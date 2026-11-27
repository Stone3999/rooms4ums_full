import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rooms4ums_mobile/core/utils/security_validators.dart';

/// Adjunto listo para enviarse como `multipart/form-data` (Práctica 7).
///
/// Se mantiene como bytes + metadatos para que `ApiService` no dependa de
/// ningún plugin de selección de archivos y pueda probarse con `MockClient`.
class PostAttachment {
  final String filename;
  final String mimeType;
  final List<int> bytes;

  const PostAttachment({
    required this.filename,
    required this.mimeType,
    required this.bytes,
  });
}

/// Cliente HTTP contra el backend NestJS desplegado en Render.
///
/// El backend aplica un prefijo global `/api` (ver `backendrooms4ums/src/main.ts`),
/// por lo que las rutas reales son `/api/rooms`, `/api/forum/...`, etc.
///
/// Todos los métodos aceptan un `client` opcional para poder inyectarse en tests.
class ApiService {
  static const String baseUrl = 'https://rooms4ums.onrender.com';

  /// Render en plan gratuito hiberna tras 15 min sin uso. El primer request
  /// tras el reposo tarda 30-90 s en despertar el contenedor, muy por encima
  /// del timeout normal. Por eso el timeout es holgado y hay un reintento.
  static const Duration _timeout = Duration(seconds: 30);

  static const Duration _retryBaseDelay = Duration(seconds: 1);
  static const int _maxNetworkRetries = 2;

  static const Map<String, String> _jsonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  /// Construye la URL final de un endpoint (base + prefijo global `/api`).
  static Uri buildUrl(String path, [Map<String, String>? query]) {
    return Uri.parse('$baseUrl/api$path').replace(queryParameters: query);
  }

  static Uri _uri(String path, [Map<String, String>? query]) => buildUrl(path, query);

  // --- Manejo de errores ---

  /// Convierte una respuesta HTTP fallida en un mensaje legible en español.
  static String _parseError(http.Response response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body['message'] != null) {
        final message = body['message'];
        if (message is List) return message.join('\n');
        return message.toString();
      }
    } catch (_) {
      // El backend puede devolver texto plano o HTML.
    }
    return 'Error ${response.statusCode} del servidor';
  }

  /// Normaliza errores de red (timeout, sin conexión) a mensajes en español.
  ///
  /// Implementa reintentos con espera exponencial (exponential backoff) para
  /// tolerar caídas breves o el arranque en frío de Render sin saturar la red.
  static Future<T> _guard<T>(
    Future<T> Function() request,
    String fallbackMessage, {
    bool retryOnNetworkError = true,
    int maxRetries = _maxNetworkRetries,
    Duration baseDelay = _retryBaseDelay,
  }) async {
    for (var attempt = 0; ; attempt++) {
      try {
        return await request();
      } on TimeoutException {
        if (retryOnNetworkError && attempt < maxRetries) {
          await Future<void>.delayed(baseDelay * (1 << attempt));
          continue;
        }
        throw Exception('El servidor tardó demasiado en responder. Intenta de nuevo.');
      } on http.ClientException {
        if (retryOnNetworkError && attempt < maxRetries) {
          await Future<void>.delayed(baseDelay * (1 << attempt));
          continue;
        }
        throw Exception('No se pudo conectar con el servidor. Revisa tu conexión.');
      } catch (e) {
        if (e is Exception && e.toString().startsWith('Exception:')) rethrow;
        throw Exception(fallbackMessage);
      }
    }
  }

  /// Desenvuelve las respuestas de listados: acepta `{ data: [...] }` o una lista suelta.
  static List<Map<String, dynamic>> _asList(Object? body) {
    final items = body is Map ? body['data'] : body;
    if (items is! List) return <Map<String, dynamic>>[];
    return items.whereType<Map<String, dynamic>>().toList();
  }

  // --- Sesión (JWT persistido) ---

  static const String _tokenKey = 'jwt_token';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> removeToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// Cierra sesión en el backend (invalida la sesión en Redis) y borra el token local.
  static Future<void> logout({http.Client? client}) async {
    final httpClient = client ?? http.Client();
    final token = await getToken();

    if (token != null) {
      try {
        await httpClient
            .post(
              _uri('/auth/logout'),
              headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
              body: '{}',
            )
            .timeout(_timeout);
      } catch (_) {
        // Si el backend no responde, cerramos sesión local de todas formas.
      }
    }

    await removeToken();
    if (client == null) httpClient.close();
  }

  /// Valida el token guardado contra el backend.
  /// Devuelve `false` si no hay token, expiró o el backend lo rechaza.
  static Future<bool> hasValidSession({http.Client? client}) async {
    final httpClient = client ?? http.Client();
    final token = await getToken();

    if (token == null || token.isEmpty) {
      if (client == null) httpClient.close();
      return false;
    }

    try {
      final response = await httpClient
          .get(
            _uri('/auth/profile'),
            headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
          )
          .timeout(_timeout);

      if (response.statusCode == 200) return true;

      // Token inválido o expirado: lo limpiamos para no arrastrar credenciales muertas.
      if (response.statusCode == 401 || response.statusCode == 403) {
        await removeToken();
      }
      return false;
    } catch (_) {
      // Sin conexión no invalidamos el token: pudo ser un corte de luz.
      return false;
    } finally {
      if (client == null) httpClient.close();
    }
  }

  // --- Auth ---

  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .post(
              _uri('/auth/login-password'),
              headers: _jsonHeaders,
              body: jsonEncode({'identifier': identifier, 'password': password}),
            )
            .timeout(_timeout);

        if (response.statusCode != 200 && response.statusCode != 201) {
          throw Exception(SecurityValidators.sanitizeAuthError(response.statusCode, _parseError(response)));
        }

        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = data['token'];
        if (token == null || token.toString().isEmpty) {
          throw Exception('El servidor no devolvió un token de sesión.');
        }
        await saveToken(token.toString());
        return data;
      }, 'No se pudo iniciar sesión. Revisa tus datos.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  static Future<Map<String, dynamic>> register({
    required String username,
    required String email,
    required String password,
    required String birthDate,
    required String country,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .post(
              _uri('/auth/register'),
              headers: _jsonHeaders,
              body: jsonEncode({
                'username': username,
                'email': email,
                'password': password,
                'birth_date': birthDate,
                'country': country,
              }),
            )
            .timeout(_timeout);

        if (response.statusCode != 200 && response.statusCode != 201) {
          throw Exception(SecurityValidators.sanitizeAuthError(response.statusCode, _parseError(response)));
        }
        return jsonDecode(response.body) as Map<String, dynamic>;
      }, 'No se pudo completar el registro.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  /// Obtiene el perfil del usuario autenticado (UID, rol, username).
  static Future<Map<String, dynamic>> getProfile({http.Client? client}) async {
    final token = await getToken();
    if (token == null || token.isEmpty) {
      throw Exception('Debes iniciar sesión para consultar el perfil.');
    }

    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .get(
              _uri('/auth/profile'),
              headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
            )
            .timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return jsonDecode(response.body) as Map<String, dynamic>;
      }, 'No se pudo obtener el perfil.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  // --- Rooms ---

  /// Devuelve las salas activas tal como las expone `RoomsService.findAllActive()`.
  /// Cada elemento trae `id`, `name`, `slug`, `description`, `icon`, `is_interactive`, `status`.
  static Future<List<Map<String, dynamic>>> getRooms({http.Client? client}) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient.get(_uri('/rooms'), headers: _jsonHeaders).timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return _asList(jsonDecode(response.body));
      }, 'No se pudieron cargar las salas.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  // --- Push remoto (tokens FCM) ---------------------------------------------

  /// Asocia el token del dispositivo con el usuario autenticado.
  /// Es idempotente: si el token ya existe, el backend lo actualiza.
  static Future<void> registerPushToken(
    String token, {
    String platform = 'android',
  }) async {
    final jwt = await getToken();
    if (jwt == null || token.isEmpty) return;

    await _guard(() async {
      final response = await http
          .post(
            _uri('/push/register'),
            headers: {..._jsonHeaders, 'Authorization': 'Bearer $jwt'},
            body: jsonEncode({'token': token, 'platform': platform}),
          )
          .timeout(_timeout);

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception(_parseError(response));
      }
    }, 'No se pudo registrar el dispositivo para notificaciones.');
  }

  /// Da de baja el dispositivo para dejar de recibir push.
  static Future<void> unregisterPushToken(String token) async {
    final jwt = await getToken();
    if (jwt == null || token.isEmpty) return;

    await _guard(() async {
      final response = await http
          .delete(
            _uri('/push/register'),
            headers: {..._jsonHeaders, 'Authorization': 'Bearer $jwt'},
            body: jsonEncode({'token': token}),
          )
          .timeout(_timeout);
      if (response.statusCode != 200) throw Exception(_parseError(response));
    }, 'No se pudo dar de baja el dispositivo.');
  }

  // --- Forum / Posts ---

  /// Posts de una sala. El backend responde `{ data: [...], total: n }`.
  static Future<List<Map<String, dynamic>>> getPosts(
    String roomId, {
    int page = 1,
    int limit = 20,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .get(
              _uri('/forum/rooms/$roomId/posts', {'page': '$page', 'limit': '$limit'}),
              headers: _jsonHeaders,
            )
            .timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return _asList(jsonDecode(response.body));
      }, 'No se pudieron cargar las publicaciones.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  static Future<Map<String, dynamic>> getPost(String postId, {http.Client? client}) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response =
            await httpClient.get(_uri('/forum/posts/$postId'), headers: _jsonHeaders).timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return jsonDecode(response.body) as Map<String, dynamic>;
      }, 'No se pudo cargar la publicación.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  /// Posts más vistos del sitio.
  static Future<List<Map<String, dynamic>>> getPopularPosts({
    int limit = 10,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .get(_uri('/forum/popular', {'limit': '$limit'}), headers: _jsonHeaders)
            .timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return _asList(jsonDecode(response.body));
      }, 'No se pudieron cargar los posts populares.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  /// Posts más recientes de todo el sitio.
  static Future<List<Map<String, dynamic>>> getRecentPosts({
    int limit = 20,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .get(_uri('/forum/recent', {'limit': '$limit'}), headers: _jsonHeaders)
            .timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return _asList(jsonDecode(response.body));
      }, 'No se pudieron cargar los posts recientes.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  static String generateIdempotencyKey() {
    return 'req_${DateTime.now().microsecondsSinceEpoch}';
  }

  /// Crea un post. Requiere sesión activa (JWT) e incluye clave de idempotencia.
  ///
  /// Si se envían adjuntos usa `multipart/form-data` con el campo `files`, que
  /// es exactamente lo que espera `FilesInterceptor('files', 5)` del backend
  /// (Práctica 7). Sin adjuntos conserva el contrato JSON original.
  static Future<Map<String, dynamic>> createPost({
    required String roomId,
    required String title,
    required String content,
    String? status,
    String? priority,
    String? idempotencyKey,
    List<PostAttachment> attachments = const <PostAttachment>[],
    http.Client? client,
  }) async {
    final token = await getToken();
    if (token == null) throw Exception('Debes iniciar sesión para publicar.');

    final attachmentError = SecurityValidators.validateAttachmentList(attachments.length);
    if (attachmentError != null) throw Exception(attachmentError);
    for (final attachment in attachments) {
      final error = SecurityValidators.validateAttachment(
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        bytes: attachment.bytes.length,
      );
      if (error != null) throw Exception(error);
    }

    final key = idempotencyKey ?? generateIdempotencyKey();
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final http.Response response;
        if (attachments.isEmpty) {
          final payload = <String, dynamic>{
            'roomId': roomId,
            'title': title,
            'content': content,
            'status': ?status,
            'priority': ?priority,
          };
          response = await httpClient
              .post(
                _uri('/forum/posts'),
                headers: {
                  ..._jsonHeaders,
                  'Authorization': 'Bearer $token',
                  'X-Idempotency-Key': key,
                },
                body: jsonEncode(payload),
              )
              .timeout(_timeout);
        } else {
          final request = http.MultipartRequest('POST', _uri('/forum/posts'))
            ..headers.addAll({
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
              'X-Idempotency-Key': key,
            })
            ..fields['roomId'] = roomId
            ..fields['title'] = title
            ..fields['content'] = content;
          if (status != null) request.fields['status'] = status;
          if (priority != null) request.fields['priority'] = priority;
          for (final attachment in attachments) {
            request.files.add(
              http.MultipartFile.fromBytes(
                'files',
                attachment.bytes,
                filename: attachment.filename,
                contentType: MediaType.parse(attachment.mimeType),
              ),
            );
          }
          final streamed = await httpClient.send(request).timeout(_timeout);
          response = await http.Response.fromStream(streamed);
        }

        if (response.statusCode != 200 && response.statusCode != 201) {
          throw Exception(_parseError(response));
        }
        return jsonDecode(response.body) as Map<String, dynamic>;
      }, 'No se pudo publicar el mensaje.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  /// Actualiza un post propio (estado, prioridad, título o contenido).
  static Future<Map<String, dynamic>> updatePost(
    String postId,
    Map<String, dynamic> updates, {
    http.Client? client,
  }) async {
    final token = await getToken();
    if (token == null) throw Exception('Debes iniciar sesión para editar.');

    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .patch(
              _uri('/forum/posts/$postId'),
              headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
              body: jsonEncode(updates),
            )
            .timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return jsonDecode(response.body) as Map<String, dynamic>;
      }, 'No se pudo actualizar el post.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  /// Elimina un post propio.
  static Future<void> deletePost(String postId, {http.Client? client}) async {
    final token = await getToken();
    if (token == null) throw Exception('Debes iniciar sesión para eliminar.');

    final httpClient = client ?? http.Client();
    try {
      await _guard(() async {
        final response = await httpClient
            .delete(
              _uri('/forum/posts/$postId'),
              headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
            )
            .timeout(_timeout);
        if (response.statusCode != 200 && response.statusCode != 204) {
          throw Exception(_parseError(response));
        }
      }, 'No se pudo eliminar el post.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  // --- Comentarios ---

  static Future<List<Map<String, dynamic>>> getComments(
    String postId, {
    int page = 1,
    int limit = 20,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      return await _guard(() async {
        final response = await httpClient
            .get(
              _uri('/forum/posts/$postId/comments', {'page': '$page', 'limit': '$limit'}),
              headers: _jsonHeaders,
            )
            .timeout(_timeout);
        if (response.statusCode != 200) throw Exception(_parseError(response));
        return _asList(jsonDecode(response.body));
      }, 'No se pudieron cargar los comentarios.');
    } finally {
      if (client == null) httpClient.close();
    }
  }

  static Future<void> createComment(
    String postId,
    String content, {
    String? idempotencyKey,
    http.Client? client,
  }) async {
    final token = await getToken();
    if (token == null) throw Exception('Debes iniciar sesión para comentar.');

    final key = idempotencyKey ?? generateIdempotencyKey();
    final httpClient = client ?? http.Client();
    try {
      await _guard(() async {
        final response = await httpClient
            .post(
              _uri('/forum/posts/$postId/comments'),
              headers: {
                ..._jsonHeaders,
                'Authorization': 'Bearer $token',
                'X-Idempotency-Key': key,
              },
              body: jsonEncode({'content': content}),
            )
            .timeout(_timeout);
        if (response.statusCode != 200 && response.statusCode != 201) {
          throw Exception(_parseError(response));
        }
      }, 'No se pudo enviar el comentario.');
    } finally {
      if (client == null) httpClient.close();
    }
  }
}
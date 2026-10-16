import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/deep_link_service.dart';
import 'package:rooms4ums_mobile/data/local/image_cache.dart';
import 'package:rooms4ums_mobile/main.dart';
import 'package:rooms4ums_mobile/ui/widgets/post_card.dart';

MockClient _client(Future<http.Response> Function(http.Request request) handler) {
  return MockClient((request) async => handler(request));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Contrato con el backend', () {
    test('las rutas anteponen el prefijo global /api', () {
      expect(ApiService.buildUrl('/rooms').toString(), 'https://rooms4ums.onrender.com/api/rooms');
      expect(
        ApiService.buildUrl('/auth/login-password').toString(),
        'https://rooms4ums.onrender.com/api/auth/login-password',
      );
    });

    test('los posts se piden por slug con paginación', () async {
      late Uri captured;
      final client = _client((request) async {
        captured = request.url;
        return http.Response(jsonEncode({'data': [], 'total': 0}), 200);
      });

      await ApiService.getPosts('general', page: 2, limit: 5, client: client);

      expect(captured.path, '/api/forum/rooms/general/posts');
      expect(captured.queryParameters['page'], '2');
      expect(captured.queryParameters['limit'], '5');
    });
  });

  group('Login', () {
    test('persiste el token cuando las credenciales son válidas', () async {
      SharedPreferences.setMockInitialValues({});

      final client = _client((request) async => http.Response(
            jsonEncode({'token': 'jwt-de-prueba', 'user': {'id': 1}}),
            200,
          ));

      await ApiService.login(client: client, identifier: 'dave', password: '123456');
      expect(await ApiService.getToken(), 'jwt-de-prueba');
    });

    test('no guarda token si el backend rechaza las credenciales', () async {
      SharedPreferences.setMockInitialValues({});

      final client = _client((request) async => http.Response(
            jsonEncode({'statusCode': 401, 'message': 'Credenciales inválidas'}),
            401,
          ));

      await expectLater(
        ApiService.login(client: client, identifier: 'nope', password: 'mal'),
        throwsA(predicate((e) => e.toString().contains('Credenciales inválidas'))),
      );
      expect(await ApiService.getToken(), isNull);
    });
  });

  group('Posts', () {
    test('desenvuelve el campo data que devuelve el backend', () async {
      final client = _client((request) async => http.Response(
            jsonEncode({
              'data': [
                {'_id': 'a1', 'title': 'Hola', 'content': 'Mundo', 'commentCount': 2},
              ],
              'total': 1,
            }),
            200,
          ));

      final posts = await ApiService.getPosts('general', client: client);
      expect(posts, hasLength(1));
      expect(posts.first['title'], 'Hola');
    });

    test('tolera una lista suelta por si el backend cambia', () async {
      final client = _client(
        (request) async => http.Response(jsonEncode([{'_id': 'b2', 'title': 'Directo'}]), 200),
      );

      final posts = await ApiService.getPosts('general', client: client);
      expect(posts.first['title'], 'Directo');
    });
  });

  group('Sesión', () {
    test('sin token no hay sesión', () async {
      SharedPreferences.setMockInitialValues({});
      expect(await ApiService.hasValidSession(), isFalse);
    });

    test('borra el token si el backend responde 401', () async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'token-muerto'});

      final client = _client((request) async => http.Response('{}', 401));

      expect(await ApiService.hasValidSession(client: client), isFalse);
      expect(await ApiService.getToken(), isNull);
    });
  });

  // PRÁCTICA 3 - URLs preasignadas
  group('Deep links', () {
    test('construye la URL de un post con su sala', () {
      expect(
        DeepLinkService.shareLinkForPost('abc123', roomSlug: 'general'),
        'rooms4ums://post/abc123?room=general',
      );
    });

    test('construye la URL de una sala', () {
      expect(DeepLinkService.shareLinkForRoom('lab'), 'rooms4ums://room/lab');
    });

    test('la URL generada se vuelve a interpretar sin perder el destino', () {
      final link = DeepLinkService.shareLinkForPost('abc123', roomSlug: 'general');
      final parsed = DeepLink.tryParse(link);

      expect(parsed, isA<DeepLinkPost>());
      final post = parsed! as DeepLinkPost;
      expect(post.id, 'abc123');
      expect(post.roomSlug, 'general');
    });

    test('reconoce las cuatro rutas registradas en el manifest', () {
      expect(DeepLink.tryParse('rooms4ums://room/lab'), isA<DeepLinkRoom>());
      expect(DeepLink.tryParse('rooms4ums://post/xyz'), isA<DeepLinkPost>());
      expect(DeepLink.tryParse('rooms4ums://popular'), isA<DeepLinkPopular>());
      expect(DeepLink.tryParse('rooms4ums://home'), isA<DeepLinkHome>());
    });

    test('acepta también el formato https por si se usa universal links', () {
      final parsed = DeepLink.tryParse('https://rooms4ums.com/room/general');
      expect(parsed, isA<DeepLinkRoom>());
      expect((parsed! as DeepLinkRoom).slug, 'general');
    });

    test('devuelve null en rutas desconocidas o incompletas', () {
      expect(DeepLink.tryParse('rooms4ums://inexistente/1'), isNull);
      expect(DeepLink.tryParse('rooms4ums://room'), isNull);
      expect(DeepLink.tryParse('no-es-una-url'), isNull);
    });
  });

  // Práctica 3 + push: vista previa de la foto del post en el reloj.
  group('Imagen de la notificación', () {
    test('detecta el primer adjunto que sea imagen', () {
      final post = {
        'attachments': [
          {'url': 'https://cdn.test/documento.pdf', 'type': 'application/pdf'},
          {'url': 'https://cdn.test/foto.jpg', 'type': 'image/jpeg'},
        ],
      };
      expect(firstImageUrl(post), 'https://cdn.test/foto.jpg');
    });

    test('infiere que es imagen cuando el backend no manda el tipo', () {
      final post = {
        'attachments': [
          {'url': 'https://cdn.test/6a7e4ef406ccc420.png'},
        ],
      };
      expect(firstImageUrl(post), 'https://cdn.test/6a7e4ef406ccc420.png');
    });

    test('devuelve null si no hay imagen o no hay adjuntos', () {
      expect(firstImageUrl({'attachments': <dynamic>[]}), isNull);
      expect(firstImageUrl({}), isNull);
      expect(
        firstImageUrl({
          'attachments': [
            {'url': 'https://cdn.test/a.pdf', 'type': 'application/pdf'},
          ],
        }),
        isNull,
      );
    });

    test('el nombre de sala de la notificación va en mayúsculas', () {
      expect(resolveRoomName({'roomId': 'general'}), 'GENERAL');
      expect(resolveRoomName({}), 'FORO');
    });
  });

  group('Widgets', () {
    testWidgets('la landing ofrece login y registro', (tester) async {
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(const Rooms4umsApp());
      await tester.pump();

      expect(find.text('ROOMS4UMS'), findsOneWidget);
      expect(find.text('INICIAR SESIÓN'), findsOneWidget);
      expect(find.text('REGISTRARSE'), findsOneWidget);
    });
  });

  group('Utilidades', () {
    test('formatRelativeDate humaniza fechas recientes', () {
      final now = DateTime.now();
      expect(formatRelativeDate(now.toIso8601String()), 'ahora');
      expect(
        formatRelativeDate(now.subtract(const Duration(minutes: 5)).toIso8601String()),
        'hace 5 min',
      );
      expect(formatRelativeDate(null), '');
      expect(formatRelativeDate('no-es-fecha'), '');
    });

    test('truncate recorta agregando puntos suspensivos', () {
      expect(truncate('hola', 10), 'hola');
      expect(truncate('hola mundo entero', 5), 'hola ...');
    });
  });
}
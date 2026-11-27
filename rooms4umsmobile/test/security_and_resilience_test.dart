import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_theme.dart';
import 'package:rooms4ums_mobile/core/utils/security_validators.dart';
import 'package:rooms4ums_mobile/ui/screens/login_screen.dart';
import 'package:rooms4ums_mobile/ui/screens/wearable_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Práctica 5 - Validadores de código seguro', () {
    test('rechaza usuario vacío o compuesto únicamente por espacios', () {
      expect(SecurityValidators.validateIdentifier(null), isNotNull);
      expect(SecurityValidators.validateIdentifier(''), isNotNull);
      expect(SecurityValidators.validateIdentifier('     '), isNotNull);
      expect(SecurityValidators.validateIdentifier('usuario_valido'), isNull);
    });

    test('rechaza contraseñas menores a 8 caracteres o mayores a 64', () {
      expect(SecurityValidators.validatePassword(null), isNotNull);
      expect(SecurityValidators.validatePassword('        '), isNotNull);
      expect(SecurityValidators.validatePassword('1234567'), isNotNull);
      expect(SecurityValidators.validatePassword('a' * 65), isNotNull);
      expect(SecurityValidators.validatePassword('claveSegura1'), isNull);
    });

    test('rechaza correos mal formados o mensajes vacíos', () {
      expect(SecurityValidators.validateEmail('sin-arroba'), isNotNull);
      expect(SecurityValidators.validateEmail('valido@uteq.edu.mx'), isNull);
      expect(SecurityValidators.validateMessage('   '), isNotNull);
      expect(SecurityValidators.validateMessage('a' * 501), isNotNull);
      expect(SecurityValidators.validateMessage('Mensaje de prueba'), isNull);
    });

    test('sanitiza errores de autenticación sin filtrar detalles técnicos', () {
      expect(
        SecurityValidators.sanitizeAuthError(401, 'SQL error at line 42'),
        'Credenciales inválidas o acceso no autorizado.',
      );
      expect(
        SecurityValidators.sanitizeAuthError(500, '<html>stack trace</html>'),
        'Servicio temporalmente no disponible. Intenta más tarde.',
      );
    });

    testWidgets('LoginScreen rechaza espacios y contraseña menor a 8 caracteres', (tester) async {
      await tester.pumpWidget(MaterialApp(theme: AppTheme.darkRetroTheme, home: const LoginScreen()));

      await tester.enterText(find.byType(TextFormField).at(0), '   ');
      await tester.enterText(find.byType(TextFormField).at(1), '1234');
      await tester.tap(find.text('ENTRAR'));
      await tester.pump();

      expect(find.text('Escribe tu usuario o correo'), findsOneWidget);
      expect(find.text('Mínimo 8 caracteres'), findsOneWidget);
    });
  });

  group('Wear OS - Avisos de publicaciones', () {
    testWidgets('solo presenta la activación de avisos, sin estado del enlace ni llamadas', (tester) async {
      await tester.pumpWidget(MaterialApp(theme: AppTheme.darkRetroTheme, home: const WearableScreen()));
      await tester.pump();

      expect(find.byType(TextField), findsNothing);
      expect(find.text('AVISOS DE PUBLICACIONES'), findsOneWidget);
      expect(find.text('ACTIVAR AVISOS EN EL RELOJ'), findsOneWidget);
      expect(find.textContaining('ENLACE ACTIVO'), findsNothing);
      expect(find.textContaining('EN LLAMADA'), findsNothing);
    });
  });

  group('Práctica 9, 10 y 12 - API CRUD, Seguridad e Idempotencia', () {
    test('createPost envía X-Idempotency-Key y conserva la clave en reintentos', () async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'jwt-ok'});
      var attempts = 0;
      final seenKeys = <String?>[];

      final client = MockClient((request) async {
        attempts++;
        seenKeys.add(request.headers['X-Idempotency-Key']);
        if (attempts == 1) {
          throw TimeoutException('cold start');
        }
        return http.Response(jsonEncode({'_id': 'post1', 'title': 'PRUEBA_A_001'}), 201);
      });

      final created = await ApiService.createPost(
        roomId: 'general',
        title: 'PRUEBA_A_001',
        content: 'Contenido de prueba',
        idempotencyKey: 'key-fija-123',
        client: client,
      );

      expect(attempts, 2);
      expect(seenKeys, ['key-fija-123', 'key-fija-123']);
      expect(created['_id'], 'post1');
    });

    test('updatePost envía PATCH con JWT y propaga 403 ante acceso ajeno', () async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'jwt-usuario-a'});

      final client = MockClient((request) async {
        expect(request.method, 'PATCH');
        expect(request.url.path, '/api/forum/posts/postB');
        expect(request.headers['Authorization'], 'Bearer jwt-usuario-a');
        return http.Response(
          jsonEncode({'statusCode': 403, 'message': 'No tienes permiso para modificar este registro'}),
          403,
        );
      });

      await expectLater(
        ApiService.updatePost('postB', {'status': 'EN_PROCESO'}, client: client),
        throwsA(predicate((e) => e.toString().contains('No tienes permiso'))),
      );
    });

    test('deletePost acepta respuesta 204 No Content', () async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'jwt-usuario-a'});

      final client = MockClient((request) async {
        expect(request.method, 'DELETE');
        expect(request.url.path, '/api/forum/posts/postA');
        return http.Response('', 204);
      });

      await ApiService.deletePost('postA', client: client);
    });
  });

  group('Práctica 7 - Adjuntos multipart y roles', () {
    test('valida formato, tamaño y cantidad de imágenes', () {
      expect(
        SecurityValidators.validateAttachment(filename: 'nota.txt', mimeType: 'text/plain', bytes: 10),
        isNotNull,
      );
      expect(
        SecurityValidators.validateAttachment(filename: 'foto.png', mimeType: 'image/png', bytes: 0),
        isNotNull,
      );
      expect(
        SecurityValidators.validateAttachment(
          filename: 'foto.png',
          mimeType: 'image/png',
          bytes: SecurityValidators.maxAttachmentBytes + 1,
        ),
        isNotNull,
      );
      expect(
        SecurityValidators.validateAttachment(filename: 'foto.webp', mimeType: 'image/webp', bytes: 1024),
        isNull,
      );
      expect(SecurityValidators.validateAttachmentList(6), isNotNull);
      expect(SecurityValidators.validateAttachmentList(5), isNull);
    });

    test('createPost envía multipart/form-data con el campo files (Práctica 7)', () async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'jwt-ok'});

      late http.Request captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(jsonEncode({'_id': 'post-img', 'attachments': 1}), 201);
      });

      final created = await ApiService.createPost(
        roomId: 'general',
        title: 'Incidencia con evidencia',
        content: 'Adjunto la captura del error',
        idempotencyKey: 'key-img-1',
        attachments: const [
          PostAttachment(filename: 'captura.png', mimeType: 'image/png', bytes: [137, 80, 78, 71]),
        ],
        client: client,
      );

      expect(created['_id'], 'post-img');
      expect(captured.method, 'POST');
      expect(captured.url.path, '/api/forum/posts');
      expect(captured.headers['Authorization'], 'Bearer jwt-ok');
      expect(captured.headers['X-Idempotency-Key'], 'key-img-1');
      expect(captured.headers['content-type'], contains('multipart/form-data'));

      final body = latin1.decode(captured.bodyBytes);
      expect(body, contains('name="files"'));
      expect(body, contains('filename="captura.png"'));
      expect(body, contains('name="roomId"'));
      expect(body, contains('name="title"'));
      expect(body, contains('name="content"'));
    });

    test('rechaza adjuntos fuera de política antes de tocar la red', () async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'jwt-ok'});
      var called = false;
      final client = MockClient((request) async {
        called = true;
        return http.Response('{}', 201);
      });

      await expectLater(
        ApiService.createPost(
          roomId: 'general',
          title: 't',
          content: 'c',
          attachments: const [
            PostAttachment(filename: 'video.mp4', mimeType: 'video/mp4', bytes: [1, 2, 3]),
          ],
          client: client,
        ),
        throwsA(predicate((e) => e.toString().contains('JPG, PNG o WebP'))),
      );
      expect(called, isFalse);
    });
  });
}

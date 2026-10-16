import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// PRÁCTICA 4 - Almacenamiento estructurado local.
///
/// Sustituye al `SharedPreferences` (que solo guarda el token) por una base
/// SQLite con esquema definido, índices y consultas reales. Sirve como caché
/// de salas y posts para lectura offline, con invalidación por TTL.
///
/// Esquema:
///   rooms_cache  -> id (TEXT PK), slug, name, description, icon,
///                   is_interactive, fetched_at
///   posts_cache  -> id (TEXT PK), room_id, title, content, author_name,
///                   comment_count, view_count, created_at, fetched_at
///
/// Índices sobre (room_id) y (fetched_at) para consultas de feed y de TTL.
class LocalDatabase {
  LocalDatabase._();

  static final LocalDatabase instance = LocalDatabase._();

  static const String _fileName = 'rooms4ums.db';
  static const int _version = 1;

  /// Tiempo máximo que se considera fresco un registro cacheado.
  static const Duration roomsTtl = Duration(hours: 6);
  static const Duration postsTtl = Duration(minutes: 15);

  Database? _db;

  Future<Database> get database async {
    return _db ??= await _open();
  }

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, _fileName),
      version: _version,
      onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE rooms_cache (
            id             TEXT PRIMARY KEY,
            slug           TEXT NOT NULL,
            name           TEXT NOT NULL,
            description    TEXT,
            icon           TEXT,
            is_interactive INTEGER NOT NULL DEFAULT 0,
            fetched_at     INTEGER NOT NULL
          )
        ''');

        await db.execute('''
          CREATE TABLE posts_cache (
            id            TEXT PRIMARY KEY,
            room_id       TEXT NOT NULL,
            title         TEXT NOT NULL,
            content       TEXT,
            author_name   TEXT,
            comment_count INTEGER NOT NULL DEFAULT 0,
            view_count    INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT,
            fetched_at    INTEGER NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms_cache (id)
          )
        ''');

        await db.execute('CREATE INDEX idx_posts_room ON posts_cache (room_id, created_at DESC)');
        await db.execute('CREATE INDEX idx_posts_fetched ON posts_cache (fetched_at)');
      },
    );
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }

  // --- Rooms -----------------------------------------------------------------

  /// Guarda las salas del backend. Reemplaza el snapshot completo para
  /// que una sala borrada en el servidor no sobreviva en el dispositivo.
  Future<void> cacheRooms(List<Map<String, dynamic>> rooms) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;

    await db.transaction((txn) async {
      await txn.delete('rooms_cache');
      for (final room in rooms) {
        final slug = (room['slug'] ?? room['id'] ?? '').toString();
        if (slug.isEmpty) continue;

        await txn.insert(
          'rooms_cache',
          {
            'id': slug,
            'slug': slug,
            'name': (room['name'] ?? slug).toString(),
            'description': room['description']?.toString(),
            'icon': room['icon']?.toString(),
            'is_interactive': room['is_interactive'] == true ? 1 : 0,
            'fetched_at': now,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  Future<List<Map<String, dynamic>>> cachedRooms({bool onlyFresh = true}) async {
    final db = await database;
    final rows = await db.query(
      'rooms_cache',
      where: onlyFresh ? 'fetched_at >= ?' : null,
      whereArgs: onlyFresh ? [_since(roomsTtl)] : null,
      orderBy: 'name ASC',
    );
    return rows;
  }

  // --- Posts -----------------------------------------------------------------

  Future<void> cachePosts(List<Map<String, dynamic>> posts, {required String roomId}) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;

    await db.transaction((txn) async {
      for (final post in posts) {
        final id = (post['_id'] ?? post['id'] ?? '').toString();
        if (id.isEmpty) continue;

        await txn.insert(
          'posts_cache',
          {
            'id': id,
            'room_id': roomId,
            'title': (post['title'] ?? 'SIN TÍTULO').toString(),
            'content': post['content']?.toString(),
            'author_name': post['authorName']?.toString(),
            'comment_count': _asInt(post['commentCount']),
            'view_count': _asInt(post['viewCount']),
            'created_at': post['createdAt']?.toString(),
            'fetched_at': now,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      // Poda: fuera los posts viejos de esta sala que ya no vinieron del servidor.
      await txn.delete(
        'posts_cache',
        where: 'room_id = ? AND fetched_at < ?',
        whereArgs: [roomId, now],
      );
    });
  }

  Future<List<Map<String, dynamic>>> cachedPosts(String roomId, {bool onlyFresh = true}) async {
    final db = await database;
    final rows = await db.query(
      'posts_cache',
      where: onlyFresh
          ? 'room_id = ? AND fetched_at >= ?'
          : 'room_id = ?',
      whereArgs: onlyFresh ? [roomId, _since(postsTtl)] : [roomId],
      orderBy: 'created_at DESC',
      limit: 50,
    );
    return rows;
  }

  /// Marca los posts ya notificados para no repetir la alerta.
  Future<void> markNotified(Set<String> postIds) async {
    if (postIds.isEmpty) return;
    final db = await database;
    final placeholders = List.filled(postIds.length, '?').join(',');
    await db.rawUpdate(
      'UPDATE posts_cache SET fetched_at = ? WHERE id IN ($placeholders)',
      [_since(Duration.zero), ...postIds],
    );
  }

  /// Borra registros que ya superaron su TTL. Se ejecuta al arrancar.
  Future<int> purgeExpired() async {
    final db = await database;
    final rooms = await db.delete('rooms_cache', where: 'fetched_at < ?', whereArgs: [_since(roomsTtl)]);
    final posts = await db.delete('posts_cache', where: 'fetched_at < ?', whereArgs: [_since(postsTtl)]);
    return rooms + posts;
  }

  Future<Map<String, int>> stats() async {
    final db = await database;
    final rooms = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM rooms_cache')) ?? 0;
    final posts = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM posts_cache')) ?? 0;
    return {'rooms': rooms, 'posts': posts};
  }

  // --- Utilidades ------------------------------------------------------------

  static int _since(Duration ttl) =>
      DateTime.now().subtract(ttl).millisecondsSinceEpoch;

  static int _asInt(Object? value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  /// Convierte una fila de `posts_cache` al mismo formato que devuelve la API,
  /// para que los widgets puedan pintar igual online u offline.
  static Map<String, dynamic> postFromRow(Map<String, Object?> row) {
    return {
      '_id': row['id'],
      'title': row['title'],
      'content': row['content'],
      'authorName': row['author_name'],
      'commentCount': row['comment_count'],
      'viewCount': row['view_count'],
      'createdAt': row['created_at'],
      'roomId': row['room_id'],
      '_fromCache': true,
    };
  }

  static Map<String, dynamic> roomFromRow(Map<String, Object?> row) {
    return {
      'id': row['id'],
      'slug': row['slug'],
      'name': row['name'],
      'description': row['description'],
      'icon': row['icon'],
      'is_interactive': row['is_interactive'] == 1,
      '_fromCache': true,
    };
  }

  /// Serializa un deep link como payload de notificación.
  static String encodeLink(Map<String, dynamic> data) => jsonEncode(data);
}
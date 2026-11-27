import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/new_post_watcher.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/core/utils/security_validators.dart';
import 'package:rooms4ums_mobile/data/local/local_database.dart';
import 'package:rooms4ums_mobile/ui/screens/post_detail_screen.dart';
import 'package:rooms4ums_mobile/ui/widgets/post_card.dart';

/// Feed de una sala. Lee posts reales del backend y permite publicar si hay sesión.
class RoomScreen extends StatefulWidget {
  final String roomId;
  final String roomName;
  final bool isInteractive;
  final String? roomSlug;

  const RoomScreen({
    super.key,
    required this.roomId,
    required this.roomName,
    this.isInteractive = true,
    this.roomSlug,
  });

  @override
  State<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  late Future<List<Map<String, dynamic>>> _postsFuture;
  bool _isLoggedIn = false;

  /// PRÁCTICA 4: true cuando el contenido proviene de la caché local.
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _postsFuture = _fetchPosts();
    ApiService.getToken().then((token) {
      if (mounted) setState(() => _isLoggedIn = token != null && token.isNotEmpty);
    });
  }

  void _load() {
    setState(() {
      _postsFuture = _fetchPosts();
    });
  }

  Future<List<Map<String, dynamic>>> _fetchPosts() async {
    // Red primero. Si falla, se sirve la caché local (PRÁCTICA 4).
    setState(() => _isOffline = false);

    try {
      final posts = await _fetchFromNetwork();

      if (posts.isNotEmpty) {
        await LocalDatabase.instance.cachePosts(posts, roomId: _cacheKey);
        // Lo que el usuario está viendo no debe generar push.
        NewPostWatcher.instance.markAsSeen(
          posts.map((p) => (p['_id'] ?? '').toString()).where((e) => e.isNotEmpty),
        );
      }

      return posts;
    } catch (e) {
      final cached = await LocalDatabase.instance.cachedPosts(_cacheKey);
      if (cached.isEmpty) rethrow;
      if (mounted) setState(() => _isOffline = true);
      return cached.map(LocalDatabase.postFromRow).toList();
    }
  }

  /// La clave de caché incluye el slug alterno para no duplicar entradas.
  String get _cacheKey => widget.roomSlug ?? widget.roomId;

  Future<List<Map<String, dynamic>>> _fetchFromNetwork() async {
    // Si la sala viene con slug o id, intentamos obtener los posts
    try {
      final posts = await ApiService.getPosts(widget.roomId);
      if (posts.isNotEmpty) return posts;
      // Si vino vacío y tenemos slug alternativo, intentamos con el slug
      if (widget.roomSlug != null && widget.roomSlug != widget.roomId) {
        return await ApiService.getPosts(widget.roomSlug!);
      }
      return posts;
    } catch (e) {
      // Reintentar con slug alterno si el primario falló
      if (widget.roomSlug != null && widget.roomSlug != widget.roomId) {
        try {
          return await ApiService.getPosts(widget.roomSlug!);
        } catch (_) {}
      }
      rethrow;
    }
  }

  Future<void> _refresh() async {
    _load();
    try {
      await _postsFuture;
    } catch (_) {
      // El error ya se maneja dentro de _fetchPosts.
    }
  }

  Future<void> _openComposer() async {
    final messenger = ScaffoldMessenger.of(context);
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PostComposer(roomId: widget.roomId),
    );

    if (created == true) {
      _refresh();
      messenger.showSnackBar(
        const SnackBar(content: Text('PUBLICADO CORRECTAMENTE')),
      );
    }
  }

  void _openPost(Map<String, dynamic> post) {
    final postId = (post['_id'] ?? post['id'] ?? post['postId'] ?? '').toString();
    if (postId.isEmpty) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PostDetailScreen(postId: postId, preview: post),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.roomName.toUpperCase()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), tooltip: 'Actualizar', onPressed: _refresh),
        ],
      ),
      floatingActionButton: _isLoggedIn
          ? FloatingActionButton.extended(
              onPressed: _openComposer,
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.black,
              shape: const BeveledRectangleBorder(),
              icon: const Icon(Icons.add, size: 18),
              label: const Text(
                'NUEVO POST',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 1),
              ),
            )
          : null,
      body: SafeArea(
        child: Column(
          children: [
            _RoomBanner(
              roomName: widget.roomName,
              isInteractive: widget.isInteractive,
              isLoggedIn: _isLoggedIn,
              isOffline: _isOffline,
            ),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.accent,
                backgroundColor: AppColors.bgSecondary,
                onRefresh: _refresh,
                child: FutureBuilder<List<Map<String, dynamic>>>(
                  future: _postsFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(
                        child: CircularProgressIndicator(color: AppColors.accent),
                      );
                    }

                    if (snapshot.hasError) {
                      return _FeedMessage(
                        icon: Icons.cloud_off,
                        message: snapshot.error.toString().replaceFirst('Exception: ', ''),
                        onRetry: _refresh,
                      );
                    }

                    final posts = snapshot.data ?? const <Map<String, dynamic>>[];
                    if (posts.isEmpty) {
                      return _FeedMessage(
                        icon: Icons.inbox,
                        message: _isLoggedIn
                            ? 'AÚN NO HAY POSTS EN ESTA SALA.\n¡SÉ EL PRIMERO EN PUBLICAR!'
                            : 'AÚN NO HAY POSTS EN ESTA SALA.\nINICIA SESIÓN PARA PUBLICAR EL TUYO.',
                      );
                    }

                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: posts.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final post = posts[index];
                        return PostCard(post: post, onTap: () => _openPost(post));
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoomBanner extends StatelessWidget {
  final String roomName;
  final bool isInteractive;
  final bool isLoggedIn;
  final bool isOffline;

  const _RoomBanner({
    required this.roomName,
    required this.isInteractive,
    required this.isLoggedIn,
    this.isOffline = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.bgSecondary,
        border: Border(bottom: BorderSide(color: AppColors.winBorder, width: 2)),
      ),
      child: Row(
        children: [
          Icon(
            isInteractive ? Icons.forum : Icons.lock_outline,
            size: 16,
            color: isInteractive ? AppColors.accent : AppColors.textSecondary,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isOffline
                  ? 'SIN CONEXIÓN · CACHÉ LOCAL'
                  : isLoggedIn
                      ? 'SESIÓN ACTIVA · PUEDES PUBLICAR'
                      : 'MODO INVITADO · SOLO LECTURA',
              style: TextStyle(
                color: isOffline || isLoggedIn ? AppColors.accent : AppColors.textSecondary,
                fontSize: 10,
                letterSpacing: 1,
              ),
            ),
          ),
          if (isOffline)
            const Icon(Icons.cloud_off, size: 13, color: AppColors.accent)
          else if (!isInteractive)
            const Text(
              'SALA NO INTERACTIVA',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 9),
            ),
        ],
      ),
    );
  }
}

class _FeedMessage extends StatelessWidget {
  final IconData icon;
  final String message;
  final VoidCallback? onRetry;

  const _FeedMessage({required this.icon, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, color: AppColors.textSecondary, size: 40),
                  const SizedBox(height: 16),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.6),
                  ),
                  if (onRetry != null) ...[
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('REINTENTAR'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Hoja inferior para redactar un post nuevo.
class _PostComposer extends StatefulWidget {
  final String roomId;

  const _PostComposer({required this.roomId});

  @override
  State<_PostComposer> createState() => _PostComposerState();
}

class _PostComposerState extends State<_PostComposer> {
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _picker = ImagePicker();
  final List<PostAttachment> _attachments = <PostAttachment>[];
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  /// Tipo MIME a partir de la extensión: `image_picker` no siempre lo informa.
  String _mimeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  /// PRÁCTICA 7: selección y validación de adjuntos antes de enviarlos.
  Future<void> _pickImages() async {
    if (_attachments.length >= SecurityValidators.maxAttachments) {
      setState(() => _error = 'Máximo ${SecurityValidators.maxAttachments} imágenes por publicación.');
      return;
    }

    try {
      final files = await _picker.pickMultiImage(imageQuality: 85, maxWidth: 1600);
      if (files.isEmpty) return;

      final selected = <PostAttachment>[];
      String? validationError;

      for (final file in files) {
        if (_attachments.length + selected.length >= SecurityValidators.maxAttachments) {
          validationError = 'Máximo ${SecurityValidators.maxAttachments} imágenes por publicación.';
          break;
        }
        final bytes = await file.readAsBytes();
        final mimeType = file.mimeType ?? _mimeFromName(file.name);
        final error = SecurityValidators.validateAttachment(
          filename: file.name,
          mimeType: mimeType,
          bytes: bytes.length,
        );
        if (error != null) {
          validationError = '${file.name}: $error';
          continue;
        }
        selected.add(PostAttachment(filename: file.name, mimeType: mimeType, bytes: bytes));
      }

      if (!mounted) return;
      setState(() {
        _attachments.addAll(selected);
        _error = validationError;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo abrir la galería del dispositivo.');
    }
  }

  void _removeAttachment(int index) {
    setState(() => _attachments.removeAt(index));
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();

    if (title.isEmpty || content.isEmpty) {
      setState(() => _error = 'El título y el contenido son obligatorios.');
      return;
    }
    final titleError = SecurityValidators.validateMessage(
      title,
      maxLength: SecurityValidators.maxTitleLength,
      emptyMessage: 'El título es obligatorio.',
    );
    if (titleError != null) {
      setState(() => _error = titleError);
      return;
    }
    final contentError = SecurityValidators.validateMessage(
      content,
      maxLength: 5000,
      emptyMessage: 'El contenido es obligatorio.',
    );
    if (contentError != null) {
      setState(() => _error = contentError);
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ApiService.createPost(
        roomId: widget.roomId,
        title: title,
        content: content,
        attachments: _attachments,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: insets),
      child: Material(
        color: AppColors.bgSecondary,
        shape: const BeveledRectangleBorder(
          side: BorderSide(color: AppColors.accent, width: 2),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text('NUEVO POST', style: kTitleStyle.copyWith(fontSize: 14)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      color: AppColors.textSecondary,
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (_error != null) ...[
                  Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFFFF7777), fontSize: 11, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: _titleController,
                  textInputAction: TextInputAction.next,
                  maxLength: 120,
                  decoration: const InputDecoration(
                    labelText: 'TÍTULO',
                    counterStyle: TextStyle(color: AppColors.textSecondary, fontSize: 10),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _contentController,
                  maxLines: 5,
                  minLines: 4,
                  decoration: const InputDecoration(labelText: 'CONTENIDO'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: _isLoading ? null : _pickImages,
                      icon: const Icon(Icons.image_outlined, size: 16),
                      label: const Text('ADJUNTAR IMAGEN'),
                    ),
                    const Spacer(),
                    Text(
                      '${_attachments.length}/${SecurityValidators.maxAttachments}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
                if (_attachments.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < _attachments.length; i++)
                        _AttachmentChip(
                          attachment: _attachments[i],
                          onRemove: _isLoading ? null : () => _removeAttachment(i),
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: 16),
                SizedBox(
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.black,
                      padding: EdgeInsets.zero,
                    ),
                    icon: isLoadingSafe(_isLoading),
                    label: Text(
                      _isLoading ? 'ENVIANDO...' : 'PUBLICAR',
                      style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget isLoadingSafe(bool loading) {
    return loading
        ? const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
          )
        : const Icon(Icons.send, size: 16);
  }
}

/// Miniatura del adjunto seleccionado con acción para quitarlo.
class _AttachmentChip extends StatelessWidget {
  final PostAttachment attachment;
  final VoidCallback? onRemove;

  const _AttachmentChip({required this.attachment, this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.bgPanel,
        border: Border.all(color: AppColors.winBorder, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: Image.memory(
              Uint8List.fromList(attachment.bytes),
              width: 36,
              height: 36,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const SizedBox(
                width: 36,
                height: 36,
                child: Icon(Icons.broken_image, size: 18, color: AppColors.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 110),
            child: Text(
              attachment.filename,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: const Icon(Icons.close, size: 14),
            color: AppColors.textSecondary,
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
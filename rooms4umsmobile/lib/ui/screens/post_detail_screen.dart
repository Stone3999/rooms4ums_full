import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';
import 'package:rooms4ums_mobile/ui/widgets/post_card.dart';

/// Detalle de un post con su hilo de comentarios.
/// Recibe el post del feed como `preview` para pintar al instante y luego
/// refresca contra el backend (el endpoint además incrementa `viewCount`).
class PostDetailScreen extends StatefulWidget {
  final String postId;
  final Map<String, dynamic> preview;

  const PostDetailScreen({super.key, required this.postId, required this.preview});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  late Future<Map<String, dynamic>> _postFuture;
  late Future<List<Map<String, dynamic>>> _commentsFuture;

  final _commentController = TextEditingController();
  final _scrollController = ScrollController();

  bool _isLoggedIn = false;
  bool _isSending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    ApiService.getToken().then((token) {
      if (mounted) setState(() => _isLoggedIn = token != null);
    });
  }

  @override
  void dispose() {
    _commentController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _load() {
    setState(() {
      _postFuture = ApiService.getPost(widget.postId);
      _commentsFuture = ApiService.getComments(widget.postId);
    });
  }

  Future<void> _refresh() async {
    setState(() {
      _postFuture = ApiService.getPost(widget.postId);
      _commentsFuture = ApiService.getComments(widget.postId);
    });
    await Future.wait([_postFuture, _commentsFuture]);
  }

  Future<void> _sendComment() async {
    final content = _commentController.text.trim();
    if (content.isEmpty) return;

    setState(() {
      _isSending = true;
      _error = null;
    });

    try {
      await ApiService.createComment(widget.postId, content);
      _commentController.clear();
      if (!mounted) return;

      setState(() => _commentsFuture = ApiService.getComments(widget.postId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('COMENTARIO PUBLICADO')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('POST')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                color: AppColors.accent,
                backgroundColor: AppColors.bgSecondary,
                onRefresh: _refresh,
                child: CustomScrollView(
                  controller: _scrollController,
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverToBoxAdapter(child: _buildPost()),
                    SliverToBoxAdapter(child: _buildCommentsHeader()),
                    _buildComments(),
                  ],
                ),
              ),
            ),
            if (_isLoggedIn) _buildComposer(),
          ],
        ),
      ),
    );
  }

  Widget _buildPost() {
    return FutureBuilder<Map<String, dynamic>>(
      future: _postFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
          );
        }

        final post = snapshot.data ?? widget.preview;
        final attachments = post['attachments'];

        return Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
          child: Container(
            width: double.infinity,
            decoration: WinBorders.panel(borderColor: AppColors.accent),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  color: AppColors.bgPanel,
                  child: Row(
                    children: [
                      const Icon(Icons.person, size: 14, color: AppColors.accent),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          (post['authorName'] ?? 'ANÓNIMO').toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.accent,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      Text(
                        formatRelativeDate(post['createdAt']?.toString()),
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 9),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (post['title'] ?? 'SIN TÍTULO').toString(),
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        (post['content'] ?? '').toString(),
                        style: const TextStyle(
                          color: AppColors.textBody,
                          fontSize: 13,
                          height: 1.6,
                        ),
                      ),
                      if (attachments is List && attachments.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        for (final attachment in attachments)
                          if (attachment is Map && attachment['url'] != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: ClipRRect(
                                child: Image.network(
                                  attachment['url'].toString(),
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, _, _) => const Text(
                                    'ADJUNTO NO DISPONIBLE',
                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 10),
                                  ),
                                ),
                              ),
                            ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Icon(Icons.mode_comment_outlined, size: 13, color: AppColors.textSecondary),
                          const SizedBox(width: 5),
                          Text(
                            '${post['commentCount'] ?? 0} comentarios',
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildCommentsHeader() {
    return const Padding(
      padding: EdgeInsets.fromLTRB(14, 20, 14, 10),
      child: Row(
        children: [
          Icon(Icons.forum_outlined, size: 15),
          SizedBox(width: 9),
          Text('COMENTARIOS', style: kTitleStyle),
        ],
      ),
    );
  }

  Widget _buildComments() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _commentsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                ),
              ),
            ),
          );
        }

        if (snapshot.hasError) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text(
                  snapshot.error.toString().replaceFirst('Exception: ', ''),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ),
            ),
          );
        }

        final comments = snapshot.data ?? const <Map<String, dynamic>>[];
        if (comments.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: Center(
                child: Text(
                  _isLoggedIn
                      ? 'SIN COMENTARIOS. SÉ EL PRIMERO.'
                      : 'SIN COMENTARIOS.\nINICIA SESIÓN PARA RESPONDER.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.6),
                ),
              ),
            ),
          );
        }

        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          sliver: SliverList.separated(
            itemCount: comments.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _CommentTile(comment: comments[index]),
          ),
        );
      },
    );
  }

  Widget _buildComposer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: const BoxDecoration(
        color: AppColors.bgSecondary,
        border: Border(top: BorderSide(color: AppColors.winBorder, width: 2)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              Text(
                _error!,
                style: const TextStyle(color: Color(0xFFFF7777), fontSize: 10),
              ),
              const SizedBox(height: 8),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    maxLines: 3,
                    minLines: 1,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      hintText: 'ESCRIBE UN COMENTARIO...',
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 44,
                  width: 44,
                  child: ElevatedButton(
                    onPressed: _isSending ? null : _sendComment,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.black,
                      padding: EdgeInsets.zero,
                    ),
                    child: _isSending
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Icon(Icons.send, size: 17),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  final Map<String, dynamic> comment;

  const _CommentTile({required this.comment});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: WinBorders.panel(borderWidth: 1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person, size: 12, color: AppColors.accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  (comment['authorName'] ?? 'ANÓNIMO').toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.accent,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Text(
                formatRelativeDate(comment['createdAt']?.toString()),
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 9),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            (comment['content'] ?? '').toString(),
            style: const TextStyle(color: AppColors.textBody, fontSize: 12, height: 1.5),
          ),
        ],
      ),
    );
  }
}
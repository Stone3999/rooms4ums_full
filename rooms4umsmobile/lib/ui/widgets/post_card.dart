import 'package:flutter/material.dart';

import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

/// Tarjeta de post del feed, con el mismo lenguaje visual que `.post-card`
/// de la web: panel biselado, autor en naranja, título y pie de acciones.
class PostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  final VoidCallback onTap;

  const PostCard({super.key, required this.post, required this.onTap});

  String get _author => (post['authorName'] ?? 'ANÓNIMO').toString();

  int get _commentCount {
    final value = post['commentCount'];
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  int get _viewCount {
    final value = post['viewCount'];
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  /// El backend guarda el post en MongoDB: `_id` es un ObjectId (24 hex).
  String? get _firstImage {
    final attachments = post['attachments'];
    if (attachments is List) {
      for (final attachment in attachments) {
        if (attachment is Map && attachment['url'] != null) {
          final url = attachment['url']?.toString() ?? '';
          final type = attachment['type']?.toString() ?? '';
          if (type.startsWith('image/') || url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp')) {
            if (url.isNotEmpty) return url;
          }
        } else if (attachment is String && (attachment.startsWith('http') || attachment.startsWith('/'))) {
          return attachment;
        }
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = _firstImage;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: WinBorders.panel(borderColor: AppColors.winBorder),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cabecera: autor + fecha.
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                color: AppColors.bgPanel,
                child: Row(
                  children: [
                    const Icon(Icons.person, size: 13, color: AppColors.accent),
                    const SizedBox(width: 7),
                    Flexible(
                      child: Text(
                        _author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.accent,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      formatRelativeDate(post['createdAt']?.toString()),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 9),
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (post['title'] ?? 'SIN TÍTULO').toString(),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        height: 1.3,
                      ),
                    ),
                    if (imageUrl != null) ...[
                      const SizedBox(height: 10),
                      ClipRRect(
                        child: Image.network(
                          imageUrl,
                          height: 160,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(
                            height: 60,
                            color: AppColors.bgPanel,
                            alignment: Alignment.center,
                            child: const Text(
                              'IMAGEN NO DISPONIBLE',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 9),
                            ),
                          ),
                          loadingBuilder: (context, child, progress) {
                            if (progress == null) return child;
                            return Container(
                              height: 160,
                              color: AppColors.bgPanel,
                              alignment: Alignment.center,
                              child: const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      truncate((post['content'] ?? '').toString(), 180),
                      style: const TextStyle(color: AppColors.textBody, fontSize: 12, height: 1.5),
                    ),
                  ],
                ),
              ),

              // Pie: métricas + acción de ver post.
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.winBorder)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.mode_comment_outlined, size: 13, color: AppColors.textSecondary),
                    const SizedBox(width: 5),
                    Text(
                      '$_commentCount',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                    ),
                    const SizedBox(width: 14),
                    const Icon(Icons.visibility_outlined, size: 13, color: AppColors.textSecondary),
                    const SizedBox(width: 5),
                    Text(
                      '$_viewCount',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                    ),
                    const Spacer(),
                    const Text(
                      'VER POST',
                      style: TextStyle(
                        color: AppColors.accent,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                      ),
                    ),
                    const Icon(Icons.chevron_right, size: 15, color: AppColors.accent),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Recorta texto largo de forma segura.
String truncate(String text, int maxLength) {
  final clean = text.trim();
  if (clean.length <= maxLength) return clean;
  return '${clean.substring(0, maxLength)}...';
}

/// Convierte la fecha ISO del backend en algo legible ("hace 5 min").
String formatRelativeDate(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) return '';
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return '';

  final now = DateTime.now();
  final diff = now.difference(parsed.toLocal());

  if (diff.inSeconds < 60) return 'ahora';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  if (diff.inDays < 7) return 'hace ${diff.inDays} d';
  if (diff.inDays < 365) return 'hace ${(diff.inDays / 7).floor()} sem';

  return '${parsed.year}-${_two(parsed.month)}-${_two(parsed.day)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
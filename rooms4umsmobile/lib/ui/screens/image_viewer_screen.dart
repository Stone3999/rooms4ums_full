import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:rooms4ums_mobile/core/services/api_service.dart';
import 'package:rooms4ums_mobile/core/services/deep_link_service.dart';
import 'package:rooms4ums_mobile/core/theme/app_colors.dart';

/// Visor de un adjunto del post.
///
/// PRÁCTICA 3: cada apertura trabaja con una URL preasignada distinta
/// (`rooms4ums://image/<post>/<n>?t=<nonce>`). El botón de refrescar genera
/// otra, de modo que la URL cambia cada vez que se quiere ver la imagen.
class ImageViewerScreen extends StatefulWidget {
  final String postId;
  final int index;
  final String? deepLink;
  final String? previewUrl;

  const ImageViewerScreen({
    super.key,
    required this.postId,
    required this.index,
    this.deepLink,
    this.previewUrl,
  });

  @override
  State<ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends State<ImageViewerScreen> {
  late Future<Map<String, dynamic>> _postFuture;
  late String _link;

  @override
  void initState() {
    super.initState();
    _postFuture = ApiService.getPost(widget.postId);
    _link = widget.deepLink ??
        DeepLinkService.shareLinkForImage(widget.postId, widget.index);
  }

  void _regenerate() {
    setState(() {
      _link = DeepLinkService.shareLinkForImage(widget.postId, widget.index);
    });
  }

  void _copyLink() {
    Clipboard.setData(ClipboardData(text: _link));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('URL COPIADA: $_link', style: const TextStyle(fontSize: 10)),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  String? _attachmentUrl(Map<String, dynamic>? post) {
    final attachments = post?['attachments'];
    if (attachments is! List) return null;
    if (widget.index < 0 || widget.index >= attachments.length) return null;

    final attachment = attachments[widget.index];
    if (attachment is Map && attachment['url'] != null) {
      return attachment['url'].toString();
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('IMAGEN ${widget.index + 1}'),
        actions: [
          IconButton(
            tooltip: 'Copiar URL preasignada',
            icon: const Icon(Icons.link, size: 19),
            onPressed: _copyLink,
          ),
          IconButton(
            tooltip: 'Generar otra URL',
            icon: const Icon(Icons.refresh, size: 19),
            onPressed: _regenerate,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(child: _buildImage()),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildImage() {
    return FutureBuilder<Map<String, dynamic>>(
      future: _postFuture,
      builder: (context, snapshot) {
        final url = widget.previewUrl ?? _attachmentUrl(snapshot.data);

        if (url == null) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.accent),
            );
          }
          return _errorBox(
            snapshot.error?.toString().replaceFirst('Exception: ', '') ??
                'ESTE POST NO TIENE ESA IMAGEN.',
          );
        }

        return InteractiveViewer(
          minScale: 1,
          maxScale: 5,
          child: Center(
            child: Image.network(
              url,
              fit: BoxFit.contain,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                final total = progress.expectedTotalBytes;
                final value = total == null
                    ? null
                    : progress.cumulativeBytesLoaded / total;
                return Center(
                  child: SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(
                      value: value,
                      strokeWidth: 2,
                      color: AppColors.accent,
                    ),
                  ),
                );
              },
              errorBuilder: (_, _, _) => _errorBox(
                'NO SE PUDO CARGAR LA IMAGEN.\n\n$url',
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _errorBox(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: WinBorders.panel(borderWidth: 1),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 10,
              height: 1.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        color: AppColors.bgSecondary,
        border: Border(top: BorderSide(color: AppColors.winBorder, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'URL PREASIGNADA (CAMBIA EN CADA APERTURA)',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 8),
          ),
          const SizedBox(height: 4),
          SelectableText(
            _link,
            style: const TextStyle(color: AppColors.accent, fontSize: 9),
          ),
        ],
      ),
    );
  }
}

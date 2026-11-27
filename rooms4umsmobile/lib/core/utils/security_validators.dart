/// PRÁCTICA 5 - Validadores de entrada y saneamiento de errores.
///
/// Centraliza la validación en el cliente para rechazar entradas vacías,
/// compuestas únicamente por espacios o fuera de los límites permitidos,
/// además de evitar la exposición de detalles técnicos en mensajes de error.
class SecurityValidators {
  SecurityValidators._();

  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 64;
  static const int maxIdentifierLength = 64;
  static const int minUsernameLength = 3;
  static const int maxUsernameLength = 32;
  static const int maxEmailLength = 100;
  static const int maxTitleLength = 120;
  static const int maxMessageLength = 500;

  /// Práctica 7 - Adjuntos: mismo límite que el backend (`FilesInterceptor('files', 5)`)
  /// y el presupuesto de 3 MB por imagen acordado en el documento del proyecto.
  static const int maxAttachments = 5;
  static const int maxAttachmentBytes = 3 * 1024 * 1024;

  static const Set<String> allowedAttachmentMimeTypes = {
    'image/jpeg',
    'image/png',
    'image/webp',
  };

  static const Set<String> _allowedExtensions = {'jpg', 'jpeg', 'png', 'webp'};

  static final RegExp _emailRegex = RegExp(
    r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$',
  );

  /// Valida usuario o correo en login. Rechaza vacío, solo espacios o exceso de longitud.
  static String? validateIdentifier(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Escribe tu usuario o correo';
    }
    if (value.trim().length > maxIdentifierLength) {
      return 'Máximo $maxIdentifierLength caracteres';
    }
    return null;
  }

  /// Valida contraseña (mínimo 8 caracteres, máximo 64, no solo espacios).
  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty || value.trim().isEmpty) {
      return 'Escribe tu contraseña';
    }
    if (value.length < minPasswordLength) {
      return 'Mínimo $minPasswordLength caracteres';
    }
    if (value.length > maxPasswordLength) {
      return 'Máximo $maxPasswordLength caracteres';
    }
    return null;
  }

  /// Valida nombre de usuario en registro.
  static String? validateUsername(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return 'Elige un nombre de usuario';
    }
    if (trimmed.length < minUsernameLength) {
      return 'Mínimo $minUsernameLength caracteres';
    }
    if (trimmed.length > maxUsernameLength) {
      return 'Máximo $maxUsernameLength caracteres';
    }
    return null;
  }

  /// Valida correo electrónico.
  static String? validateEmail(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return 'Escribe tu correo';
    }
    if (trimmed.length > maxEmailLength) {
      return 'Máximo $maxEmailLength caracteres';
    }
    if (!_emailRegex.hasMatch(trimmed)) {
      return 'Correo no válido';
    }
    return null;
  }

  /// Valida texto breve (mensajes entre dispositivos, comentarios, posts).
  static String? validateMessage(
    String? value, {
    int maxLength = maxMessageLength,
    String emptyMessage = 'El mensaje no puede estar vacío',
  }) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return emptyMessage;
    }
    if (trimmed.length > maxLength) {
      return 'Máximo $maxLength caracteres';
    }
    return null;
  }

  /// Valida un adjunto antes de subirlo (Práctica 7).
  ///
  /// Rechaza formatos fuera de la política, archivos vacíos o que superen el
  /// presupuesto de 3 MB, para no gastar datos móviles ni saturar el backend.
  static String? validateAttachment({
    required String filename,
    required String mimeType,
    required int bytes,
  }) {
    final extension = filename.contains('.')
        ? filename.split('.').last.toLowerCase()
        : '';
    final typeAllowed = allowedAttachmentMimeTypes.contains(mimeType) ||
        _allowedExtensions.contains(extension);
    if (!typeAllowed) {
      return 'Solo se admiten imágenes JPG, PNG o WebP.';
    }
    if (bytes <= 0) {
      return 'El archivo está vacío.';
    }
    if (bytes > maxAttachmentBytes) {
      return 'Cada imagen debe pesar menos de 3 MB.';
    }
    return null;
  }

  /// Valida la lista completa de adjuntos de un post.
  static String? validateAttachmentList(int count) {
    if (count > maxAttachments) {
      return 'Máximo $maxAttachments imágenes por publicación.';
    }
    return null;
  }

  /// Devuelve un mensaje genérico seguro en autenticación sin filtrar detalles técnicos.
  static String sanitizeAuthError(int statusCode, String rawMessage) {
    if (statusCode == 401 || statusCode == 403) {
      return 'Credenciales inválidas o acceso no autorizado.';
    }
    if (statusCode == 409) {
      return 'El usuario o correo ya se encuentra registrado.';
    }
    if (statusCode >= 500) {
      return 'Servicio temporalmente no disponible. Intenta más tarde.';
    }
    final clean = rawMessage.trim();
    if (clean.isEmpty || clean.toLowerCase().contains('exception') || clean.contains('<html')) {
      return 'No se pudo completar la operación. Verifica tus datos.';
    }
    return clean;
  }
}

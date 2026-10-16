import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging, MulticastMessage, SendResponse } from 'firebase-admin/messaging';

/**
 * PUSH REMOTO - Envio de notificaciones con Firebase Cloud Messaging.
 *
 * DECISION ARQUITECTONICA: la notificacion se emite AQUI, en el backend, y no
 * en cada cliente. Eso cubre el requisito de "sin importar desde donde se
 * publique un post": la web Angular, la app Flutter, el reloj Wear OS o
 * cualquier cliente futuro pasan todos por POST /api/forum/posts, por lo que
 * un unico punto de emision cubre todos los origenes.
 *
 * Wear OS: Android replica automaticamente en el reloj las notificaciones
 * recibidas por FCM, incluida la imagen de vista previa. Para los botones de
 * accion propios del reloj, el modulo Kotlin registra su token contra
 * /api/push/register y recibe la misma multidifusion.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  /** `null` si Firebase no esta configurado: el sistema degrada sin romperse. */
  private app: App | null = null;

  constructor(
    @Inject('DATABASE_CONNECTION') private sql: any,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const credentials = this.resolveCredentials();
    if (!credentials) {
      this.logger.warn(
        'Push remoto DESHABILITADO: no se encontro credencial de Firebase. ' +
          'Defina FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON.',
      );
      return;
    }

    try {
      this.app = initializeApp({ credential: cert(credentials) });
      this.logger.log('Push remoto HABILITADO (Firebase Admin inicializado)');
    } catch (e: any) {
      this.logger.error(`No se pudo inicializar Firebase Admin: ${e.message}`);
      this.app = null;
    }
  }

  /**
   * Admite dos formas de configuracion:
   *   - FIREBASE_SERVICE_ACCOUNT_PATH: ruta al JSON descargado de Firebase.
   *   - FIREBASE_SERVICE_ACCOUNT_JSON: el JSON completo como texto. Es lo
   *     recomendado en Render, donde no hay sistema de archivos persistente.
   */
  private resolveCredentials(): ServiceAccount | null {
    const inline = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (inline) {
      try {
        return JSON.parse(inline) as ServiceAccount;
      } catch {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON valido');
        return null;
      }
    }

    const path = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (path) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        return JSON.parse(fs.readFileSync(path, 'utf8')) as ServiceAccount;
      } catch (e: any) {
        this.logger.error(`No se pudo leer la credencial desde ${path}: ${e.message}`);
        return null;
      }
    }

    return null;
  }

  get enabled(): boolean {
    return this.app !== null;
  }

  // --- Registro de tokens ---------------------------------------------------

  /**
   * Asocia un token FCM a un usuario. Es idempotente: si el token ya existe
   * (por reinstallacion, o porque Firebase lo regenero) se actualiza en lugar
   * de duplicar. El token es la clave unica, de modo que celular y reloj
   * conviven sin conflicto.
   */
  async registerToken(userId: string, token: string, platform = 'android'): Promise<void> {
    if (!token) return;
    try {
      await this.sql`
        INSERT INTO device_tokens (user_id, token, platform, updated_at)
        VALUES (${userId}, ${token}, ${platform}, NOW())
        ON CONFLICT (token) DO UPDATE
          SET user_id = ${userId}, updated_at = NOW()
      `;
    } catch (e: any) {
      this.logger.error(`No se pudo registrar el token: ${e.message}`);
    }
  }

  async unregisterToken(token: string): Promise<void> {
    if (!token) return;
    try {
      await this.sql`DELETE FROM device_tokens WHERE token = ${token}`;
    } catch (e: any) {
      this.logger.error(`No se pudo eliminar el token: ${e.message}`);
    }
  }

  // --- Emision --------------------------------------------------------------

  /**
   * Notifica a todos los dispositivos registrados que hay un post nuevo.
   *
   * @param post      Documento del post recien creado.
   * @param authorId  Usuario autor, para NO notificarle a si mismo.
   */
  async notifyNewPost(post: any, authorId?: string): Promise<void> {
    if (!this.app) return; // Firebase no configurado: salida silenciosa.

    const roomSlug = (post.roomId ?? '').toString();
    const postId = (post._id ?? '').toString();
    if (!postId) return;

    try {
      const rows = authorId
        ? await this.sql`
            SELECT token FROM device_tokens WHERE user_id <> ${authorId}
          `
        : await this.sql`SELECT token FROM device_tokens`;

      const tokens: string[] = (rows ?? []).map((r: any) => r.token).filter(Boolean);
      if (tokens.length === 0) {
        this.logger.debug('No hay tokens registrados: no se envia push');
        return;
      }

      const firstImage = this.firstImageUrl(post);
      const title = `Nuevo post en ${roomSlug ? roomSlug.toUpperCase() : 'ROOMS4UMS'}`;
      const body = `${post.authorName ?? 'Alguien'} escribio: ${post.title ?? ''}`;

      // `notification` es lo que Android dibuja solo cuando la app esta
      // cerrada o en segundo plano. `data` viaja siempre y sirve para que
      // la app construya el deep link.
      const message: MulticastMessage = {
        tokens,
        notification: { title, body },
        data: {
          postId,
          room: roomSlug,
          title: post.title ?? '',
          ...(firstImage ? { image: firstImage } : {}),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'rooms4ums_remoto',
            // La imagen adjunta se refleja tambien en el Wear OS emparejado.
            ...(firstImage ? { image: firstImage } : {}),
          },
        },
      };

      const result = await getMessaging(this.app).sendEachForMulticast(message);

      this.logger.log(
        `Push enviado a ${result.successCount}/${tokens.length} dispositivos ` +
          `(${result.failureCount} fallidos)`,
      );

      // Da de baja tokens que Firebase reporta como invalidos (app desinstalada).
      await this.pruneInvalidTokens(tokens, result.responses);
    } catch (e: any) {
      this.logger.error(`Error enviando push: ${e.message}`);
    }
  }

  /** Primer adjunto que sea imagen del post. */
  private firstImageUrl(post: any): string | null {
    const attachments = post.attachments;
    if (!Array.isArray(attachments)) return null;

    for (const attachment of attachments) {
      if (!attachment?.url) continue;
      const type = (attachment.type ?? '').toString().toLowerCase();
      if (type.startsWith('image/') || type === '') return attachment.url.toString();
    }
    return null;
  }

  /**
   * Firebase marca como invalidos los tokens de apps desinstaladas.
   * Limpiarlos evita acumular tokens muertos que nunca recibieron nada.
   */
  private async pruneInvalidTokens(
    sent: string[],
    responses: SendResponse[],
  ): Promise<void> {
    const invalid: string[] = [];

    responses.forEach((response, index) => {
      if (response.success) return;
      const code = response.error?.code ?? '';
      const message = response.error?.message ?? '';

      const isInvalid =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        message.includes('Requested entity was not found');

      if (isInvalid) invalid.push(sent[index]);
    });

    if (invalid.length === 0) return;

    try {
      for (const token of invalid) {
        await this.sql`DELETE FROM device_tokens WHERE token = ${token}`;
      }
      this.logger.log(`${invalid.length} token(s) invalido(s) eliminado(s)`);
    } catch (e: any) {
      this.logger.error(`No se pudieron limpiar tokens invalidos: ${e.message}`);
    }
  }
}
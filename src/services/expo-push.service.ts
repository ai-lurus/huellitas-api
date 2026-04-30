import { logger } from '../config/logger';
import { LostReportRepository } from '../repositories/lost-report.repository';

export class ExpoPushService {
  private repo: LostReportRepository;

  constructor(repo?: LostReportRepository) {
    this.repo = repo ?? new LostReportRepository();
  }

  /**
   * Envía notificaciones a usuarios cercanos (10km) sin bloquear HTTP.
   * Si Expo indica token inválido/no registrado, se elimina de DB.
   */
  async notifyLostReportNearby(params: {
    reportId: string;
    lat: number;
    lng: number;
    excludeUserId?: string;
    radiusMeters?: number;
  }): Promise<void> {
    // Import dinámico para evitar problemas de Jest/CommonJS con dependencias ESM.
    const { Expo } = (await import('expo-server-sdk')) as unknown as {
      Expo: {
        isExpoPushToken: (token: string) => boolean;
        new (): {
          chunkPushNotifications: (messages: unknown[]) => unknown[][];
          sendPushNotificationsAsync: (messages: unknown[]) => Promise<unknown[]>;
        };
      };
    };

    const expo = new Expo();
    const radiusMeters = params.radiusMeters ?? 10_000;
    const candidates = await this.repo.findPushTokensNearPoint({
      lat: params.lat,
      lng: params.lng,
      radiusMeters,
      excludeUserId: params.excludeUserId,
    });

    const validTokens = candidates.map((c) => c.token).filter((t) => Expo.isExpoPushToken(t));

    if (validTokens.length === 0) return;

    const messages = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: '¡Mascota perdida cerca!',
      data: { reportId: params.reportId },
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: Array<{ status: string; details?: unknown }> = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = (await expo.sendPushNotificationsAsync(chunk)) as Array<{
          status: string;
          details?: unknown;
        }>;
        tickets.push(...ticketChunk);
      } catch (err) {
        logger.warn({
          message: 'Expo sendPushNotificationsAsync failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Si Expo rechaza tokens inmediatamente, se limpian.
    const toDelete: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status !== 'error') continue;
      const token = validTokens[i];
      const code = (ticket.details as { error?: string } | undefined)?.error;
      if (
        token &&
        (code === 'DeviceNotRegistered' ||
          code === 'InvalidCredentials' ||
          code === 'MessageTooBig')
      ) {
        // DeviceNotRegistered es el caso típico para token inválido/no existente.
        if (code === 'DeviceNotRegistered') toDelete.push(token);
      }
    }

    if (toDelete.length > 0) {
      await Promise.all(
        toDelete.map(async (token) => {
          try {
            await this.repo.deletePushToken(token);
          } catch (err) {
            logger.warn({
              message: 'Failed to delete invalid Expo token',
              token,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
    }
  }
}

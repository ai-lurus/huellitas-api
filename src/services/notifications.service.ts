import { logger } from '../config/logger';
import { UserRepository } from '../repositories/user.repository';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { initFirebase, messaging } from '../config/firebase';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export class NotificationsService {
  private users: UserRepository;
  private repo: NotificationsRepository;

  constructor(users?: UserRepository, repo?: NotificationsRepository) {
    this.users = users ?? new UserRepository();
    this.repo = repo ?? new NotificationsRepository();
  }

  async sendLostPetAlert(params: {
    reportId: string;
    petName: string;
    ownerId: string;
    lat: number;
    lng: number;
    radiusMeters?: number;
  }): Promise<void> {
    if (!initFirebase()) {
      logger.warn({ message: 'FCM not configured; skipping lost pet alerts' });
      return;
    }

    const radiusMeters = params.radiusMeters ?? 10_000;
    const rows = await this.repo.findEligibleNearbyTokens({
      lat: params.lat,
      lng: params.lng,
      radiusMeters,
      ownerId: params.ownerId,
    });
    if (!rows.length) return;

    const tokens = rows.map((r) => r.token);
    const userByToken = new Map<string, string>();
    rows.forEach((r) => userByToken.set(r.token, r.user_id));

    const title = '¡Mascota perdida cerca!';
    const chunks = chunk(tokens, 500);
    for (const batch of chunks) {
      try {
        const resp = await messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title },
          data: { reportId: params.reportId },
        });

        const invalidTokens: string[] = [];
        const deliveredUserIds: string[] = [];

        resp.responses.forEach((r, i) => {
          const token = batch[i];
          if (!token) return;
          if (r.success) {
            const uid = userByToken.get(token);
            if (uid) deliveredUserIds.push(uid);
            return;
          }
          const code = r.error?.code ?? '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            code.includes('404')
          ) {
            invalidTokens.push(token);
          }
        });

        if (invalidTokens.length) {
          await Promise.all(invalidTokens.map((t) => this.repo.deletePushToken(t)));
        }

        if (deliveredUserIds.length) {
          await this.repo.logNotificationSentMany({
            userIds: deliveredUserIds,
            reportId: params.reportId,
          });
        }
      } catch (err) {
        logger.warn({
          message: 'FCM lost pet multicast failed',
          reportId: params.reportId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async sendSightingNotification(params: {
    ownerId: string;
    petName: string;
    reportId: string;
  }): Promise<void> {
    if (!initFirebase()) {
      logger.warn({
        message: 'FCM not configured; skipping sighting push',
        ownerId: params.ownerId,
      });
      return;
    }

    const tokens = await this.users.listPushTokensForUser(params.ownerId);
    if (tokens.length === 0) return;

    const title = `Alguien vio a ${params.petName}!`;
    const chunks = chunk(tokens, 500);
    for (const batch of chunks) {
      try {
        const resp = await messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title },
          data: { reportId: params.reportId },
        });

        const invalid: string[] = [];
        resp.responses.forEach((r, i) => {
          if (r.success) return;
          const code = r.error?.code ?? '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            code.includes('404')
          ) {
            const t = batch[i];
            if (t) invalid.push(t);
          }
        });
        if (invalid.length) {
          await Promise.all(invalid.map((t) => this.users.deletePushToken(t)));
        }
      } catch (err) {
        logger.warn({
          message: 'FCM sighting multicast failed',
          ownerId: params.ownerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export const notificationsService = new NotificationsService();

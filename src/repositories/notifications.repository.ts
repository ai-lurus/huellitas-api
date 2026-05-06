import { Pool } from 'pg';
import { getPool } from '../db/index';

export interface PushTokenRow {
  token: string;
  user_id: string;
  platform: 'ios' | 'android';
}

export class NotificationsRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  async findEligibleNearbyTokens(params: {
    lat: number;
    lng: number;
    radiusMeters: number;
    ownerId: string;
  }): Promise<PushTokenRow[]> {
    const { rows } = await this.pool.query<PushTokenRow>(
      `
      SELECT pt.token, pt.platform, pt.user_id
      FROM push_tokens pt
      JOIN "user" u ON u.id = pt.user_id AND u.deleted_at IS NULL
      WHERE u.alerts_enabled = TRUE
        AND u.location IS NOT NULL
        AND u.id <> $4
        AND ST_DWithin(
          u.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3,
          false
        )
        AND u.id NOT IN (
          SELECT user_id FROM notification_log
          WHERE DATE(sent_at) = CURRENT_DATE
          GROUP BY user_id HAVING COUNT(*) >= 3
        )
      `,
      [params.lat, params.lng, params.radiusMeters, params.ownerId],
    );
    return rows;
  }

  async deletePushToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
  }

  async logNotificationSent(params: { userId: string; reportId: string }): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO notification_log (user_id, report_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, report_id) DO NOTHING
      `,
      [params.userId, params.reportId],
    );
  }

  async logNotificationSentMany(params: { userIds: string[]; reportId: string }): Promise<void> {
    if (!params.userIds.length) return;
    // Unnest to bulk insert
    await this.pool.query(
      `
      INSERT INTO notification_log (user_id, report_id)
      SELECT x.user_id, $2
      FROM UNNEST($1::text[]) AS x(user_id)
      ON CONFLICT (user_id, report_id) DO NOTHING
      `,
      [params.userIds, params.reportId],
    );
  }
}

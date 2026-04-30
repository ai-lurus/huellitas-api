import { Pool } from 'pg';
import { getPool } from '../db/index';

export interface UserProfileRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  onboarding_completed_at: Date | null;
  alerts_enabled: boolean;
  alert_radius_km: number;
  notifications_enabled: boolean;
  email_alerts_enabled: boolean;
}

export interface UpdateUserProfileData {
  name?: string;
  image?: string | null;
  /** true = marca completado ahora; false = borra marca (re-onboarding) */
  onboardingCompleted?: boolean;
}

export interface UpdateUserSettingsData {
  alert_radius_km?: number;
  alerts_enabled?: boolean;
  notifications_enabled?: boolean;
  email_alerts_enabled?: boolean;
}

/** Distancia mínima en metros para persistir un nuevo punto GPS */
export const LOCATION_UPDATE_MIN_METERS = 100;

export class UserRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  async findProfileById(userId: string): Promise<UserProfileRow | null> {
    const { rows } = await this.pool.query<UserProfileRow>(
      `SELECT id, name, email, image, onboarding_completed_at, alerts_enabled, alert_radius_km,
              notifications_enabled, email_alerts_enabled
       FROM "user"
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async updateProfile(userId: string, data: UpdateUserProfileData): Promise<UserProfileRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(data.name);
    }
    if (data.image !== undefined) {
      sets.push(`image = $${i++}`);
      values.push(data.image);
    }
    if (data.onboardingCompleted === true) {
      sets.push(`onboarding_completed_at = NOW()`);
    } else if (data.onboardingCompleted === false) {
      sets.push(`onboarding_completed_at = NULL`);
    }

    if (sets.length === 0) {
      return this.findProfileById(userId);
    }

    sets.push(`updated_at = NOW()`);
    values.push(userId);

    const { rows } = await this.pool.query<UserProfileRow>(
      `UPDATE "user"
       SET ${sets.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, name, email, image, onboarding_completed_at, alerts_enabled, alert_radius_km,
                 notifications_enabled, email_alerts_enabled`,
      values,
    );
    return rows[0] ?? null;
  }

  /**
   * Actualiza `location` solo si no hay punto previo o el desplazamiento es > {@link LOCATION_UPDATE_MIN_METERS} m.
   * Usa ST_MakePoint(lng, lat)::geography (con SRID 4326).
   */
  async updateLocationIfMoved(
    userId: string,
    lat: number,
    lng: number,
    minMeters: number = LOCATION_UPDATE_MIN_METERS,
  ): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE "user"
       SET location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
         AND (
           location IS NULL
           OR ST_Distance(
             location,
             ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
             false
           ) > $4
         )`,
      [userId, lng, lat, minMeters],
    );
    return (rowCount ?? 0) > 0;
  }

  async updateSettings(
    userId: string,
    data: UpdateUserSettingsData,
  ): Promise<UserProfileRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.alert_radius_km !== undefined) {
      sets.push(`alert_radius_km = $${i++}`);
      values.push(data.alert_radius_km);
    }
    if (data.alerts_enabled !== undefined) {
      sets.push(`alerts_enabled = $${i++}`);
      values.push(data.alerts_enabled);
    }
    if (data.notifications_enabled !== undefined) {
      sets.push(`notifications_enabled = $${i++}`);
      values.push(data.notifications_enabled);
    }
    if (data.email_alerts_enabled !== undefined) {
      sets.push(`email_alerts_enabled = $${i++}`);
      values.push(data.email_alerts_enabled);
    }

    if (sets.length === 0) {
      return this.findProfileById(userId);
    }

    sets.push(`updated_at = NOW()`);
    values.push(userId);

    const { rows } = await this.pool.query<UserProfileRow>(
      `UPDATE "user"
       SET ${sets.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, name, email, image, onboarding_completed_at, alerts_enabled, alert_radius_km,
                 notifications_enabled, email_alerts_enabled`,
      values,
    );
    return rows[0] ?? null;
  }

  async softDeleteUser(userId: string): Promise<void> {
    await this.pool.query('BEGIN');
    try {
      // Invalidate active sessions/tokens
      await this.pool.query(`DELETE FROM session WHERE user_id = $1`, [userId]);
      await this.pool.query(`DELETE FROM push_tokens WHERE user_id = $1`, [userId]);

      // Soft-delete owned resources
      await this.pool.query(
        `UPDATE pets SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId],
      );
      await this.pool.query(
        `UPDATE lost_reports SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId],
      );

      await this.pool.query(
        `UPDATE "user" SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
        [userId],
      );
      await this.pool.query('COMMIT');
    } catch (e) {
      await this.pool.query('ROLLBACK');
      throw e;
    }
  }

  async upsertPushToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.pool.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform`,
      [userId, token, platform],
    );
  }

  async deleteAllPushTokensForUser(userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM push_tokens WHERE user_id = $1`, [userId]);
  }

  async listPushTokensForUser(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ token: string }>(
      `SELECT token FROM push_tokens WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => r.token).filter(Boolean);
  }

  async deletePushToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
  }
}

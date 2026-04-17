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
}

export interface UpdateUserProfileData {
  name?: string;
  image?: string | null;
  /** true = marca completado ahora; false = borra marca (re-onboarding) */
  onboardingCompleted?: boolean;
  alertsEnabled?: boolean;
  /** Si se envía, actualiza el punto WGS84 en la columna geography */
  location?: { lat: number; lng: number };
}

export class UserRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  async findProfileById(userId: string): Promise<UserProfileRow | null> {
    const { rows } = await this.pool.query<UserProfileRow>(
      `SELECT id, name, email, image, onboarding_completed_at, alerts_enabled, alert_radius_km
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
    if (data.alertsEnabled !== undefined) {
      sets.push(`alerts_enabled = $${i++}`);
      values.push(data.alertsEnabled);
    }
    if (data.location !== undefined) {
      sets.push(`location = ST_SetSRID(ST_MakePoint($${i++}, $${i++}), 4326)::geography`);
      values.push(data.location.lng, data.location.lat);
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
       RETURNING id, name, email, image, onboarding_completed_at, alerts_enabled, alert_radius_km`,
      values,
    );
    return rows[0] ?? null;
  }
}

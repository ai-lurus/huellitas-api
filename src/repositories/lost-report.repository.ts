import { Pool } from 'pg';
import { getPool } from '../db/index';

export interface NearbyLostReportRow {
  id: string;
  pet_id: string;
  user_id: string;
  last_seen_at: Date;
  status: 'active' | 'resolved';
  message: string | null;
  created_at: Date;
  updated_at: Date;
  /** Distancia calculada (m) */
  distance_meters: number;
  /** Para filtros/response */
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
}

export interface LostReportRow {
  id: string;
  pet_id: string;
  user_id: string;
  last_seen_at: Date;
  status: 'active' | 'resolved';
  message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserPushTokenRow {
  token: string;
  user_id: string;
}

export class LostReportRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  async create(data: {
    petId: string;
    userId: string;
    lat: number;
    lng: number;
    lastSeenAt: Date;
    message?: string;
  }): Promise<LostReportRow> {
    const { rows } = await this.pool.query<LostReportRow>(
      `
      INSERT INTO lost_reports (pet_id, user_id, location, last_seen_at, status, message)
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
        $5,
        'active',
        $6
      )
      RETURNING id, pet_id, user_id, last_seen_at, status, message, created_at, updated_at
      `,
      [data.petId, data.userId, data.lng, data.lat, data.lastSeenAt, data.message ?? null],
    );
    const created = rows[0];
    if (!created) throw new Error('Failed to create lost report');
    return created;
  }

  async findPushTokensNearPoint(params: {
    lat: number;
    lng: number;
    radiusMeters: number;
    excludeUserId?: string;
  }): Promise<UserPushTokenRow[]> {
    const values: unknown[] = [params.lng, params.lat, params.radiusMeters];
    let idx = values.length + 1;
    const excludeFilter = params.excludeUserId != null ? `AND u.id <> $${idx++}` : '';
    if (params.excludeUserId != null) values.push(params.excludeUserId);

    const { rows } = await this.pool.query<UserPushTokenRow>(
      `
      WITH q AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS point
      )
      SELECT DISTINCT pt.token, pt.user_id
      FROM push_tokens pt
      JOIN "user" u ON u.id = pt.user_id AND u.deleted_at IS NULL
      CROSS JOIN q
      WHERE u.location IS NOT NULL
        AND ST_DWithin(u.location, q.point, $3, false)
        ${excludeFilter}
      `,
      values,
    );
    return rows;
  }

  async deletePushToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
  }

  async findNearby(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    species?: NearbyLostReportRow['species'];
  }): Promise<NearbyLostReportRow[]> {
    const radiusMeters = params.radiusKm * 1000;

    // Nota: los parámetros de ST_MakePoint son (lng, lat)
    const values: unknown[] = [params.lng, params.lat, radiusMeters];
    let idx = values.length + 1;

    const speciesFilter = params.species != null ? `AND p.species = $${idx++}` : '';
    if (params.species != null) values.push(params.species);

    const { rows } = await this.pool.query<NearbyLostReportRow>(
      `
      WITH q AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS point
      )
      SELECT
        lr.id,
        lr.pet_id,
        lr.user_id,
        lr.last_seen_at,
        lr.status,
        lr.message,
        lr.created_at,
        lr.updated_at,
        p.species,
        ST_Distance(lr.location, q.point, false) AS distance_meters
      FROM lost_reports lr
      JOIN pets p ON p.id = lr.pet_id AND p.deleted_at IS NULL
      CROSS JOIN q
      WHERE lr.deleted_at IS NULL
        AND lr.status = 'active'
        AND ST_DWithin(lr.location, q.point, $3, false)
        ${speciesFilter}
      ORDER BY distance_meters ASC
      LIMIT 200
      `,
      values,
    );

    return rows.map((r) => ({
      ...r,
      // `pg` puede devolver numeric como string según config; esto lo normaliza.
      distance_meters: Number((r as unknown as { distance_meters: unknown }).distance_meters),
    }));
  }
}

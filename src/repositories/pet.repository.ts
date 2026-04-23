import { Pool } from 'pg';
import { getPool } from '../db/index';

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  breed: string | null;
  color: string | null;
  sex: 'male' | 'female' | 'unknown' | null;
  age_years: number | null;
  notes: string | null;
  photos: string[];
  is_lost: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePetData {
  user_id: string;
  name: string;
  species: string;
  breed?: string;
  color?: string;
  sex?: string;
  age_years?: number;
  notes?: string;
}

export interface UpdatePetData {
  name?: string;
  species?: string;
  breed?: string | null;
  color?: string | null;
  sex?: string | null;
  age_years?: number | null;
  notes?: string | null;
  is_lost?: boolean;
}

export class PetRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  async findByUserId(userId: string): Promise<Pet[]> {
    const { rows } = await this.pool.query<Pet>(
      `SELECT * FROM pets WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  }

  async findById(id: string): Promise<Pet | null> {
    const { rows } = await this.pool.query<Pet>(
      `SELECT * FROM pets WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  async countByUserId(userId: string): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM pets WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async create(data: CreatePetData): Promise<Pet> {
    const { rows } = await this.pool.query<Pet>(
      `INSERT INTO pets (user_id, name, species, breed, color, sex, age_years, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.user_id,
        data.name,
        data.species,
        data.breed ?? null,
        data.color ?? null,
        data.sex ?? null,
        data.age_years ?? null,
        data.notes ?? null,
      ],
    );
    if (!rows[0]) throw new Error('Failed to create pet');
    return rows[0];
  }

  async update(id: string, data: UpdatePetData): Promise<Pet | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.species !== undefined) {
      fields.push(`species = $${idx++}`);
      values.push(data.species);
    }
    if (data.breed !== undefined) {
      fields.push(`breed = $${idx++}`);
      values.push(data.breed);
    }
    if (data.color !== undefined) {
      fields.push(`color = $${idx++}`);
      values.push(data.color);
    }
    if (data.sex !== undefined) {
      fields.push(`sex = $${idx++}`);
      values.push(data.sex);
    }
    if (data.age_years !== undefined) {
      fields.push(`age_years = $${idx++}`);
      values.push(data.age_years);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(data.notes);
    }
    if (data.is_lost !== undefined) {
      fields.push(`is_lost = $${idx++}`);
      values.push(data.is_lost);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await this.pool.query<Pet>(
      `UPDATE pets SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE pets SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  }

  async addPhoto(id: string, photoUrl: string): Promise<Pet | null> {
    const { rows } = await this.pool.query<Pet>(
      `UPDATE pets SET photos = array_append(photos, $1), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [photoUrl, id],
    );
    return rows[0] ?? null;
  }
}

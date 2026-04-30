import { Pool } from 'pg';
import 'dotenv/config';
import { LostReportRepository } from '../../src/repositories/lost-report.repository';

const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Expire reports job (repo)', () => {
  let pool: Pool;
  let repo: LostReportRepository;
  const USER_ID = 'test-expire-user';
  let petId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    repo = new LostReportRepository(pool);

    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
      [USER_ID, 'Expire', 'expire@t.com'],
    );
    const pet = await pool.query<{ id: string }>(
      `INSERT INTO pets (user_id, name, species) VALUES ($1, 'Oldie', 'dog') RETURNING id`,
      [USER_ID],
    );
    const createdPetId = pet.rows[0]?.id;
    if (!createdPetId) throw new Error('Failed to create pet fixture');
    petId = createdPetId;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM lost_reports WHERE user_id = $1`, [USER_ID]);
    await pool.query(`DELETE FROM pets WHERE id = $1`, [petId]);
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [USER_ID]);
    await pool.end();
  });

  it('expires active reports older than 30 days and skips recent', async () => {
    const old = await pool.query<{ id: string }>(
      `
      INSERT INTO lost_reports (pet_id, user_id, location, last_seen_at, status, created_at, updated_at)
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint(-99.13, 19.43), 4326)::geography,
        NOW(),
        'active',
        NOW() - INTERVAL '31 days',
        NOW() - INTERVAL '31 days'
      )
      RETURNING id
      `,
      [petId, USER_ID],
    );
    const recent = await pool.query<{ id: string }>(
      `
      INSERT INTO lost_reports (pet_id, user_id, location, last_seen_at, status, created_at, updated_at)
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint(-99.13, 19.43), 4326)::geography,
        NOW(),
        'active',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
      )
      RETURNING id
      `,
      [petId, USER_ID],
    );

    const oldId = old.rows[0]?.id;
    const recentId = recent.rows[0]?.id;
    if (!oldId || !recentId) throw new Error('Failed to create report fixtures');

    const count = await repo.expireOldReports(30);
    expect(count).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM lost_reports WHERE id = $1 OR id = $2 ORDER BY id`,
      [oldId, recentId],
    );
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    expect(byId.get(oldId)).toBe('resolved');
    expect(byId.get(recentId)).toBe('active');
  });
});

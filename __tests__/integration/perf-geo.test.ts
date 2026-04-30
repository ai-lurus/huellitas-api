import { Pool } from 'pg';
import 'dotenv/config';

const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

function planHasSeqScan(plan: unknown): boolean {
  if (!plan) return false;
  if (Array.isArray(plan)) return plan.some(planHasSeqScan);
  if (typeof plan === 'object') {
    const nodeType = (plan as Record<string, unknown>)['Node Type'] as string | undefined;
    if (nodeType?.includes('Seq Scan')) return true;
    return Object.values(plan as Record<string, unknown>).some(planHasSeqScan);
  }
  return false;
}

describeIfDb('Geo query performance (EXPLAIN)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

    // Seed 1000 users fast (if they don't exist)
    await pool.query(
      `
      INSERT INTO "user" (id, name, email, alerts_enabled, location)
      SELECT
        'perf-u-' || gs::text,
        'Perf ' || gs::text,
        'perf-' || gs::text || '@t.com',
        TRUE,
        ST_SetSRID(ST_MakePoint(-99.1332 + (random() - 0.5) * 0.2, 19.4326 + (random() - 0.5) * 0.2), 4326)::geography
      FROM generate_series(1, 1000) gs
      ON CONFLICT (id) DO NOTHING
      `,
    );
    await pool.query(
      `
      INSERT INTO push_tokens (user_id, token, platform)
      SELECT
        'perf-u-' || gs::text,
        'fcm-token-' || gs::text,
        'android'
      FROM generate_series(1, 1000) gs
      ON CONFLICT (token) DO NOTHING
      `,
    );
  });

  afterAll(async () => {
    // Cleanup tokens + users
    await pool.query(`DELETE FROM push_tokens WHERE user_id LIKE 'perf-u-%'`);
    await pool.query(`DELETE FROM "user" WHERE id LIKE 'perf-u-%'`);
    await pool.end();
  });

  it('ST_DWithin on user.location should not use Seq Scan', async () => {
    const sql = `
      SELECT pt.token, pt.user_id
      FROM push_tokens pt
      JOIN "user" u ON u.id = pt.user_id AND u.deleted_at IS NULL
      WHERE u.alerts_enabled = TRUE
        AND u.location IS NOT NULL
        AND ST_DWithin(
          u.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3,
          false
        )
      LIMIT 50
    `;
    const { rows } = await pool.query<{ 'QUERY PLAN': unknown }>(
      `EXPLAIN (FORMAT JSON) ${sql}`,
      [19.4326, -99.1332, 10_000],
    );
    const plan = rows[0]?.['QUERY PLAN'];
    expect(planHasSeqScan(plan)).toBe(false);
  });
});

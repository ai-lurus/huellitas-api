import 'dotenv/config';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

  const explain = async (sql: string, params: unknown[]): Promise<unknown> => {
    const { rows } = await pool.query<{ 'QUERY PLAN': unknown }>(
      `EXPLAIN (FORMAT JSON) ${sql}`,
      params,
    );
    return rows[0]?.['QUERY PLAN'];
  };

  const pointSql = `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`;

  const eligibleSql = `
    SELECT pt.token, pt.platform, pt.user_id
    FROM push_tokens pt
    JOIN "user" u ON u.id = pt.user_id AND u.deleted_at IS NULL
    WHERE u.alerts_enabled = TRUE
      AND u.location IS NOT NULL
      AND u.id <> $4
      AND ST_DWithin(u.location, ${pointSql}, $3, false)
  `;

  const nearbySql = `
    WITH q AS (SELECT ${pointSql} AS point)
    SELECT lr.id
    FROM lost_reports lr
    CROSS JOIN q
    WHERE lr.deleted_at IS NULL AND lr.status = 'active'
      AND ST_DWithin(lr.location, q.point, $3, false)
    LIMIT 50
  `;

  // Example params
  const params = [19.4326, -99.1332, 10_000, 'owner'];
  // eslint-disable-next-line no-console
  console.log('Eligible tokens plan:', JSON.stringify(await explain(eligibleSql, params), null, 2));
  // eslint-disable-next-line no-console
  console.log(
    'Nearby reports plan:',
    JSON.stringify(await explain(nearbySql, params.slice(0, 3)), null, 2),
  );

  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

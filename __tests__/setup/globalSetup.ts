import { Pool } from 'pg';

export default async function globalSetup(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://localhost/huellitas_test',
  });
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  } finally {
    client.release();
    await pool.end();
  }
}

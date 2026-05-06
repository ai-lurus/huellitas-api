import { Pool } from 'pg';
import { logger } from '../config/logger';

let pool: Pool | null = null;

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

let warming: Promise<void> | null = null;

export function getPool(): Pool {
  if (!pool) {
    const max = numEnv('DB_POOL_MAX', 10);
    pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Slow query monitoring (no values logged)
    const slowMs = numEnv('DB_SLOW_QUERY_MS', 1000);
    const origQuery = pool.query.bind(pool) as Pool['query'];
    (pool as unknown as { query: Pool['query'] }).query = (async (
      ...args: Parameters<Pool['query']>
    ) => {
      const start = Date.now();
      try {
        return await origQuery(...(args as Parameters<Pool['query']>));
      } finally {
        const ms = Date.now() - start;
        if (ms >= slowMs) {
          const text = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: string }).text;
          logger.warn({
            message: 'Slow DB query',
            durationMs: ms,
            query: (text ?? '').slice(0, 500),
          });
        }
      }
    }) as unknown as Pool['query'];
  }
  return pool;
}

export async function warmupPool(minConnections = 2): Promise<void> {
  // pg no tiene "min" real; hacemos warmup con N connects.
  if (warming) return warming;
  const doWarmup = async (): Promise<void> => {
    const n = Math.max(0, minConnections);
    const clients = await Promise.all(Array.from({ length: n }).map(() => getPool().connect()));
    clients.forEach((c) => c.release());
  };

  warming = doWarmup().finally(() => {
    warming = null;
  });
  return warming;
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

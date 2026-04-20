import 'dotenv/config';

import type { PoolClient } from 'pg';
import { Pool } from 'pg';
import { createBetterAuth } from '../config/better-auth.shared';
import { env } from '../config/env';

type SignUpEmailResult = {
  user?: { id?: string };
};

function readStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;

  const direct = e['status'];
  if (typeof direct === 'number') return direct;

  const response = e['response'];
  if (response && typeof response === 'object') {
    const status = (response as Record<string, unknown>)['status'];
    if (typeof status === 'number') return status;
  }

  const cause = e['cause'];
  if (cause && typeof cause === 'object') {
    const status = (cause as Record<string, unknown>)['status'];
    if (typeof status === 'number') return status;
  }

  return undefined;
}

async function truncateAllAppData(client: PoolClient): Promise<void> {
  // Orden: dependientes -> padres (evitar truncates con CASCADE sobre todo el esquema)
  await client.query(`
    TRUNCATE TABLE
      sightings,
      notification_log,
      lost_reports,
      pets,
      push_tokens,
      session,
      account,
      verification,
      "user"
    RESTART IDENTITY CASCADE;
  `);
}

async function main(): Promise<void> {
  const email = process.env['SEED_USER_EMAIL']?.trim() ?? 'test@huellitas.com';
  const password = process.env['SEED_USER_PASSWORD']?.trim() ?? 'password123';
  const name = process.env['SEED_USER_NAME']?.trim() ?? 'Usuario Prueba Huellitas';

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await truncateAllAppData(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const auth = createBetterAuth(pool);

  try {
    const result = (await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    })) as SignUpEmailResult;

    // eslint-disable-next-line no-console
    console.log('✅ Base limpiada + usuario semilla creado (Better Auth).');
    // eslint-disable-next-line no-console
    console.log({
      email,
      password,
      userId: result.user?.id ?? null,
      onboarding: { onboardingCompletedAt: null, pets: 0 },
    });
  } catch (err: unknown) {
    const status = readStatusCode(err);
    if (status === 422) {
      // No debería pasar justo después de un TRUNCATE, pero lo dejamos explícito.
      // eslint-disable-next-line no-console
      console.error('❌ No se pudo crear el usuario semilla (422). Detalle:', err);
      process.exitCode = 1;
      return;
    }
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ db:reset falló:', err);
  process.exit(1);
});

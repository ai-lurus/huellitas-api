import 'dotenv/config';

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

async function main(): Promise<void> {
  const email = process.env['TEST_USER_EMAIL']?.trim() ?? 'test@huellitas.com';
  const password = process.env['TEST_USER_PASSWORD']?.trim() ?? 'password123';
  const name = process.env['TEST_USER_NAME']?.trim() ?? 'Usuario Prueba Huellitas';

  const pool = new Pool({ connectionString: env.DATABASE_URL });

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
    console.log('✅ Usuario de prueba creado.');
    // eslint-disable-next-line no-console
    console.log({ email, password, userId: result.user?.id ?? null });
  } catch (err: unknown) {
    const status = readStatusCode(err);
    if (status === 422) {
      // eslint-disable-next-line no-console
      console.log('ℹ️ El usuario ya existe (o email inválido).');
      // eslint-disable-next-line no-console
      console.log({ email });
      return;
    }
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ No se pudo crear el usuario de prueba:', err);
  process.exitCode = 1;
});

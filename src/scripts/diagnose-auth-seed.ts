import 'dotenv/config';

import { Pool } from 'pg';
import { createBetterAuth } from '../config/better-auth.shared';
import { env } from '../config/env';

/**
 * Diagnóstico rápido cuando el login devuelve 401:
 * - Confirma que el usuario existe en la MISMA DATABASE_URL que usa la API
 * - Confirma fila `account` con provider `credential` (email/contraseña)
 * - Intenta signInEmail vía API server-side (misma config que /api/auth)
 */
async function main(): Promise<void> {
  const email = process.env['SEED_USER_EMAIL']?.trim() ?? 'test@huellitas.com';
  const password = process.env['SEED_USER_PASSWORD']?.trim() ?? 'password123';

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const auth = createBetterAuth(pool);

  try {
    const userRows = await pool.query<{
      id: string;
      email: string;
      onboarding_completed_at: Date | null;
    }>(`SELECT id, email, onboarding_completed_at FROM "user" WHERE lower(email) = lower($1)`, [
      email,
    ]);

    if (userRows.rowCount === 0) {
      // eslint-disable-next-line no-console
      console.error(
        `❌ No hay usuario con email "${email}" en esta base (DATABASE_URL). Ejecutá: npm run db:reset`,
      );
      process.exitCode = 1;
      return;
    }

    const u = userRows.rows[0];
    const accRows = await pool.query<{ provider_id: string; has_password: boolean }>(
      `SELECT provider_id, (password IS NOT NULL AND password <> '') AS has_password
       FROM account WHERE user_id = $1`,
      [u.id],
    );

    const credential = accRows.rows.find((r) => r.provider_id === 'credential');

    // eslint-disable-next-line no-console
    console.log('— Estado en base de datos —');
    // eslint-disable-next-line no-console
    console.log({
      userId: u.id,
      emailInDb: u.email,
      onboardingCompletedAt: u.onboarding_completed_at,
      accounts: accRows.rows,
      credentialAccount: credential ?? null,
    });

    if (!credential?.has_password) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ No hay cuenta "credential" con contraseña. El login email/contraseña no va a funcionar. Volvé a crear el usuario con db:reset.',
      );
      process.exitCode = 1;
      return;
    }

    await auth.api.signInEmail({
      body: { email, password },
    });

    // eslint-disable-next-line no-console
    console.log('✅ signInEmail (server API) OK: email+password coinciden con Better Auth.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ signInEmail falló (revisá contraseña o DATABASE_URL):', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

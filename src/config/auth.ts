import { Pool } from 'pg';
import { env } from './env';
import { createBetterAuth } from './better-auth.shared';

export const auth = createBetterAuth(new Pool({ connectionString: env.DATABASE_URL }));

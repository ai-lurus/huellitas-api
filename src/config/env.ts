import { z } from 'zod';

// Incluye 127.0.0.1: Expo/Web a veces abren la preview con ese host; es otro origen distinto de localhost.
const DEFAULT_DEV_TRUSTED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'http://127.0.0.1:3000',
] as const;

/** Esquema de deep link de la app Expo (debe coincidir con app.json → expo.scheme). */
function deepLinkTrustedOrigins(scheme: string): string[] {
  const s = scheme.trim().toLowerCase();
  if (!s) return [];
  return [`${s}://`, `${s}://*`];
}

function buildTrustedOrigins(
  raw: string | undefined,
  nodeEnv: string,
  expoAppScheme: string,
): string[] {
  let base: string[];
  if (raw?.trim()) {
    base = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  } else if (nodeEnv === 'production') {
    base = ['https://huellitas.app'];
  } else {
    base = [...DEFAULT_DEV_TRUSTED_ORIGINS];
  }
  // OAuth / callbacks en iOS y Android usan el custom scheme; Better Auth lo valida en trustedOrigins (no en CORS).
  return [...base, ...deepLinkTrustedOrigins(expoAppScheme)];
}

/** Solo orígenes http(s) para el middleware `cors` de Express. */
function corsOriginsFromTrusted(httpList: string[]): string[] {
  return httpList.filter((o) => o.startsWith('http://') || o.startsWith('https://'));
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  /** Comma-separated frontend origins (Expo web, staging, production). Overrides dev/prod defaults when set. */
  TRUSTED_ORIGINS: z.string().optional(),
  /** Deep link scheme (ej. huellitas). Se añade `scheme://` a Better Auth trustedOrigins para Google OAuth en nativo. */
  EXPO_APP_SCHEME: z.string().min(1).default('huellitas'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;

/** Orígenes que Better Auth acepta para callbackURL / OAuth en web y Expo (incl. `EXPO_APP_SCHEME://`). */
export const authTrustedOrigins = buildTrustedOrigins(
  env.TRUSTED_ORIGINS,
  env.NODE_ENV,
  env.EXPO_APP_SCHEME,
);

/** Orígenes `http(s):` para el middleware CORS de Express (los custom schemes no aplican a CORS). */
export const corsAllowedOrigins = corsOriginsFromTrusted(authTrustedOrigins);

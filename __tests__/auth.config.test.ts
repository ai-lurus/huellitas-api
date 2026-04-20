/**
 * Tests for Better Auth configuration (auth.ts).
 * We test the shape and options of the auth instance rather than live HTTP
 * calls, which belong in integration tests that need a real DB + network.
 */

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      end: jest.fn(),
    })),
  };
});

jest.mock('better-auth', () => ({
  betterAuth: jest.fn().mockReturnValue({
    handler: jest.fn(),
    api: { getSession: jest.fn() },
    options: {},
  }),
}));

describe('auth config', () => {
  beforeEach(() => {
    jest.resetModules();
    // Provide all required env vars
    process.env['NODE_ENV'] = 'test';
    process.env['DATABASE_URL'] = 'postgresql://localhost/huellitas_test';
    process.env['BETTER_AUTH_SECRET'] = 'test-secret-at-least-32-characters-long';
    process.env['BETTER_AUTH_URL'] = 'http://localhost:3000';
    process.env['GOOGLE_CLIENT_ID'] = 'google-client-id';
    process.env['GOOGLE_CLIENT_SECRET'] = 'google-client-secret';
    process.env['FIREBASE_PROJECT_ID'] = 'test-project';
    process.env['FIREBASE_CLIENT_EMAIL'] = 'test@test.com';
    process.env['FIREBASE_PRIVATE_KEY'] =
      '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----\n';
    process.env['R2_ACCOUNT_ID'] = 'test';
    process.env['R2_ACCESS_KEY_ID'] = 'test';
    process.env['R2_SECRET_ACCESS_KEY'] = 'test';
    process.env['R2_BUCKET_NAME'] = 'test';
    process.env['R2_PUBLIC_URL'] = 'http://localhost:9000';
    process.env['API_URL'] = 'http://localhost:3000';
  });

  it('initializes betterAuth with email/password enabled', async () => {
    const { betterAuth } = await import('better-auth');
    await import('../src/config/auth');

    expect(betterAuth).toHaveBeenCalledTimes(1);
    const callArg = (betterAuth as jest.Mock).mock.calls[0][0];
    expect(callArg.emailAndPassword.enabled).toBe(true);
    expect(callArg.baseURL).toBe('http://localhost:3000');
    expect(callArg.basePath).toBe('/api/auth');
  });

  it('configures Google OAuth social provider', async () => {
    const { betterAuth } = await import('better-auth');
    await import('../src/config/auth');

    const callArg = (betterAuth as jest.Mock).mock.calls[0][0];
    expect(callArg.socialProviders.google).toBeDefined();
    expect(callArg.socialProviders.google.clientId).toBe('google-client-id');
    expect(callArg.socialProviders.google.clientSecret).toBe('google-client-secret');
  });

  it('passes trustedOrigins for Expo deep link and dev hosts (Better Auth callbackURL)', async () => {
    const { betterAuth } = await import('better-auth');
    await import('../src/config/auth');

    const callArg = (betterAuth as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(callArg.trustedOrigins)).toBe(true);
    expect(callArg.trustedOrigins).toEqual(
      expect.arrayContaining([
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        'huellitas://',
        'huellitas://*',
      ]),
    );
  });

  it('configures session with 15-minute access token and 30-day cookie cache', async () => {
    const { betterAuth } = await import('better-auth');
    await import('../src/config/auth');

    const callArg = (betterAuth as jest.Mock).mock.calls[0][0];
    const { session } = callArg;
    expect(session.expiresIn).toBe(60 * 15);
    expect(session.cookieCache.enabled).toBe(true);
    expect(session.cookieCache.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it('creates a pg Pool with DATABASE_URL', async () => {
    const { Pool } = await import('pg');
    await import('../src/config/auth');

    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgresql://localhost/huellitas_test',
    });
  });

  it('exports a valid auth object with handler and api', async () => {
    const { auth } = await import('../src/config/auth');
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe('function');
    expect(auth.api).toBeDefined();
  });
});

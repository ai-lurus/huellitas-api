describe('firebase config', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('initFirebase returns false when env missing', async () => {
    // Mock env module BEFORE importing firebase (avoid env.ts process.exit)
    jest.doMock('../../../src/config/env', () => ({
      env: {
        NODE_ENV: 'test',
        PORT: 3000,
        API_URL: 'https://example.com/api',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        BETTER_AUTH_URL: 'https://example.com/auth',
        TRUSTED_ORIGINS: undefined,
        EXPO_APP_SCHEME: 'huellitas',
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
        FIREBASE_PROJECT_ID: undefined,
        FIREBASE_CLIENT_EMAIL: undefined,
        FIREBASE_PRIVATE_KEY: undefined,
        R2_ACCOUNT_ID: undefined,
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: undefined,
        R2_PUBLIC_URL: undefined,
        SENTRY_DSN: undefined,
      },
    }));

    const { initFirebase } = await import('../../../src/config/firebase');
    expect(initFirebase()).toBe(false);
  });

  it('initFirebase initializes once when env present', async () => {
    jest.doMock('../../../src/config/env', () => ({
      env: {
        NODE_ENV: 'test',
        PORT: 3000,
        API_URL: 'https://example.com/api',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        BETTER_AUTH_URL: 'https://example.com/auth',
        TRUSTED_ORIGINS: undefined,
        EXPO_APP_SCHEME: 'huellitas',
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
        FIREBASE_PROJECT_ID: 'p',
        FIREBASE_CLIENT_EMAIL: 'a@b.com',
        FIREBASE_PRIVATE_KEY: 'k',
        R2_ACCOUNT_ID: undefined,
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: undefined,
        R2_PUBLIC_URL: undefined,
        SENTRY_DSN: undefined,
      },
    }));

    const initializeApp = jest.fn();
    jest.doMock('firebase-admin', () => ({
      __esModule: true,
      default: {
        apps: [],
        initializeApp,
        credential: { cert: jest.fn() },
        messaging: jest.fn(),
      },
    }));

    const { initFirebase } = await import('../../../src/config/firebase');
    expect(initFirebase()).toBe(true);
    expect(initFirebase()).toBe(true);
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
});

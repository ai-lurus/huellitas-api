import express from 'express';
import request from 'supertest';
import helmet from 'helmet';
import cors from 'cors';

function buildApp() {
  // Import after env is ready (config/env validates and can exit)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { corsOptions, helmetOptions } =
    require('../../src/config/security') as typeof import('../../src/config/security');
  const app = express();
  app.use(helmet(helmetOptions));
  app.use(cors(corsOptions));
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Security middleware', () => {
  beforeAll(() => {
    process.env['API_URL'] = process.env['API_URL'] ?? 'https://example.com/api';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://user:pass@localhost:5432/db';
    process.env['BETTER_AUTH_SECRET'] = process.env['BETTER_AUTH_SECRET'] ?? 'x'.repeat(32);
    process.env['BETTER_AUTH_URL'] = process.env['BETTER_AUTH_URL'] ?? 'https://example.com/auth';
  });

  it('sets Helmet security headers', async () => {
    const app = buildApp();
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeTruthy();
    expect(res.headers['content-security-policy']).toBeTruthy();
  });

  it('CORS blocks unknown origins (no ACAO header)', async () => {
    const app = buildApp();
    const res = await request(app).get('/ok').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

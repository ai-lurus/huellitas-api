import express from 'express';
import request from 'supertest';
import {
  authLimiter,
  apiLimiter,
  uploadLimiter,
} from '../../../src/middleware/rateLimit.middleware';
import type { RequestHandler } from 'express';

function appWith(routeSetup: (app: express.Express) => void) {
  const app = express();
  routeSetup(app);
  return app;
}

describe('rateLimit middleware', () => {
  beforeAll(() => {
    process.env['RATE_LIMIT_TEST'] = '1';
  });
  afterAll(() => {
    delete process.env['RATE_LIMIT_TEST'];
  });

  it('authLimiter: 6ta request en 1 min retorna 429 y Retry-After', async () => {
    const app = appWith((app) => {
      app.get('/api/auth/test', authLimiter, (_req, res) => res.json({ ok: true }));
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/api/auth/test');
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get('/api/auth/test');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
  });

  it('apiLimiter: 101ra request bloquea por userId', async () => {
    const app = appWith((app) => {
      const attachUser: RequestHandler = (req, _res, next) => {
        (req as unknown as { user: { id: string; email: string; name: string } }).user = {
          id: 'u-1',
          email: 'a@b.com',
          name: 'A',
        };
        next();
      };
      app.use(attachUser);
      app.get('/api/v1/test', apiLimiter, (_req, res) => res.json({ ok: true }));
    });

    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/api/v1/test');
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get('/api/v1/test');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
  });

  it('uploadLimiter: 11va request bloquea por userId', async () => {
    const app = appWith((app) => {
      const attachUser: RequestHandler = (req, _res, next) => {
        (req as unknown as { user: { id: string; email: string; name: string } }).user = {
          id: 'u-1',
          email: 'a@b.com',
          name: 'A',
        };
        next();
      };
      app.use(attachUser);
      app.post('/api/v1/upload', uploadLimiter, (_req, res) => res.json({ ok: true }));
    });

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/v1/upload');
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post('/api/v1/upload');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
  });
});

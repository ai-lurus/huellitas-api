import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import 'dotenv/config';

const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

const TEST_USER_ID = 'test-user-users-api';
const TEST_EMAIL = 'test-users-api@huellitas.app';

jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    req.user = { id: TEST_USER_ID, email: TEST_EMAIL, name: 'Onboarding Test' };
    next();
  },
}));

jest.mock('../../src/services/storage.service', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    url: 'https://cdn.huellitas.app/avatars/test/face.jpg',
    id: 'mock-avatar-upload-id',
  }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { usersRouter } = require('../../src/routes/users.routes') as {
    usersRouter: express.Router;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorMiddleware } = require('../../src/middleware/error.middleware') as {
    errorMiddleware: express.ErrorRequestHandler;
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', usersRouter);
  app.use('/users', usersRouter);
  app.use(errorMiddleware);
  return app;
}

describeIfDb('Users API — perfil y onboarding', () => {
  let pool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    // Alineado con migración 004; permite CI/entornos sin `npm run migrate` previo
    await pool.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ`,
    );
    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
      [TEST_USER_ID, 'Onboarding Test', TEST_EMAIL],
    );
    await pool.query(
      `UPDATE "user" SET onboarding_completed_at = NULL, image = NULL WHERE id = $1`,
      [TEST_USER_ID],
    );
    app = buildTestApp();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER_ID]);
    await pool.end();
  });

  describe('GET /api/v1/users/me', () => {
    it('devuelve onboardingCompleted false cuando onboarding_completed_at es NULL', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(TEST_USER_ID);
      expect(res.body.data.onboardingCompleted).toBe(false);
      expect(res.body.data.onboardingCompletedAt).toBeNull();
      expect(res.body.data.name).toBe('Onboarding Test');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('rechaza cuerpo vacío', async () => {
      const res = await request(app).patch('/api/v1/users/me').send({});
      expect(res.status).toBe(400);
    });

    it('actualiza nombre, imagen y marca onboarding completado', async () => {
      const res = await request(app).patch('/api/v1/users/me').send({
        name: 'María Pérez',
        image: 'https://cdn.example.com/u/1.png',
        onboardingCompleted: true,
        alertsEnabled: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('María Pérez');
      expect(res.body.data.image).toBe('https://cdn.example.com/u/1.png');
      expect(res.body.data.onboardingCompleted).toBe(true);
      expect(res.body.data.onboardingCompletedAt).toBeTruthy();
      expect(res.body.data.alertsEnabled).toBe(true);
    });

    it('puede enviar ubicación con lat/lng', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .send({
          location: { lat: 19.4326, lng: -99.1332 },
        });
      expect(res.status).toBe(200);
    });
  });

  describe('Alias /users (mismo router que /api/v1/users)', () => {
    it('GET /users/me coincide con /api/v1/users/me', async () => {
      const alias = await request(app).get('/users/me');
      const v1 = await request(app).get('/api/v1/users/me');
      expect(alias.status).toBe(200);
      expect(v1.status).toBe(200);
      expect(alias.body.data).toEqual(v1.body.data);
    });

    it('PATCH /users/me persiste igual que la ruta versionada', async () => {
      const res = await request(app).patch('/users/me').send({ name: 'Alias User' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Alias User');
    });
  });

  describe('POST /api/v1/users/me/avatar', () => {
    it('sube foto y devuelve URL', async () => {
      const res = await request(app)
        .post('/api/v1/users/me/avatar')
        .attach('photo', Buffer.from('fake-avatar'), {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toContain('https://');
    });
  });
});

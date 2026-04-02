import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import 'dotenv/config';

// Skip integration tests if no DB is configured
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

const TEST_USER_ID = 'test-user-integration';
const OTHER_USER_ID = 'test-other-user-integration';

// Mock requireAuth to inject a test user without hitting Better Auth
jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    req.user = { id: TEST_USER_ID, email: 'test@huellitas.app', name: 'Test User' };
    next();
  },
}));

// Mock storage service to avoid real R2 calls
jest.mock('../../src/services/storage.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://cdn.huellitas.app/pets/test-pet/photo.jpg'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

// Build a minimal test app (avoids importing src/index.ts which uses better-auth/node ESM)
function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { petsRouter } = require('../../src/routes/pets.routes') as { petsRouter: express.Router };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorMiddleware } = require('../../src/middleware/error.middleware') as {
    errorMiddleware: express.ErrorRequestHandler;
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/pets', petsRouter);
  app.use(errorMiddleware);
  return app;
}

describeIfDb('Pets API — Integration Tests', () => {
  let pool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

    // Create test users required by FK constraint on pets.user_id
    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3), ($4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        TEST_USER_ID,
        'Test User',
        'test-integration@huellitas.app',
        OTHER_USER_ID,
        'Other User',
        'other-integration@huellitas.app',
      ],
    );

    app = buildTestApp();
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM pets WHERE user_id = ANY($1)`, [[TEST_USER_ID, OTHER_USER_ID]]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [[TEST_USER_ID, OTHER_USER_ID]]);
    await pool.end();
  });

  describe('POST /api/v1/pets', () => {
    it('creates a pet and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Firulais', species: 'dog', breed: 'Labrador', sex: 'male' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Firulais');
      expect(res.body.data.species).toBe('dog');
      expect(res.body.data.user_id).toBe(TEST_USER_ID);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app).post('/api/v1/pets').send({ breed: 'Labrador' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 when max 3 pets exceeded', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/pets')
          .send({ name: `Pet ${i}`, species: 'cat' });
      }

      const res = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Fourth Pet', species: 'dog' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('LIMIT_EXCEEDED');
    });
  });

  describe('GET /api/v1/pets', () => {
    it('returns empty list when user has no pets', async () => {
      const res = await request(app).get('/api/v1/pets');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns only non-deleted pets for the user', async () => {
      await request(app).post('/api/v1/pets').send({ name: 'Miau', species: 'cat' });
      await request(app).post('/api/v1/pets').send({ name: 'Rex', species: 'dog' });

      const res = await request(app).get('/api/v1/pets');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/pets/:id', () => {
    it('returns a single pet', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Buddy', species: 'dog' });

      const res = await request(app).get(`/api/v1/pets/${created.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Buddy');
    });

    it('returns 404 for non-existent pet', async () => {
      const res = await request(app).get('/api/v1/pets/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('returns 403 when pet belongs to another user', async () => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO pets (user_id, name, species) VALUES ($1, $2, $3) RETURNING id`,
        [OTHER_USER_ID, 'NotMine', 'cat'],
      );
      const otherId = rows[0]?.id as string;

      const res = await request(app).get(`/api/v1/pets/${otherId}`);
      expect(res.status).toBe(403);

      // afterEach handles cleanup
    });
  });

  describe('PATCH /api/v1/pets/:id', () => {
    it('updates a pet', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'OldName', species: 'rabbit' });

      const res = await request(app)
        .patch(`/api/v1/pets/${created.body.data.id}`)
        .send({ name: 'NewName', color: 'white' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('NewName');
      expect(res.body.data.color).toBe('white');
    });
  });

  describe('DELETE /api/v1/pets/:id', () => {
    it('soft deletes a pet and returns 204', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Tobi', species: 'dog' });

      const petId = created.body.data.id as string;
      const deleteRes = await request(app).delete(`/api/v1/pets/${petId}`);
      expect(deleteRes.status).toBe(204);

      const listRes = await request(app).get('/api/v1/pets');
      const ids = (listRes.body.data as Array<{ id: string }>).map((p) => p.id);
      expect(ids).not.toContain(petId);
    });

    it('returns 404 when deleting an already deleted pet', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Gone', species: 'bird' });

      const petId = created.body.data.id as string;
      await request(app).delete(`/api/v1/pets/${petId}`);
      const res = await request(app).delete(`/api/v1/pets/${petId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/pets/:id/photos', () => {
    it('uploads a photo and returns the pet with updated photos array', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'PhotoPet', species: 'dog' });

      const petId = created.body.data.id as string;
      const res = await request(app)
        .post(`/api/v1/pets/${petId}/photos`)
        .attach('photo', Buffer.from('fake-image'), {
          filename: 'dog.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.photos).toHaveLength(1);
    });

    it('returns 400 when no file is provided', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'NoPhoto', species: 'cat' });

      const res = await request(app).post(`/api/v1/pets/${created.body.data.id}/photos`);
      expect(res.status).toBe(400);
    });
  });
});

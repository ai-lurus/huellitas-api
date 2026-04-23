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
  uploadFile: jest.fn().mockResolvedValue({
    url: 'https://cdn.huellitas.app/pets/test-pet/photo.jpg',
    id: 'mock-upload-id',
  }),
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
      expect(res.body.data.userId).toBe(TEST_USER_ID);
      expect(res.body.data.isLost).toBe(false);
    });

    it('returns 422 for missing required fields', async () => {
      const res = await request(app).post('/api/v1/pets').send({ breed: 'Labrador' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 when max 3 pets exceeded', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/pets')
          .send({ name: `Pet ${i}`, species: 'cat', sex: 'female' });
      }

      const res = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Fourth Pet', species: 'dog', sex: 'male' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('LIMIT_EXCEEDED');
      expect(res.body.error).toBe('You can only have 3 pets');
    });
  });

  describe('GET /api/v1/pets', () => {
    it('returns empty list when user has no pets', async () => {
      const res = await request(app).get('/api/v1/pets');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns only non-deleted pets for the user', async () => {
      await request(app).post('/api/v1/pets').send({ name: 'Miau', species: 'cat', sex: 'female' });
      await request(app).post('/api/v1/pets').send({ name: 'Rex', species: 'dog', sex: 'male' });

      const res = await request(app).get('/api/v1/pets');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('isLost');
    });

    it('incluye coverPhotoUrl (primera foto) cuando hay fotos', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'ConFoto', species: 'dog', sex: 'male' });
      const petId = created.body.data.id as string;

      await request(app)
        .post(`/api/v1/pets/${petId}/photos`)
        .attach('photo', Buffer.from('x'), { filename: 'a.jpg', contentType: 'image/jpeg' });

      const listRes = await request(app).get('/api/v1/pets');
      const item = (listRes.body.data as Array<{ id: string; coverPhotoUrl: string | null }>).find(
        (p) => p.id === petId,
      );
      expect(item?.coverPhotoUrl).toBe('https://cdn.huellitas.app/pets/test-pet/photo.jpg');
    });
  });

  describe('GET /api/v1/pets/:petId', () => {
    it('returns a single pet', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Buddy', species: 'dog', sex: 'male' });

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

  describe('PATCH /api/v1/pets/:petId', () => {
    it('updates a pet', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'OldName', species: 'rabbit', sex: 'unknown' });

      const res = await request(app)
        .patch(`/api/v1/pets/${created.body.data.id}`)
        .send({ name: 'NewName', color: 'white' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('NewName');
      expect(res.body.data.color).toBe('white');
    });

    it('returns 403 when pet belongs to another user', async () => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO pets (user_id, name, species, sex) VALUES ($1, $2, $3, $4) RETURNING id`,
        [OTHER_USER_ID, 'Foreign', 'cat', 'female'],
      );
      const otherId = rows[0]?.id as string;

      const res = await request(app).patch(`/api/v1/pets/${otherId}`).send({ name: 'Hack' });
      expect(res.status).toBe(403);
    });

    it('returns 422 for empty patch body', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'PatchEmpty', species: 'dog', sex: 'male' });

      const res = await request(app).patch(`/api/v1/pets/${created.body.data.id}`).send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('permite actualizar isLost para el badge de perdido', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Perdido', species: 'cat', sex: 'female' });
      const petId = created.body.data.id as string;

      const patchRes = await request(app).patch(`/api/v1/pets/${petId}`).send({ isLost: true });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.isLost).toBe(true);

      const getRes = await request(app).get(`/api/v1/pets/${petId}`);
      expect(getRes.body.data.isLost).toBe(true);
      expect(getRes.body.data.coverPhotoUrl).toBeNull();
    });
  });

  describe('DELETE /api/v1/pets/:petId', () => {
    it('soft deletes a pet and returns 204', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'Tobi', species: 'dog', sex: 'male' });

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
        .send({ name: 'Gone', species: 'bird', sex: 'unknown' });

      const petId = created.body.data.id as string;
      await request(app).delete(`/api/v1/pets/${petId}`);
      const res = await request(app).delete(`/api/v1/pets/${petId}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when pet belongs to another user', async () => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO pets (user_id, name, species, sex) VALUES ($1, $2, $3, $4) RETURNING id`,
        [OTHER_USER_ID, 'Foreign', 'cat', 'female'],
      );
      const otherId = rows[0]?.id as string;

      const res = await request(app).delete(`/api/v1/pets/${otherId}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/pets/:petId/photos', () => {
    it('uploads a photo and returns public url and id', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'PhotoPet', species: 'dog', sex: 'male' });

      const petId = created.body.data.id as string;
      const res = await request(app)
        .post(`/api/v1/pets/${petId}/photos`)
        .attach('photo', Buffer.from('fake-image'), {
          filename: 'dog.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.url).toContain('https://');
      expect(res.body.data.id).toBe('mock-upload-id');

      const getRes = await request(app).get(`/api/v1/pets/${petId}`);
      expect(getRes.body.data.photos).toHaveLength(1);
    });

    it('returns 400 when no file is provided', async () => {
      const created = await request(app)
        .post('/api/v1/pets')
        .send({ name: 'NoPhoto', species: 'cat', sex: 'female' });

      const res = await request(app).post(`/api/v1/pets/${created.body.data.id}/photos`);
      expect(res.status).toBe(400);
    });
  });
});

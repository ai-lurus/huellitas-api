import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import 'dotenv/config';

jest.setTimeout(20000);

const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

const TEST_USER_ID = 'test-user-lost-reports-nearby';
const TEST_EMAIL = 'test-lost-reports-nearby@huellitas.app';

jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    req.user = { id: TEST_USER_ID, email: TEST_EMAIL, name: 'Geo Test' };
    next();
  },
}));

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { lostReportsRouter } = require('../../src/routes/lost-reports.routes') as {
    lostReportsRouter: express.Router;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorMiddleware } = require('../../src/middleware/error.middleware') as {
    errorMiddleware: express.ErrorRequestHandler;
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/lost-reports', lostReportsRouter);
  app.use(errorMiddleware);
  return app;
}

describeIfDb('Lost Reports API — GET /nearby', () => {
  let pool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  let petId: string;
  let reportNearId: string;
  let reportFarId: string;

  const baseLat = 19.4326;
  const baseLng = -99.1332;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
      [TEST_USER_ID, 'Geo Test', TEST_EMAIL],
    );

    const pet = await pool.query<{ id: string }>(
      `INSERT INTO pets (user_id, name, species)
       VALUES ($1, 'Firulais', 'dog')
       RETURNING id`,
      [TEST_USER_ID],
    );
    const createdPetId = pet.rows[0]?.id;
    if (!createdPetId) throw new Error('Failed to create pet fixture');
    petId = createdPetId;

    // Cerca (~0.5 km)
    const near = await pool.query<{ id: string }>(
      `
      INSERT INTO lost_reports (pet_id, user_id, location, last_seen_at, status)
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
        NOW(),
        'active'
      )
      RETURNING id
      `,
      [petId, TEST_USER_ID, baseLng + 0.005, baseLat],
    );
    const createdNearId = near.rows[0]?.id;
    if (!createdNearId) throw new Error('Failed to create nearby lost_report fixture');
    reportNearId = createdNearId;

    // Lejos (~> 10 km)
    const far = await pool.query<{ id: string }>(
      `
      INSERT INTO lost_reports (pet_id, user_id, location, last_seen_at, status)
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
        NOW(),
        'active'
      )
      RETURNING id
      `,
      [petId, TEST_USER_ID, baseLng + 0.2, baseLat],
    );
    const createdFarId = far.rows[0]?.id;
    if (!createdFarId) throw new Error('Failed to create far lost_report fixture');
    reportFarId = createdFarId;

    app = buildTestApp();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM lost_reports WHERE user_id = $1`, [TEST_USER_ID]);
    await pool.query(`DELETE FROM pets WHERE user_id = $1`, [TEST_USER_ID]);
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER_ID]);
    await pool.end();
  });

  it('devuelve reportes activos dentro del radio e incluye distance (m)', async () => {
    const res = await request(app).get('/api/v1/lost-reports/nearby').query({
      lat: baseLat,
      lng: baseLng,
      radius: 5,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(reportNearId);
    expect(ids).not.toContain(reportFarId);

    const near = (res.body.data as Array<{ id: string; distance: number }>).find(
      (r) => r.id === reportNearId,
    );
    expect(typeof near?.distance).toBe('number');
    expect((near?.distance ?? 0) > 0).toBe(true);
  });

  it('400 si lat/lng inválidos', async () => {
    const res = await request(app).get('/api/v1/lost-reports/nearby').query({
      lat: 999,
      lng: baseLng,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('filtra por species si se envía', async () => {
    const res = await request(app).get('/api/v1/lost-reports/nearby').query({
      lat: baseLat,
      lng: baseLng,
      radius: 5,
      species: 'cat',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).not.toContain(reportNearId);
  });
});

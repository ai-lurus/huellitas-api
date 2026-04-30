import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import 'dotenv/config';

const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

const OWNER_ID = 'test-owner-sightings';
const REPORTER_ID = 'test-reporter-sightings';

jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    const forced = req.headers['x-test-user'] as string | undefined;
    const id = forced ?? REPORTER_ID;
    const email = id === OWNER_ID ? 'o@t.com' : 'r@t.com';
    const name = id === OWNER_ID ? 'Owner' : 'Reporter';
    req.user = { id, email, name };
    next();
  },
}));

jest.mock('../../src/services/storage.service', () => ({
  uploadFile: jest.fn().mockImplementation(async (_buf, folder: string, originalName: string) => {
    const ext = String(originalName).split('.').pop() ?? 'bin';
    return { url: `https://cdn.huellitas.app/${folder}/mock.${ext}`, id: 'mock-upload-id' };
  }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

const sendSightingNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/notifications.service', () => ({
  notificationsService: { sendSightingNotification },
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

describeIfDb('Sightings endpoints', () => {
  let pool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let petId: string;
  let reportId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    await pool.query(
      `ALTER TABLE sightings ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'`,
    );

    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
      [OWNER_ID, 'Owner', 'o@t.com'],
    );
    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
      [REPORTER_ID, 'Reporter', 'r@t.com'],
    );

    const pet = await pool.query<{ id: string }>(
      `INSERT INTO pets (user_id, name, species) VALUES ($1, 'Luna', 'dog') RETURNING id`,
      [OWNER_ID],
    );
    const createdPetId = pet.rows[0]?.id;
    if (!createdPetId) throw new Error('Failed to create pet fixture');
    petId = createdPetId;

    const report = await pool.query<{ id: string }>(
      `
      INSERT INTO lost_reports (pet_id, user_id, location, last_seen_at, status)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint(-99.1332, 19.4326), 4326)::geography, NOW(), 'active')
      RETURNING id
      `,
      [petId, OWNER_ID],
    );
    const createdReportId = report.rows[0]?.id;
    if (!createdReportId) throw new Error('Failed to create report fixture');
    reportId = createdReportId;

    app = buildTestApp();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sightings WHERE report_id = $1`, [reportId]);
    await pool.query(`DELETE FROM lost_reports WHERE id = $1`, [reportId]);
    await pool.query(`DELETE FROM pets WHERE id = $1`, [petId]);
    await pool.query(`DELETE FROM "user" WHERE id = $1 OR id = $2`, [OWNER_ID, REPORTER_ID]);
    await pool.end();
  });

  it('POST crea sighting, devuelve data y notifica al dueño', async () => {
    sendSightingNotification.mockClear();
    const { uploadFile } = jest.requireMock('../../src/services/storage.service') as {
      uploadFile: jest.Mock;
    };
    uploadFile.mockClear();
    const res = await request(app)
      .post(`/api/v1/lost-reports/${reportId}/sightings`)
      .field('lat', '19.43')
      .field('lng', '-99.13')
      .field('message', 'Lo vi por el parque')
      .attach('photo', Buffer.from('fake'), { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
    });
    expect(res.body.data.photo).toContain('https://');
    expect(String(res.body.data.reporter.id)).toMatch(/^anon_/);
    expect(uploadFile).toHaveBeenCalled();
    const folder = uploadFile.mock.calls[0]?.[1] as string;
    expect(folder).toMatch(/^sightings\/[0-9a-f-]{36}$/);

    // background: damos un tick
    await new Promise((r) => setTimeout(r, 0));
    expect(sendSightingNotification).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OWNER_ID, petName: 'Luna', reportId }),
    );
  });

  it('GET sightings solo dueño (403 si no)', async () => {
    const res = await request(app).get(`/api/v1/lost-reports/${reportId}/sightings`);
    expect(res.status).toBe(403);

    const ownerRes = await request(app)
      .get(`/api/v1/lost-reports/${reportId}/sightings`)
      .set('x-test-user', OWNER_ID);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.success).toBe(true);
    expect(Array.isArray(ownerRes.body.data)).toBe(true);
  });

  it('rechaza crear sighting si el reporte está resuelto (400)', async () => {
    await pool.query(`UPDATE lost_reports SET status = 'resolved' WHERE id = $1`, [reportId]);
    const res = await request(app)
      .post(`/api/v1/lost-reports/${reportId}/sightings`)
      .field('lat', '19.43')
      .field('lng', '-99.13');
    expect(res.status).toBe(400);
    await pool.query(`UPDATE lost_reports SET status = 'active' WHERE id = $1`, [reportId]);
  });
});

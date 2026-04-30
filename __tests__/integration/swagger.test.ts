import request from 'supertest';
import express from 'express';
import SwaggerParser from '@apidevtools/swagger-parser';

function buildApp(includeDocs: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { docsRouter } = require('../../src/routes/docs.routes') as { docsRouter: express.Router };
  const app = express();
  if (includeDocs) app.use('/api', docsRouter);
  return app;
}

describe('Swagger docs', () => {
  it('serves /api/docs in non-production', async () => {
    const app = buildApp(true);
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger UI');
  });

  it('returns 404 for /api/docs in production', async () => {
    const app = buildApp(false);
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(404);
  });

  it('swagger JSON is valid', async () => {
    const app = buildApp(true);
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    const api = res.body;
    await SwaggerParser.validate(api);
  });
});

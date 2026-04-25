import request from 'supertest';
import express from 'express';

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { requestIdMiddleware } = require('../../src/middleware/requestId.middleware') as {
    requestIdMiddleware: express.RequestHandler;
  };

  const app = express();
  app.use(requestIdMiddleware);
  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('requestIdMiddleware', () => {
  it('adds X-Request-ID header to responses', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });
});

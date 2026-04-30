import request from 'supertest';
import express from 'express';

jest.mock('../../src/db/index', () => ({
  checkDbConnection: jest.fn(),
}));

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { healthRouter } = require('../../src/routes/health.routes') as {
    healthRouter: express.Router;
  };
  const app = express();
  app.use('/', healthRouter);
  return app;
}

describe('GET /health', () => {
  it('returns 200 ok when dbConnected=true', async () => {
    const { checkDbConnection } = jest.requireMock('../../src/db/index') as {
      checkDbConnection: jest.Mock;
    };
    checkDbConnection.mockResolvedValue(true);

    const app = buildTestApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dbConnected).toBe(true);
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.timestamp).toBeTruthy();
  });

  it('returns 503 degraded when dbConnected=false', async () => {
    const { checkDbConnection } = jest.requireMock('../../src/db/index') as {
      checkDbConnection: jest.Mock;
    };
    checkDbConnection.mockResolvedValue(false);

    const app = buildTestApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dbConnected).toBe(false);
  });
});

describe('GET /', () => {
  it('returns API info', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Huellitas API', version: '1.0.0' });
  });
});

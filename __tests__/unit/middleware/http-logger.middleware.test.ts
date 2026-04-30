import express from 'express';
import request from 'supertest';

jest.mock('../../../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('httpLoggerMiddleware', () => {
  it('logs method/url/status/duration with requestId', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { httpLoggerMiddleware } =
      require('../../../src/middleware/http-logger.middleware') as typeof import('../../../src/middleware/http-logger.middleware');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logger } = require('../../../src/config/logger') as { logger: { info: jest.Mock } };

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { requestId: string }).requestId = 'rid-1';
      next();
    });
    app.use(httpLoggerMiddleware);
    app.get('/ok', (_req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'rid-1',
        method: 'GET',
        statusCode: 200,
      }),
    );
  });
});

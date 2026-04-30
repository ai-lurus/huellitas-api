import express from 'express';
import request from 'supertest';

jest.mock('@sentry/node', () => ({
  setTag: jest.fn(),
}));

describe('sentryContextMiddleware', () => {
  it('sets safe tags without reading body', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { sentryContextMiddleware } =
      require('../../../src/middleware/sentry-context.middleware') as typeof import('../../../src/middleware/sentry-context.middleware');
    const Sentry = jest.requireMock('@sentry/node') as { setTag: jest.Mock };

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { requestId: string }).requestId = 'rid-2';
      next();
    });
    app.use(sentryContextMiddleware);
    app.get('/x', (_req, res) => res.status(200).send('ok'));

    const res = await request(app).get('/x');
    expect(res.status).toBe(200);
    expect(Sentry.setTag).toHaveBeenCalledWith('requestId', 'rid-2');
    expect(Sentry.setTag).toHaveBeenCalledWith('method', 'GET');
  });
});

jest.mock('../../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

describe('db/index slow query + warmup', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('logs slow queries without values', async () => {
    const query = jest.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { rows: [] };
    });
    const connect = jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() });

    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => ({
        query,
        connect,
      })),
    }));

    process.env['DB_SLOW_QUERY_MS'] = '0';
    const { getPool } = await import('../../../src/db/index');
    const pool = getPool();
    await pool.query('SELECT 1');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logger } = require('../../../src/config/logger') as { logger: { warn: jest.Mock } };
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Slow DB query',
        query: expect.stringContaining('SELECT 1'),
      }),
    );
  });
});

import { runExpireReportsJob } from '../../../src/jobs/expireReports.job';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../../src/config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('expireReports job', () => {
  it('logs count and does not throw when count is 0', async () => {
    const repo: { expireOldReports: (daysOld: number) => Promise<number> } = {
      expireOldReports: jest.fn().mockResolvedValue(0),
    };
    const count = await runExpireReportsJob(
      repo as unknown as Parameters<typeof runExpireReportsJob>[0],
      30,
    );
    expect(count).toBe(0);
  });
});

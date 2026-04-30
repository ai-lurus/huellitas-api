import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { logger } from '../config/logger';
import { LostReportRepository } from '../repositories/lost-report.repository';

export async function runExpireReportsJob(
  repo: LostReportRepository = new LostReportRepository(),
  daysOld = 30,
): Promise<number> {
  const count = await repo.expireOldReports(daysOld);
  logger.info({ message: 'Expired stale reports', count });
  return count;
}

export function scheduleExpireReports(): void {
  // Daily at 02:00 UTC
  cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        await runExpireReportsJob();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        logger.error({
          message: 'Failed to expire reports',
          errorMessage: e.message,
          stack: e.stack,
        });
        Sentry.captureException(e);
      }
    },
    { timezone: 'UTC' },
  );
}

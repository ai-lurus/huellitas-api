import app from './app';
import { logger } from './config/logger';
import { warmupPool } from './db/index';
import { scheduleExpireReports } from './jobs/expireReports.job';

const PORT = process.env['PORT'] ?? 3000;

// En Vercel (serverless) NO hay que ejecutar `listen()` ni jobs de fondo:
// Vercel invoca la función por request y espera que el handler termine.
if (!process.env['VERCEL']) {
  app.listen(PORT, () => {
    logger.info(`🐾 Huellitas API running on port ${PORT}`);
  });

  // Background jobs (solo en runtime persistente)
  scheduleExpireReports();
  void warmupPool(2).catch((err) => {
    logger.warn({ message: 'DB warmup failed', err });
  });
}

export default app;

import { Router } from 'express';
import { checkDbConnection } from '../db/index';

const router = Router();

const API_VERSION = '1.0.0';

router.get('/', (_req, res) => {
  res.json({ name: 'Huellitas API', version: API_VERSION });
});

router.get('/health', async (_req, res) => {
  const dbConnected = await checkDbConnection();
  const status = dbConnected ? 'ok' : 'degraded';
  res.status(dbConnected ? 200 : 503).json({
    status,
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    dbConnected,
  });
});

export { router as healthRouter };

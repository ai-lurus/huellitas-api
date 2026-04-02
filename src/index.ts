import 'dotenv/config';
import './config/env'; // Fail fast on missing env vars
import './config/sentry'; // Must be before express import
import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { logger } from './config/logger';
import { checkDbConnection } from './db/index';
import { auth } from './config/auth';
import { apiRouter } from './routes/index';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env['NODE_ENV'] === 'production'
        ? ['https://huellitas.app']
        : ['http://localhost:8081', 'http://localhost:19006'],
    credentials: true,
  }),
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

// Better Auth routes — rate limited to 5 req/min per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.all('/api/auth/*', authLimiter, toNodeHandler(auth));

// Health check (no auth required)
app.get('/health', async (_req: express.Request, res: express.Response) => {
  const dbOk = await checkDbConnection();
  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    version: process.env['npm_package_version'] ?? '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1', apiRouter);

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler (must be last)
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`🐾 Huellitas API running on port ${PORT}`);
});

export { app };

import 'dotenv/config';
import { corsAllowedOrigins } from './config/env'; // valida env y expone orígenes CORS
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
import { usersRouter } from './routes/users.routes';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { httpLoggerMiddleware } from './middleware/http-logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: corsAllowedOrigins,
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
app.use(httpLoggerMiddleware);

// Better Auth — límite por IP (get-session en el cliente puede dispararse a menudo)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env['NODE_ENV'] === 'production' ? 60 : 300,
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
// Alias: el cliente móvil usa `/users/me` sin prefijo `/api/v1`
app.use('/users', usersRouter);

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler (must be last)
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`🐾 Huellitas API running on port ${PORT}`);
});

export { app };

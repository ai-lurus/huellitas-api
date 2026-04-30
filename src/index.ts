import 'dotenv/config';
import { corsAllowedOrigins } from './config/env'; // valida env y expone orígenes CORS
import './config/sentry'; // Must be before express import
import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { logger } from './config/logger';
import { auth } from './config/auth';
import { apiRouter } from './routes/index';
import { usersRouter } from './routes/users.routes';
import { healthRouter } from './routes/health.routes';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { httpLoggerMiddleware } from './middleware/http-logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { authLimiter } from './middleware/rateLimit.middleware';
import { scheduleExpireReports } from './jobs/expireReports.job';
import { sentryContextMiddleware } from './middleware/sentry-context.middleware';

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

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(sentryContextMiddleware);
app.use(httpLoggerMiddleware);

// Better Auth — 5 req/min por IP
app.all('/api/auth/*', authLimiter, toNodeHandler(auth));

// Info + Health check (no auth required, no rate limit)
app.use('/', healthRouter);

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

// Background jobs
scheduleExpireReports();

export { app };

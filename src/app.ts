import 'dotenv/config';
import './config/sentry'; // Must be before express import
import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth';
import { corsOptions, helmetOptions } from './config/security';
import { apiRouter } from './routes/index';
import { usersRouter } from './routes/users.routes';
import { healthRouter } from './routes/health.routes';
import { docsRouter } from './routes/docs.routes';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { httpLoggerMiddleware } from './middleware/http-logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { authLimiter } from './middleware/rateLimit.middleware';
import { sentryContextMiddleware } from './middleware/sentry-context.middleware';

const app = express();

// Detrás de reverse proxy (Vercel, Railway, Render, etc.): IP real y `req.secure` correctos para rate limit / logs.
if (process.env['NODE_ENV'] === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

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

// Swagger (non-production only)
if (process.env['NODE_ENV'] !== 'production') {
  app.use('/api', docsRouter);
}

// API routes
app.use('/api/v1', apiRouter);
// Alias: el cliente móvil usa `/users/me` sin prefijo `/api/v1`
app.use('/users', usersRouter);

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler (must be last)
app.use(errorMiddleware);

export default app;

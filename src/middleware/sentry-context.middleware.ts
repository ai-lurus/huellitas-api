import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export function sentryContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Evita loggear/capturar bodies; solo contexto seguro.
  Sentry.setTag('requestId', req.requestId ?? '');
  Sentry.setTag('method', req.method);
  Sentry.setTag('url', req.originalUrl ?? req.url);
  next();
}

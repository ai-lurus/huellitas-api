import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;
  const userId = req.user?.id;

  if (err instanceof ZodError) {
    logger.warn({
      requestId,
      userId,
      message: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ requestId, userId, code: err.code, message: err.message });
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  Sentry.captureException(err, { user: userId ? { id: userId } : undefined });
  logger.error({ requestId, userId, err, message: 'Unexpected error' });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

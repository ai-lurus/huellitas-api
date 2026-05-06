import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import * as Sentry from '@sentry/node';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  try {
    return new Error(typeof err === 'string' ? err : JSON.stringify(err));
  } catch {
    return new Error('Unknown error');
  }
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;
  const userId = req.user?.id;
  const method = req.method;
  const url = req.originalUrl ?? req.url;

  if (err instanceof ZodError) {
    logger.warn({
      requestId,
      userId,
      method,
      url,
      message: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    logger.warn({ requestId, userId, method, url, message: 'Multer error', code: err.code });
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: 'File too large (max 5 MB)',
        code: 'FILE_TOO_LARGE',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: 'Upload failed',
      code: err.code,
    });
    return;
  }

  if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
    logger.warn({ requestId, userId, method, url, message: 'Invalid upload MIME type' });
    res.status(400).json({
      success: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, WebP.',
      code: 'INVALID_FILE_TYPE',
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ requestId, userId, method, url, code: err.code, message: err.message });
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  const e = toError(err);
  Sentry.captureException(e, { user: userId ? { id: userId } : undefined });
  logger.error({
    requestId,
    userId,
    method,
    url,
    message: 'Unexpected error',
    errorName: e.name,
    errorMessage: e.message,
    stack: e.stack,
  });
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
  });
}

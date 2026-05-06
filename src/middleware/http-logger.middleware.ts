import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = req.requestId;

  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info({
      requestId,
      method: req.method,
      url: req.originalUrl ?? req.url,
      statusCode: res.statusCode,
      durationMs: ms,
    });
  });

  next();
}

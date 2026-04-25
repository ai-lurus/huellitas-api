import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.headers['x-request-id'] = id;
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

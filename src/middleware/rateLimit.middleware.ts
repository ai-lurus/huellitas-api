import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

function keyByIp(req: Request): string {
  return req.ip ?? 'unknown';
}

function keyByUserOrIp(req: Request): string {
  const userId = req.user?.id;
  return userId ? `user:${userId}` : `ip:${req.ip ?? 'unknown'}`;
}

const base = {
  windowMs: 60_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
} as const;

function shouldSkip(): boolean {
  return process.env['NODE_ENV'] === 'test' && process.env['RATE_LIMIT_TEST'] !== '1';
}

export const authLimiter = rateLimit({
  ...base,
  max: 5,
  keyGenerator: keyByIp,
});

export const apiLimiter = rateLimit({
  ...base,
  max: 100,
  keyGenerator: keyByUserOrIp,
  skip: () => shouldSkip(),
});

export const uploadLimiter = rateLimit({
  ...base,
  max: 10,
  keyGenerator: keyByUserOrIp,
  skip: () => shouldSkip(),
});

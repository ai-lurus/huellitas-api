import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import multer from 'multer';
import { errorMiddleware } from '../../../src/middleware/error.middleware';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  LimitExceededError,
} from '../../../src/utils/errors';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../../src/config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

function makeMocks() {
  const req = { requestId: 'test-id', user: undefined } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('errorMiddleware', () => {
  it('returns 422 for ZodError', () => {
    const { req, res, next } = makeMocks();
    const zodErr = z.object({ name: z.string() }).safeParse({ name: 123 });
    const err = (zodErr as { error: ZodError }).error;

    errorMiddleware(err, req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(422);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      success: false,
      error: 'Validation failed',
    });
  });

  it('returns correct status for NotFoundError (404)', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new NotFoundError('Pet not found'), req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      success: false,
      error: 'Pet not found',
      code: 'NOT_FOUND',
    });
  });

  it('returns 403 for ForbiddenError', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new ForbiddenError(), req, res, next);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });

  it('returns 400 for ValidationError', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new ValidationError('Too many photos'), req, res, next);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);
  });

  it('returns 422 for LimitExceededError', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new LimitExceededError('Max pets exceeded'), req, res, next);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(422);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      success: false,
      code: 'LIMIT_EXCEEDED',
    });
  });

  it('returns 413 for MulterError LIMIT_FILE_SIZE', () => {
    const { req, res, next } = makeMocks();
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    errorMiddleware(err, req, res, next);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(413);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      success: false,
      code: 'FILE_TOO_LARGE',
    });
  });

  it('returns 400 for INVALID_FILE_TYPE from multer fileFilter', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new Error('INVALID_FILE_TYPE'), req, res, next);
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      success: false,
      code: 'INVALID_FILE_TYPE',
    });
  });

  it('returns 500 with generic message for unknown errors', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new Error('db crashed'), req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(500);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
  });

  it('does not leak stack trace to client on unknown errors', () => {
    const { req, res, next } = makeMocks();
    errorMiddleware(new Error('secret details'), req, res, next);

    const body = (res.json as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('secret details');
  });

  it('logs stack trace for unknown errors', () => {
    const { req, res, next } = makeMocks();
    const { logger } = jest.requireMock('../../../src/config/logger') as {
      logger: { warn: jest.Mock; error: jest.Mock };
    };

    const err = new Error('boom');
    errorMiddleware(err, req, res, next);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-id',
        message: 'Unexpected error',
        stack: expect.any(String),
      }),
    );
  });

  it('includes userId in logs when user is attached', () => {
    const { req, res, next } = makeMocks();
    (req as unknown as Record<string, unknown>)['user'] = {
      id: 'user-123',
      email: 'a@b.com',
      name: 'A',
    };

    const { logger } = jest.requireMock('../../../src/config/logger') as {
      logger: { warn: jest.Mock; error: jest.Mock };
    };

    errorMiddleware(new AppError('TEST', 400, 'test'), req, res, next);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-123' }));
  });
});

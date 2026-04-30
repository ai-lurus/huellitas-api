import { requireAuth } from '../../../src/middleware/auth.middleware';
import type { Request, Response, NextFunction } from 'express';

jest.mock('../../../src/config/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock('@sentry/node', () => ({
  setUser: jest.fn(),
}));

describe('requireAuth Sentry user context', () => {
  it('sets Sentry user id after auth', async () => {
    const { auth } = jest.requireMock('../../../src/config/auth') as {
      auth: { api: { getSession: jest.Mock } };
    };
    auth.api.getSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', name: 'A' },
    });

    const req = { headers: {} } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    const Sentry = jest.requireMock('@sentry/node') as { setUser: jest.Mock };
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(next).toHaveBeenCalled();
  });
});

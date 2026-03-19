import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../src/middleware/auth.middleware';

// Mock the auth module
jest.mock('../src/config/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { auth } from '../src/config/auth';

const mockGetSession = jest.mocked(auth.api.getSession);

function buildMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as Partial<Request>;
}

function buildMockRes(): { res: Partial<Response>; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status } as unknown as Partial<Response>;
  return { res, status, json };
}

describe('requireAuth middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('calls next() and attaches user when session is valid', async () => {
    const fakeUser = { id: 'user-1', email: 'test@example.com', name: 'Test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSession.mockResolvedValueOnce({ user: fakeUser, session: {} } as any);

    const req = buildMockReq({ authorization: 'Bearer valid-token' });
    const { res } = buildMockRes();

    await requireAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request).user).toEqual(fakeUser);
  });

  it('returns 401 when session is null (no token)', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const req = buildMockReq();
    const { res, status, json } = buildMockRes();

    await requireAuth(req as Request, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when session is undefined (invalid/expired token)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetSession.mockResolvedValueOnce(undefined as any);

    const req = buildMockReq({ authorization: 'Bearer expired-token' });
    const { res, status, json } = buildMockRes();

    await requireAuth(req as Request, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next(err) when getSession throws', async () => {
    const error = new Error('Auth service unavailable');
    mockGetSession.mockRejectedValueOnce(error);

    const req = buildMockReq({ authorization: 'Bearer some-token' });
    const { res } = buildMockRes();

    await requireAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('passes headers to getSession', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const headers = { authorization: 'Bearer abc123', cookie: 'session=xyz' };
    const req = buildMockReq(headers);
    const { res } = buildMockRes();

    await requireAuth(req as Request, res as Response, next);

    expect(mockGetSession).toHaveBeenCalledWith({ headers });
  });
});

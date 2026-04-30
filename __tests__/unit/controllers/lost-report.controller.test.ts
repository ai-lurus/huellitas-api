import type { NextFunction, Request, Response } from 'express';

const nearby = jest.fn();
const getDetail = jest.fn();
const createLostReport = jest.fn();
const addSighting = jest.fn();
const resolve = jest.fn();
const listSightingsOwnerOnly = jest.fn();

jest.mock('../../../src/services/lost-report.service', () => ({
  LostReportService: jest.fn().mockImplementation(() => ({
    nearby,
    getDetail,
    createLostReport,
    addSighting,
    resolve,
    listSightingsOwnerOnly,
  })),
}));

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('lost-report.controller error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getNearbyLostReports forwards errors to next()', async () => {
    const err = new Error('boom');
    nearby.mockRejectedValueOnce(err);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const controller =
      require('../../../src/controllers/lost-report.controller') as typeof import('../../../src/controllers/lost-report.controller');

    const req = { query: { lat: 1, lng: 2, radius: 5 } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.getNearbyLostReports(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('getLostReportDetail forwards errors to next()', async () => {
    const err = new Error('boom');
    getDetail.mockRejectedValueOnce(err);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const controller =
      require('../../../src/controllers/lost-report.controller') as typeof import('../../../src/controllers/lost-report.controller');

    const req = { params: { id: 'rid' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.getLostReportDetail(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('postLostReport returns 401 when unauthenticated', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const controller =
      require('../../../src/controllers/lost-report.controller') as typeof import('../../../src/controllers/lost-report.controller');

    const req = { user: undefined, body: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.postLostReport(req, res, next);
    expect(next).toHaveBeenCalled();
    const passed = (next as unknown as jest.Mock).mock.calls[0]?.[0] as Error;
    expect(passed.name).toBe('UnauthorizedError');
  });

  it('postSighting forwards errors to next()', async () => {
    const err = new Error('boom');
    addSighting.mockRejectedValueOnce(err);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const controller =
      require('../../../src/controllers/lost-report.controller') as typeof import('../../../src/controllers/lost-report.controller');

    const req = {
      user: { id: 'u1' },
      params: { id: 'r1' },
      body: { lat: 1, lng: 2 },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.postSighting(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('patchResolve forwards errors to next()', async () => {
    const err = new Error('boom');
    resolve.mockRejectedValueOnce(err);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const controller =
      require('../../../src/controllers/lost-report.controller') as typeof import('../../../src/controllers/lost-report.controller');

    const req = { user: { id: 'u1' }, params: { id: 'r1' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.patchResolve(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('getSightings forwards errors to next()', async () => {
    const err = new Error('boom');
    listSightingsOwnerOnly.mockRejectedValueOnce(err);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const controller =
      require('../../../src/controllers/lost-report.controller') as typeof import('../../../src/controllers/lost-report.controller');

    const req = { user: { id: 'u1' }, params: { id: 'r1' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.getSightings(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

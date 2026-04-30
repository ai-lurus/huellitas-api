import { LostReportService } from '../../../src/services/lost-report.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../src/utils/errors';
import type { LostReportRepository } from '../../../src/repositories/lost-report.repository';

jest.mock('../../../src/services/storage.service', () => ({
  uploadFile: jest.fn(),
}));

jest.mock('../../../src/services/notifications.service', () => ({
  notificationsService: {
    sendLostPetAlert: jest.fn().mockResolvedValue(undefined),
    sendSightingNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/repositories/pet.repository', () => ({
  PetRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn(),
  })),
}));

describe('LostReportService branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDetail throws NotFound when report missing', async () => {
    const repo = {
      findDetailById: jest.fn().mockResolvedValue(null),
      listSightingsForReport: jest.fn(),
    } as unknown as LostReportRepository;
    const svc = new LostReportService(repo);
    await expect(svc.getDetail('r1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('listSightingsOwnerOnly throws Forbidden when not owner', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({ id: 'r1', user_id: 'owner' }),
      listSightingsForReport: jest.fn(),
    } as unknown as LostReportRepository;
    const svc = new LostReportService(repo);
    await expect(
      svc.listSightingsOwnerOnly({ reportId: 'r1', userId: 'other' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('createLostReport throws NotFound when pet missing', async () => {
    const repo = { create: jest.fn() } as unknown as LostReportRepository;
    const svc = new LostReportService(repo);
    const pets = (svc as unknown as { pets: { findById: jest.Mock } }).pets;
    pets.findById.mockResolvedValue(null);

    await expect(
      svc.createLostReport({ userId: 'u1', petId: 'p1', lat: 1, lng: 2, lastSeenAt: new Date() }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('createLostReport throws Forbidden when pet belongs to another user', async () => {
    const repo = { create: jest.fn() } as unknown as LostReportRepository;
    const svc = new LostReportService(repo);
    const pets = (svc as unknown as { pets: { findById: jest.Mock } }).pets;
    pets.findById.mockResolvedValue({ id: 'p1', user_id: 'someone-else', name: 'N' });

    await expect(
      svc.createLostReport({ userId: 'u1', petId: 'p1', lat: 1, lng: 2, lastSeenAt: new Date() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('addSighting throws ValidationError when report resolved', async () => {
    const repo = {
      findDetailById: jest
        .fn()
        .mockResolvedValue({ id: 'r1', status: 'resolved', user_id: 'o', pet_name: 'P' }),
    } as unknown as LostReportRepository;
    const svc = new LostReportService(repo);
    await expect(
      svc.addSighting({ reportId: 'r1', reporterId: 'u2', lat: 1, lng: 2, files: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('addSighting skips updateSightingPhotos when no photos uploaded', async () => {
    const repo = {
      findDetailById: jest
        .fn()
        .mockResolvedValue({ id: 'r1', status: 'active', user_id: 'o', pet_name: 'P' }),
      createSighting: jest.fn().mockResolvedValue({
        id: 's1',
        report_id: 'r1',
        reporter_id: 'u2',
        lat: 1,
        lng: 2,
        message: null,
        seen_at: new Date().toISOString(),
        photos: [],
      }),
      updateSightingPhotos: jest.fn(),
    } as unknown as LostReportRepository;

    const svc = new LostReportService(repo);
    await svc.addSighting({ reportId: 'r1', reporterId: 'u2', lat: 1, lng: 2, files: [] });
    expect(repo.updateSightingPhotos).not.toHaveBeenCalled();
  });

  it('resolve throws NotFound when report missing', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) } as unknown as LostReportRepository;
    const svc = new LostReportService(repo);
    await expect(svc.resolve({ reportId: 'r1', userId: 'u1' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

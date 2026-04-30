import { NotificationsService } from '../../../src/services/notifications.service';

const sendEachForMulticast = jest.fn();

jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    messaging: () => ({ sendEachForMulticast }),
  },
}));

jest.mock('../../../src/config/firebase', () => ({
  initFirebase: jest.fn().mockReturnValue(true),
  messaging: () => ({ sendEachForMulticast }),
}));

describe('NotificationsService (FCM)', () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset();
  });

  it('chunkea en lotes de 500 y limpia tokens inválidos', async () => {
    const repo: {
      findEligibleNearbyTokens: jest.Mock;
      deletePushToken: jest.Mock;
      logNotificationSentMany: jest.Mock;
    } = {
      findEligibleNearbyTokens: jest.fn().mockResolvedValue(
        Array.from({ length: 501 }).map((_, i) => ({
          token: `t${i}`,
          platform: 'android',
          user_id: `u${i}`,
        })),
      ),
      deletePushToken: jest.fn().mockResolvedValue(undefined),
      logNotificationSentMany: jest.fn().mockResolvedValue(undefined),
    };

    sendEachForMulticast
      .mockResolvedValueOnce({
        responses: Array.from({ length: 500 }).map(() => ({ success: true })),
      })
      .mockResolvedValueOnce({
        responses: [
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        ],
      });

    const service = new NotificationsService(
      undefined,
      repo as unknown as ConstructorParameters<typeof NotificationsService>[1],
    );
    await service.sendLostPetAlert({
      reportId: '00000000-0000-0000-0000-000000000000',
      petName: 'Luna',
      ownerId: 'owner',
      lat: 1,
      lng: 2,
      radiusMeters: 10_000,
    });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(repo.deletePushToken).toHaveBeenCalledWith('t500');
    expect(repo.logNotificationSentMany).toHaveBeenCalled();
  });

  it('respeta límite diario al depender del query elegible', async () => {
    const repo: {
      findEligibleNearbyTokens: jest.Mock;
      deletePushToken: jest.Mock;
      logNotificationSentMany: jest.Mock;
    } = {
      findEligibleNearbyTokens: jest.fn().mockResolvedValue([]),
      deletePushToken: jest.fn(),
      logNotificationSentMany: jest.fn(),
    };
    const service = new NotificationsService(
      undefined,
      repo as unknown as ConstructorParameters<typeof NotificationsService>[1],
    );
    await service.sendLostPetAlert({
      reportId: '00000000-0000-0000-0000-000000000000',
      petName: 'Luna',
      ownerId: 'owner',
      lat: 1,
      lng: 2,
      radiusMeters: 10_000,
    });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sendSightingNotification chunkea y limpia tokens inválidos', async () => {
    const users: { listPushTokensForUser: jest.Mock; deletePushToken: jest.Mock } = {
      listPushTokensForUser: jest.fn().mockResolvedValue(['a', 'b']),
      deletePushToken: jest.fn().mockResolvedValue(undefined),
    };
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    });

    const service = new NotificationsService(
      users as unknown as ConstructorParameters<typeof NotificationsService>[0],
      undefined,
    );
    await service.sendSightingNotification({ ownerId: 'owner', petName: 'Luna', reportId: 'r1' });
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(users.deletePushToken).toHaveBeenCalledWith('b');
  });
});

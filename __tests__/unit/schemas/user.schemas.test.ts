import {
  patchUserProfileSchema,
  updateLocationSchema,
  updateUserSettingsSchema,
  registerPushTokenSchema,
} from '../../../src/schemas/user.schemas';

describe('patchUserProfileSchema', () => {
  it('acepta onboardingCompleted', () => {
    const r = patchUserProfileSchema.safeParse({
      onboardingCompleted: true,
    });
    expect(r.success).toBe(true);
  });

  it('falla con objeto vacío', () => {
    const r = patchUserProfileSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('rechaza claves desconocidas (strict)', () => {
    const r = patchUserProfileSchema.safeParse({ name: 'A', extra: 1 });
    expect(r.success).toBe(false);
  });
});

describe('updateLocationSchema', () => {
  it('acepta lat/lng válidos', () => {
    const r = updateLocationSchema.safeParse({ lat: 19.43, lng: -99.13 });
    expect(r.success).toBe(true);
  });

  it('rechaza lat fuera de rango', () => {
    const r = updateLocationSchema.safeParse({ lat: 91, lng: 0 });
    expect(r.success).toBe(false);
  });
});

describe('updateUserSettingsSchema', () => {
  it('acepta alert_radius_km y alerts_enabled', () => {
    const r = updateUserSettingsSchema.safeParse({ alert_radius_km: 5, alerts_enabled: false });
    expect(r.success).toBe(true);
  });

  it('falla con objeto vacío', () => {
    const r = updateUserSettingsSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('registerPushTokenSchema', () => {
  it('acepta token y platform', () => {
    const r = registerPushTokenSchema.safeParse({ token: 'fcm-abc', platform: 'android' });
    expect(r.success).toBe(true);
  });

  it('rechaza platform inválida', () => {
    const r = registerPushTokenSchema.safeParse({ token: 'x', platform: 'web' });
    expect(r.success).toBe(false);
  });
});

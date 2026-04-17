import { patchUserProfileSchema } from '../../../src/schemas/user.schemas';

describe('patchUserProfileSchema', () => {
  it('acepta onboardingCompleted y alertsEnabled', () => {
    const r = patchUserProfileSchema.safeParse({
      onboardingCompleted: true,
      alertsEnabled: false,
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

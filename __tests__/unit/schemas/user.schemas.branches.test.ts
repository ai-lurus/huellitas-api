import { patchUserProfileSchema } from '../../../src/schemas/user.schemas';

describe('user.schemas booleanFromString branches', () => {
  it('coerces "true"/"false" strings to booleans', () => {
    const parsed = patchUserProfileSchema.parse({
      alertsEnabled: 'true',
      notificationsEnabled: 'false',
    });
    expect(parsed.alertsEnabled).toBe(true);
    expect(parsed.notificationsEnabled).toBe(false);
  });

  it('keeps non-boolean strings to trigger validation error', () => {
    expect(() => patchUserProfileSchema.parse({ alertsEnabled: 'nope' })).toThrow();
  });
});

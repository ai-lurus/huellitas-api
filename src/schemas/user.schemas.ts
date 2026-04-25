import { z } from 'zod';

function booleanFromString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return value;
}

export const updateLocationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const updateUserSettingsSchema = z
  .object({
    alert_radius_km: z.number().int().min(1).max(10).optional(),
    alerts_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Se requiere al menos un campo para actualizar',
  });

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;

export const registerPushTokenSchema = z
  .object({
    token: z.string().min(1).max(4096),
    platform: z.enum(['ios', 'android']),
  })
  .strict();

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const patchUserProfileSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    image: z.union([z.string().url(), z.null()]).optional(),
    onboardingCompleted: z.boolean().optional(),
    alertRadiusKm: z.coerce.number().int().min(1).max(10).optional(),
    alertsEnabled: z.preprocess(booleanFromString, z.boolean()).optional(),
    notificationsEnabled: z.preprocess(booleanFromString, z.boolean()).optional(),
    emailAlertsEnabled: z.preprocess(booleanFromString, z.boolean()).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Se requiere al menos un campo para actualizar',
  });

export type PatchUserProfileInput = z.infer<typeof patchUserProfileSchema>;

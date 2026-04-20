import { z } from 'zod';

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const patchUserProfileSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    image: z.union([z.string().url(), z.null()]).optional(),
    onboardingCompleted: z.boolean().optional(),
    alertsEnabled: z.boolean().optional(),
    location: locationSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Se requiere al menos un campo para actualizar',
  });

export type PatchUserProfileInput = z.infer<typeof patchUserProfileSchema>;

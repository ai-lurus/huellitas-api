import { z } from 'zod';

export const createLostReportSchema = z
  .object({
    petId: z.string().uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    lastSeenAt: z.string().datetime(),
    message: z.string().max(500).optional(),
  })
  .strict();

export type CreateLostReportInput = z.infer<typeof createLostReportSchema>;

export const createSightingSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    message: z.string().max(500).optional(),
  })
  .strict();

export type CreateSightingInput = z.infer<typeof createSightingSchema>;

export const nearbyLostReportsQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().positive().max(200).optional().default(5),
    species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'other']).optional(),
  })
  .strict();

export type NearbyLostReportsQuery = z.infer<typeof nearbyLostReportsQuerySchema>;

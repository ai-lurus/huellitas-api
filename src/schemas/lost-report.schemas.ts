import { z } from 'zod';

export const nearbyLostReportsQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().positive().max(200).optional().default(5),
    species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'other']).optional(),
  })
  .strict();

export type NearbyLostReportsQuery = z.infer<typeof nearbyLostReportsQuerySchema>;

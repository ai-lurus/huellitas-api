import { z } from 'zod';

export const createPetSchema = z.object({
  name: z.string().min(1).max(50),
  species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'other']),
  breed: z.string().max(100).optional(),
  color: z.string().max(100).optional(),
  sex: z.enum(['male', 'female', 'unknown']),
  age: z.coerce.number().int().min(0).max(50).optional(),
  notes: z.string().max(300).optional(),
});

export const updatePetSchema = createPetSchema.partial();

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;

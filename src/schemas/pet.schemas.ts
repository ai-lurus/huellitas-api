import { z } from 'zod';

const petWritableBodySchema = z.object({
  name: z.string().min(1).max(50),
  species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'other']),
  breed: z.string().max(100).optional(),
  color: z.string().max(100).optional(),
  sex: z.enum(['male', 'female', 'unknown']),
  age: z.coerce.number().int().min(0).max(50).optional(),
  notes: z.string().max(300).optional(),
});

/** Crear mascota (no expone `isLost`; el estado “perdido” va por flujo dedicado / PATCH). */
export const createPetSchema = petWritableBodySchema.strict();

export const updatePetSchema = petWritableBodySchema
  .partial()
  .extend({ isLost: z.boolean().optional() })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Se requiere al menos un campo para actualizar',
  });

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;

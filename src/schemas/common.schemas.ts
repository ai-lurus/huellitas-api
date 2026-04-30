import { z } from 'zod';

export const uuidParam = z.string().uuid();

export const petIdParamSchema = z.object({ petId: uuidParam }).strict();
export type PetIdParam = z.infer<typeof petIdParamSchema>;

export const reportIdParamSchema = z.object({ id: uuidParam }).strict();
export type ReportIdParam = z.infer<typeof reportIdParamSchema>;

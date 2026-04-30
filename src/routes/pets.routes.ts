import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPetSchema, updatePetSchema } from '../schemas/pet.schemas';
import * as petController from '../controllers/pet.controller';
import { imageUpload } from '../middleware/upload.middleware';
import { apiLimiter, uploadLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(requireAuth);
router.use(apiLimiter);

router.get('/', petController.listPets);
router.post('/', validate(createPetSchema), petController.createPet);
router.get('/:petId', petController.getPet);
router.patch('/:petId', validate(updatePetSchema), petController.updatePet);
/** Alias para clientes que usan PUT (p. ej. axios/fetch por defecto en “save”). */
router.put('/:petId', validate(updatePetSchema), petController.updatePet);
router.delete('/:petId', petController.deletePet);
/** `photo` (canónico), `image` y `file`: alias para clientes móviles / FormData. */
router.post(
  '/:petId/photos',
  uploadLimiter,
  imageUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  petController.uploadPhoto,
);

export { router as petsRouter };

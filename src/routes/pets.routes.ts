import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPetSchema, updatePetSchema } from '../schemas/pet.schemas';
import * as petController from '../controllers/pet.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);

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
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  petController.uploadPhoto,
);

export { router as petsRouter };

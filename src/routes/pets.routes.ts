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
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(requireAuth);

router.get('/', petController.listPets);
router.post('/', validate(createPetSchema), petController.createPet);
router.get('/:id', petController.getPet);
router.patch('/:id', validate(updatePetSchema), petController.updatePet);
router.delete('/:id', petController.deletePet);
router.post('/:id/photos', upload.single('photo'), petController.uploadPhoto);

export { router as petsRouter };

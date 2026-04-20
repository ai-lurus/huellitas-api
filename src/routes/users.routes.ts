import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { patchUserProfileSchema } from '../schemas/user.schemas';
import * as userController from '../controllers/user.controller';

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

router.get('/me', userController.getMe);
router.patch('/me', validate(patchUserProfileSchema), userController.patchMe);
router.post('/me/avatar', upload.single('photo'), userController.postAvatar);

export { router as usersRouter };

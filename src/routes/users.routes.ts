import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import {
  patchUserProfileSchema,
  updateUserSettingsSchema,
  registerPushTokenSchema,
} from '../schemas/user.schemas';
import * as userController from '../controllers/user.controller';

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
router.use(apiLimiter);

router.get('/me', userController.getMe);
// `PATCH /users/me` soporta JSON o multipart/form-data (campo `image`).
router.patch(
  '/me',
  upload.fields([
    { name: 'image', maxCount: 1 },
    // Aliases para clientes que mandan `photo` o `file`
    { name: 'photo', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  (req, _res, next) => {
    // Permite multipart con SOLO archivo (sin campos) para actualizar avatar.
    const grouped = req.files as Record<string, Express.Multer.File[]> | undefined;
    const hasFile = !!(
      grouped?.['image']?.[0] ??
      grouped?.['photo']?.[0] ??
      grouped?.['file']?.[0]
    );
    if (hasFile && Object.keys(req.body ?? {}).length === 0) {
      next();
      return;
    }
    validate(patchUserProfileSchema)(req, _res, next);
  },
  userController.patchMe,
);
router.patch('/me/location', userController.patchLocation);
router.patch('/me/settings', validate(updateUserSettingsSchema), userController.patchSettings);
router.post('/me/push-token', validate(registerPushTokenSchema), userController.postPushToken);
router.delete('/me/push-token', userController.deletePushToken);
router.post('/me/avatar', upload.single('photo'), userController.postAvatar);
router.delete('/me', userController.deleteMe);

export { router as usersRouter };

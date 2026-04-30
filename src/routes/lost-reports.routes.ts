import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as lostReportController from '../controllers/lost-report.controller';
import { createLostReportSchema } from '../schemas/lost-report.schemas';

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

router.get('/nearby', lostReportController.getNearbyLostReports);
router.post('/', validate(createLostReportSchema), lostReportController.postLostReport);
router.get('/:id', lostReportController.getLostReportDetail);
router.post(
  '/:id/sightings',
  upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'photo', maxCount: 5 },
    { name: 'image', maxCount: 5 },
    { name: 'file', maxCount: 5 },
  ]),
  lostReportController.postSighting,
);
router.patch('/:id/resolve', lostReportController.patchResolve);

export { router as lostReportsRouter };

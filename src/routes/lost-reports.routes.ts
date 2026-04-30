import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as lostReportController from '../controllers/lost-report.controller';
import { createLostReportSchema } from '../schemas/lost-report.schemas';
import { imageUpload } from '../middleware/upload.middleware';
import { apiLimiter, uploadLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(requireAuth);
router.use(apiLimiter);

router.get('/nearby', lostReportController.getNearbyLostReports);
router.post('/', validate(createLostReportSchema), lostReportController.postLostReport);
router.get('/:id', lostReportController.getLostReportDetail);
router.get('/:id/sightings', lostReportController.getSightings);
router.post(
  '/:id/sightings',
  uploadLimiter,
  imageUpload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'photo', maxCount: 5 },
    { name: 'image', maxCount: 5 },
    { name: 'file', maxCount: 5 },
  ]),
  lostReportController.postSighting,
);
router.patch('/:id/resolve', lostReportController.patchResolve);

export { router as lostReportsRouter };

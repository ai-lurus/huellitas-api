import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as lostReportController from '../controllers/lost-report.controller';
import { reportIdParamSchema } from '../schemas/common.schemas';
import {
  createLostReportSchema,
  createSightingSchema,
  nearbyLostReportsQuerySchema,
} from '../schemas/lost-report.schemas';
import { imageUpload } from '../middleware/upload.middleware';
import { apiLimiter, uploadLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(requireAuth);
router.use(apiLimiter);

router.get(
  '/nearby',
  validate(nearbyLostReportsQuerySchema, 'query'),
  lostReportController.getNearbyLostReports,
);
router.post('/', validate(createLostReportSchema), lostReportController.postLostReport);
router.get(
  '/:id',
  validate(reportIdParamSchema, 'params'),
  lostReportController.getLostReportDetail,
);
router.get(
  '/:id/sightings',
  validate(reportIdParamSchema, 'params'),
  lostReportController.getSightings,
);
router.post(
  '/:id/sightings',
  validate(reportIdParamSchema, 'params'),
  uploadLimiter,
  imageUpload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'photo', maxCount: 5 },
    { name: 'image', maxCount: 5 },
    { name: 'file', maxCount: 5 },
  ]),
  validate(createSightingSchema),
  lostReportController.postSighting,
);
router.patch(
  '/:id/resolve',
  validate(reportIdParamSchema, 'params'),
  lostReportController.patchResolve,
);

export { router as lostReportsRouter };

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as lostReportController from '../controllers/lost-report.controller';

const router = Router();

router.use(requireAuth);

router.get('/nearby', lostReportController.getNearbyLostReports);

export { router as lostReportsRouter };

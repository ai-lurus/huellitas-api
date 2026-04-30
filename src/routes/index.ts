import { Router } from 'express';
import { petsRouter } from './pets.routes';
import { usersRouter } from './users.routes';
import { lostReportsRouter } from './lost-reports.routes';

const router = Router();

router.use('/pets', petsRouter);
router.use('/users', usersRouter);
router.use('/lost-reports', lostReportsRouter);

export { router as apiRouter };

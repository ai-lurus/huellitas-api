import { Router } from 'express';
import { petsRouter } from './pets.routes';
import { usersRouter } from './users.routes';

const router = Router();

router.use('/pets', petsRouter);
router.use('/users', usersRouter);
// router.use('/lost-reports', reportsRouter);

export { router as apiRouter };

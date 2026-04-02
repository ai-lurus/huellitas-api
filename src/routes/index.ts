import { Router } from 'express';
import { petsRouter } from './pets.routes';

const router = Router();

router.use('/pets', petsRouter);

// Mount additional feature routers here as they are implemented
// router.use('/users', usersRouter);
// router.use('/lost-reports', reportsRouter);

export { router as apiRouter };

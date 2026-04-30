import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '../config/swagger';

const router = Router();

router.get('/docs.json', (_req, res) => {
  res.json(buildOpenApiSpec());
});

router.use('/docs', swaggerUi.serve, swaggerUi.setup(buildOpenApiSpec(), { explorer: true }));

export { router as docsRouter };

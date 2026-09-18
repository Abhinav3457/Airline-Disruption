import { Router } from 'express';

import { getPoliciesHandler } from '../controllers/policy.controller';

const router = Router();

// GET /api/policies
router.get('/', getPoliciesHandler);

export default router;

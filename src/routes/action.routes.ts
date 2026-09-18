import { Router } from 'express';

import { postActionExecute } from '../controllers/agent.controller';

import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// POST /api/actions/execute — policy-gated simulated execution
router.post('/execute', asyncHandler(postActionExecute));

export default router;

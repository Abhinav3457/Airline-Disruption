import { Router } from 'express';

import { postEscalation } from '../controllers/agent.controller';

import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// POST /api/escalations — create a human escalation
router.post('/', asyncHandler(postEscalation));

export default router;

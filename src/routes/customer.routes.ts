import { Router } from 'express';

import {
  getCustomerBookingsHandler,
  getCustomerByPnrHandler,
  getAllCustomersHandler,
} from '../controllers/customer.controller';

import { parseOrThrow, pnrParamSchema } from '../middleware/validation.middleware';

const router = Router();

// All customer routes validate the :pnr parameter first.
router.use('/:pnr', (_req, _res, next) => {
  parseOrThrow(pnrParamSchema, { pnr: _req.params.pnr });
  next();
});

// GET /api/customers
router.get('/', getAllCustomersHandler);

// GET /api/customers/:pnr — full profile
router.get('/:pnr', getCustomerByPnrHandler);

// GET /api/customers/:pnr/bookings — booking legs for the customer
router.get('/:pnr/bookings', getCustomerBookingsHandler);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './companies.controller.js';

export const companiesRouter = Router();

companiesRouter.use(authenticate);

companiesRouter.get('/', requirePermission('platform:manage'), controller.listCompanies);
companiesRouter.get('/mine', requirePermission('company:read'), controller.getMyCompany);
companiesRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string().min(1) }) }),
  requirePermission('company:read'),
  controller.getCompany,
);
companiesRouter.post('/', requirePermission('platform:manage'), controller.createCompany);
companiesRouter.patch(
  '/:id',
  validate({ params: z.object({ id: z.string().min(1) }) }),
  requirePermission('company:update'),
  controller.updateCompany,
);

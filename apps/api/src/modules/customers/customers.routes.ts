import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './customers.controller.js';

export const customersRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

customersRouter.use(authenticate, tenantScope);

customersRouter.get('/', requirePermission('customer:read'), controller.listCustomers);
customersRouter.post('/', requirePermission('customer:create'), controller.createCustomer);
customersRouter.get('/:id', requirePermission('customer:read'), validate({ params: idParams }), controller.getCustomer);
customersRouter.patch('/:id', requirePermission('customer:update'), validate({ params: idParams }), controller.updateCustomer);
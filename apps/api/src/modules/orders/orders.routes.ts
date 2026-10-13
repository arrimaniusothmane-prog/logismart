import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './orders.controller.js';

export const ordersRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

ordersRouter.use(authenticate, tenantScope);

ordersRouter.get('/', requirePermission('order:read'), controller.listOrders);
ordersRouter.post('/', requirePermission('order:create'), controller.createOrder);
ordersRouter.get('/:id', requirePermission('order:read'), validate({ params: idParams }), controller.getOrder);
ordersRouter.patch('/:id', requirePermission('order:update'), validate({ params: idParams }), controller.updateOrder);
ordersRouter.patch('/:id/assign', requirePermission('order:assign'), validate({ params: idParams }), controller.assignOrder);
ordersRouter.patch('/:id/status', validate({ params: idParams }), controller.changeOrderStatus);
ordersRouter.delete('/:id', requirePermission('order:delete'), validate({ params: idParams }), controller.deleteOrder);
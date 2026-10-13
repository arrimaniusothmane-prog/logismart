import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './drivers.controller.js';

export const driversRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

driversRouter.use(authenticate, tenantScope);

driversRouter.get('/me', controller.getOwnProfile);
driversRouter.get('/', requirePermission('driver:read'), controller.listDrivers);
driversRouter.get('/:id', requirePermission('driver:read'), validate({ params: idParams }), controller.getDriver);
driversRouter.patch('/:id', requirePermission('driver:update'), validate({ params: idParams }), controller.updateDriver);
driversRouter.patch('/me/availability', controller.updateOwnAvailability);
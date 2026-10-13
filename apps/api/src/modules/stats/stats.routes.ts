import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import * as controller from './stats.controller.js';

export const statsRouter = Router();

statsRouter.use(authenticate, tenantScope);

statsRouter.get('/overview', requirePermission('stats:read'), controller.overview);

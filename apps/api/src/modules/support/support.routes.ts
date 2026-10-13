import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './support.controller.js';

export const supportRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

supportRouter.use(authenticate, tenantScope);

supportRouter.get('/escalations', requirePermission('support:read'), controller.listEscalations);
supportRouter.get('/escalations/:id', requirePermission('support:read'), validate({ params: idParams }), controller.getEscalation);
supportRouter.post('/escalations/:id/reply', requirePermission('support:respond'), validate({ params: idParams }), controller.reply);
supportRouter.patch('/escalations/:id', requirePermission('support:manage'), validate({ params: idParams }), controller.updateEscalation);

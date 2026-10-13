import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import * as controller from './platform.controller.js';

export const platformRouter = Router();

platformRouter.use(authenticate);

platformRouter.get('/stats', requirePermission('platform:stats'), controller.platformStats);

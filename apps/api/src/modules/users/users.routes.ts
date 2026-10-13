import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';

export const usersRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

usersRouter.use(authenticate, tenantScope);

usersRouter.get('/', requirePermission('user:read'), controller.listUsers);
usersRouter.get('/:id', requirePermission('user:read'), validate({ params: idParams }), controller.getUser);
usersRouter.post('/', requirePermission('user:create'), controller.createUser);
usersRouter.patch('/:id', requirePermission('user:update'), validate({ params: idParams }), controller.updateUser);
usersRouter.delete('/:id', requirePermission('user:delete'), validate({ params: idParams }), controller.deactivateUser);

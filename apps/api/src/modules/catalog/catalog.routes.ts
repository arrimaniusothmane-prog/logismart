import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './catalog.controller.js';

export const catalogRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

catalogRouter.use(authenticate, tenantScope);

catalogRouter.get('/', requirePermission('catalog:read'), controller.listCatalogItems);
catalogRouter.post('/', requirePermission('catalog:create'), controller.createCatalogItem);
catalogRouter.get('/:id', requirePermission('catalog:read'), validate({ params: idParams }), controller.getCatalogItem);
catalogRouter.patch('/:id', requirePermission('catalog:update'), validate({ params: idParams }), controller.updateCatalogItem);
catalogRouter.delete('/:id', requirePermission('catalog:delete'), validate({ params: idParams }), controller.deleteCatalogItem);

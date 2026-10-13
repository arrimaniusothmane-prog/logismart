import { Router } from 'express';
import { z } from 'zod';
import { authenticatePortal } from './portal.middleware.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './portal.controller.js';

export const portalRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

// Session (jetons portail dédiés)
portalRouter.post('/register', controller.register);
portalRouter.post('/login', controller.login);
portalRouter.post('/refresh', controller.refresh);
portalRouter.post('/logout', controller.logout);

portalRouter.use(authenticatePortal);

portalRouter.get('/me', controller.me);
portalRouter.get('/stats', controller.getStats);
portalRouter.get('/services', controller.listServices);
portalRouter.patch('/profile', controller.updateProfile);
portalRouter.post('/password', controller.changePassword);
portalRouter.get('/orders', controller.listOrders);
portalRouter.get('/orders/:id', validate({ params: idParams }), controller.getOrder);
portalRouter.post('/orders', controller.createOrder);
portalRouter.patch('/orders/:id/cancel', validate({ params: idParams }), controller.cancelOrder);
portalRouter.post('/orders/:id/cancel', validate({ params: idParams }), controller.cancelOrder);
portalRouter.get('/notifications', controller.notifications);
portalRouter.post('/notifications/read', controller.markNotificationsRead);
portalRouter.get('/support', controller.listSupport);
portalRouter.post('/support', controller.createSupport);
portalRouter.get('/support/:id', validate({ params: idParams }), controller.getSupport);
portalRouter.post('/support/:id/messages', validate({ params: idParams }), controller.replySupport);
portalRouter.post('/chat', controller.chat);

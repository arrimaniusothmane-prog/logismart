import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', authLimiter, controller.login);
authRouter.post('/refresh', authLimiter, controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
authRouter.post('/change-password', authenticate, authLimiter, controller.changePassword);

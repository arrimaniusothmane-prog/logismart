import { Router } from 'express';
import * as controller from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', controller.health);
healthRouter.get('/ready', controller.ready);

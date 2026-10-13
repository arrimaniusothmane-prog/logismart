import { Router } from 'express';
import * as controller from './tracking.controller.js';

/** Routes publiques — aucun middleware d'authentification (jeton = preuve). */
export const trackingRouter = Router();

trackingRouter.get('/:token', controller.trackOrder);
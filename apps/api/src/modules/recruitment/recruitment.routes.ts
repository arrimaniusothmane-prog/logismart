import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as jobs from './jobs.controller.js';
import * as candidates from './candidates.controller.js';

export const jobsRouter = Router();
export const candidatesRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

jobsRouter.use(authenticate, tenantScope);
candidatesRouter.use(authenticate, tenantScope);

jobsRouter.get('/', requirePermission('job:read'), jobs.listJobs);
jobsRouter.post('/', requirePermission('job:manage'), jobs.createJob);
jobsRouter.get('/:id', requirePermission('job:read'), validate({ params: idParams }), jobs.getJob);
jobsRouter.patch('/:id', requirePermission('job:manage'), validate({ params: idParams }), jobs.updateJob);

candidatesRouter.get('/', requirePermission('candidate:read'), candidates.listCandidates);
candidatesRouter.post('/', requirePermission('candidate:manage'), candidates.createCandidate);
candidatesRouter.get('/:id', requirePermission('candidate:read'), validate({ params: idParams }), candidates.getCandidate);
candidatesRouter.patch('/:id', requirePermission('candidate:manage'), validate({ params: idParams }), candidates.updateCandidate);
candidatesRouter.post('/:id/hire', requirePermission('candidate:hire'), validate({ params: idParams }), candidates.hireCandidate);

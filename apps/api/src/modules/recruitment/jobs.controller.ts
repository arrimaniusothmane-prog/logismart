import type { Request, Response } from 'express';
import { z } from 'zod';
import { createJobOfferSchema, listJobsQuerySchema, updateJobOfferSchema } from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { assertCompanyOwnership, companyWhere } from '../../middleware/tenant.js';
import { logger } from '../../lib/logger.js';

const idParams = z.object({ id: z.string().min(1) });

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listJobsQuerySchema, req.query);
  const where = {
    ...companyWhere(req),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? { title: { contains: query.search, mode: 'insensitive' as const } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.jobOffer.count({ where }),
    prisma.jobOffer.findMany({
      where,
      orderBy: [{ createdAt: query.order }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { _count: { select: { candidates: true } } },
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const job = await prisma.jobOffer.findUnique({
    where: { id },
    include: {
      _count: { select: { candidates: true } },
      candidates: {
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          compatibilityScore: true,
          createdAt: true,
        },
      },
    },
  });
  if (!job) throw notFound('Offre introuvable');
  assertCompanyOwnership(req, job.companyId);
  ok(res, job);
});

export const createJob = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createJobOfferSchema, req.body);
  const job = await prisma.jobOffer.create({ data: { ...input, companyId: req.tenantId! } });
  logger.info('job offer created', { jobOfferId: job.id, requestId: req.id });
  ok(res, job, undefined, 201);
});

export const updateJob = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(updateJobOfferSchema, req.body);

  const existing = await prisma.jobOffer.findUnique({ where: { id } });
  if (!existing) throw notFound('Offre introuvable');
  assertCompanyOwnership(req, existing.companyId);

  const job = await prisma.jobOffer.update({ where: { id }, data: input });
  logger.info('job offer updated', { jobOfferId: id, requestId: req.id });
  ok(res, job);
});

import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createCandidateSchema,
  listCandidatesQuerySchema,
  updateCandidateSchema,
} from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { assertCompanyOwnership, companyWhere } from '../../middleware/tenant.js';
import { hashPassword } from '../auth/auth.service.js';
import { logger } from '../../lib/logger.js';

const idParams = z.object({ id: z.string().min(1) });

const SCORE_SELECT = {
  id: true,
  companyId: true,
  jobOfferId: true,
  name: true,
  email: true,
  phone: true,
  cvUrl: true,
  note: true,
  status: true,
  compatibilityScore: true,
  scoreBreakdown: true,
  aiSummary: true,
  sourceFileName: true,
  userId: true,
  driverProfileId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listCandidates = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listCandidatesQuerySchema, req.query);
  const where = {
    ...companyWhere(req),
    ...(query.status ? { status: query.status } : {}),
    ...(query.jobOfferId ? { jobOfferId: query.jobOfferId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy: [{ createdAt: query.order }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        ...SCORE_SELECT,
        jobOffer: { select: { id: true, title: true, isDriverRole: true, location: true } },
        _count: { select: { skills: true, questions: true } },
      },
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getCandidate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      jobOffer: { select: { id: true, title: true, isDriverRole: true, location: true, status: true } },
      skills: { orderBy: [{ score: 'desc' as const }, { skill: 'asc' as const }] },
      questions: { orderBy: { createdAt: 'asc' as const } },
      hiredUser: { select: { id: true, name: true, email: true, role: true, status: true } },
    },
  });
  if (!candidate) throw notFound('Candidat introuvable');
  assertCompanyOwnership(req, candidate.companyId);
  ok(res, candidate);
});

export const createCandidate = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createCandidateSchema, req.body);

  const job = await prisma.jobOffer.findUnique({ where: { id: input.jobOfferId } });
  if (!job) throw notFound('Offre introuvable');
  assertCompanyOwnership(req, job.companyId);

  const candidate = await prisma.candidate.create({
    data: { ...input, companyId: job.companyId },
    select: SCORE_SELECT,
  });
  logger.info('candidate created', { candidateId: candidate.id, requestId: req.id });
  ok(res, candidate, undefined, 201);
});

/** Transition de pipeline (statut + note). Le passage à HIRED passe par /hire. */
export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(updateCandidateSchema, req.body);

  const existing = await prisma.candidate.findUnique({ where: { id } });
  if (!existing) throw notFound('Candidat introuvable');
  assertCompanyOwnership(req, existing.companyId);

  const data: Record<string, unknown> = {};
  if (input.status && input.status !== 'HIRED') data.status = input.status;
  if (input.note !== undefined) data.note = input.note;

  const candidate = await prisma.candidate.update({
    where: { id },
    data,
    select: SCORE_SELECT,
  });
  logger.info('candidate updated', { candidateId: id, requestId: req.id });
  ok(res, candidate);
});

/**
 * Embauche : crée le compte utilisateur (DRIVER si le poste est un poste livreur,
 * sinon DISPATCHER), crée le profil livreur si besoin, et marque le candidat HIRED.
 * Le mot de passe temporaire n'est renvoyé qu'une seule fois.
 */
export const hireCandidate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { jobOffer: { select: { title: true, isDriverRole: true } } },
  });
  if (!candidate) throw notFound('Candidat introuvable');
  assertCompanyOwnership(req, candidate.companyId);
  if (candidate.status === 'HIRED' || candidate.userId) {
    throw conflict('Ce candidat a déjà été embauché');
  }

  const temporaryPassword = `LS-${Math.random().toString(36).slice(2, 8)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
  const role = candidate.jobOffer.isDriverRole ? 'DRIVER' : 'DISPATCHER';

  const user = await prisma.user.create({
    data: {
      companyId: candidate.companyId,
      name: candidate.name,
      email: candidate.email,
      passwordHash: await hashPassword(temporaryPassword),
      role,
      status: 'ACTIVE',
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  let driverProfileId: string | null = null;
  if (candidate.jobOffer.isDriverRole) {
    const profile = await prisma.driverProfile.create({
      data: { userId: user.id, companyId: candidate.companyId },
      select: { id: true },
    });
    driverProfileId = profile.id;
  }

  const updated = await prisma.candidate.update({
    where: { id },
    data: { status: 'HIRED', userId: user.id, driverProfileId },
    select: SCORE_SELECT,
  });

  logger.info('candidate hired', { candidateId: id, userId: user.id, role, requestId: req.id });
  ok(res, { candidate: updated, user, temporaryPassword });
});

import type { Request, Response } from 'express';
import { z } from 'zod';
import { createUserSchema, updateUserSchema, paginationSchema, ROLES } from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { hashPassword, revokeAllUserSessions } from '../auth/auth.service.js';
import { logger } from '../../lib/logger.js';

const idParam = z.object({ id: z.string().min(1) });

const listQuerySchema = paginationSchema.extend({
  role: z.enum(ROLES).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']).optional(),
  companyId: z.string().min(1).optional(),
});

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  companyId: true,
  lastLoginAt: true,
  createdAt: true,
  company: { select: { id: true, name: true, slug: true } },
} as const;

/** Périmètre : SUPER_ADMIN = plateforme (filtre optionnel), sinon tenant courant. */
function scopeFor(req: Request, requestedCompanyId?: string): { companyId?: string } {
  const auth = req.auth!;
  if (auth.role === 'SUPER_ADMIN') {
    return requestedCompanyId ? { companyId: requestedCompanyId } : {};
  }
  if (!auth.companyId) throw forbidden('Compte sans entreprise associée');
  return { companyId: auth.companyId };
}

function assertCanManageRole(req: Request, role: string) {
  const auth = req.auth!;
  if (role === 'SUPER_ADMIN' && auth.role !== 'SUPER_ADMIN') {
    throw forbidden('Seul un SUPER_ADMIN peut créer ou modifier un SUPER_ADMIN');
  }
  if (auth.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') throw forbidden();
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listQuerySchema, req.query);
  const scope = scopeFor(req, query.companyId);

  const where = {
    ...scope,
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
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
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: SAFE_SELECT,
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const auth = req.auth!;

  const user = await prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
  if (!user) throw notFound('Utilisateur introuvable');

  if (auth.role !== 'SUPER_ADMIN' && user.companyId !== auth.companyId) {
    throw forbidden('Ressource hors de votre périmètre');
  }
  ok(res, user);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createUserSchema, req.body);
  const auth = req.auth!;

  assertCanManageRole(req, input.role);

  const companyId = auth.role === 'SUPER_ADMIN' ? (req.body.companyId as string | undefined) : auth.companyId;
  if (!companyId) throw badRequest('companyId requis');

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw notFound('Entreprise introuvable');

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('Un compte existe déjà avec cet e-mail');

  const user = await prisma.user.create({
    data: {
      companyId,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: input.status,
    },
    select: SAFE_SELECT,
  });

  logger.info('user created', { userId: user.id, role: user.role, companyId, requestId: req.id });
  ok(res, user, undefined, 201);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const input = parseOrThrow(updateUserSchema, req.body);
  const auth = req.auth!;

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, companyId: true, role: true } });
  if (!existing) throw notFound('Utilisateur introuvable');
  if (auth.role !== 'SUPER_ADMIN' && existing.companyId !== auth.companyId) {
    throw forbidden('Ressource hors de votre périmètre');
  }
  if (id === auth.userId && input.status === 'SUSPENDED') {
    throw badRequest('Impossible de désactiver son propre compte');
  }
  if (input.role) assertCanManageRole(req, input.role);

  const user = await prisma.user.update({ where: { id }, data: input, select: SAFE_SELECT });

  // Un changement de rôle/statut révoque les sessions en cours.
  if (input.role || input.status) await revokeAllUserSessions(id);

  logger.info('user updated', { userId: id, changes: Object.keys(input), requestId: req.id });
  ok(res, user);
});

/**
 * Désactivation au lieu de suppression physique :
 * les commandes, livraisons et candidats référencent l'utilisateur.
 * La réactivation se fait via PATCH { status: "ACTIVE" }.
 */
export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const auth = req.auth!;

  if (id === auth.userId) throw badRequest('Impossible de désactiver son propre compte');

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, companyId: true, role: true } });
  if (!existing) throw notFound('Utilisateur introuvable');
  if (auth.role !== 'SUPER_ADMIN' && existing.companyId !== auth.companyId) {
    throw forbidden('Ressource hors de votre périmètre');
  }
  if (existing.role === 'SUPER_ADMIN' && auth.role !== 'SUPER_ADMIN') {
    throw forbidden('Impossible de désactiver un SUPER_ADMIN');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status: 'SUSPENDED' },
    select: SAFE_SELECT,
  });
  await revokeAllUserSessions(id);

  logger.info('user deactivated', { userId: id, requestId: req.id });
  ok(res, { user, deactivated: true });
});

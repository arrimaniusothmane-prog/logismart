import type { Request, Response } from 'express';
import { createCompanySchema, updateCompanySchema, paginationSchema } from '@logismart/shared';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { generatePublicId } from '../../lib/ids.js';
import { hashPassword } from '../auth/auth.service.js';
import { logger } from '../../lib/logger.js';

const idParam = z.object({ id: z.string().min(1) });

const createWithAdminSchema = createCompanySchema.extend({
  admin: z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(8).max(128),
    })
    .optional(),
});

async function uniquePublicId(): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generatePublicId();
    const existing = await prisma.company.findUnique({ where: { publicId: candidate } });
    if (!existing) return candidate;
  }
  throw conflict('Génération d\'identifiant public impossible, réessayez.');
}

/** Liste (SUPER_ADMIN) ou entreprise courante via /mine. */
export const listCompanies = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(paginationSchema, req.query);
  const where = query.search
    ? { OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { slug: { contains: query.search, mode: 'insensitive' as const } }] }
    : {};

  const [total, items] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: { id: true, publicId: true, name: true, slug: true, email: true, phone: true, createdAt: true, _count: { select: { users: true, orders: true } } },
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getMyCompany = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth!;
  if (!auth.companyId) {
    if (auth.role === 'SUPER_ADMIN') return ok(res, null);
    throw forbidden('Compte sans entreprise associée');
  }
  const company = await prisma.company.findUnique({
    where: { id: auth.companyId },
    select: { id: true, publicId: true, name: true, slug: true, logo: true, email: true, phone: true, address: true, createdAt: true },
  });
  if (!company) throw notFound('Entreprise introuvable');
  ok(res, company);
});

export const getCompany = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const auth = req.auth!;

  if (auth.role !== 'SUPER_ADMIN' && auth.companyId !== id) {
    throw forbidden('Ressource hors de votre périmètre');
  }

  const company = await prisma.company.findUnique({
    where: { id },
    select: { id: true, publicId: true, name: true, slug: true, logo: true, email: true, phone: true, address: true, createdAt: true, _count: { select: { users: true, orders: true, drivers: true } } },
  });
  if (!company) throw notFound('Entreprise introuvable');
  ok(res, company);
});

/** Création d'entreprise — réservée au SUPER_ADMIN (contexte plateforme). */
export const createCompany = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createWithAdminSchema, req.body);

  const existing = await prisma.company.findUnique({ where: { slug: input.slug } });
  if (existing) throw conflict('Ce slug est déjà utilisé');

  const publicId = await uniquePublicId();

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name: input.name,
        slug: input.slug,
        email: input.email,
        phone: input.phone,
        address: input.address,
        logo: input.logo,
        publicId,
      },
    });

    if (input.admin) {
      await tx.user.create({
        data: {
          companyId: created.id,
          name: input.admin.name,
          email: input.admin.email.toLowerCase(),
          passwordHash: await hashPassword(input.admin.password),
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    return created;
  });

  logger.info('company created', { companyId: company.id, slug: company.slug, requestId: req.id });
  ok(res, company, undefined, 201);
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const input = parseOrThrow(updateCompanySchema, req.body);
  const auth = req.auth!;

  if (auth.role !== 'SUPER_ADMIN' && auth.companyId !== id) {
    throw forbidden('Ressource hors de votre périmètre');
  }

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) throw notFound('Entreprise introuvable');

  const company = await prisma.company.update({ where: { id }, data: input });
  ok(res, company);
});

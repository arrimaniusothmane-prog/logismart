import type { Request, Response } from 'express';
import { z } from 'zod';
import { createCatalogItemSchema, updateCatalogItemSchema, listCatalogQuerySchema } from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { assertCompanyOwnership, companyWhere } from '../../middleware/tenant.js';
import { logger } from '../../lib/logger.js';

const idParam = z.object({ id: z.string().min(1) });

export const listCatalogItems = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listCatalogQuerySchema, req.query);
  const where = {
    ...companyWhere(req),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.catalogItem.count({ where }),
    prisma.catalogItem.findMany({
      where,
      orderBy: [{ createdAt: query.order }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) throw notFound('Élément introuvable');
  assertCompanyOwnership(req, item.companyId);
  ok(res, item);
});

export const createCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createCatalogItemSchema, req.body);

  const item = await prisma.catalogItem.create({
    data: { ...input, price: input.price ?? null, companyId: req.tenantId! },
  });

  logger.info('catalog item created', { catalogItemId: item.id, type: item.type, requestId: req.id });
  ok(res, item, undefined, 201);
});

export const updateCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const input = parseOrThrow(updateCatalogItemSchema, req.body);

  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) throw notFound('Élément introuvable');
  assertCompanyOwnership(req, existing.companyId);

  const item = await prisma.catalogItem.update({ where: { id }, data: input });
  logger.info('catalog item updated', { catalogItemId: item.id, requestId: req.id });
  ok(res, item);
});

export const deleteCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);

  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) throw notFound('Élément introuvable');
  assertCompanyOwnership(req, existing.companyId);

  await prisma.catalogItem.delete({ where: { id } });
  logger.info('catalog item deleted', { catalogItemId: id, requestId: req.id });
  ok(res, { id });
});

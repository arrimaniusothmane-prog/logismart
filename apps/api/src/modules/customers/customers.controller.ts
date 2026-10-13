import type { Request, Response } from 'express';
import { z } from 'zod';
import { createCustomerSchema, updateCustomerSchema, paginationSchema } from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { notFound, conflict } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { assertCompanyOwnership, companyWhere } from '../../middleware/tenant.js';
import { logger } from '../../lib/logger.js';

const listQuerySchema = paginationSchema;

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listQuerySchema, req.query);
  const where = {
    ...companyWhere(req),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: query.order }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { _count: { select: { orders: true } } },
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(z.object({ id: z.string().min(1) }), req.params);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { orders: true } },
      orders: { select: { id: true, trackingNumber: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!customer) throw notFound('Client introuvable');
  assertCompanyOwnership(req, customer.companyId);
  ok(res, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createCustomerSchema, req.body);
  const existing = await prisma.customer.findFirst({
    where: { companyId: req.tenantId!, ...(input.email ? { email: input.email } : {}) },
  });
  if (existing) throw conflict('Un client de cette entreprise utilise déjà cet e-mail');

  const customer = await prisma.customer.create({
    data: { ...input, companyId: req.tenantId! },
  });

  logger.info('customer created', { customerId: customer.id, requestId: req.id });
  ok(res, customer, undefined, 201);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(z.object({ id: z.string().min(1) }), req.params);
  const input = parseOrThrow(updateCustomerSchema, req.body);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw notFound('Client introuvable');
  assertCompanyOwnership(req, existing.companyId);

  if (input.email && input.email !== existing.email) {
    const clash = await prisma.customer.findFirst({
      where: { companyId: req.tenantId!, email: input.email, id: { not: id } },
    });
    if (clash) throw conflict('Un client de cette entreprise utilise déjà cet e-mail');
  }

  const customer = await prisma.customer.update({ where: { id }, data: input });
  logger.info('customer updated', { customerId: customer.id, requestId: req.id });
  ok(res, customer);
});
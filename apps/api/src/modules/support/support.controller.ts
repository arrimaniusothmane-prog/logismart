import type { Request, Response } from 'express';
import { z } from 'zod';
import { paginationSchema } from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { assertCompanyOwnership, companyWhere } from '../../middleware/tenant.js';
import { logger } from '../../lib/logger.js';

const idParams = z.object({ id: z.string().min(1) });
const listQuerySchema = paginationSchema.extend({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
});
const replySchema = z.object({ content: z.string().trim().min(1).max(4000) });
const updateSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']) });

/**
 * Résout les identifiants de session en nom client affichable.
 * Les sessions créées depuis le portail client stockent l'id customer.
 */
async function attachCustomerNames<T extends { session: { customerIdentifier: string | null } }>(
  items: T[],
): Promise<Array<T & { session: T['session'] & { customerName: string | null } }>> {
  const ids = [
    ...new Set(
      items
        .map((item) => item.session.customerIdentifier)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const customers = ids.length
    ? await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(customers.map((c) => [c.id, c.name]));

  return items.map((item) => ({
    ...item,
    session: {
      ...item.session,
      customerName: item.session.customerIdentifier
        ? (names.get(item.session.customerIdentifier) ?? null)
        : null,
    },
  }));
}

export const listEscalations = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listQuerySchema, req.query);
  const where = {
    ...companyWhere(req),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, items, counts] = await Promise.all([
    prisma.supportEscalation.count({ where }),
    prisma.supportEscalation.findMany({
      where,
      orderBy: [{ createdAt: query.order }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        session: {
          select: {
            id: true,
            trackingNumber: true,
            customerIdentifier: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { messages: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true, createdAt: true } },
          },
        },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.supportEscalation.groupBy({
      by: ['status'],
      where: companyWhere(req),
      _count: { _all: true },
    }),
  ]);

  const summary = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const c of counts) summary[c.status] = c._count._all;

  ok(res, { ...paginated(await attachCustomerNames(items), query.page, query.limit, total), summary });
});

export const getEscalation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const escalation = await prisma.supportEscalation.findUnique({
    where: { id },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      session: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!escalation) throw notFound('Conversation introuvable');
  assertCompanyOwnership(req, escalation.companyId);
  ok(res, (await attachCustomerNames([escalation]))[0]);
});

/** Réponse de l'agent : message ajouté à la conversation client. */
export const reply = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(replySchema, req.body);

  const escalation = await prisma.supportEscalation.findUnique({ where: { id } });
  if (!escalation) throw notFound('Conversation introuvable');
  assertCompanyOwnership(req, escalation.companyId);

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { sessionId: escalation.sessionId, role: 'assistant', content: input.content },
    }),
    prisma.supportEscalation.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);

  logger.info('support reply sent', { escalationId: id, requestId: req.id });
  ok(res, message, undefined, 201);
});

export const updateEscalation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(updateSchema, req.body);

  const existing = await prisma.supportEscalation.findUnique({ where: { id } });
  if (!existing) throw notFound('Conversation introuvable');
  assertCompanyOwnership(req, existing.companyId);

  const escalation = await prisma.supportEscalation.update({ where: { id }, data: input });
  logger.info('support escalation updated', { escalationId: id, status: input.status, requestId: req.id });
  ok(res, escalation);
});

import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  assignOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  canTransitionOrderStatus,
  type OrderStatus,
} from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { companyWhere } from '../../middleware/tenant.js';
import { generateTrackingNumber, generateSecureToken } from '../../lib/ids.js';
import { logger } from '../../lib/logger.js';

const idParams = z.object({ id: z.string().min(1) });

const STATUSES_HANDLED_BY_DRIVER: readonly OrderStatus[] = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'];

export const ORDER_INCLUDE = {
  customer: true,
  driver: { include: { user: { select: { id: true, name: true, email: true } } } },
  _count: { select: { proofs: true } },
} as const;

const DETAIL_INCLUDE = {
  ...ORDER_INCLUDE,
  history: { orderBy: { createdAt: 'asc' as const } },
  proofs: { select: { id: true, type: true, createdAt: true }, orderBy: { createdAt: 'desc' as const } },
} as const;

export const TOKEN_TTL_DAYS = 30;

export async function generateUniqueTrackingNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateTrackingNumber();
    const existing = await prisma.order.findUnique({ where: { trackingNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error('Impossible de générer un numéro de suivi unique');
}

/** Restriction service : un livreur ne voit que ses propres livraisons. */
async function scopedWhere(req: Request, base: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (req.auth!.role !== 'DRIVER') return { ...companyWhere(req), ...base };
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.auth!.userId }, select: { id: true } });
  return { ...companyWhere(req), ...base, driverId: profile?.id ?? '__none__' };
}

async function findOwnedOrder(id: string, req: Request) {
  const order = await prisma.order.findUnique({ where: { id }, include: { driver: { select: { userId: true } } } });
  if (!order) throw notFound('Commande introuvable');
  if (req.auth!.role === 'SUPER_ADMIN') return order;
  if (order.companyId !== req.auth!.companyId) throw forbidden('Ressource hors de votre périmètre');
  if (req.auth!.role === 'DRIVER' && order.driver?.userId !== req.auth!.userId) {
    throw forbidden('Ressource hors de votre périmètre');
  }
  return order;
}

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listOrdersQuerySchema, req.query);

  const where = await scopedWhere(req, {
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { trackingNumber: { contains: query.search, mode: 'insensitive' as const } },
            { deliveryAddress: { contains: query.search, mode: 'insensitive' as const } },
            { customer: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  });

  // Un livreur ne peut pas filtrer sur un autre livreur.
  const finalWhere = {
    ...where,
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(req.auth!.role !== 'DRIVER' && query.driverId ? { driverId: query.driverId } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.order.count({ where: finalWhere }),
    prisma.order.findMany({
      where: finalWhere,
      orderBy: { createdAt: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: ORDER_INCLUDE,
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const order = await prisma.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!order) throw notFound('Commande introuvable');
  if (req.auth!.role === 'SUPER_ADMIN') return ok(res, order);
  if (order.companyId !== req.auth!.companyId) throw forbidden('Ressource hors de votre périmètre');
  if (req.auth!.role === 'DRIVER' && order.driver?.userId !== req.auth!.userId) {
    throw forbidden('Ressource hors de votre périmètre');
  }
  ok(res, order);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(createOrderSchema, req.body);
  const tenantId = req.tenantId!;

  // Résolution du client : soit un client existant, soit création à la volée.
  let customerId = input.customerId;
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { companyId: true } });
    if (!customer) throw notFound('Client introuvable');
    if (customer.companyId !== tenantId) throw forbidden('Ressource hors de votre périmètre');
  } else if (input.customer) {
    const existing = await prisma.customer.findFirst({
      where: { companyId: tenantId, ...(input.customer.email ? { email: input.customer.email } : {}) },
    });
    if (existing) throw conflict('Un client de cette entreprise utilise déjà cet e-mail');
    const customer = await prisma.customer.create({ data: { ...input.customer, companyId: tenantId } });
    customerId = customer.id;
  } else {
    throw badRequest('Indiquez un client existant (customerId) ou un nouveau client (customer)');
  }

  // Affectation éventuelle à un livreur (même entreprise, profil valide).
  let status: OrderStatus = 'PREPARED';
  let driverId: string | null = null;
  if (input.driverId) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: input.driverId },
      select: { id: true, companyId: true },
    });
    if (!driver || driver.companyId !== tenantId) throw badRequest('Livreur invalide pour cette entreprise');
    driverId = driver.id;
    if (input.driverId) status = 'ASSIGNED';
  }

  const trackingNumber = await generateUniqueTrackingNumber();

  const order = await prisma.order.create({
    data: {
      companyId: tenantId,
      trackingNumber,
      customerId,
      driverId,
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress,
      status,
      note: input.note,
      estimatedDeliveryAt: input.estimatedDeliveryAt ?? null,
      history: {
        create: [
          { status: 'PREPARED', note: 'Commande créée' },
          ...(status === 'ASSIGNED' ? [{ status: 'ASSIGNED' as const, note: 'Affectée à la création' }] : []),
        ],
      },
      trackingTokens: {
        create: {
          token: generateSecureToken(24),
          expiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000),
        },
      },
    },
    include: ORDER_INCLUDE,
  });

  logger.info('order created', { orderId: order.id, trackingNumber, status, requestId: req.id });
  ok(res, order, undefined, 201);
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(updateOrderSchema, req.body);
  const order = await findOwnedOrder(id, req);

  if (order.status !== 'PREPARED') {
    throw conflict('Commande déjà prise en charge : modification refusée');
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(input.pickupAddress !== undefined ? { pickupAddress: input.pickupAddress } : {}),
      ...(input.deliveryAddress !== undefined ? { deliveryAddress: input.deliveryAddress } : {}),
      ...(input.estimatedDeliveryAt !== undefined ? { estimatedDeliveryAt: input.estimatedDeliveryAt } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    include: ORDER_INCLUDE,
  });

  ok(res, updated);
});

export const assignOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(assignOrderSchema, req.body);
  const order = await findOwnedOrder(id, req);

  if (!['PREPARED', 'ASSIGNED'].includes(order.status)) {
    throw conflict('Affectation possible uniquement avant ou pendant la préparation');
  }

  if (input.driverId) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: input.driverId },
      select: { id: true, companyId: true, userId: true },
    });
    if (!driver || driver.companyId !== order.companyId) throw badRequest('Livreur invalide pour cette commande');

    if (order.driverId === driver.id) return ok(res, await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE }));

    const updated = await prisma.order.update({
      where: { id },
      data: {
        driverId: driver.id,
        status: 'ASSIGNED',
        history: {
          create: [{ status: 'ASSIGNED', note: order.status === 'PREPARED' ? undefined : 'Réaffectée à un autre livreur' }],
        },
      },
      include: ORDER_INCLUDE,
    });
    logger.info('order assigned', { orderId: id, driverId: driver.id, requestId: req.id });
    return ok(res, updated);
  }

  // Désaffectation : retour à « Préparée », sans livreur.
  const updated = await prisma.order.update({
    where: { id },
    data: {
      driverId: null,
      status: 'PREPARED',
      history: { create: [{ status: 'PREPARED', note: 'Désaffectée' }] },
    },
    include: ORDER_INCLUDE,
  });
  logger.info('order unassigned', { orderId: id, requestId: req.id });
  ok(res, updated);
});

export const changeOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(updateOrderStatusSchema, req.body);
  const order = await findOwnedOrder(id, req);

  // Droit : gestionnaire (order:update) OU livreur affecté (manutention uniquement).
  const managerOk = req.auth!.role === 'SUPER_ADMIN' || req.auth!.role === 'COMPANY_ADMIN' || req.auth!.role === 'DISPATCHER';
  const isAssignedDriver = order.driver?.userId != null && order.driver.userId === req.auth!.userId;
  if (!managerOk && !isAssignedDriver) throw forbidden('Accès refusé');
  if (!managerOk && !STATUSES_HANDLED_BY_DRIVER.includes(input.status)) {
    throw forbidden('Le livreur ne peut signaler que la manutention (récupération, transit, livraison, échec)');
  }

  if (!canTransitionOrderStatus(order.status, input.status)) {
    throw conflict(`Transition ${order.status} → ${input.status} non autorisée`);
  }

  const deliveredAt = input.status === 'DELIVERED' ? new Date() : null;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: input.status,
      ...(deliveredAt ? { deliveredAt } : {}),
      history: {
        create: [{
          status: input.status,
          note: input.note,
          latitude: input.latitude,
          longitude: input.longitude,
        }],
      },
    },
    include: ORDER_INCLUDE,
  });

  if (input.status === 'CANCELLED') {
    await prisma.trackingToken.updateMany({
      where: { orderId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (input.status === 'DELIVERED') {
    await prisma.driverProfile.updateMany({
      where: { id: order.driverId ?? '' },
      data: { totalDeliveries: { increment: 1 }, successfulDeliveries: { increment: 1 } },
    });
  }

  logger.info('order status changed', { orderId: id, from: order.status, to: input.status, requestId: req.id });
  ok(res, updated);
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParams, req.params);
  const order = await findOwnedOrder(id, req);

  if (order.status !== 'PREPARED') {
    throw conflict('Seules les commandes non prises en charge peuvent être supprimées');
  }

  await prisma.order.delete({ where: { id } });
  logger.info('order deleted', { orderId: id, requestId: req.id });
  ok(res, { id });
});
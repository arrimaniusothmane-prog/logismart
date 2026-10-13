import type { Request, Response } from 'express';
import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  canTransitionOrderStatus,
  paginationSchema,
  portalChatSchema,
  portalLoginSchema,
  portalMessageSchema,
  portalPasswordSchema,
  portalRegisterSchema,
  portalSupportSchema,
  portalUpdateProfileSchema,
  portalCreateOrderSchema,
} from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { hashPassword, verifyPassword } from '../auth/auth.service.js';
import { clearPortalCookies, setPortalCookies, verifyPortalToken } from './portal.tokens.js';
import { logger } from '../../lib/logger.js';
import { generateSecureToken } from '../../lib/ids.js';
import { generateUniqueTrackingNumber, TOKEN_TTL_DAYS, ORDER_INCLUDE } from '../orders/orders.controller.js';

const idParams = z.object({ id: z.string().min(1) });
const listOrdersQuery = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});

const CUSTOMER_SELECT = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  createdAt: true,
} as const;

const ORDER_CARD_SELECT = {
  id: true,
  trackingNumber: true,
  status: true,
  deliveryAddress: true,
  pickupAddress: true,
  estimatedDeliveryAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
  driver: { select: { id: true, vehicleType: true, user: { select: { name: true } } } },
} as const;

const TRACKING_RE = /\bLS-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{2}\b/;

function activeOrderWhere(customerId: string) {
  return { customerId, status: { notIn: ['DELIVERED', 'CANCELLED', 'FAILED'] as OrderStatus[] } };
}

/* ------------------------------ Session ------------------------------ */

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(portalRegisterSchema, req.body);

  const order = await prisma.order.findUnique({
    where: { trackingNumber: input.trackingNumber },
    include: { customer: true },
  });
  if (!order) throw notFound('Aucune commande trouvée avec ce numéro de suivi');

  const customer = order.customer;
  if (customer.email && customer.email.toLowerCase() !== input.email) {
    throw forbidden('Cet e-mail ne correspond pas à cette commande');
  }
  if (customer.passwordHash) throw conflict('Ce compte client est déjà activé');

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash: await hashPassword(input.password),
      ...(customer.email ? {} : { email: input.email }),
    },
  });

  setPortalCookies(res, customer.id, customer.companyId);
  logger.info('portal account activated', { customerId: customer.id, requestId: req.id });
  ok(res, { id: customer.id, name: customer.name, email: input.email });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(portalLoginSchema, req.body);

  const candidates = await prisma.customer.findMany({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: { id: true, companyId: true, name: true, email: true, passwordHash: true },
  });

  for (const candidate of candidates) {
    if (!candidate.passwordHash) continue;
    if (await verifyPassword(input.password, candidate.passwordHash)) {
      setPortalCookies(res, candidate.id, candidate.companyId);
      logger.info('portal login success', { customerId: candidate.id, requestId: req.id });
      return ok(res, {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
      });
    }
  }

  throw unauthorized('Identifiants incorrects');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.ls_pr as string | undefined;
  if (!token) throw unauthorized('Session requise');

  let payload;
  try {
    payload = verifyPortalToken(token, 'portal-refresh');
  } catch {
    throw unauthorized('Session expirée ou invalide');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: payload.customerId },
    select: { id: true, companyId: true },
  });
  if (!customer || customer.companyId !== payload.companyId) {
    throw unauthorized('Session expirée ou invalide');
  }

  setPortalCookies(res, customer.id, customer.companyId);
  ok(res, { id: customer.id });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearPortalCookies(res);
  ok(res, { loggedOut: true });
});

/* ------------------------------ Profil ------------------------------ */

export const me = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      ...CUSTOMER_SELECT,
      notificationsReadAt: true,
      company: { select: { name: true, phone: true, email: true } },
    },
  });
  if (!customer) throw notFound('Compte introuvable');

  const [totalOrders, activeOrder, lastDelivered, notificationsUnread] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.findFirst({
      where: activeOrderWhere(customerId),
      orderBy: { updatedAt: 'desc' },
      select: ORDER_CARD_SELECT,
    }),
    prisma.order.findFirst({
      where: { customerId, status: 'DELIVERED' },
      orderBy: { deliveredAt: 'desc' },
      select: ORDER_CARD_SELECT,
    }),
    prisma.orderStatusHistory.count({
      where: {
        order: { customerId },
        createdAt: { gt: customer.notificationsReadAt ?? new Date(0) },
      },
    }),
  ]);

  const { notificationsReadAt: _ignored, ...profile } = customer;
  ok(res, { ...profile, totalOrders, activeOrder, lastDelivered, notificationsUnread });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;
  const input = parseOrThrow(portalUpdateProfileSchema, req.body);

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
    },
    select: CUSTOMER_SELECT,
  });

  logger.info('portal profile updated', { customerId, requestId: req.id });
  ok(res, customer);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;
  const input = parseOrThrow(portalPasswordSchema, req.body);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { passwordHash: true },
  });
  if (!customer) throw notFound('Compte introuvable');

  const valid =
    customer.passwordHash !== null &&
    (await verifyPassword(input.currentPassword, customer.passwordHash));
  if (!valid) throw unauthorized('Mot de passe actuel incorrect');

  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: await hashPassword(input.password) },
  });

  logger.info('portal password changed', { customerId, requestId: req.id });
  ok(res, { changed: true });
});

/* ------------------------------ Commandes ------------------------------ */

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;
  const query = parseOrThrow(listOrdersQuery, req.query);

  const where: Record<string, unknown> = {
    customerId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { trackingNumber: { contains: query.search, mode: 'insensitive' as const } },
            { deliveryAddress: { contains: query.search, mode: 'insensitive' as const } },
            { pickupAddress: { contains: query.search, mode: 'insensitive' as const } },
            { note: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: query.order }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: ORDER_CARD_SELECT,
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;
  const { id } = parseOrThrow(idParams, req.params);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true, address: true } },
      company: { select: { name: true, phone: true, email: true } },
      history: { orderBy: { createdAt: 'asc' } },
      proofs: { orderBy: { createdAt: 'desc' } },
      driver: {
        select: {
          id: true,
          vehicleType: true,
          availability: true,
          currentLatitude: true,
          currentLongitude: true,
          lastLocationAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  // Le client ne voit que ses propres commandes — 404 (pas de fuite d'existence).
  if (!order || order.customerId !== customerId) throw notFound('Commande introuvable');
  ok(res, order);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, companyId } = req.portalAuth!;
  const input = parseOrThrow(portalCreateOrderSchema, req.body);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, companyId: true, name: true, phone: true },
  });
  if (!customer || customer.companyId !== companyId) throw notFound('Compte introuvable');

  // Résolution optionnelle du service du catalogue pour calculer le tarif réel
  let serviceName: string | null = null;
  let servicePrice: number | null = null;
  if (input.serviceId) {
    const service = await prisma.catalogItem.findUnique({
      where: { id: input.serviceId },
      select: { id: true, companyId: true, name: true, price: true, status: true, type: true },
    });
    if (!service || service.companyId !== companyId || service.status !== 'ACTIVE') {
      throw notFound('Service de livraison introuvable ou indisponible');
    }
    serviceName = service.name;
    servicePrice = service.price;
  }

  // Construction d'une note structurée et lisible
  const noteParts: string[] = [];
  if (serviceName) {
    noteParts.push(`Service : ${serviceName}${servicePrice !== null ? ` (${servicePrice.toFixed(2)} €)` : ''}`);
  }
  if (input.recipientName || input.recipientPhone || input.recipientCity) {
    const recipientDetails = [
      input.recipientName ? `Destinataire : ${input.recipientName}` : '',
      input.recipientPhone ? `Tél : ${input.recipientPhone}` : '',
      input.recipientCity ? `Ville : ${input.recipientCity}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    noteParts.push(recipientDetails);
  }
  if (input.senderName || input.senderPhone) {
    const senderDetails = [
      input.senderName ? `Expéditeur : ${input.senderName}` : '',
      input.senderPhone ? `Tél : ${input.senderPhone}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    noteParts.push(senderDetails);
  }
  if (input.description) {
    noteParts.push(`Contenu : ${input.description}`);
  }
  if (input.quantity && input.quantity > 1) {
    noteParts.push(`Quantité : ${input.quantity}`);
  }
  if (input.codAmount && input.codAmount > 0) {
    noteParts.push(`Contre-remboursement (COD) : ${input.codAmount.toFixed(2)} €`);
  }
  if (input.deliveryInstructions) {
    noteParts.push(`Instructions : ${input.deliveryInstructions}`);
  }
  if (input.note) {
    noteParts.push(input.note);
  }

  const trackingNumber = await generateUniqueTrackingNumber();

  const finalDeliveryAddress =
    input.recipientCity && !input.deliveryAddress.toLowerCase().includes(input.recipientCity.toLowerCase())
      ? `${input.deliveryAddress}, ${input.recipientCity}`
      : input.deliveryAddress;

  const order = await prisma.order.create({
    data: {
      companyId,
      customerId,
      trackingNumber,
      pickupAddress: input.pickupAddress,
      deliveryAddress: finalDeliveryAddress,
      status: 'PREPARED',
      note: noteParts.length > 0 ? noteParts.join('\n') : null,
      estimatedDeliveryAt: input.estimatedDeliveryAt ?? null,
      history: {
        create: [{ status: 'PREPARED', note: 'Commande créée via portail client' }],
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

  logger.info('portal order created', { orderId: order.id, trackingNumber, customerId, requestId: req.id });
  ok(res, order, undefined, 201);
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, companyId } = req.portalAuth!;
  const { id } = parseOrThrow(idParams, req.params);

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, customerId: true, companyId: true, status: true, trackingNumber: true },
  });

  if (!order || order.customerId !== customerId || order.companyId !== companyId) {
    throw notFound('Commande introuvable');
  }

  if (!['PREPARED', 'ASSIGNED'].includes(order.status) || !canTransitionOrderStatus(order.status, 'CANCELLED')) {
    throw conflict('Cette commande ne peut plus être annulée car elle a déjà été prise en charge par le transporteur.');
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      history: {
        create: [{ status: 'CANCELLED', note: 'Commande annulée par le client' }],
      },
    },
    include: ORDER_INCLUDE,
  });

  await prisma.trackingToken.updateMany({
    where: { orderId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  logger.info('portal order cancelled', { orderId: id, trackingNumber: order.trackingNumber, customerId, requestId: req.id });
  ok(res, updated);
});

export const listServices = asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.portalAuth!;
  const services = await prisma.catalogItem.findMany({
    where: { companyId, type: 'SERVICE', status: 'ACTIVE' },
    orderBy: { price: 'asc' },
    select: { id: true, name: true, description: true, price: true },
  });
  ok(res, services);
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;

  const [
    total,
    preparing,
    inTransit,
    delivered,
    failed,
    cancelled,
    recentOrders,
    recentHistories,
    customer,
  ] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.count({ where: { customerId, status: { in: ['PREPARED', 'ASSIGNED'] } } }),
    prisma.order.count({ where: { customerId, status: { in: ['PICKED_UP', 'IN_TRANSIT'] } } }),
    prisma.order.count({ where: { customerId, status: 'DELIVERED' } }),
    prisma.order.count({ where: { customerId, status: 'FAILED' } }),
    prisma.order.count({ where: { customerId, status: 'CANCELLED' } }),
    prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: ORDER_CARD_SELECT,
    }),
    prisma.orderStatusHistory.findMany({
      where: { order: { customerId } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { order: { select: { id: true, trackingNumber: true, deliveryAddress: true } } },
    }),
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { notificationsReadAt: true },
    }),
  ]);

  const readAt = customer?.notificationsReadAt ?? new Date(0);

  const latestUpdates = recentHistories.map((h) => ({
    id: h.id,
    orderId: h.order.id,
    trackingNumber: h.order.trackingNumber,
    deliveryAddress: h.order.deliveryAddress,
    status: h.status,
    label: ORDER_STATUS_LABELS[h.status] ?? h.status,
    note: h.note,
    at: h.createdAt.toISOString(),
    read: h.createdAt.getTime() <= readAt.getTime(),
  }));

  ok(res, {
    total,
    preparing,
    inTransit,
    delivered,
    failed,
    cancelled,
    recentOrders,
    latestUpdates,
  });
});


export const notifications = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;

  const [customer, orders] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { notificationsReadAt: true },
    }),
    prisma.order.findMany({
      where: { customerId },
      select: { id: true, trackingNumber: true },
    }),
  ]);
  const readAt = customer?.notificationsReadAt ?? new Date(0);
  const orderIds = orders.map((o) => o.id);
  const byId = new Map(orders.map((o) => [o.id, o.trackingNumber]));

  const history = orderIds.length
    ? await prisma.orderStatusHistory.findMany({
        where: { orderId: { in: orderIds } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, orderId: true, status: true, note: true, createdAt: true },
      })
    : [];

  ok(
    res,
    history.map((h) => ({
      id: h.id,
      orderId: h.orderId,
      trackingNumber: byId.get(h.orderId) ?? null,
      status: h.status,
      label: ORDER_STATUS_LABELS[h.status] ?? h.status,
      note: h.note,
      at: h.createdAt.toISOString(),
      read: h.createdAt.getTime() <= readAt.getTime(),
    })),
  );
});

/** Marque toutes les notifications comme lues (horodatage côté serveur). */
export const markNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.portalAuth!;
  const now = new Date();
  await prisma.customer.update({
    where: { id: customerId },
    data: { notificationsReadAt: now },
  });
  logger.info('portal notifications read', { customerId, requestId: req.id });
  ok(res, { readAt: now.toISOString() });
});

/* ------------------------------ Support client ------------------------------ */

interface PortalEscalationAuth {
  customerId: string;
  companyId: string;
}

/** Le ticket n'existe que pour le propriétaire et la tenant du jeton (404 sinon). */
function assertTicketOwnership(
  escalation: { companyId: string; session: { customerIdentifier: string | null } },
  auth: PortalEscalationAuth,
): void {
  if (escalation.companyId !== auth.companyId || escalation.session.customerIdentifier !== auth.customerId) {
    throw notFound('Demande introuvable');
  }
}

export const listSupport = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.portalAuth!;

  const sessions = await prisma.chatSession.findMany({
    where: { customerIdentifier: auth.customerId, companyId: auth.companyId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  const escalations = sessionIds.length
    ? await prisma.supportEscalation.findMany({
        where: { sessionId: { in: sessionIds }, companyId: auth.companyId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              trackingNumber: true,
              _count: { select: { messages: true } },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { role: true, content: true, createdAt: true },
              },
            },
          },
        },
      })
    : [];

  ok(
    res,
    escalations.map((e) => ({
      id: e.id,
      reason: e.reason,
      status: e.status,
      trackingNumber: e.session.trackingNumber,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      messageCount: e.session._count.messages,
      lastMessage: e.session.messages[0]
        ? {
            role: e.session.messages[0].role,
            content: e.session.messages[0].content,
            at: e.session.messages[0].createdAt.toISOString(),
          }
        : null,
    })),
  );
});

export const createSupport = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.portalAuth!;
  const input = parseOrThrow(portalSupportSchema, req.body);

  let trackingNumber: string | null = null;
  if (input.trackingNumber) {
    const order = await prisma.order.findFirst({
      where: { trackingNumber: input.trackingNumber, customerId: auth.customerId },
      select: { trackingNumber: true },
    });
    if (!order) throw notFound('Aucune commande trouvée avec ce numéro de suivi');
    trackingNumber = order.trackingNumber;
  }

  const escalation = await prisma.$transaction(async (tx) => {
    const session = await tx.chatSession.create({
      data: {
        companyId: auth.companyId,
        customerIdentifier: auth.customerId,
        trackingNumber,
      },
      select: { id: true },
    });
    await tx.chatMessage.create({
      data: { sessionId: session.id, role: 'user', content: input.message },
    });
    return tx.supportEscalation.create({
      data: { sessionId: session.id, companyId: auth.companyId, reason: input.reason },
      select: { id: true, status: true, createdAt: true },
    });
  });

  logger.info('portal support ticket created', {
    customerId: auth.customerId,
    escalationId: escalation.id,
    requestId: req.id,
  });
  ok(
    res,
    {
      id: escalation.id,
      reason: input.reason,
      status: escalation.status,
      trackingNumber,
      createdAt: escalation.createdAt.toISOString(),
    },
    undefined,
    201,
  );
});

export const getSupport = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.portalAuth!;
  const { id } = parseOrThrow(idParams, req.params);

  const escalation = await prisma.supportEscalation.findUnique({
    where: { id },
    include: {
      session: {
        select: {
          trackingNumber: true,
          customerIdentifier: true,
          createdAt: true,
          messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, createdAt: true } },
        },
      },
    },
  });
  if (!escalation) throw notFound('Demande introuvable');
  assertTicketOwnership(escalation, auth);

  ok(res, {
    id: escalation.id,
    reason: escalation.reason,
    status: escalation.status,
    trackingNumber: escalation.session.trackingNumber,
    createdAt: escalation.createdAt.toISOString(),
    messages: escalation.session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      at: m.createdAt.toISOString(),
    })),
  });
});

/** Réponse du client : ajoute un message et rouvre la demande si elle était résolue. */
export const replySupport = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.portalAuth!;
  const { id } = parseOrThrow(idParams, req.params);
  const input = parseOrThrow(portalMessageSchema, req.body);

  const escalation = await prisma.supportEscalation.findUnique({
    where: { id },
    include: { session: { select: { id: true, customerIdentifier: true } } },
  });
  if (!escalation) throw notFound('Demande introuvable');
  assertTicketOwnership(escalation, auth);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: { sessionId: escalation.sessionId, role: 'user', content: input.content },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    await tx.chatSession.update({
      where: { id: escalation.sessionId },
      data: { updatedAt: new Date() },
    });
    if (escalation.status === 'RESOLVED') {
      await tx.supportEscalation.update({ where: { id }, data: { status: 'OPEN' } });
    }
    return created;
  });

  logger.info('portal support reply', {
    customerId: auth.customerId,
    escalationId: id,
    requestId: req.id,
  });
  ok(
    res,
    { id: message.id, role: message.role, content: message.content, at: message.createdAt.toISOString() },
    undefined,
    201,
  );
});

/* ------------------------------ Assistant ------------------------------ */

function orderSummary(order: {
  trackingNumber: string;
  status: keyof typeof ORDER_STATUS_LABELS;
  deliveryAddress: string;
  estimatedDeliveryAt: Date | null;
  deliveredAt: Date | null;
  driver: { user: { name: string } } | null;
}): string {
  const status = ORDER_STATUS_LABELS[order.status] ?? order.status;
  const parts = [`Votre colis ${order.trackingNumber} est « ${status} ».`];
  if (order.driver) parts.push(`Livreur : ${order.driver.user.name}.`);
  if (order.status === 'DELIVERED' && order.deliveredAt) {
    parts.push(`Livré le ${order.deliveredAt.toLocaleString('fr-FR')}.`);
  } else if (order.estimatedDeliveryAt) {
    parts.push(`Livraison prévue le ${order.estimatedDeliveryAt.toLocaleString('fr-FR')}.`);
  }
  parts.push(`Destination : ${order.deliveryAddress}.`);
  return parts.join(' ');
}

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, companyId } = req.portalAuth!;
  const input = parseOrThrow(portalChatSchema, req.body);

  const orders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { updatedAt: 'desc' },
    select: {
      ...ORDER_CARD_SELECT,
      customer: { select: { name: true } },
    },
  });

  const active = orders.find((o) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(o.status)) ?? orders[0] ?? null;

  let reply: string;
  let context: { orderId: string; trackingNumber: string } | null = null;

  const mention = input.message.match(TRACKING_RE);
  const target = mention
    ? orders.find((o) => o.trackingNumber.toUpperCase() === mention[0].toUpperCase())
    : active;

  if (mention && !target) {
    reply = "Je ne trouve aucun colis avec ce numéro parmi vos livraisons. Vérifiez le format (LS-XXXX-XXXX-XX).";
  } else if (!target) {
    reply =
      "Aucune livraison n'est associée à votre compte pour le moment. Vous pouvez activer votre suivi avec un numéro de commande depuis la page d'accueil.";
  } else {
    context = { orderId: target.id, trackingNumber: target.trackingNumber };
    const message = input.message.toLowerCase();

    if (/(bonjour|salut|hello|hi|coucou)/.test(message)) {
      reply = `Bonjour ${orders[0]?.customer?.name ?? ''} ! ${orderSummary(target)}`.trim();
    } else if (/(annul)/.test(message)) {
      reply = `La commande ${target.trackingNumber} est « ${ORDER_STATUS_LABELS[target.status]} ». Toute annulation passe par le support LogiSmart — je peux vous mettre en relation depuis l'onglet Aide.`;
    } else if (/(statut|situation|avance|en route|suivi|où est|ou est|ou se trouve|où se trouve)/.test(message)) {
      reply = `Votre colis ${target.trackingNumber} est « ${ORDER_STATUS_LABELS[target.status]} ».` + (target.driver ? ` Livreur : ${target.driver.user.name}.` : '');
    } else if (/(heure|quand|délai|delai|retard|arriv|estim)/.test(message)) {
      reply = target.estimatedDeliveryAt
        ? `Livraison prévue le ${target.estimatedDeliveryAt.toLocaleString('fr-FR')} pour ${target.trackingNumber} (statut : ${ORDER_STATUS_LABELS[target.status]}).`
        : `Aucune estimation d'heure n'est encore enregistrée pour ${target.trackingNumber} — statut actuel : ${ORDER_STATUS_LABELS[target.status]}.`;
    } else if (/(livreur|conducteur|chauffeur|conductrice)/.test(message)) {
      reply = target.driver
        ? `Le livreur en charge de ${target.trackingNumber} est ${target.driver.user.name} (${target.driver.vehicleType.toLowerCase()}).`
        : `Aucun livreur n'est encore assigné à ${target.trackingNumber}.`;
    } else if (/(adresse|destination|lieu|expédi|expedi)/.test(message)) {
      reply = `Destination : ${target.deliveryAddress}. Départ : ${target.pickupAddress}. Statut : ${ORDER_STATUS_LABELS[target.status]}.`;
    } else {
      reply = orderSummary(target);
    }
  }

  // Persistance de la conversation (session réelle côté backend).
  let session = await prisma.chatSession.findFirst({
    where: { companyId, customerIdentifier: customerId },
    select: { id: true },
  });
  if (!session) {
    session = await prisma.chatSession.create({
      data: { companyId, customerIdentifier: customerId, trackingNumber: context?.trackingNumber ?? null },
      select: { id: true },
    });
  }
  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: 'user', content: input.message },
      { sessionId: session.id, role: 'assistant', content: reply },
    ],
  });

  ok(res, { reply, ...context });
});

import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { ok } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';

const tokenParams = z.object({ token: z.string().trim().min(16).max(200) });

/**
 * Suivi public d'une livraison.
 * Aucune authentification : la possession du jeton opaque est la preuve.
 * Le client n'expose jamais d'informations sensibles (positions GPS précises,
 * identité du livreur) — uniquement le parcours et les étapes.
 */
export const trackOrder = asyncHandler(async (req: Request, res: Response) => {
  const { token } = parseOrThrow(tokenParams, req.params);

  const tracking = await prisma.trackingToken.findUnique({
    where: { token },
    include: {
      order: {
        include: {
          customer: { select: { name: true } },
          driver: { select: { id: true, user: { select: { name: true } }, phone: true } },
          history: {
            orderBy: { createdAt: 'asc' as const },
            select: { status: true, note: true, createdAt: true },
          },
        },
      },
    },
  });

  if (
    !tracking ||
    tracking.revokedAt !== null ||
    tracking.expiresAt.getTime() < Date.now()
  ) {
    throw notFound('Lien de suivi invalide ou expiré');
  }

  const { order } = tracking;

  ok(res, {
    trackingNumber: order.trackingNumber,
    status: order.status,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    estimatedDeliveryAt: order.estimatedDeliveryAt,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
    note: order.note,
    customer: order.customer,
    driver: order.driver
      ? { name: order.driver.user.name, phone: order.driver.phone }
      : null,
    timeline: order.history,
  });
});
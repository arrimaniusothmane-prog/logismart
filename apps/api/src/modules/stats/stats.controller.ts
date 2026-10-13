import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ok } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { companyWhere } from '../../middleware/tenant.js';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@logismart/shared';

const LIVE_STATUSES: OrderStatus[] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
const DAY = 86_400_000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Vue d'ensemble de l'entreprise (portail Company) :
 * chiffres du jour, performance, timeline d'activité, livraisons live.
 * Périmètre strictement issu du jeton (jamais de query companyId).
 */
export const overview = asyncHandler(async (req: Request, res: Response) => {
  const where = companyWhere(req);
  const now = new Date();
  const startToday = startOfUtcDay(now);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);

  const [
    todayGroups,
    totalOrders,
    totalCustomers,
    totalDrivers,
    onlineDrivers,
    delayedCount,
    recentHistory,
    liveOrders,
    deliveredSeries,
    delivered30,
    failed30,
  ] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], where: { ...where, createdAt: { gte: startToday } }, _count: { _all: true } }),
    prisma.order.count({ where }),
    prisma.customer.count({ where }),
    prisma.driverProfile.count({ where }),
    prisma.driverProfile.count({ where: { availability: { in: ['ONLINE', 'BUSY'] } } }),
    prisma.order.count({
      where: {
        ...where,
        estimatedDeliveryAt: { lt: now },
        status: { notIn: ['DELIVERED', 'CANCELLED', 'FAILED'] },
      },
    }),
    prisma.orderStatusHistory.findMany({
      where: { order: where },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { order: { select: { id: true, trackingNumber: true } } },
    }),
    prisma.order.findMany({
      where: { ...where, status: { in: LIVE_STATUSES } },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      include: {
        customer: { select: { name: true } },
        driver: {
          select: {
            id: true,
            availability: true,
            vehicleType: true,
            currentLatitude: true,
            currentLongitude: true,
            lastLocationAt: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { ...where, status: 'DELIVERED', deliveredAt: { gte: since7 } },
      select: { deliveredAt: true },
    }),
    prisma.order.findMany({
      where: { ...where, status: 'DELIVERED', deliveredAt: { gte: since30 } },
      select: { createdAt: true, deliveredAt: true },
    }),
    prisma.order.count({ where: { ...where, status: 'FAILED', createdAt: { gte: since30 } } }),
  ]);

  const byStatus: Record<string, number> = {};
  let todayTotal = 0;
  for (const group of todayGroups) {
    byStatus[group.status] = group._count._all;
    todayTotal += group._count._all;
  }

  const delivered30Count = delivered30.length;
  const finished30 = delivered30Count + failed30;
  const successRate = finished30 === 0 ? null : Math.round((delivered30Count / finished30) * 1000) / 10;

  const durations = delivered30
    .filter((o) => o.deliveredAt)
    .map((o) => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / 60_000)
    .filter((min) => min >= 0 && min < 24 * 60);
  const avgDeliveryMinutes =
    durations.length === 0
      ? null
      : Math.round((durations.reduce((sum, v) => sum + v, 0) / durations.length) * 10) / 10;

  const deliveredTrend: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = startOfUtcDay(new Date(now.getTime() - i * DAY));
    const next = new Date(day.getTime() + DAY);
    const count = deliveredSeries.filter(
      (o) => o.deliveredAt && o.deliveredAt >= day && o.deliveredAt < next,
    ).length;
    deliveredTrend.push({ date: day.toISOString().slice(0, 10), count });
  }

  const activity = recentHistory.map((h) => ({
    id: h.id,
    at: h.createdAt.toISOString(),
    status: h.status,
    label: ORDER_STATUS_LABELS[h.status] ?? h.status,
    note: h.note,
    trackingNumber: h.order.trackingNumber,
    orderId: h.order.id,
  }));

  const live = liveOrders.map((order) => ({
    id: order.id,
    trackingNumber: order.trackingNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    deliveryAddress: order.deliveryAddress,
    customerName: order.customer.name,
    estimatedDeliveryAt: order.estimatedDeliveryAt?.toISOString() ?? null,
    updatedAt: order.updatedAt.toISOString(),
    driver: order.driver
      ? {
          id: order.driver.id,
          name: order.driver.user.name,
          vehicleType: order.driver.vehicleType,
          availability: order.driver.availability,
          latitude: order.driver.currentLatitude,
          longitude: order.driver.currentLongitude,
          locationAt: order.driver.lastLocationAt?.toISOString() ?? null,
        }
      : null,
  }));

  ok(res, {
    today: {
      total: todayTotal,
      delivered: byStatus.DELIVERED ?? 0,
      inTransit: (byStatus.IN_TRANSIT ?? 0) + (byStatus.PICKED_UP ?? 0),
      delayed: delayedCount,
      failed: byStatus.FAILED ?? 0,
      byStatus,
    },
    totals: {
      orders: totalOrders,
      customers: totalCustomers,
      drivers: totalDrivers,
      driversOnline: onlineDrivers,
    },
    performance: { successRate, avgDeliveryMinutes, deliveredTrend },
    activity,
    live,
  });
});

import type { Request, Response } from 'express';
import {
  DRIVER_AVAILABILITIES,
  ORDER_STATUSES,
  ROLES,
  USER_STATUSES,
  type DriverAvailability,
  type OrderStatus,
  type Role,
  type UserStatus,
} from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { ok } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Compte le nombre d'éléments pour chaque clé d'un groupBy Prisma. */
function tally<K extends string>(rows: Array<{ key: K; count: number }>, keys: readonly K[]): Record<K, number> {
  const map = new Map(rows.map((r) => [r.key, r.count]));
  return Object.fromEntries(keys.map((key) => [key, map.get(key) ?? 0])) as Record<K, number>;
}

/** KPI plateforme — réservée au SUPER_ADMIN (permission platform:stats). */
export const platformStats = asyncHandler(async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [
    companiesTotal,
    companiesNew,
    recentCompanies,
    usersTotal,
    userStatusRows,
    userRoleRows,
    recentUsers,
    ordersTotal,
    orderStatusRows,
    customersTotal,
    driversTotal,
    driverAvailabilityRows,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { createdAt: { gte: since } } }),
    prisma.company.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
    }),
    prisma.user.count(),
    prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    }),
    prisma.order.count(),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.customer.count(),
    prisma.driverProfile.count(),
    prisma.driverProfile.groupBy({ by: ['availability'], _count: { _all: true } }),
  ]);

  const byStatus = tally<OrderStatus>(
    orderStatusRows.map((r) => ({ key: r.status, count: r._count._all })),
    ORDER_STATUSES,
  );

  const activeOrders = byStatus.ASSIGNED + byStatus.PICKED_UP + byStatus.IN_TRANSIT;
  const finishedOrders = byStatus.DELIVERED + byStatus.FAILED + byStatus.CANCELLED;

  ok(res, {
    companies: { total: companiesTotal, newLast30Days: companiesNew, recent: recentCompanies },
    users: {
      total: usersTotal,
      byStatus: tally<UserStatus>(
        userStatusRows.map((r) => ({ key: r.status, count: r._count._all })),
        USER_STATUSES,
      ),
      byRole: tally<Role>(
        userRoleRows.map((r) => ({ key: r.role, count: r._count._all })),
        ROLES,
      ),
      recent: recentUsers,
    },
    orders: { total: ordersTotal, byStatus, active: activeOrders, finished: finishedOrders },
    drivers: {
      total: driversTotal,
      byAvailability: tally<DriverAvailability>(
        driverAvailabilityRows.map((r) => ({ key: r.availability, count: r._count._all })),
        DRIVER_AVAILABILITIES,
      ),
    },
    customers: { total: customersTotal },
  });
});

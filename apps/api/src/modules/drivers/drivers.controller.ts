import type { Request, Response } from 'express';
import { z } from 'zod';
import { paginationSchema, updateDriverAvailabilitySchema, updateDriverSchema } from '@logismart/shared';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { ok, paginated } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { assertCompanyOwnership, companyWhere } from '../../middleware/tenant.js';
import { logger } from '../../lib/logger.js';

const idParam = z.object({ id: z.string().min(1) });

const listQuerySchema = paginationSchema.extend({
  availability: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'ON_LEAVE']).optional(),
});

const PROFILE_SELECT = {
  id: true,
  userId: true,
  companyId: true,
  phone: true,
  vehicleType: true,
  licenseNumber: true,
  availability: true,
  currentLatitude: true,
  currentLongitude: true,
  lastLocationAt: true,
  totalDeliveries: true,
  successfulDeliveries: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, status: true } },
  _count: { select: { orders: true } },
} as const;

export const listDrivers = asyncHandler(async (req: Request, res: Response) => {
  const query = parseOrThrow(listQuerySchema, req.query);
  const where = {
    ...companyWhere(req),
    ...(query.availability ? { availability: query.availability } : {}),
    ...(query.search
      ? {
          user: {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.driverProfile.count({ where }),
    prisma.driverProfile.findMany({
      where,
      orderBy: { createdAt: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: PROFILE_SELECT,
    }),
  ]);

  ok(res, paginated(items, query.page, query.limit, total));
});

export const getDriver = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const driver = await prisma.driverProfile.findUnique({ where: { id }, select: PROFILE_SELECT });
  if (!driver) throw notFound('Livreur introuvable');
  assertCompanyOwnership(req, driver.companyId);

  const lastLocation = await prisma.driverLocation.findFirst({
    where: { driverId: id, companyId: driver.companyId },
    orderBy: { timestamp: 'desc' },
  });

  ok(res, { ...driver, lastLocation });
});

/** Le livreur met à jour sa propre disponibilité (authentifié, sans permission requise). */
export const updateOwnAvailability = asyncHandler(async (req: Request, res: Response) => {
  const input = parseOrThrow(updateDriverAvailabilitySchema, req.body);
  const driver = await prisma.driverProfile.findUnique({ where: { userId: req.auth!.userId } });
  if (!driver) throw notFound('Profil livreur introuvable');

  const updated = await prisma.driverProfile.update({
    where: { id: driver.id },
    data: { availability: input.availability },
    select: PROFILE_SELECT,
  });

  logger.info('driver availability updated', { driverId: updated.id, availability: updated.availability, requestId: req.id });
  ok(res, updated);
});
/** Le livreur consulte son propre profil (authentifié, sans permission requise). */
export const getOwnProfile = asyncHandler(async (req: Request, res: Response) => {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: req.auth!.userId },
    select: PROFILE_SELECT,
  });
  if (!driver) throw notFound('Profil livreur introuvable');

  const lastLocation = await prisma.driverLocation.findFirst({
    where: { driverId: driver.id, companyId: driver.companyId },
    orderBy: { timestamp: 'desc' },
  });

  ok(res, { ...driver, lastLocation });
});

/** Mise à jour du profil d'un livreur (COMPANY_ADMIN/DISPATCHER/SUPER_ADMIN ou le livreur lui-même). */
export const updateDriver = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParam, req.params);
  const input = parseOrThrow(updateDriverSchema, req.body);

  const driver = await prisma.driverProfile.findUnique({ where: { id } });
  if (!driver) throw notFound('Livreur introuvable');
  assertCompanyOwnership(req, driver.companyId);

  const updated = await prisma.driverProfile.update({
    where: { id },
    data: input,
    select: PROFILE_SELECT,
  });

  logger.info('driver updated', { driverId: id, requestId: req.id });
  ok(res, updated);
});

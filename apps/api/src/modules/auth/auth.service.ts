import bcrypt from 'bcryptjs';
import type { Role } from '@logismart/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { forbidden, unauthorized } from '../../lib/errors.js';
import { hashRefreshToken } from './tokens.js';

// 12 tours en production ; 4 en test pour garder la suite de tests rapide.
const BCRYPT_ROUNDS = env.isTest ? 4 : 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  status: string;
}

export function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  status: string;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    status: user.status,
  };
}

export async function findUserForLogin(email: string) {
  return prisma.user.findUnique({ where: { email }, include: { company: { select: { id: true, name: true, slug: true, publicId: true } } } });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true, slug: true, publicId: true } } },
  });
  if (!user) throw unauthorized('Session expirée ou invalide');
  return user;
}

/** Persiste un refresh token hashé. */
export async function persistRefreshToken(params: {
  userId: string;
  rawToken: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}) {
  return prisma.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: hashRefreshToken(params.rawToken),
      expiresAt: params.expiresAt,
      userAgent: params.userAgent?.slice(0, 300),
      ip: params.ip?.slice(0, 64),
    },
  });
}

export async function consumeRefreshToken(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });
  if (!token) throw unauthorized('Session invalide');
  if (token.revokedAt) throw unauthorized('Session révoquée');
  if (token.expiresAt.getTime() < Date.now()) throw unauthorized('Session expirée');
  if (token.user.status !== 'ACTIVE') throw forbidden('Compte désactivé');
  return token;
}

export async function revokeRefreshToken(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function markLogin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

/** Nettoyage périodique des sessions expirées (best effort). */
export async function purgeExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 86_400_000) } }] },
  });
  return result.count;
}

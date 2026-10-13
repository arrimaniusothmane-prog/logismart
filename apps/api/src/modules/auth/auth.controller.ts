import type { Request, Response } from 'express';
import { loginSchema, changePasswordSchema, type LoginInput } from '@logismart/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { unauthorized, forbidden, badRequest } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { ok } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { parseOrThrow } from '../../middleware/validate.js';
import {
  createRefreshToken,
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
  signAccessToken,
} from './tokens.js';
import * as authService from './auth.service.js';

function requestMeta(req: Request) {
  return { userAgent: req.header('user-agent') ?? undefined, ip: req.ip };
}

function getRefreshToken(req: Request): string | undefined {
  return req.cookies?.[env.refreshCookie] as string | undefined;
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input: LoginInput = parseOrThrow(loginSchema, req.body);
  const user = await authService.findUserForLogin(input.email);

  const valid = user ? await authService.verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !valid) {
    logger.warn('login failed', { email: input.email, ip: req.ip, requestId: req.id });
    throw unauthorized('Identifiants incorrects');
  }
  if (user.status !== 'ACTIVE') throw forbidden('Compte désactivé');

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    companyId: user.companyId,
  });

  const refresh = createRefreshToken();
  await authService.persistRefreshToken({ userId: user.id, rawToken: refresh.raw, expiresAt: refresh.expiresAt, ...requestMeta(req) });
  await authService.markLogin(user.id);

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refresh.raw);
  res.setHeader('cache-control', 'no-store');

  logger.info('login success', { userId: user.id, role: user.role, requestId: req.id });

  ok(res, {
    user: authService.toSafeUser(user),
    company: user.company ? { id: user.company.id, name: user.company.name, slug: user.company.slug, publicId: user.company.publicId } : null,
    accessToken,
    expiresInMs: 15 * 60_000,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const raw = getRefreshToken(req);
  if (!raw) throw unauthorized('Session absente');

  const token = await authService.consumeRefreshToken(raw);
  // Rotation : l'ancien jeton est révoqué, un nouveau est émis.
  await authService.revokeRefreshToken(raw);

  const user = token.user;
  const accessToken = signAccessToken({ sub: user.id, role: user.role, companyId: user.companyId });
  const next = createRefreshToken();
  await authService.persistRefreshToken({ userId: user.id, rawToken: next.raw, expiresAt: next.expiresAt, ...requestMeta(req) });

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, next.raw);
  res.setHeader('cache-control', 'no-store');

  ok(res, { user: authService.toSafeUser(user), accessToken, expiresInMs: 15 * 60_000 });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const raw = getRefreshToken(req);
  if (raw) await authService.revokeRefreshToken(raw);
  clearAuthCookies(res);
  res.setHeader('cache-control', 'no-store');
  ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth;
  if (!auth) throw unauthorized();
  const user = await authService.getUserById(auth.userId);
  res.setHeader('cache-control', 'no-store');
  ok(res, {
    user: authService.toSafeUser(user),
    company: user.company
      ? { id: user.company.id, name: user.company.name, slug: user.company.slug, publicId: user.company.publicId }
      : null,
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth;
  if (!auth) throw unauthorized();
  const input = parseOrThrow(changePasswordSchema, req.body);

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) throw unauthorized();

  const valid = await authService.verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw badRequest('Mot de passe actuel incorrect');

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await authService.hashPassword(input.newPassword) },
  });
  // Toutes les sessions sont invalidées après un changement de mot de passe.
  await authService.revokeAllUserSessions(user.id);

  logger.info('password changed', { userId: user.id, requestId: req.id });
  ok(res, { changed: true, sessionsRevoked: true });
});

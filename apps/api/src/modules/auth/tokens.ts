import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { Role } from '@logismart/shared';
import { env } from '../../config/env.js';
import { sha256, generateSecureToken } from '../../lib/ids.js';
import { durationToMs } from '../../lib/time.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  companyId: string | null;
  typ: 'access';
}

export const ACCESS_TTL_MS = durationToMs(env.JWT_ACCESS_TTL, 15 * 60_000);
export const REFRESH_TTL_MS = durationToMs(env.JWT_REFRESH_TTL, 7 * 86_400_000);

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'access' }, env.JWT_SECRET, {
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
    issuer: 'logismart',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'logismart' }) as jwt.JwtPayload;
  if (decoded.typ !== 'access' || typeof decoded.sub !== 'string') {
    throw new Error('Token invalide');
  }
  return {
    sub: decoded.sub,
    role: decoded.role as Role,
    companyId: (decoded.companyId as string | null) ?? null,
    typ: 'access',
  };
}

/** Jeton de refresh opaque : la valeur en clair part dans le cookie,
 *  seul son hash SHA-256 est persisté (fuite de base ≠ vol de session). */
export function createRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = generateSecureToken(48);
  return { raw, hash: sha256(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) };
}

export function hashRefreshToken(raw: string): string {
  return sha256(raw);
}

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE,
};

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(env.accessCookie, token, { ...baseCookie, maxAge: ACCESS_TTL_MS, path: '/' });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.refreshCookie, token, {
    ...baseCookie,
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(env.accessCookie, { ...baseCookie, path: '/' });
  res.clearCookie(env.refreshCookie, { ...baseCookie, path: '/api/auth' });
}

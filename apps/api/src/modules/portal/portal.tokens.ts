import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../../config/env.js';

/** Sessions du portail client — jetons et cookies dédiés,
 *  strictement séparés de la session utilisateur (`ls_at` / `ls_rt`). */

export const PORTAL_ACCESS_COOKIE = 'ls_pt';
export const PORTAL_REFRESH_COOKIE = 'ls_pr';

export interface PortalAccessPayload {
  sub: string; // customerId
  companyId: string;
  typ: 'portal-access';
}

export interface PortalRefreshPayload {
  sub: string;
  companyId: string;
  typ: 'portal-refresh';
}

const ACCESS_TTL_S = 12 * 3600; // 12h
const REFRESH_TTL_S = 30 * 24 * 3600; // 30j

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE,
} as const;

export function signPortalAccess(customerId: string, companyId: string): string {
  return jwt.sign({ sub: customerId, companyId, typ: 'portal-access' }, env.JWT_SECRET, {
    expiresIn: ACCESS_TTL_S,
    issuer: 'logismart',
  });
}

export function signPortalRefresh(customerId: string, companyId: string): string {
  return jwt.sign({ sub: customerId, companyId, typ: 'portal-refresh' }, env.JWT_SECRET, {
    expiresIn: REFRESH_TTL_S,
    issuer: 'logismart',
  });
}

export function verifyPortalToken(
  token: string,
  expected: 'portal-access' | 'portal-refresh',
): { customerId: string; companyId: string } {
  const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'logismart' }) as jwt.JwtPayload;
  if (decoded.typ !== expected || typeof decoded.sub !== 'string' || typeof decoded.companyId !== 'string') {
    throw new Error('Token portail invalide');
  }
  return { customerId: decoded.sub, companyId: decoded.companyId };
}

export function setPortalCookies(res: Response, customerId: string, companyId: string): void {
  res.cookie(PORTAL_ACCESS_COOKIE, signPortalAccess(customerId, companyId), {
    ...baseCookie,
    maxAge: ACCESS_TTL_S * 1000,
    path: '/',
  });
  res.cookie(PORTAL_REFRESH_COOKIE, signPortalRefresh(customerId, companyId), {
    ...baseCookie,
    maxAge: REFRESH_TTL_S * 1000,
    path: '/api/portal',
  });
}

export function clearPortalCookies(res: Response): void {
  res.clearCookie(PORTAL_ACCESS_COOKIE, { ...baseCookie, path: '/' });
  res.clearCookie(PORTAL_REFRESH_COOKIE, { ...baseCookie, path: '/api/portal' });
}

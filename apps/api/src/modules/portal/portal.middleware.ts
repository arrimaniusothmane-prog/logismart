import type { RequestHandler } from 'express';
import { unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { PORTAL_ACCESS_COOKIE, verifyPortalToken } from './portal.tokens.js';

function extractPortalToken(req: Parameters<RequestHandler>[0]): string | null {
  const cookie = req.cookies?.[PORTAL_ACCESS_COOKIE] as string | undefined;
  if (cookie) return cookie;
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Authentification du portail client.
 * customerId / companyId proviennent toujours du jeton —
 * jamais d'un query param ni du body.
 */
export const authenticatePortal: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractPortalToken(req);
    if (!token) throw unauthorized('Session requise');

    let payload;
    try {
      payload = verifyPortalToken(token, 'portal-access');
    } catch {
      throw unauthorized('Session expirée ou invalide');
    }

    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      select: { id: true, companyId: true, name: true, email: true },
    });
    if (!customer) throw unauthorized('Session expirée ou invalide');
    if (customer.companyId !== payload.companyId) throw unauthorized('Session expirée ou invalide');

    req.portalAuth = { customerId: customer.id, companyId: customer.companyId };
    next();
  } catch (err) {
    next(err);
  }
};

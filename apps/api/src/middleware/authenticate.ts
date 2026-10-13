import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

function extractToken(req: Parameters<RequestHandler>[0]): string | null {
  const cookie = req.cookies?.[env.accessCookie] as string | undefined;
  if (cookie) return cookie;
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Vérifie le jeton d'accès puis recharge l'utilisateur depuis la base :
 * une révocation (suspension, suppression) prend effet immédiatement.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Session expirée ou invalide');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, companyId: true, role: true, email: true, name: true, status: true },
    });

    if (!user) throw unauthorized('Session expirée ou invalide');
    if (user.status !== 'ACTIVE') throw forbidden('Compte désactivé');

    req.auth = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
      status: user.status,
    };
    req.tenantId = user.companyId;
    next();
  } catch (err) {
    next(err);
  }
};

/** Variante optionnelle : laisse passer les requêtes anonymes. */
export const optionalAuthenticate: RequestHandler = async (req, res, next) => {
  const hadCookie = Boolean(req.cookies?.[env.accessCookie]) || Boolean(req.header('authorization'));
  if (!hadCookie) return next();
  return authenticate(req, res, next);
};

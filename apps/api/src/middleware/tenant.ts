import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * Garde-fou multi-tenant.
 *
 * Règle absolue : le périmètre tenant vient du jeton authentifié,
 * jamais d'un champ `companyId` envoyé par le client.
 */
export const tenantScope: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  if (req.auth.role === 'SUPER_ADMIN') return next(); // le scope est porté par la route plateforme
  if (!req.auth.companyId) return forbidden('Compte sans entreprise associée');
  req.tenantId = req.auth.companyId;
  next();
};

/**
 * Construit un filtre Prisma strictement limité au tenant courant.
 * Le SUPER_ADMIN, dont le scope est la plateforme entière, n'est pas restreint.
 */
export function companyWhere(req: { auth?: { companyId: string | null; role: string } }): {
  companyId?: string;
} {
  if (req.auth?.role === 'SUPER_ADMIN') return {};
  if (!req.auth?.companyId) throw forbidden('Compte sans entreprise associée');
  return { companyId: req.auth.companyId };
}

/** Vérifie qu'une ressource appartient bien au tenant courant. */
export function assertCompanyOwnership(
  req: { auth?: { companyId: string | null; role: string } },
  resourceCompanyId: string | null | undefined,
): void {
  if (req.auth?.role === 'SUPER_ADMIN') return;
  if (!req.auth?.companyId) throw forbidden('Compte sans entreprise associée');
  if (resourceCompanyId !== req.auth.companyId) throw forbidden('Ressource hors de votre périmètre');
}

import type { RequestHandler } from 'express';
import type { Permission, Role } from '@logismart/shared';
import { can } from '@logismart/shared';
import { forbidden, unauthorized } from '../lib/errors.js';

function requireAuth(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

/** Contrôle d'accès par rôle (RBAC coarse). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const auth = requireAuth(req);
      if (!roles.includes(auth.role)) {
        throw forbidden(`Rôle insuffisant (requis : ${roles.join(' ou ')})`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Contrôle d'accès par permission (RBAC fin, matrice partagée). */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const auth = requireAuth(req);
      const missing = permissions.filter((p) => !can(auth.role, p));
      if (missing.length > 0) {
        throw forbidden(`Permission manquante : ${missing.join(', ')}`);
      }
      req.permissions = permissions;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Restreint une route aux actions plateforme (SUPER_ADMIN). */
export const requirePlatform = requireRole('SUPER_ADMIN');

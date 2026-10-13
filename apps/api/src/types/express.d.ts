import type { Permission, Role } from '@logismart/shared';

export interface AuthContext {
  userId: string;
  companyId: string | null;
  role: Role;
  email: string;
  name: string;
  status: string;
}

/** Session du portail client (client final) — indépendante de AuthContext. */
export interface PortalAuthContext {
  customerId: string;
  companyId: string;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
      /** Session portail client (`/api/portal/*`). */
      portalAuth?: PortalAuthContext;
      /** Périmètre tenant déduit du token — jamais du body. */
      tenantId?: string | null;
      /** Permissions effectivement accordées pour cette requête. */
      permissions?: readonly Permission[];
    }
  }
}

export {};

/** Rôles disponibles dans LogiSmart (multi-tenant, RBAC). */
export const ROLES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'DISPATCHER',
  'DRIVER',
  'RECRUITER',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Permissions granulaires appliquées au niveau route puis au niveau service. */
export const PERMISSIONS = [
  'platform:manage',
  'platform:stats',
  'company:read',
  'company:update',
  'user:read',
  'user:create',
  'user:update',
  'user:delete',
  'driver:read',
  'driver:create',
  'driver:update',
  'customer:read',
  'customer:create',
  'customer:update',
  'catalog:read',
  'catalog:create',
  'catalog:update',
  'catalog:delete',
  'order:read',
  'order:create',
  'order:update',
  'order:assign',
  'order:delete',
  'map:read',
  'location:write',
  'proof:create',
  'support:read',
  'support:respond',
  'support:manage',
  'knowledge:read',
  'knowledge:manage',
  'job:read',
  'job:manage',
  'candidate:read',
  'candidate:manage',
  'candidate:hire',
  'stats:read',
  'settings:read',
  'settings:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

/**
 * Matrice rôle → permissions.
 * Note : les permissions « lecture » sont ensuite restreintes par le service
 * au périmètre du tenant (companyId) et, pour DRIVER, à ses propres livraisons.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL,

  COMPANY_ADMIN: ALL.filter((p) => !p.startsWith('platform:')),

  DISPATCHER: [
    'company:read',
    'order:read',
    'order:create',
    'order:update',
    'order:assign',
    'customer:read',
    'customer:create',
    'customer:update',
    'catalog:read',
    'driver:read',
    'map:read',
    'support:read',
    'support:respond',
    'stats:read',
    'user:read',
  ],

  DRIVER: [
    'order:read',
    'location:write',
    'proof:create',
    'company:read',
  ],

  RECRUITER: [
    'company:read',
    'user:read',
    'job:read',
    'job:manage',
    'candidate:read',
    'candidate:manage',
    'candidate:hire',
    'stats:read',
    'settings:read',
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAll(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Rôles autorisés à accéder au dashboard privé. */
export const DASHBOARD_ROLES: readonly Role[] = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'DISPATCHER',
  'DRIVER',
  'RECRUITER',
];

/** Rôles autorisés sur les routes plateforme (SUPER_ADMIN uniquement). */
export const PLATFORM_ROLES: readonly Role[] = ['SUPER_ADMIN'];

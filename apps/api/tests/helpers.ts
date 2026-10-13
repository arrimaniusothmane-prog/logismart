import request from 'supertest';
import type { Express } from 'express';
import type { Role } from '@logismart/shared';
import { prisma } from '../src/lib/prisma.js';
import { createApp as createAppImpl } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { generateTrackingNumber, generateSecureToken } from '../src/lib/ids.js';

export { prisma };

/** Vide toutes les tables (FK en cascade) — données de test jamais partagées. */
export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: Role;
  companyId: string;
  token: string;
}

export interface TestCompany {
  id: string;
  slug: string;
  publicId: string;
  admin: TestUser;
}

const PASSWORD = 'Demo!Pass123';

async function createUser(params: {
  companyId: string | null;
  name: string;
  email: string;
  role: Role;
}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email,
      passwordHash: await hashPassword(PASSWORD),
      role: params.role,
      status: 'ACTIVE',
    },
  });
  return {
    id: user.id,
    email: user.email,
    password: PASSWORD,
    role: params.role,
    companyId: params.companyId ?? '',
    token: '',
  };
}

/** Crée une entreprise + ses comptes de test (données jetables). */
export async function seedCompany(prefix: string): Promise<TestCompany> {
  const company = await prisma.company.create({
    data: {
      name: `Entreprise ${prefix}`,
      slug: `entreprise-${prefix}`,
      publicId: `pub-${prefix}`,
    },
  });
  const admin = await createUser({
    companyId: company.id,
    name: `Admin ${prefix}`,
    email: `admin-${prefix}@test.local`,
    role: 'COMPANY_ADMIN',
  });
  return { id: company.id, slug: company.slug, publicId: company.publicId, admin };
}

export async function seedUser(
  companyId: string,
  role: Role,
  tag: string,
): Promise<TestUser> {
  return createUser({
    companyId,
    name: `${role} ${tag}`,
    email: `${role.toLowerCase()}-${tag}@test.local`,
    role,
  });
}

export async function seedSuperAdmin(): Promise<TestUser> {
  return createUser({ companyId: null, name: 'Super Admin', email: 'super@test.local', role: 'SUPER_ADMIN' });
}

/** Obtient un JWT d'accès pour un utilisateur de test. */
export async function tokenFor(user: { email: string; password: string }): Promise<string> {
  const res = await request(createMinimalApp()).post('/api/auth/login').send({
    email: user.email,
    password: user.password,
  });
  if (res.status !== 200) {
    throw new Error(`login de test échoué (${res.status}) : ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken as string;
}

let cachedApp: Express | null = null;

/** App légère réutilisée pour les appels helpers (évite de recharger le module). */
export function createMinimalApp(): Express {
  if (!cachedApp) cachedApp = createAppImpl();
  return cachedApp;
}

/** Agent supertest qui conserve les cookies (flux navigateur réel). */
export function cookieAgent(app: Express) {
  return request.agent(app);
}

export async function loginAgent(app: Express, email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login échoué (${res.status}) : ${JSON.stringify(res.body)}`);
  }
  return { agent, data: res.body.data as { accessToken: string; user: { id: string; role: Role; companyId: string | null } } };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Commande de test complète (statut donné). */
export async function seedOrder(params: {
  companyId: string;
  customerId?: string;
  driverId?: string | null;
  status?: 'PREPARED' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
}) {
  const customer =
    (params.customerId
      ? { id: params.customerId }
      : await prisma.customer.create({
          data: { companyId: params.companyId, name: 'Client test', address: '1 rue Test' },
        }));

  return prisma.order.create({
    data: {
      companyId: params.companyId,
      trackingNumber: generateTrackingNumber(),
      customerId: customer.id,
      driverId: params.driverId ?? null,
      pickupAddress: 'Entrepôt test',
      deliveryAddress: 'Adresse test',
      status: params.status ?? 'PREPARED',
    },
  });
}

export async function seedTrackingToken(orderId: string) {
  return prisma.trackingToken.create({
    data: { orderId, token: generateSecureToken(24), expiresAt: new Date(Date.now() + 86_400_000) },
  });
}

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import {
  resetDb,
  seedCompany,
  seedUser,
  seedSuperAdmin,
  seedOrder,
  prisma,
} from './helpers.js';

const app = createApp();

let companyA: Awaited<ReturnType<typeof seedCompany>>;
let companyB: Awaited<ReturnType<typeof seedCompany>>;
let superToken: string;
let tokenA: string;
let tokenB: string;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login échoué : ${res.status}`);
  return res.body.data.accessToken as string;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('aaa');
  companyB = await seedCompany('bbb');
  tokenA = await login(companyA.admin.email, companyA.admin.password);
  tokenB = await login(companyB.admin.email, companyB.admin.password);
  const superAdmin = await seedSuperAdmin();
  superToken = await login(superAdmin.email, superAdmin.password);
});

afterAll(async () => {
  await closePrisma();
});

describe('isolation des entreprises', () => {
  it('ne lit pas les informations d\'une autre entreprise', async () => {
    const res = await request(app).get(`/api/companies/${companyA.id}`).set(bearer(tokenB));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('périmètre');
  });

  it('limite la liste des utilisateurs à son propre tenant', async () => {
    await seedUser(companyA.id, 'DISPATCHER', 'only-a');
    await seedUser(companyB.id, 'DISPATCHER', 'only-b');

    const res = await request(app).get('/api/users?limit=100').set(bearer(tokenB));
    expect(res.status).toBe(200);

    const emails: string[] = res.body.data.items.map((u: { email: string }) => u.email);
    expect(emails).toContain('dispatcher-only-b@test.local');
    expect(emails).not.toContain('dispatcher-only-a@test.local');
    expect(emails).not.toContain(companyA.admin.email);
    for (const user of res.body.data.items) {
      expect(user.companyId).toBe(companyB.id);
    }
  });

  it('refuse l\'accès direct à un utilisateur d\'un autre tenant', async () => {
    const userA = await seedUser(companyA.id, 'DRIVER', 'cible');

    const read = await request(app).get(`/api/users/${userA.id}`).set(bearer(tokenB));
    expect(read.status).toBe(403);

    const update = await request(app)
      .patch(`/api/users/${userA.id}`)
      .set(bearer(tokenB))
      .send({ name: 'Pirate' });
    expect(update.status).toBe(403);

    const remove = await request(app).delete(`/api/users/${userA.id}`).set(bearer(tokenB));
    expect(remove.status).toBe(403);

    const untouched = await prisma.user.findUnique({ where: { id: userA.id } });
    expect(untouched?.name).toBe('DRIVER cible');
    expect(untouched?.status).toBe('ACTIVE');
  });

  it('limite les commandes à son tenant', async () => {
    const orderA = await seedOrder({ companyId: companyA.id });
    const orderB = await seedOrder({ companyId: companyB.id });

    const whereA = await prisma.order.findMany({ where: { companyId: companyA.id } });
    const whereB = await prisma.order.findMany({ where: { companyId: companyB.id } });

    expect(whereA.map((o) => o.id)).toEqual([orderA.id]);
    expect(whereB.map((o) => o.id)).toEqual([orderB.id]);
    expect(orderA.trackingNumber).not.toBe(orderB.trackingNumber);
  });

  it('ignore le companyId envoyé par le client (contexte = jeton)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(tokenB))
      .send({
        name: 'Injection Tenant',
        email: 'injection@tenant.test',
        password: 'Secret!12345',
        role: 'DISPATCHER',
        companyId: companyA.id, // tentative d'injection
      });

    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBe(companyB.id);

    const stored = await prisma.user.findUnique({ where: { email: 'injection@tenant.test' } });
    expect(stored?.companyId).toBe(companyB.id);
  });

  it('empêche un admin de gérer son propre compte comme SUPER_ADMIN via le rôle', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(tokenA))
      .send({
        name: 'Escalade',
        email: 'escalade@tenant.test',
        password: 'Secret!12345',
        role: 'SUPER_ADMIN',
      });
    expect(res.status).toBe(403);
  });
});

describe('accès plateforme (SUPER_ADMIN)', () => {
  it('voit les deux entreprises', async () => {
    const res = await request(app).get('/api/companies?limit=100').set(bearer(superToken));
    expect(res.status).toBe(200);
    const slugs = res.body.data.items.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain(companyA.slug);
    expect(slugs).toContain(companyB.slug);
  });

  it('peut filtrer les utilisateurs par entreprise', async () => {
    const res = await request(app)
      .get(`/api/users?companyId=${companyA.id}&limit=100`)
      .set(bearer(superToken));
    expect(res.status).toBe(200);
    for (const user of res.body.data.items) {
      expect(user.companyId).toBe(companyA.id);
    }
  });

  it('peut lire n\'importe quelle entreprise', async () => {
    const res = await request(app).get(`/api/companies/${companyB.id}`).set(bearer(superToken));
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(companyB.slug);
  });

  it('liste les clients, commandes et livreurs de toutes les entreprises', async () => {
    const orderA = await seedOrder({ companyId: companyA.id });
    const orderB = await seedOrder({ companyId: companyB.id });

    const driverA = await seedUser(companyA.id, 'DRIVER', 'drv-a');
    const driverB = await seedUser(companyB.id, 'DRIVER', 'drv-b');
    for (const d of [driverA, driverB]) {
      await prisma.driverProfile.create({
        data: {
          userId: d.id,
          companyId: d.companyId,
          phone: '0600000000',
          vehicleType: 'CAR',
        },
      });
    }

    const customers = await request(app).get('/api/customers?limit=100').set(bearer(superToken));
    expect(customers.status).toBe(200);
    expect(customers.body.data.items.map((c: { id: string }) => c.id)).toEqual(
      expect.arrayContaining([orderA.customerId!, orderB.customerId!]),
    );

    const orders = await request(app).get('/api/orders?limit=100').set(bearer(superToken));
    expect(orders.status).toBe(200);
    expect(orders.body.data.items.map((o: { id: string }) => o.id)).toEqual(
      expect.arrayContaining([orderA.id, orderB.id]),
    );

    const drivers = await request(app).get('/api/drivers?limit=100').set(bearer(superToken));
    expect(drivers.status).toBe(200);
    expect(drivers.body.data.items.map((d: { userId: string }) => d.userId)).toEqual(
      expect.arrayContaining([driverA.id, driverB.id]),
    );
  });

  it('lit une ressource d\'une autre entreprise', async () => {
    const order = await seedOrder({ companyId: companyB.id });
    const customerId = order.customerId!;

    const readCustomer = await request(app).get(`/api/customers/${customerId}`).set(bearer(superToken));
    expect(readCustomer.status).toBe(200);
    expect(readCustomer.body.data.id).toBe(customerId);

    const readOrder = await request(app).get(`/api/orders/${order.id}`).set(bearer(superToken));
    expect(readOrder.status).toBe(200);
    expect(readOrder.body.data.id).toBe(order.id);
  });
});

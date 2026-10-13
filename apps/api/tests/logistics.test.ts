import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Role } from '@logismart/shared';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import {
  prisma,
  resetDb,
  seedCompany,
  seedOrder,
  seedSuperAdmin,
  seedTrackingToken,
  seedUser,
  authHeader,
  type TestCompany,
  type TestUser,
} from './helpers.js';

const app = createApp();

let companyA: TestCompany;
let companyB: TestCompany;
let dispatchA: TestUser;
let dispatchB: TestUser;
let adminA: TestUser;
let driverA: { user: TestUser; profileId: string };
let driverB: { user: TestUser; profileId: string };

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login échoué : ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken as string;
}

async function seedDriver(companyId: string, tag: string) {
  const user = await seedUser(companyId, 'DRIVER', tag);
  const profile = await prisma.driverProfile.create({
    data: { userId: user.id, companyId, phone: `+33 6 99 ${tag}`, vehicleType: 'MOTORCYCLE', availability: 'ONLINE' },
  });
  return { user, profileId: profile.id };
}

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('logi');
  companyB = await seedCompany('logiB');
  dispatchA = await seedUser(companyA.id, 'DISPATCHER', 'dispatch-a');
  dispatchB = await seedUser(companyB.id, 'DISPATCHER', 'dispatch-b');
  adminA = companyA.admin;
  driverA = await seedDriver(companyA.id, 'a1');
  driverB = await seedDriver(companyA.id, 'a2');
  await seedSuperAdmin();

  dispatchA.token = await login(dispatchA.email, dispatchA.password);
  dispatchB.token = await login(dispatchB.email, dispatchB.password);
  adminA.token = await login(adminA.email, adminA.password);
  driverA.user.token = await login(driverA.user.email, driverA.user.password);
  driverB.user.token = await login(driverB.user.email, driverB.user.password);
});

afterAll(async () => {
  await closePrisma();
});

describe('clients (customers)', () => {
  it('protection : exige une authentification', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  it('RBAC : création réservée aux rôles disposant de customer:create', async () => {
    const payload = { name: 'Client Dispatcher', email: 'c-dispatch@test.local', phone: '+33 6 00 00 00 00' };
    const ok = await request(app).post('/api/customers').set(authHeader(dispatchA.token)).send(payload);
    expect(ok.status).toBe(201);
    expect(ok.body.data.companyId).toBe(companyA.id);

    const forbidden = await request(app).post('/api/customers').set(authHeader(driverA.user.token)).send(payload);
    expect(forbidden.status).toBe(403);
  });

  it('création puis lecture, mise à jour', async () => {
    const created = await request(app).post('/api/customers').set(authHeader(dispatchA.token)).send({ name: 'Paul Dupont' });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const got = await request(app).get(`/api/customers/${id}`).set(authHeader(dispatchA.token));
    expect(got.status).toBe(200);
    expect(got.body.data.name).toBe('Paul Dupont');

    const updated = await request(app).patch(`/api/customers/${id}`).set(authHeader(dispatchA.token)).send({ phone: '+33 6 11 22 33 44' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.phone).toBe('+33 6 11 22 33 44');
  });

  it('e-mail en double → conflit (même entreprise)', async () => {
    await prisma.customer.create({ data: { companyId: companyA.id, name: 'Premier', email: 'dup@test.local' } });
    const res = await request(app).post('/api/customers').set(authHeader(dispatchA.token)).send({ name: 'Second', email: 'dup@test.local' });
    expect(res.status).toBe(409);
  });

  it('isolation multi-tenant : B ne voit pas les clients de A', async () => {
    const created = await request(app).post('/api/customers').set(authHeader(dispatchA.token)).send({ name: 'Client A' });
    const id = created.body.data.id as string;

    const listB = await request(app).get('/api/customers').set(authHeader(dispatchB.token));
    expect(listB.status).toBe(200);
    expect(listB.body.data.items).toHaveLength(0);

    const getB = await request(app).get(`/api/customers/${id}`).set(authHeader(dispatchB.token));
    expect(getB.status).toBe(403);
  });
});

describe('livreurs (drivers)', () => {
  it('protection : exige une authentification', async () => {
    const res = await request(app).get('/api/drivers');
    expect(res.status).toBe(401);
  });

  it('liste : dispatcher et admin OK, recruteur/livreur refusés', async () => {
    const ok = await request(app).get('/api/drivers').set(authHeader(dispatchA.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.items.length).toBe(2);

    const recruit = await seedUser(companyA.id, 'RECRUITER', 'rec');
    const recruitToken = await login(recruit.email, recruit.password);
    const no = await request(app).get('/api/drivers').set(authHeader(recruitToken));
    expect(no.status).toBe(403);

    const driverView = await request(app).get('/api/drivers').set(authHeader(driverA.user.token));
    expect(driverView.status).toBe(403);
  });

  it('isolation : B ne voit pas les livreurs de A', async () => {
    const res = await request(app).get('/api/drivers').set(authHeader(dispatchB.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('un livreur met à jour sa propre disponibilité', async () => {
    const res = await request(app)
      .patch('/api/drivers/me/availability')
      .set(authHeader(driverA.user.token))
      .send({ availability: 'BUSY' });
    expect(res.status).toBe(200);
    expect(res.body.data.availability).toBe('BUSY');
    expect(res.body.data.userId).toBe(driverA.user.id);
  });
});

describe('commandes (orders)', () => {
  it('protection : exige une authentification', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('création avec client existant : PREPARED, numéro de suivi, journal, jeton', async () => {
    const customer = await prisma.customer.create({ data: { companyId: companyA.id, name: 'Client' } });
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(dispatchA.token))
      .send({ customerId: customer.id, pickupAddress: 'Entrepôt A', deliveryAddress: 'Chez client' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PREPARED');
    expect(res.body.data.trackingNumber).toMatch(/^LS-/);
    expect(res.body.data.customerId).toBe(customer.id);

    const history = await prisma.orderStatusHistory.count({ where: { orderId: res.body.data.id } });
    const token = await prisma.trackingToken.count({ where: { orderId: res.body.data.id } });
    expect(history).toBe(1);
    expect(token).toBe(1);
  });

  it('création avec client à la volée : client auto-créé', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(dispatchA.token))
      .send({ customer: { name: 'Client Volée', email: 'volee@test.local' }, pickupAddress: 'Entrepôt', deliveryAddress: 'Adresse' });
    expect(res.status).toBe(201);
    expect(res.body.data.customer.name).toBe('Client Volée');
  });

  it('création exige le client (existant ou nouveau)', async () => {
    const res = await request(app).post('/api/orders').set(authHeader(dispatchA.token)).send({ pickupAddress: 'X', deliveryAddress: 'Y' });
    expect(res.status).toBe(400);
  });

  it('créer avec un livreur : statut ASSIGNED immédiat', async () => {
    const customer = await prisma.customer.create({ data: { companyId: companyA.id, name: 'Client' } });
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(dispatchA.token))
      .send({ customerId: customer.id, driverId: driverA.profileId, pickupAddress: 'Entrepôt', deliveryAddress: 'Adresse client' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ASSIGNED');
    expect(res.body.data.driverId).toBe(driverA.profileId);
  });

  it('RBAC : DRIVER ne peut pas créer une commande', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(authHeader(driverA.user.token))
      .send({ customer: { name: 'X' }, pickupAddress: 'E', deliveryAddress: 'D' });
    expect(res.status).toBe(403);
  });

  it('affectation / désaffectation d\'un livreur', async () => {
    const customer = await prisma.customer.create({ data: { companyId: companyA.id, name: 'Client' } });
    const created = await request(app)
      .post('/api/orders')
      .set(authHeader(dispatchA.token))
      .send({ customerId: customer.id, pickupAddress: 'Entrepôt test', deliveryAddress: 'Adresse test' });
    expect(created.status).toBe(201);
    const orderId = created.body.data.id as string;

    const assign = await request(app)
      .patch(`/api/orders/${orderId}/assign`)
      .set(authHeader(dispatchA.token))
      .send({ driverId: driverA.profileId });
    expect(assign.status).toBe(200);
    expect(assign.body.data.status).toBe('ASSIGNED');
    expect(assign.body.data.driverId).toBe(driverA.profileId);

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => h.status)).toEqual(['PREPARED', 'ASSIGNED']);

    const unassign = await request(app)
      .patch(`/api/orders/${orderId}/assign`)
      .set(authHeader(dispatchA.token))
      .send({ driverId: null });
    expect(unassign.status).toBe(200);
    expect(unassign.body.data.status).toBe('PREPARED');
    expect(unassign.body.data.driverId).toBeNull();
  });

  it('affectation impossible avec un livreur d\'une autre entreprise', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const res = await request(app)
      .patch(`/api/orders/${order.id}/assign`)
      .set(authHeader(dispatchA.token))
      .send({ driverId: driverA.profileId });
    expect(res.status).toBe(200);

    const badDriver = await prisma.driverProfile.create({
      data: { userId: (await seedUser(companyB.id, 'DRIVER', 'b-driver')).id, companyId: companyB.id, phone: '+33', vehicleType: 'CAR' },
    });
    const res2 = await request(app)
      .patch(`/api/orders/${order.id}/assign`)
      .set(authHeader(dispatchA.token))
      .send({ driverId: badDriver.id });
    expect(res2.status).toBe(400);
  });

  it('transitions complètes gérées par un dispatcher', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const path = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] as const;

    for (const [i, next] of path.entries()) {
      if (next === 'ASSIGNED') {
        const res = await request(app)
          .patch(`/api/orders/${order.id}/assign`)
          .set(authHeader(dispatchA.token))
          .send({ driverId: driverA.profileId });
        expect(res.status).toBe(200);
        continue;
      }
      const res = await request(app)
        .patch(`/api/orders/${order.id}/status`)
        .set(authHeader(dispatchA.token))
        .send({ status: next });
      expect(res.status, `transition ${i + 1} → ${next}`).toBe(200);
    }

    const final = await prisma.order.findUnique({ where: { id: order.id } });
    expect(final?.status).toBe('DELIVERED');
    expect(final?.deliveredAt).toBeInstanceOf(Date);
  });

  it('transition invalide (saut direct) → conflit', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const res = await request(app).patch(`/api/orders/${order.id}/status`).set(authHeader(dispatchA.token)).send({ status: 'DELIVERED' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('un livreur fait avancer ses propres livraisons uniquement (manutention)', async () => {
    const order = await prisma.order.update({
      where: { id: (await seedOrder({ companyId: companyA.id, status: 'PREPARED' })).id },
      data: { status: 'ASSIGNED', driverId: driverA.profileId },
    });

    const own = await request(app).patch(`/api/orders/${order.id}/status`).set(authHeader(driverA.user.token)).send({ status: 'PICKED_UP' });
    expect(own.status).toBe(200);

    const noJump = await request(app).patch(`/api/orders/${order.id}/status`).set(authHeader(driverA.user.token)).send({ status: 'DELIVERED' });
    expect(noJump.status).toBe(409);

    const transit = await request(app).patch(`/api/orders/${order.id}/status`).set(authHeader(driverA.user.token)).send({ status: 'IN_TRANSIT' });
    expect(transit.status).toBe(200);

    const delivered = await request(app).patch(`/api/orders/${order.id}/status`).set(authHeader(driverA.user.token)).send({ status: 'DELIVERED' });
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.deliveredAt).not.toBeNull();
  });

  it('un livreur ne peut pas toucher la commande d\'un autre livreur', async () => {
    const order = await prisma.order.update({
      where: { id: (await seedOrder({ companyId: companyA.id, status: 'PREPARED' })).id },
      data: { status: 'ASSIGNED', driverId: driverA.profileId },
    });
    const res = await request(app).patch(`/api/orders/${order.id}/status`).set(authHeader(driverB.user.token)).send({ status: 'PICKED_UP' });
    expect(res.status).toBe(403);
  });

  it('un livreur ne voit que ses propres commandes', async () => {
    await prisma.order.update({
      where: { id: (await seedOrder({ companyId: companyA.id })).id },
      data: { status: 'ASSIGNED', driverId: driverA.profileId },
    });
    await prisma.order.update({
      where: { id: (await seedOrder({ companyId: companyA.id })).id },
      data: { status: 'ASSIGNED', driverId: driverB.profileId },
    });

    const mine = await request(app).get('/api/orders').set(authHeader(driverA.user.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items).toHaveLength(1);
    expect(mine.body.data.items[0].driverId).toBe(driverA.profileId);

    const all = await request(app).get('/api/orders').set(authHeader(dispatchA.token));
    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(2);

    const other = await seedOrder({ companyId: companyA.id, driverId: driverB.profileId, status: 'ASSIGNED' });
    const forbidden = await request(app).get(`/api/orders/${other.id}`).set(authHeader(driverA.user.token));
    expect(forbidden.status).toBe(403);
  });

  it('modification d\'une commande réservée avant prise en charge', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const res = await request(app)
      .patch(`/api/orders/${order.id}`)
      .set(authHeader(dispatchA.token))
      .send({ note: 'Urgent' });
    expect(res.status).toBe(200);
    expect(res.body.data.note).toBe('Urgent');

    await request(app).patch(`/api/orders/${order.id}/assign`).set(authHeader(dispatchA.token)).send({ driverId: driverA.profileId });

    const tooLate = await request(app).patch(`/api/orders/${order.id}`).set(authHeader(dispatchA.token)).send({ note: 'Trop tard' });
    expect(tooLate.status).toBe(409);
  });

  it('suppression réservée aux commandes jamais prises en charge', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const del = await request(app).delete(`/api/orders/${order.id}`).set(authHeader(adminA.token));
    expect(del.status).toBe(200);
    expect(await prisma.order.findUnique({ where: { id: order.id } })).toBeNull();

    const taken = await prisma.order.update({
      where: { id: (await seedOrder({ companyId: companyA.id })).id },
      data: { status: 'ASSIGNED', driverId: driverA.profileId },
    });
    const denied = await request(app).delete(`/api/orders/${taken.id}`).set(authHeader(adminA.token));
    expect(denied.status).toBe(409);
  });

  it('isolation multi-tenant : B ne voit ni ne modifie les commandes de A', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });

    const list = await request(app).get('/api/orders').set(authHeader(dispatchB.token));
    expect(list.body.data.items).toHaveLength(0);

    const get = await request(app).get(`/api/orders/${order.id}`).set(authHeader(dispatchB.token));
    expect(get.status).toBe(403);

    const assign = await request(app)
      .patch(`/api/orders/${order.id}/assign`)
      .set(authHeader(dispatchB.token))
      .send({ driverId: null });
    expect(assign.status).toBe(403);
  });

  it('isolation : un livreur B ne voit pas les commandes de A', async () => {
    const order = await seedOrder({ companyId: companyA.id, driverId: driverA.profileId, status: 'IN_TRANSIT' });
    const res = await request(app).get(`/api/orders/${order.id}`).set(authHeader(dispatchB.token));
    expect(res.status).toBe(403);
  });
});

describe('suivi public (tracking)', () => {
  async function publicTrack(token: string) {
    return request(app).get(`/api/public/track/${encodeURIComponent(token)}`);
  }

  it('renvoie le parcours public pour un jeton valide', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'IN_TRANSIT', driverId: driverA.profileId });
    const { token } = await seedTrackingToken(order.id);

    const res = await publicTrack(token);
    expect(res.status).toBe(200);
    expect(res.body.data.trackingNumber).toBe(order.trackingNumber);
    expect(res.body.data.status).toBe('IN_TRANSIT');
    expect(res.body.data.timeline).toBeInstanceOf(Array);
    expect(res.body.data.driver.name).toBe((await prisma.user.findUnique({ where: { id: driverA.user.id } }))?.name);
    expect(res.body.data).not.toHaveProperty('token');
    expect(res.body.data).not.toHaveProperty('companyId');
    expect(JSON.stringify(res.body.data)).not.toContain(token);
  });

  it('jeton inconnu ou invalide → 404', async () => {
    const res = await publicTrack('invalide-token-inconnu-123456789');
    expect(res.status).toBe(404);
  });

  it('jeton révoqué (annulation de livraison) → 404', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'ASSIGNED', driverId: driverA.profileId });
    const { token } = await seedTrackingToken(order.id);

    const cancelled = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set(authHeader(dispatchA.token))
      .send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);

    const res = await publicTrack(token);
    expect(res.status).toBe(404);
  });

  it('jeton expiré → 404', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const t = await prisma.trackingToken.create({
      data: { orderId: order.id, token: 'expired-token-123456789012345678901234', expiresAt: new Date(Date.now() - 60_000) },
    });
    const res = await publicTrack(t.token);
    expect(res.status).toBe(404);
  });

  it('poster une tâche de gestion sur le suivi public est refusé (route GET uniquement)', async () => {
    const order = await seedOrder({ companyId: companyA.id, status: 'PREPARED' });
    const { token } = await seedTrackingToken(order.id);
    const res = await request(app).post(`/api/public/track/${token}`);
    expect(res.status).toBe(404);
  });
});

describe('RBAC global logistique', () => {
  async function roleToken(role: Role, companyId: string, tag: string) {
    const u = await seedUser(companyId, role, tag);
    return login(u.email, u.password);
  }

  it('RECRUITER n\'accède pas aux routes logistiques', async () => {
    const token = await roleToken('RECRUITER', companyA.id, 'misc');
    for (const [verb, path] of [['get', '/api/orders'], ['get', '/api/drivers'], ['get', '/api/customers']] as const) {
      const res = await request(app)[verb](path).set(authHeader(token));
      expect(res.status).toBe(403);
    }
  });
});
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, seedOrder, tokenFor, prisma, type TestCompany } from './helpers.js';

const app = createApp();

let companyA: TestCompany;
let companyB: TestCompany;
let customerA: { id: string; email: string };
let customerB: { id: string; email: string };
let orderA: { id: string; trackingNumber: string };
let orderB: { id: string; trackingNumber: string };

function cookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]!);
}

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('portal-a');
  companyB = await seedCompany('portal-b');

  customerA = await prisma.customer.create({
    data: { companyId: companyA.id, name: 'Camille Martin', email: 'camille@portal.test', address: '10 av. des Champs' },
  });
  customerB = await prisma.customer.create({
    data: { companyId: companyB.id, name: 'Autre Client', email: 'autre@portal.test', address: '1 rue Ailleurs' },
  });

  orderA = await seedOrder({ companyId: companyA.id, customerId: customerA.id, status: 'IN_TRANSIT' });
  orderB = await seedOrder({ companyId: companyB.id, customerId: customerB.id, status: 'PREPARED' });

  // Historique de statut : source des notifications du portail.
  await prisma.orderStatusHistory.createMany({
    data: [
      { orderId: orderA.id, status: 'PREPARED', note: 'Commande créée' },
      { orderId: orderA.id, status: 'IN_TRANSIT', note: 'En route' },
    ],
  });
});

afterAll(async () => {
  await closePrisma();
});

describe('POST /api/portal/register (revendication par numéro de suivi)', () => {
  it('404 si le numéro de suivi est inconnu', async () => {
    const res = await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: 'LS-AAAA-BBBB-CC', email: 'camille@portal.test', password: 'Demo!Pass123' });
    expect(res.status).toBe(404);
  });

  it("403 si l'e-mail ne correspond pas à la commande", async () => {
    const res = await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'intrus@portal.test', password: 'Demo!Pass123' });
    expect(res.status).toBe(403);
  });

  it('active le compte, pose les cookies portail et refuse une seconde activation', async () => {
    const res = await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' });
    expect(res.status).toBe(200);

    const setCookies = cookies(res);
    expect(setCookies.join(' ')).toContain('ls_pt=');
    expect(setCookies.join(' ')).toContain('ls_pr=');

    const again = await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' });
    expect(again.status).toBe(409);
  });

  it('refuse le mot de passe trop court (validation)', async () => {
    const res = await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'court' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/portal/login + session', () => {
  it('401 pour un compte non activé ou un mauvais mot de passe', async () => {
    const notActivated = await request(app)
      .post('/api/portal/login')
      .send({ email: 'camille@portal.test', password: 'Demo!Pass123' });
    expect(notActivated.status).toBe(401);

    await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const bad = await request(app).post('/api/portal/login').send({ email: 'camille@portal.test', password: 'WrongPass1' });
    expect(bad.status).toBe(401);
  });

  it('connecte avec les bons identifiants et renvoie le profil', async () => {
    await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const res = await request(app)
      .post('/api/portal/login')
      .send({ email: 'camille@portal.test', password: 'Demo!Pass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('camille@portal.test');
    expect(cookies(res).join(' ')).toContain('ls_pt=');
  });
});

describe('GET /api/portal/me', () => {
  it('401 sans session portail', async () => {
    const res = await request(app).get('/api/portal/me');
    expect(res.status).toBe(401);
  });

  it('retourne le profil, le total de commandes et la commande active', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const res = await agent.get('/api/portal/me');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Camille Martin');
    expect(res.body.data.totalOrders).toBe(1);
    expect(res.body.data.activeOrder.trackingNumber).toBe(orderA.trackingNumber);
    expect(res.body.data.companyId).toBe(companyA.id);
  });
});

describe('Isolation du portail client', () => {
  it("ne liste que ses propres commandes et renvoie 404 sur une commande d'un autre tenant", async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const list = await agent.get('/api/portal/orders');
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0].id).toBe(orderA.id);

    // Commande d'une autre entreprise : 404 (pas de fuite d'existence).
    const cross = await agent.get(`/api/portal/orders/${orderB.id}`);
    expect(cross.status).toBe(404);

    // Même chose pour la commande d'un autre client de la même entreprise.
    const otherCustomer = await prisma.customer.create({
      data: { companyId: companyA.id, name: 'Autre client A', email: 'autre-a@portal.test' },
    });
    const otherCustomerOrder = await seedOrder({ companyId: companyA.id, customerId: otherCustomer.id });
    const foreign = await agent.get(`/api/portal/orders/${otherCustomerOrder.id}`);
    expect(foreign.status).toBe(404);
  });

  it("n'accède pas au profil d'un autre client", async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    await agent.patch('/api/portal/profile').send({ name: 'Camille Modifiée' }).expect(200);
    const me = await agent.get('/api/portal/me');
    expect(me.body.data.name).toBe('Camille Modifiée');
    expect(me.body.data.id).toBe(customerA.id);
  });
});

describe('POST /api/portal/refresh', () => {
  it('401 sans cookie de rafraîchissement', async () => {
    const res = await request(app).post('/api/portal/refresh');
    expect(res.status).toBe(401);
  });

  it('renouvelle la session avec le cookie ls_pr uniquement', async () => {
    const login = await request(app)
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' });
    const refreshCookie = cookies(login).find((c) => c.startsWith('ls_pr='));
    expect(refreshCookie).toBeTruthy();

    const res = await request(app).post('/api/portal/refresh').set('Cookie', refreshCookie!);
    expect(res.status).toBe(200);
    expect(cookies(res).join(' ')).toContain('ls_pt=');
  });
});

describe('GET /api/portal/notifications', () => {
  it('liste les événements de ses propres commandes', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const res = await agent.get('/api/portal/notifications');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('label');
    expect(res.body.data[0].trackingNumber).toBe(orderA.trackingNumber);
  });
});

describe('POST /api/portal/chat', () => {
  it('répond avec le statut réel de la commande active', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const res = await agent.post('/api/portal/chat').send({ message: 'Où est mon colis ?' });
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toContain(orderA.trackingNumber);
    expect(res.body.data.orderId).toBe(orderA.id);

    // La conversation est persistée côté support.
    const sessions = await prisma.chatSession.findMany({ where: { companyId: companyA.id } });
    expect(sessions).toHaveLength(1);
    const messages = await prisma.chatMessage.count({ where: { sessionId: sessions[0]!.id } });
    expect(messages).toBe(2);
  });

  it('400 si le message est vide', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const res = await agent.post('/api/portal/chat').send({ message: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/portal/logout', () => {
  it('invalide la session portail', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);
    await agent.get('/api/portal/me').expect(200);

    await agent.post('/api/portal/logout').expect(200);

    // Cookies effacés : l'agent n'est plus authentifié.
    const res = await agent.get('/api/portal/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/portal/password', () => {
  async function activate(): Promise<request.SuperAgentTest> {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);
    return agent;
  }

  it('401 si le mot de passe actuel est incorrect', async () => {
    const agent = await activate();
    const res = await agent
      .post('/api/portal/password')
      .send({ currentPassword: 'WrongPass1', password: 'NouveauPass1' });
    expect(res.status).toBe(401);
  });

  it('change le mot de passe : l’ancien refuse, le nouveau connecte', async () => {
    const agent = await activate();
    await agent
      .post('/api/portal/password')
      .send({ currentPassword: 'Demo!Pass123', password: 'NouveauPass1' })
      .expect(200);

    const oldLogin = await request(app)
      .post('/api/portal/login')
      .send({ email: 'camille@portal.test', password: 'Demo!Pass123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/portal/login')
      .send({ email: 'camille@portal.test', password: 'NouveauPass1' });
    expect(newLogin.status).toBe(200);
  });

  it('400 si le nouveau mot de passe est trop court', async () => {
    const agent = await activate();
    const res = await agent
      .post('/api/portal/password')
      .send({ currentPassword: 'Demo!Pass123', password: 'court' });
    expect(res.status).toBe(400);
  });
});

describe('Notifications : état lu / non lu', () => {
  it('compte les non lues, les marque comme lues puis remet le badge à zéro', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);

    const me = await agent.get('/api/portal/me');
    expect(me.body.data.notificationsUnread).toBe(2);

    const list = await agent.get('/api/portal/notifications');
    expect(list.body.data.every((n: { read: boolean }) => n.read === false)).toBe(true);

    await agent.post('/api/portal/notifications/read').expect(200);

    const after = await agent.get('/api/portal/notifications');
    expect(after.body.data.every((n: { read: boolean }) => n.read === true)).toBe(true);

    const meAfter = await agent.get('/api/portal/me');
    expect(meAfter.body.data.notificationsUnread).toBe(0);
  });

  it('401 sans session', async () => {
    const res = await request(app).post('/api/portal/notifications/read');
    expect(res.status).toBe(401);
  });
});

describe('Support du portail client', () => {
  async function activate(): Promise<request.SuperAgentTest> {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);
    return agent;
  }

  it('crée une demande, échange avec le support et visible côté entreprise', async () => {
    const agent = await activate();

    const created = await agent.post('/api/portal/support').send({
      reason: 'Retard de livraison',
      message: 'Ma livraison n’est toujours pas arrivée.',
      trackingNumber: orderA.trackingNumber,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('OPEN');
    expect(created.body.data.trackingNumber).toBe(orderA.trackingNumber);
    const ticketId = created.body.data.id as string;

    const list = await agent.get('/api/portal/support');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].reason).toBe('Retard de livraison');
    expect(list.body.data[0].messageCount).toBe(1);

    // Réponse du client dans la conversation.
    await agent
      .post(`/api/portal/support/${ticketId}/messages`)
      .send({ content: 'Merci de me tenir informé.' })
      .expect(201);

    const detail = await agent.get(`/api/portal/support/${ticketId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.messages).toHaveLength(2);
    expect(detail.body.data.messages[0].role).toBe('user');

    // Côté entreprise : la demande apparaît avec le nom du client.
    const companyToken = await tokenFor(companyA.admin);
    const companyList = await request(app)
      .get('/api/support/escalations')
      .set('Authorization', `Bearer ${companyToken}`);
    expect(companyList.status).toBe(200);
    expect(companyList.body.data.total).toBe(1);
    expect(companyList.body.data.items[0].reason).toBe('Retard de livraison');
    expect(companyList.body.data.items[0].session.customerName).toBe('Camille Martin');

    // Réponse de l'agent → la demande passe « en cours ».
    await request(app)
      .post(`/api/support/escalations/${ticketId}/reply`)
      .set('Authorization', `Bearer ${companyToken}`)
      .send({ content: 'Nous vérifions avec le livreur.' })
      .expect(201);

    const afterReply = await agent.get(`/api/portal/support/${ticketId}`);
    expect(afterReply.body.data.status).toBe('IN_PROGRESS');
    expect(afterReply.body.data.messages).toHaveLength(3);
    expect(afterReply.body.data.messages[2].role).toBe('assistant');
  });

  it("404 pour une demande d'un autre client ou d'un autre tenant", async () => {
    const agentA = await activate();
    const created = await agentA
      .post('/api/portal/support')
      .send({ reason: 'Question', message: 'Bonjour' })
      .expect(201);
    const ticketId = created.body.data.id as string;

    // Un autre client (même entreprise) : 404.
    const otherCustomer = await prisma.customer.create({
      data: { companyId: companyA.id, name: 'Autre client A', email: 'autre-a@portal.test' },
    });
    await seedOrder({ companyId: companyA.id, customerId: otherCustomer.id });
    const agentOther = request.agent(app);
    await agentOther
      .post('/api/portal/register')
      .send({
        trackingNumber: (await prisma.order.findFirst({ where: { customerId: otherCustomer.id } }))!.trackingNumber,
        email: 'autre-a@portal.test',
        password: 'Demo!Pass123',
      })
      .expect(200);
    expect((await agentOther.get(`/api/portal/support/${ticketId}`)).status).toBe(404);
    expect(
      (await agentOther.post(`/api/portal/support/${ticketId}/messages`).send({ content: 'Intrusion' })).status,
    ).toBe(404);

    // Un client d'une autre entreprise : 404.
    const agentB = request.agent(app);
    await agentB
      .post('/api/portal/register')
      .send({ trackingNumber: orderB.trackingNumber, email: 'autre@portal.test', password: 'Demo!Pass123' })
      .expect(200);
    expect((await agentB.get(`/api/portal/support/${ticketId}`)).status).toBe(404);
  });

  it('404 si le numéro de suivi fourni ne appartient pas au client', async () => {
    const agent = await activate();
    const res = await agent.post('/api/portal/support').send({
      reason: 'Mauvais numéro',
      message: 'Je me suis trompé.',
      trackingNumber: orderB.trackingNumber,
    });
    expect(res.status).toBe(404);
  });

  it('401 sans session', async () => {
    const res = await request(app).get('/api/portal/support');
    expect(res.status).toBe(401);
  });
});

describe('Cycle de vie commandes client, stats et catalogue', () => {
  async function activateAgent(): Promise<request.SuperAgentTest> {
    const agent = request.agent(app);
    await agent
      .post('/api/portal/register')
      .send({ trackingNumber: orderA.trackingNumber, email: 'camille@portal.test', password: 'Demo!Pass123' })
      .expect(200);
    return agent;
  }

  it('permet au client de créer une commande avec destinataire, service et COD, visible par l’admin', async () => {
    const agent = await activateAgent();

    // Créer un service dans le catalogue de companyA
    const service = await prisma.catalogItem.create({
      data: {
        companyId: companyA.id,
        name: 'Livraison Express J+1',
        description: 'Livraison le lendemain avant 13h',
        type: 'SERVICE',
        price: 12.9,
        status: 'ACTIVE',
      },
    });

    const res = await agent.post('/api/portal/orders').send({
      pickupAddress: '15 Boulevard Saint-Michel, 75005 Paris',
      deliveryAddress: '24 Rue de Rivoli',
      recipientName: 'Jean Dupont',
      recipientPhone: '+33 6 11 22 33 44',
      recipientCity: '75004 Paris',
      deliveryInstructions: 'Code 4589, sonner à Dupont',
      description: 'Pièces détachées informatiques',
      quantity: 2,
      codAmount: 85.5,
      serviceId: service.id,
      note: 'Colis fragile',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PREPARED');
    expect(res.body.data.customerId).toBe(customerA.id);
    expect(res.body.data.companyId).toBe(companyA.id);
    expect(res.body.data.note).toContain('Jean Dupont');
    expect(res.body.data.note).toContain('Livraison Express J+1');
    expect(res.body.data.note).toContain('85.50 €');
    const newOrderId = res.body.data.id as string;

    // Vérifier la présence dans l'admin de l'entreprise
    const adminToken = await tokenFor(companyA.admin);
    const adminOrderRes = await request(app)
      .get(`/api/orders/${newOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminOrderRes.status).toBe(200);
    expect(adminOrderRes.body.data.trackingNumber).toBe(res.body.data.trackingNumber);
  });

  it('permet au client d’annuler une commande PREPARED mais refuse si IN_TRANSIT', async () => {
    const agent = await activateAgent();

    // 1. Commande PREPARED : annulable
    const createRes = await agent.post('/api/portal/orders').send({
      pickupAddress: 'Départ Paris',
      deliveryAddress: 'Arrivée Lyon',
    });
    const orderId = createRes.body.data.id as string;

    const cancelRes = await agent.patch(`/api/portal/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // 2. Commande IN_TRANSIT (orderA) : refusé (409)
    const cancelInTransit = await agent.patch(`/api/portal/orders/${orderA.id}/cancel`);
    expect(cancelInTransit.status).toBe(409);
  });

  it('fournit les statistiques complètes de l’espace client', async () => {
    const agent = await activateAgent();

    const statsRes = await agent.get('/api/portal/stats');
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data).toHaveProperty('total');
    expect(statsRes.body.data).toHaveProperty('preparing');
    expect(statsRes.body.data).toHaveProperty('inTransit');
    expect(statsRes.body.data).toHaveProperty('delivered');
    expect(statsRes.body.data).toHaveProperty('failed');
    expect(statsRes.body.data).toHaveProperty('recentOrders');
    expect(statsRes.body.data).toHaveProperty('latestUpdates');
    expect(statsRes.body.data.inTransit).toBeGreaterThanOrEqual(1); // orderA est IN_TRANSIT
  });

  it('liste uniquement les services de livraison actifs de la compagnie', async () => {
    const agent = await activateAgent();

    await prisma.catalogItem.createMany({
      data: [
        { companyId: companyA.id, name: 'Service Actif A', type: 'SERVICE', price: 10, status: 'ACTIVE' },
        { companyId: companyA.id, name: 'Service Inactif A', type: 'SERVICE', price: 15, status: 'INACTIVE' },
        { companyId: companyB.id, name: 'Service Société B', type: 'SERVICE', price: 20, status: 'ACTIVE' },
      ],
    });

    const res = await agent.get('/api/portal/services');
    expect(res.status).toBe(200);
    expect(res.body.data.some((s: { name: string }) => s.name === 'Service Actif A')).toBe(true);
    expect(res.body.data.some((s: { name: string }) => s.name === 'Service Inactif A')).toBe(false);
    expect(res.body.data.some((s: { name: string }) => s.name === 'Service Société B')).toBe(false);
  });
});


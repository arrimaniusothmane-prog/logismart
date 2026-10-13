import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, seedUser, tokenFor, prisma, type TestCompany } from './helpers.js';

const app = createApp();

let companyA: TestCompany;
let companyB: TestCompany;
let tokenA: string;
let tokenB: string;
let driverToken: string;
let escalationAId: string;
let escalationBId: string;

async function seedEscalation(companyId: string, trackingNumber: string): Promise<string> {
  const session = await prisma.chatSession.create({
    data: { companyId, customerIdentifier: 'client-demo', trackingNumber },
  });
  await prisma.chatMessage.create({
    data: { sessionId: session.id, role: 'user', content: 'Mon colis est en retard.' },
  });
  const escalation = await prisma.supportEscalation.create({
    data: { sessionId: session.id, companyId, reason: 'LIVRAISON_RETARD', status: 'OPEN' },
  });
  return escalation.id;
}

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('support-a');
  companyB = await seedCompany('support-b');
  tokenA = await tokenFor(companyA.admin);
  tokenB = await tokenFor(companyB.admin);
  driverToken = await tokenFor(await seedUser(companyA.id, 'DRIVER', 'support'));
  escalationAId = await seedEscalation(companyA.id, 'LS-AAAA-1111-AA');
  escalationBId = await seedEscalation(companyB.id, 'LS-BBBB-2222-BB');
});

afterAll(async () => {
  await closePrisma();
});

describe('GET /api/support/escalations', () => {
  it('exige la permission support:read', async () => {
    await request(app).get('/api/support/escalations').expect(401);
    const driver = await request(app)
      .get('/api/support/escalations')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(driver.status).toBe(403);
    expect(driver.body.error.message).toContain('support:read');
  });

  it('retourne la liste paginée et un résumé par statut, isolés par tenant', async () => {
    const res = await request(app).get('/api/support/escalations').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].id).toBe(escalationAId);
    expect(res.body.data.items[0].session.trackingNumber).toBe('LS-AAAA-1111-AA');
    expect(res.body.data.summary).toEqual({ OPEN: 1, IN_PROGRESS: 0, RESOLVED: 0 });

    const resB = await request(app).get('/api/support/escalations').set('Authorization', `Bearer ${tokenB}`);
    expect(resB.body.data.total).toBe(1);
    expect(resB.body.data.items[0].id).toBe(escalationBId);
  });

  it('filtre par statut', async () => {
    await request(app)
      .patch(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const open = await request(app)
      .get('/api/support/escalations?status=OPEN')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(open.body.data.total).toBe(0);

    const resolved = await request(app)
      .get('/api/support/escalations?status=RESOLVED')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resolved.body.data.total).toBe(1);
  });
});

describe('Détail + réponse support', () => {
  it('retourne la conversation complète', async () => {
    const res = await request(app)
      .get(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.session.messages).toHaveLength(1);
    expect(res.body.data.reason).toBe('LIVRAISON_RETARD');
  });

  it("403 sur une escalation d'un autre tenant", async () => {
    const res = await request(app)
      .get(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it('ajoute la réponse de l’agent et passe la conversation en cours', async () => {
    const res = await request(app)
      .post(`/api/support/escalations/${escalationAId}/reply`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Votre livreur arrive d’ici 20 minutes.' });
    expect(res.status).toBe(201);

    const detail = await request(app)
      .get(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(detail.body.data.status).toBe('IN_PROGRESS');
    expect(detail.body.data.session.messages).toHaveLength(2);
    expect(detail.body.data.session.messages[1].role).toBe('assistant');
  });

  it('refuse une réponse vide', async () => {
    const res = await request(app)
      .post(`/api/support/escalations/${escalationAId}/reply`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('clôture puis rouvre une conversation', async () => {
    await request(app)
      .patch(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    await request(app)
      .patch(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'OPEN' })
      .expect(200);

    const detail = await request(app)
      .get(`/api/support/escalations/${escalationAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(detail.body.data.status).toBe('OPEN');
  });

  it("403 pour une réponse sur une escalation d'un autre tenant", async () => {
    const res = await request(app)
      .post(`/api/support/escalations/${escalationAId}/reply`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Intrusion' });
    expect(res.status).toBe(403);
  });
});

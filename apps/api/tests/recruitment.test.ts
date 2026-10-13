import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, tokenFor, type TestCompany } from './helpers.js';

const app = createApp();

let companyA: TestCompany;
let companyB: TestCompany;
let tokenA: string;
let tokenB: string;

const jobPayload = {
  title: 'Driver — Lyon',
  description: 'Livraisons urbaines à moto, horaires flexibles.',
  location: 'Lyon, France',
  isDriverRole: true,
  status: 'PUBLISHED' as const,
};

const candidatePayload = {
  name: 'Léa Moreau',
  email: 'lea.moreau@candidate.test',
};

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('recr-a');
  companyB = await seedCompany('recr-b');
  tokenA = await tokenFor(companyA.admin);
  tokenB = await tokenFor(companyB.admin);
});

afterAll(async () => {
  await closePrisma();
});

describe('API recrutement — offres', () => {
  it('crée et liste les offres isolées par tenant', async () => {
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${tokenA}`).send(jobPayload).expect(201);
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...jobPayload, title: 'Driver — Paris' })
      .expect(201);

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].title).toBe('Driver — Lyon');
    expect(res.body.data.items[0]._count.candidates).toBe(0);
  });

  it('publie une offre via PATCH', async () => {
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...jobPayload, status: 'DRAFT' })
      .expect(201);
    const id = created.body.data.id as string;

    const res = await request(app)
      .patch(`/api/jobs/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'PUBLISHED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
  });

  it("403 sur une offre d'un autre tenant", async () => {
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(jobPayload)
      .expect(201);
    const id = created.body.data.id as string;

    const res = await request(app).get(`/api/jobs/${id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });
});

describe('API recrutement — candidats', () => {
  async function createCandidate(token: string) {
    const job = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send(jobPayload).expect(201);
    const res = await request(app)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...candidatePayload, jobOfferId: job.body.data.id });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  it('crée un candidat, suit le pipeline et l’embauche (compte créé)', async () => {
    const id = await createCandidate(tokenA);

    const list = await request(app).get('/api/candidates').set('Authorization', `Bearer ${tokenA}`);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0].jobOffer.title).toBe('Driver — Lyon');

    await request(app)
      .patch(`/api/candidates/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'SHORTLISTED' })
      .expect(200);

    const hired = await request(app)
      .post(`/api/candidates/${id}/hire`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(hired.status).toBe(200);
    expect(hired.body.data.temporaryPassword).toBeTruthy();
    expect(hired.body.data.candidate.status).toBe('HIRED');
    expect(hired.body.data.user.role).toBe('DRIVER');

    // Une seconde embauche est refusée.
    const again = await request(app)
      .post(`/api/candidates/${id}/hire`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(again.status).toBe(409);
  });

  it("403 sur un candidat d'un autre tenant", async () => {
    const id = await createCandidate(tokenA);
    const res = await request(app).get(`/api/candidates/${id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);

    const patch = await request(app)
      .patch(`/api/candidates/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'REJECTED' });
    expect(patch.status).toBe(403);
  });

  it('ignore le passage direct à HIRED (seule l’embauche crée le compte)', async () => {
    const id = await createCandidate(tokenA);
    const res = await request(app)
      .patch(`/api/candidates/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'HIRED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).not.toBe('HIRED');
  });
});

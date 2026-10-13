import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, seedUser, seedSuperAdmin, tokenFor, type TestCompany } from './helpers.js';

const app = createApp();

let companyA: TestCompany;
let companyB: TestCompany;
let tokenA: string;
let tokenB: string;
let driverToken: string;
let superToken: string;

const payload = {
  name: 'Livraison express',
  description: 'Livraison sous 24 h.',
  type: 'SERVICE' as const,
  price: 12.9,
  status: 'ACTIVE' as const,
};

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('catalog-a');
  companyB = await seedCompany('catalog-b');

  tokenA = await tokenFor(companyA.admin);
  tokenB = await tokenFor(companyB.admin);
  superToken = await tokenFor(await seedSuperAdmin());

  const driver = await seedUser(companyA.id, 'DRIVER', 'catalog');
  driverToken = await tokenFor(driver);
});

afterAll(async () => {
  await closePrisma();
});

describe('GET /api/catalog', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(401);
  });

  it('refuse un rôle sans la permission catalog:read', async () => {
    const res = await request(app).get('/api/catalog').set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('catalog:read');
  });

  it('retourne une liste paginée isolée par tenant', async () => {
    await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenA}`).send(payload).expect(201);
    await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenB}`).send({ ...payload, name: 'Autre tenant' }).expect(201);

    const res = await request(app).get('/api/catalog').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].name).toBe('Livraison express');
  });

  it('filtre par type et par recherche', async () => {
    await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenA}`).send(payload).expect(201);
    await request(app)
      .post('/api/catalog')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Boîte renforcée', type: 'PRODUCT', price: 4.5 })
      .expect(201);

    const products = await request(app).get('/api/catalog?type=PRODUCT').set('Authorization', `Bearer ${tokenA}`);
    expect(products.body.data.total).toBe(1);
    expect(products.body.data.items[0].type).toBe('PRODUCT');

    const search = await request(app).get('/api/catalog?search=express').set('Authorization', `Bearer ${tokenA}`);
    expect(search.body.data.total).toBe(1);
  });
});

describe('cycles CRUD /api/catalog', () => {
  it('crée, lit, modifie puis supprime un élément', async () => {
    const created = await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenA}`).send(payload);
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const patched = await request(app)
      .patch(`/api/catalog/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ price: 9.9, status: 'INACTIVE' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.price).toBe(9.9);
    expect(patched.body.data.status).toBe('INACTIVE');

    const deleted = await request(app).delete(`/api/catalog/${id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(deleted.status).toBe(200);

    const after = await request(app).get('/api/catalog').set('Authorization', `Bearer ${tokenA}`);
    expect(after.body.data.total).toBe(0);
  });

  it('valide le payload (nom trop court)', async () => {
    const res = await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenA}`).send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('isole les tenants : lecture et écriture refusées ailleurs', async () => {
    const created = await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenA}`).send(payload);
    const id = created.body.data.id as string;

    const read = await request(app).get(`/api/catalog/${id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(read.status).toBe(403);

    const write = await request(app).patch(`/api/catalog/${id}`).set('Authorization', `Bearer ${tokenB}`).send({ name: 'Piraté' });
    expect(write.status).toBe(403);

    const del = await request(app).delete(`/api/catalog/${id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(del.status).toBe(403);
  });

  it('SUPER_ADMIN sans entreprise lit le catalogue de toutes les entreprises', async () => {
    const createdA = await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenA}`).send(payload);
    expect(createdA.status).toBe(201);
    const createdB = await request(app).post('/api/catalog').set('Authorization', `Bearer ${tokenB}`).send(payload);
    expect(createdB.status).toBe(201);

    const res = await request(app).get('/api/catalog?limit=100').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((s: { id: string }) => s.id)).toEqual(
      expect.arrayContaining([createdA.body.data.id, createdB.body.data.id]),
    );
  });
});

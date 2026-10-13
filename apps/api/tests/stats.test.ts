import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, seedOrder, seedUser, tokenFor, type TestCompany } from './helpers.js';

const app = createApp();

let companyA: TestCompany;
let companyB: TestCompany;
let tokenA: string;
let tokenB: string;
let driverToken: string;

beforeEach(async () => {
  await resetDb();
  companyA = await seedCompany('stats-a');
  companyB = await seedCompany('stats-b');
  tokenA = await tokenFor(companyA.admin);
  tokenB = await tokenFor(companyB.admin);
  driverToken = await tokenFor(await seedUser(companyA.id, 'DRIVER', 'stats'));
});

afterAll(async () => {
  await closePrisma();
});

describe('GET /api/stats/overview', () => {
  it('exige la permission stats:read', async () => {
    const anonymous = await request(app).get('/api/stats/overview');
    expect(anonymous.status).toBe(401);

    const driver = await request(app)
      .get('/api/stats/overview')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(driver.status).toBe(403);
    expect(driver.body.error.message).toContain('stats:read');
  });

  it('retourne la structure complète du tableau de bord entreprise', async () => {
    await seedOrder({ companyId: companyA.id, status: 'IN_TRANSIT' });
    await seedOrder({ companyId: companyA.id, status: 'DELIVERED' });

    const res = await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data).toHaveProperty('today');
    expect(data).toHaveProperty('totals');
    expect(data).toHaveProperty('performance');
    expect(data).toHaveProperty('activity');
    expect(data).toHaveProperty('live');

    expect(data.today.total).toBe(2);
    expect(data.today.inTransit).toBe(1);
    expect(data.today.delivered).toBe(1);
    expect(data.totals.orders).toBe(2);
    expect(data.totals.customers).toBe(2);
    expect(typeof data.performance.successRate === 'number' || data.performance.successRate === null).toBe(true);
    expect(Array.isArray(data.activity)).toBe(true);
    expect(Array.isArray(data.live)).toBe(true);
    expect(data.live).toHaveLength(1);
  });

  it('isole les métriques par tenant', async () => {
    await seedOrder({ companyId: companyA.id, status: 'IN_TRANSIT' });
    await seedOrder({ companyId: companyB.id, status: 'IN_TRANSIT' });
    await seedOrder({ companyId: companyB.id, status: 'IN_TRANSIT' });

    const resA = await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${tokenA}`);
    expect(resA.body.data.totals.orders).toBe(1);
    expect(resA.body.data.today.total).toBe(1);

    const resB = await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${tokenB}`);
    expect(resB.body.data.totals.orders).toBe(2);
    expect(resB.body.data.today.total).toBe(2);
  });
});

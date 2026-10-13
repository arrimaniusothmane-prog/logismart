import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, seedOrder, seedSuperAdmin, type TestCompany } from './helpers.js';

const app = createApp();

let company: TestCompany;
let superToken: string;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login échoué : ${res.status}`);
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  await resetDb();
  company = await seedCompany('stats');
  await seedOrder({ companyId: company.id, status: 'PREPARED' });
  await seedOrder({ companyId: company.id, status: 'DELIVERED' });

  const superAdmin = await seedSuperAdmin();
  superToken = await login(superAdmin.email, superAdmin.password);
});

afterAll(async () => {
  await closePrisma();
});

describe('GET /api/platform/stats', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get('/api/platform/stats');
    expect(res.status).toBe(401);
  });

  it('refuse un compte non plateforme avec la permission attendue', async () => {
    const res = await request(app)
      .get('/api/platform/stats')
      .set('Authorization', `Bearer ${(await login(company.admin.email, company.admin.password))}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('platform:stats');
  });

  it('retourne les KPI multi-tenants au SUPER_ADMIN', async () => {
    const res = await request(app).get('/api/platform/stats').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);

    const stats = res.body.data;
    expect(stats.companies.total).toBe(1);
    expect(stats.companies.newLast30Days).toBe(1);
    expect(stats.companies.recent[0]._count).toEqual({ users: 1, orders: 2 });

    expect(stats.users.total).toBe(2);
    expect(stats.users.byStatus.ACTIVE).toBe(2);
    expect(stats.users.byRole.COMPANY_ADMIN).toBe(1);
    expect(stats.users.byRole.SUPER_ADMIN).toBe(1);
    expect(stats.users.recent).toHaveLength(2);

    expect(stats.orders.total).toBe(2);
    expect(stats.orders.byStatus.PREPARED).toBe(1);
    expect(stats.orders.byStatus.DELIVERED).toBe(1);
    expect(stats.orders.byStatus.CANCELLED).toBe(0);
    expect(stats.orders.active).toBe(0);

    expect(stats.customers.total).toBe(2);
    expect(stats.drivers.total).toBe(0);
    expect(stats.drivers.byAvailability.OFFLINE).toBe(0);
  });
});

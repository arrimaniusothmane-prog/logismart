import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Role } from '@logismart/shared';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, seedUser, seedSuperAdmin, prisma, type TestUser } from './helpers.js';

const app = createApp();

let company: Awaited<ReturnType<typeof seedCompany>>;
const tokens = new Map<Role, string>();

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login échoué : ${res.status}`);
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  await resetDb();
  company = await seedCompany('rbac');
  tokens.clear();

  const users: Array<{ role: Role; user: TestUser }> = [
    { role: 'COMPANY_ADMIN', user: company.admin },
    { role: 'DISPATCHER', user: await seedUser(company.id, 'DISPATCHER', 'rbac') },
    { role: 'RECRUITER', user: await seedUser(company.id, 'RECRUITER', 'rbac') },
    { role: 'DRIVER', user: await seedUser(company.id, 'DRIVER', 'rbac') },
  ];
  for (const { user } of users) {
    tokens.set(user.role, await login(user.email, user.password));
  }
  const superAdmin = await seedSuperAdmin();
  tokens.set('SUPER_ADMIN', await login(superAdmin.email, superAdmin.password));
});

afterAll(async () => {
  await closePrisma();
});

function auth(role: Role) {
  const token = tokens.get(role);
  if (!token) throw new Error(`token manquant pour ${role}`);
  return { Authorization: `Bearer ${token}` };
}

describe('protection des routes', () => {
  it('exige une authentification sur les routes du dashboard', async () => {
    for (const path of ['/api/users', '/api/companies/mine']) {
      const res = await request(app).get(path);
      expect(res.status, `${path} devrait exiger une auth`).toBe(401);
    }
  });

  it('rejette un rôle insuffisant avec un message explicite', async () => {
    const res = await request(app).get('/api/users').set(auth('DRIVER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('user:read');
  });
});

describe('matrice RBAC — lecture des utilisateurs (user:read)', () => {
  it.each<Role>(['COMPANY_ADMIN', 'DISPATCHER', 'RECRUITER'])('%s peut lire', async (role) => {
    const res = await request(app).get('/api/users').set(auth(role));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it.each<Role>(['DRIVER'])('%s ne peut pas lire', async (role) => {
    const res = await request(app).get('/api/users').set(auth(role));
    expect(res.status).toBe(403);
  });
});

describe('matrice RBAC — création d\'utilisateur (user:create)', () => {
  const payload = {
    name: 'Nouveau Compte',
    email: 'nouveau@rbac.test',
    password: 'Secret!12345',
    role: 'DISPATCHER',
  };

  it('COMPANY_ADMIN peut créer', async () => {
    const res = await request(app).post('/api/users').set(auth('COMPANY_ADMIN')).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBe(company.id);
  });

  it.each<Role>(['DISPATCHER', 'RECRUITER', 'DRIVER'])('%s ne peut pas créer', async (role) => {
    const res = await request(app).post('/api/users').set(auth(role)).send(payload);
    expect(res.status).toBe(403);
  });
});

describe('matrice RBAC — création d\'entreprise (platform:manage)', () => {
  const payload = { name: 'Autre Société', slug: 'autre-societe' };

  it('seul SUPER_ADMIN peut créer une entreprise', async () => {
    const res = await request(app).post('/api/companies').set(auth('SUPER_ADMIN')).send(payload);
    expect(res.status).toBe(201);
  });

  it.each<Role>(['COMPANY_ADMIN', 'DISPATCHER', 'RECRUITER', 'DRIVER'])(
    '%s ne peut pas créer une entreprise',
    async (role) => {
      const res = await request(app).post('/api/companies').set(auth(role)).send(payload);
      expect(res.status).toBe(403);
    },
  );
});

describe('escalade de privilèges', () => {
  it('un COMPANY_ADMIN ne peut pas s\'octroyer le rôle SUPER_ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/users/${company.admin.id}`)
      .set(auth('COMPANY_ADMIN'))
      .send({ role: 'SUPER_ADMIN' });

    expect(res.status).toBe(403);

    const stored = await prisma.user.findUnique({ where: { id: company.admin.id } });
    expect(stored?.role).toBe('COMPANY_ADMIN');
  });

  it('un COMPANY_ADMIN ne peut pas se suspendre lui-même', async () => {
    const res = await request(app)
      .patch(`/api/users/${company.admin.id}`)
      .set(auth('COMPANY_ADMIN'))
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(400);
  });

  it('un compte suspendu perd l\'accès immédiatement', async () => {
    const dispatcher = await seedUser(company.id, 'DISPATCHER', 'suspend');
    const token = await login(dispatcher.email, dispatcher.password);

    const before = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    await prisma.user.update({ where: { id: dispatcher.id }, data: { status: 'SUSPENDED' } });

    const after = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(403);
    expect(after.body.error.message).toBe('Compte désactivé');
  });
});

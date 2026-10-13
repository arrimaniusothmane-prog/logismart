import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePrisma } from '../src/lib/prisma.js';
import { resetDb, seedCompany, prisma } from './helpers.js';

const app = createApp();

function cookieValue(setCookie: string | string[] | undefined, name: string): string | undefined {
  const all = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const raw of all) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(raw);
    if (match) return decodeURIComponent(match[1]!);
  }
  return undefined;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closePrisma();
});

describe('POST /api/auth/login', () => {
  it('authentifie un compte valide et pose les cookies httpOnly', async () => {
    const company = await seedCompany('auth');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: company.admin.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(company.admin.email);
    expect(res.body.data.user.role).toBe('COMPANY_ADMIN');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    // Le hash de mot de passe ne fuit jamais.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2a$');

    const cookies = res.headers['set-cookie'] ?? [];
    const access = cookies.find((c) => c.startsWith('ls_at='));
    const refresh = cookies.find((c) => c.startsWith('ls_rt='));
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Lax');
    expect(refresh).toContain('Path=/api/auth');
  });

  it('rejette un mot de passe incorrect sans révéler l\'existence du compte', async () => {
    const company = await seedCompany('auth');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: 'WrongPass!123' });

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.local', password: 'WrongPass!123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.body.error.message).not.toMatch(/introuvable|n'existe pas/i);
  });

  it('valide les entrées (Zod)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'pas-un-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(Array.isArray(res.body.error.details.issues)).toBe(true);
  });

  it('applique le rate limiting sur les tentatives de connexion', async () => {
    const company = await seedCompany('rl');
    process.env.TEST_RATE_LIMIT = '1';
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: company.admin.email, password: 'mauvais-mot-de-passe' });
        statuses.push(res.status);
      }
      expect(statuses).toContain(429);
    } finally {
      delete process.env.TEST_RATE_LIMIT;
    }
  });
});

describe('GET /api/auth/me', () => {
  it('refuse les requêtes non authentifiées', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('refuse un jeton falsifié', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer jeton-absolument-faux');
    expect(res.status).toBe(401);
  });

  it('retourne le profil et l\'entreprise courante', async () => {
    const company = await seedCompany('me');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${company.admin.token || (await login(company.admin.email, company.admin.password))}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(company.admin.id);
    expect(res.body.data.company.id).toBe(company.id);
  });
});

describe('POST /api/auth/refresh', () => {
  it('tourne le jeton de refresh et révoque l\'ancien', async () => {
    const company = await seedCompany('refresh');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: company.admin.password });

    const oldRefresh = cookieValue(loginRes.headers['set-cookie'], 'ls_rt');
    expect(oldRefresh).toBeTruthy();

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `ls_rt=${oldRefresh}`);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));

    const newRefresh = cookieValue(refreshRes.headers['set-cookie'], 'ls_rt');
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    // Rejeu de l'ancien jeton : doit être refusé (révocation).
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `ls_rt=${oldRefresh}`);
    expect(replay.status).toBe(401);
  });

  it('refuse un refresh sans cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('révoque la session et efface les cookies', async () => {
    const company = await seedCompany('logout');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: company.admin.password });
    const refresh = cookieValue(loginRes.headers['set-cookie'], 'ls_rt');

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', `ls_rt=${refresh}`);
    expect(logoutRes.status).toBe(200);

    const after = await request(app).post('/api/auth/refresh').set('Cookie', `ls_rt=${refresh}`);
    expect(after.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('change le mot de passe et invalide les sessions existantes', async () => {
    const company = await seedCompany('pwd');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: company.admin.password });
    const refresh = cookieValue(loginRes.headers['set-cookie'], 'ls_rt');

    const bad = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', `ls_at=${cookieValue(loginRes.headers['set-cookie'], 'ls_at')}`)
      .send({ currentPassword: 'Mauvais!123', newPassword: 'Nouveau!456' });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', `ls_at=${cookieValue(loginRes.headers['set-cookie'], 'ls_at')}`)
      .send({ currentPassword: company.admin.password, newPassword: 'Nouveau!456' });
    expect(good.status).toBe(200);

    // Les sessions précédentes sont révoquées.
    const oldRefresh = await request(app).post('/api/auth/refresh').set('Cookie', `ls_rt=${refresh}`);
    expect(oldRefresh.status).toBe(401);

    // L'ancien mot de passe ne fonctionne plus.
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: company.admin.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: company.admin.email, password: 'Nouveau!456' });
    expect(newLogin.status).toBe(200);

    const stored = await prisma.user.findUnique({ where: { id: company.admin.id } });
    expect(stored?.passwordHash).not.toBe('Nouveau!456');
    expect(stored?.passwordHash).toMatch(/^\$2/);
  });

  it('interdit le mot de passe trop court', async () => {
    const company = await seedCompany('pwd2');
    const token = await login(company.admin.email, company.admin.password);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: company.admin.password, newPassword: 'court' });
    expect(res.status).toBe(400);
  });
});

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login test échoué : ${res.status}`);
  return res.body.data.accessToken as string;
}

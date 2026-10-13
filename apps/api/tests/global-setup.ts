import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

/**
 * Global setup Vitest :
 *  1. démarre un PostgreSQL embarqué dédié aux tests (port 5434)
 *  2. crée la base `logismart_test`
 *  3. applique les migrations Prisma
 *  4. arrête le serveur en fin de session
 *
 * Si un serveur écoute déjà sur 5434 (CI avec service Postgres), il est réutilisé.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(apiDir, '../..');

const PORT = 5434;
const DB_NAME = 'logismart_test';
const DATA_DIR = path.join(rootDir, '.pgdata-test');
const DB_URL = `postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}?schema=public`;

for (const file of [path.join(apiDir, '.env'), path.join(rootDir, '.env')]) {
  if (fs.existsSync(file)) {
    try {
      process.loadEnvFile(file);
      break;
    } catch {
      /* ignore */
    }
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function withClient<T>(url: string, fn: (q: (sql: string) => Promise<unknown>) => Promise<T>): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    return await fn((sql) => client.query(sql));
  } finally {
    await client.end();
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  let embedded: { stop: () => Promise<void> } | null = null;
  let external = false;

  if (await isPortFree(PORT)) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const pg = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user: 'postgres',
      password: 'postgres',
      port: PORT,
      persistent: true,
    });
    if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
      await pg.initialise();
    }
    await pg.start();
    embedded = pg;
    console.log(`[tests] PostgreSQL embarqué démarré sur le port ${PORT}`);
  } else {
    external = true;
    console.log(`[tests] serveur existant détecté sur le port ${PORT} — réutilisation`);
  }

  const adminUrl = `postgresql://postgres:postgres@localhost:${PORT}/postgres`;

  await withClient(adminUrl, async (q) => {
    const rows = (await q(`SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'`)) as { rows: unknown[] };
    if (rows.rows.length === 0) {
      await q(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`[tests] base "${DB_NAME}" créée`);
    }
  });

  await withClient(DB_URL, async (q) => {
    await q('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await q('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  // Migrations : DATABASE_URL explicite car prisma.config.ts désactive le .env auto.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: DB_URL },
  });

  console.log('[tests] base de test prête');

  return async () => {
    if (embedded) {
      await embedded.stop();
      console.log('[tests] PostgreSQL de test arrêté');
    } else if (external) {
      console.log('[tests] serveur externe laissé en fonctionnement');
    }
  };
}

#!/usr/bin/env node
/**
 * Lance l'environnement de développement complet en une commande :
 *   PostgreSQL embarqué → migrations → API + Frontend (concurrently)
 *
 *   npm run dev
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  /* pas de .env */
}

const PORT = Number(process.env.EMBEDDED_PG_PORT || 5433);
const USER = process.env.EMBEDDED_PG_USER || 'postgres';
const PASSWORD = process.env.EMBEDDED_PG_PASSWORD || 'postgres';
const DB_NAME = process.env.EMBEDDED_PG_DATABASE || 'logismart';
const DB_DIR = path.join(rootDir, '.pgdata');

function isPortFree(port) {
  return new Promise((resolve) => {
    import('node:net').then(({ createServer }) => {
      const srv = createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(port, '127.0.0.1');
    });
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: rootDir, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → code ${code}`))));
  });
}

function ensureBuiltShared() {
  const dist = path.join(rootDir, 'packages/shared/dist/index.js');
  const srcDir = path.join(rootDir, 'packages/shared/src');
  const srcNewest = fs.readdirSync(srcDir).reduce((acc, f) => Math.max(acc, fs.statSync(path.join(srcDir, f)).mtimeMs), 0);
  if (!fs.existsSync(dist) || fs.statSync(dist).mtimeMs < srcNewest) {
    console.log('[dev] build de @logismart/shared…');
    return run('npm', ['run', 'build', '-w', '@logismart/shared']);
  }
  return Promise.resolve();
}

async function startDatabase() {
  if (!(await isPortFree(PORT))) {
    console.log(`[dev] PostgreSQL déjà en écoute sur ${PORT} — réutilisation.`);
    return null;
  }
  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });
  if (!fs.existsSync(path.join(DB_DIR, 'PG_VERSION'))) {
    console.log('[dev] initialisation du cluster PostgreSQL…');
    await pg.initialise();
  }
  console.log('[dev] démarrage de PostgreSQL…');
  await pg.start();
  try {
    await pg.createDatabase(DB_NAME);
  } catch (err) {
    if (!/already exists/i.test(String(err?.message ?? err))) throw err;
  }
  const client = pg.getPgClient(DB_NAME);
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await client.end();
  console.log('[dev] PostgreSQL prêt.');
  return pg;
}

async function main() {
  await ensureBuiltShared();
  const pg = await startDatabase();

  console.log('[dev] migrations…');
  await run('npm', ['run', 'migrate', '-w', '@logismart/api']);

  if (!process.env.SKIP_SEED) {
    try {
      await run('npm', ['run', 'seed', '-w', '@logismart/api']);
    } catch (err) {
      console.warn('[dev] seed ignoré :', err.message);
    }
  }

  console.log('[dev] démarrage API + Web…\n');
  const children = [
    spawn('npm', ['run', 'dev', '-w', '@logismart/api'], { cwd: rootDir, stdio: 'inherit', shell: process.platform === 'win32' }),
    spawn('npm', ['run', 'dev', '-w', '@logismart/web'], { cwd: rootDir, stdio: 'inherit', shell: process.platform === 'win32' }),
  ];

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[dev] arrêt (${signal})…`);
    for (const c of children) {
      if (!c.killed) c.kill('SIGTERM');
    }
    if (pg) {
      try {
        await pg.stop();
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  for (const c of children) {
    c.on('exit', (code) => {
      if (!shuttingDown) {
        console.error(`[dev] processus terminé (code ${code})`);
        void shutdown('child-exit');
        process.exitCode = code ?? 1;
      }
    });
  }
}

main().catch((err) => {
  console.error('[dev] erreur :', err);
  process.exit(1);
});

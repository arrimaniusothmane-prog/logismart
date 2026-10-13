#!/usr/bin/env node
/**
 * Serveur PostgreSQL de développement embarqué (aucun Docker requis).
 *
 *   npm run db:start        démarre le serveur et reste en vie (Ctrl+C pour arrêter)
 *   npm run db:reset        supprime les données puis redémarre à vide
 *
 * Les données persistent dans ./.pgdata (ignoré par git).
 * En production, utiliser docker-compose.yml ou un managed Postgres.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  /* .env absent : on garde les valeurs par défaut */
}

const DB_DIR = path.join(rootDir, '.pgdata');
const PORT = Number(process.env.EMBEDDED_PG_PORT || 5433);
const USER = process.env.EMBEDDED_PG_USER || 'postgres';
const PASSWORD = process.env.EMBEDDED_PG_PASSWORD || 'postgres';
const DB_NAME = process.env.EMBEDDED_PG_DATABASE || 'logismart';
const reset = process.argv.includes('--reset');

async function isPortFree(port) {
  const { createServer } = await import('node:net');
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function main() {
  if (reset && fs.existsSync(DB_DIR)) {
    fs.rmSync(DB_DIR, { recursive: true, force: true });
    console.log(`[db] données supprimées (${DB_DIR})`);
  }

  if (!(await isPortFree(PORT))) {
    console.log(`[db] le port ${PORT} est déjà utilisé — probablement un serveur Postgres déjà lancé.`);
    console.log(`[db] on suppose que la base "${DB_NAME}" est prête.`);
    return new Promise(() => {}); // reste en vie pour que le parent ait un process stable
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  const initialised =
    fs.existsSync(path.join(DB_DIR, 'PG_VERSION'));

  if (!initialised) {
    console.log('[db] initialisation du cluster PostgreSQL…');
    await pg.initialise();
  }

  console.log(`[db] démarrage de PostgreSQL sur le port ${PORT}…`);
  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
    console.log(`[db] base "${DB_NAME}" créée`);
  } catch (err) {
    if (!/already exists/i.test(String(err?.message ?? err))) throw err;
  }

  const client = pg.getPgClient(DB_NAME);
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('[db] extension pgvector disponible');
    } catch {
      console.log('[db] pgvector indisponible (RAG en mode fallback SQL — voir README)');
    }
    const { rows } = await client.query('SELECT version()');
    console.log(`[db] prêt — ${rows[0].version.split(' on ')[0]}`);
    console.log(`[db] DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}?schema=public`);
    console.log('[db] prêt (Ctrl+C pour arrêter)');
  } finally {
    await client.end();
  }

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[db] arrêt (${signal})…`);
    try {
      await pg.stop();
    } catch {
      /* déjà arrêté */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[db] erreur :', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Gestion des migrations Prisma depuis la racine du monorepo.
 *
 *   npm run db:migrate                  applique les migrations en attente (deploy)
 *   node scripts/migrate.mjs --dev --name init   crée une nouvelle migration
 *   node scripts/migrate.mjs --generate          régénère le client avant deploy
 *
 * Les variables d'environnement sont chargées depuis .env (racine ou apps/api)
 * car prisma.config.ts désactive le chargement automatique de .env.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '..');
const rootDir = path.resolve(apiDir, '../..');

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

if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL manquant — copier .env.example vers .env');
  process.exit(1);
}

const argv = process.argv.slice(2);
const wantsGenerate = argv.includes('--generate');
const isDev = argv.includes('--dev');
const passthrough = argv.filter((a) => a !== '--generate' && a !== '--dev');

const prismaArgs = isDev ? ['migrate', 'dev', ...passthrough] : ['migrate', 'deploy', ...passthrough];

function runPrisma(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', ...args], {
      cwd: apiDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`prisma ${args.join(' ')} → code ${code}`))));
    child.on('error', reject);
  });
}

async function waitForDb(attempts = 30, delayMs = 1000) {
  const { Client } = await import('pg');
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      if (attempt === attempts) throw new Error('Base de données injoignable');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  console.log('[migrate] attente de la base…');
  await waitForDb();
  if (wantsGenerate) {
    console.log('[migrate] prisma generate…');
    await runPrisma(['generate']);
  }
  console.log(`[migrate] ${prismaArgs.join(' ')}…`);
  await runPrisma(prismaArgs);
  console.log('[migrate] OK');
}

main().catch((err) => {
  console.error('[migrate] erreur :', err.message);
  process.exit(1);
});

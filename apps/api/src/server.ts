import http from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { purgeExpiredTokens } from './modules/auth/auth.service.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migration automatique au démarrage (opt-in via AUTO_MIGRATE=1).
 * Utile en conteneur ; en dev, `npm run dev` gère les migrations.
 */
function autoMigrate(): void {
  if (!env.AUTO_MIGRATE) return;
  const apiDir = path.resolve(here, '..');
  try {
    logger.info('running pending migrations…');
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: apiDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
  } catch (err) {
    logger.error('migration failed', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }
}

async function waitForDatabase(retries = 20, delayMs = 500): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      if (attempt === retries) throw new Error('Base de données injoignable');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main(): Promise<void> {
  autoMigrate();
  await waitForDatabase();

  const app = createApp();
  // Point d'insertion Socket.io (Phase 3 — temps réel) :
  //   const io = new Server(server, { path: env.SOCKET_PATH }); et export d'un registre d'événements.
  const server = http.createServer(app);

  server.listen(env.API_PORT, env.API_HOST, () => {
    logger.info('API LogiSmart démarrée', {
      url: `http://${env.API_HOST}:${env.API_PORT}`,
      env: env.NODE_ENV,
      aiProvider: env.AI_PROVIDER,
      storage: env.STORAGE_PROVIDER,
    });
  });

  // Purge périodique des sessions expirées.
  const purgeTimer = setInterval(() => {
    void purgeExpiredTokens().catch((err) => logger.warn('purge failed', { error: String(err) }));
  }, 6 * 3_600_000);
  purgeTimer.unref();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown', { signal });
    clearInterval(purgeTimer);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error('failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

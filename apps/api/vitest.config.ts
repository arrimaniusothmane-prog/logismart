import { defineConfig } from 'vitest/config';

/**
 * Base de test : PostgreSQL embarqué dédié sur le port 5434
 * (voir tests/global-setup.ts) — jamais la base de développement.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/logismart_test?schema=public',
      JWT_SECRET: 'test-jwt-secret-0123456789abcdef',
      COOKIE_SECRET: 'test-cookie-secret-0123456789abcdef',
      LOG_LEVEL: 'silent',
      AUTH_RATE_LIMIT_MAX: '5',
      RATE_LIMIT_MAX: '10000',
      AI_PROVIDER: 'mock',
      EMBEDDING_PROVIDER: 'mock',
      STORAGE_PROVIDER: 'local',
    },
    pool: 'forks',
    // Une seule base partagée : les fichiers de test s'exécutent en série.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    teardownTimeout: 30_000,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: './test-results/junit.xml' },
  },
});

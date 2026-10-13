import { afterAll, beforeAll } from 'vitest';

/**
 * Exécuté dans chaque worker de test avant les fichiers de test.
 * garantit que l'on parle bien à la base de test, jamais à la base de dev.
 */
beforeAll(() => {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('logismart_test')) {
    throw new Error(`DATABASE_URL invalide pour les tests : ${url}`);
  }
});

afterAll(() => {
  /* les connexions Prisma sont fermées par les helpers */
});

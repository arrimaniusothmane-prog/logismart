import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Chargement puis validation des variables d'environnement.
 * Échec explicite au démarrage si une variable obligatoire manque —
 * jamais de secret codé en dur.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Candidates ordonnées : .env local, .env de l'app, .env racine du monorepo. */
const envCandidates = [
  path.resolve(here, '../../../.env'), // apps/api/.env
  path.resolve(here, '../../../../.env'), // racine monorepo
  path.resolve(here, '../../../../../.env'), // build déplacé
];

for (const file of envCandidates) {
  if (fs.existsSync(file)) {
    try {
      process.loadEnvFile(file);
      break;
    } catch {
      /* fichier illisible : on continue */
    }
  }
}

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit faire au moins 16 caractères'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('insecure-default-cookie-secret-change-me'),
  COOKIE_SECURE: booleanish.default(false),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'xai', 'ollama', 'mock']).default('mock'),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_BASE_URL: z.string().optional().default(''),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  EMBEDDING_PROVIDER: z.enum(['openai', 'ollama', 'mock']).default('mock'),
  EMBEDDING_API_KEY: z.string().optional().default(''),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_BASE_URL: z.string().optional().default(''),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary', 'supabase']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('uploads'),
  STORAGE_URL: z.string().default('http://localhost:4000/uploads'),

  SOCKET_PATH: z.string().default('/socket.io'),
  LOCATION_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  LOCATION_MIN_ACCURACY_M: z.coerce.number().min(0).default(50),

  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  AUTO_MIGRATE: booleanish.default(false),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuration invalide :\n${issues}\n\nCopier .env.example vers .env puis compléter.`);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigin: parsed.data.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean),
  cookieSecret: parsed.data.COOKIE_SECRET,
  accessCookie: 'ls_at',
  refreshCookie: 'ls_rt',
};

export type Env = typeof env;

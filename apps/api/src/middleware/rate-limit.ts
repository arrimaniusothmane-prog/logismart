import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { tooMany } from '../lib/errors.js';

function build(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Les tests désactivent le rate limiting global (config vitest).
    skip: () => env.isTest && process.env.TEST_RATE_LIMIT !== '1',
    handler: (_req, _res, next) => next(tooMany(message)),
  });
}

export const globalLimiter = build(
  env.RATE_LIMIT_WINDOW_MS,
  env.RATE_LIMIT_MAX,
  'Trop de requêtes, veuillez réessayer plus tard.',
);

/** Endpoints d'authentification : fenêtre courte, budget serré (anti brute-force). */
export const authLimiter = build(60_000, env.AUTH_RATE_LIMIT_MAX, 'Trop de tentatives de connexion.');

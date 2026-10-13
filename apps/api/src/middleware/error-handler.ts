import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, internal } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route introuvable : ${req.method} ${req.originalUrl}`));
};

function isPrismaKnownError(err: unknown): err is { code: string; meta?: unknown; message: string } {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string' && /^P\d{4}$/.test((err as { code: string }).code))
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // --- Erreurs maîtrisées ---
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error('app error', { requestId: req.id, code: err.code, message: err.message, status: err.status });
    } else {
      logger.debug('client error', { requestId: req.id, code: err.code, message: err.message, status: err.status });
    }
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details, requestId: req.id },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        requestId: req.id,
      },
    });
    return;
  }

  // --- Erreurs Prisma connues ---
  if (isPrismaKnownError(err)) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Cette valeur existe déjà.', requestId: req.id },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ressource introuvable.', requestId: req.id },
      });
      return;
    }
    logger.error('prisma error', { requestId: req.id, code: err.code, message: err.message });
  }

  // --- Erreurs syntaxiques JSON ---
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Corps JSON invalide.', requestId: req.id },
    });
    return;
  }

  // --- Inconnu : journalisé, jamais exposé en clair ---
  logger.error('unhandled error', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    error: err instanceof Error ? err : String(err),
  });

  const appErr = internal(env.isProd ? 'Une erreur interne est survenue.' : String(err instanceof Error ? err.message : err));
  res.status(500).json({
    success: false,
    error: { code: appErr.code, message: appErr.message, requestId: req.id },
  });
};

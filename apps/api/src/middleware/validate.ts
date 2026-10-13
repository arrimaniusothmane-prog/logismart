import type { RequestHandler } from 'express';
import type { ZodError, ZodTypeAny, z } from 'zod';
import { badRequest } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validation Zod des entrées. Les données parsées remplacent l'entrée brute :
 * le reste de l'application ne voit que des valeurs validées.
 */
export function validate<T extends Partial<Record<Source, ZodTypeAny>>>(
  schemas: T,
): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        const result = (schemas.body as ZodTypeAny).safeParse(req.body);
        if (!result.success) return next(toZodError(result.error, 'body'));
        req.body = result.data;
      }
      if (schemas.query) {
        const result = (schemas.query as ZodTypeAny).safeParse(req.query);
        if (!result.success) return next(toZodError(result.error, 'query'));
        (req as { query: unknown }).query = result.data;
      }
      if (schemas.params) {
        const result = (schemas.params as ZodTypeAny).safeParse(req.params);
        if (!result.success) return next(toZodError(result.error, 'params'));
        (req as { params: unknown }).params = result.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function toZodError(error: ZodError, source: string) {
  return badRequest(`Données invalides (${source})`, {
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}

export function parseOrThrow<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  label = 'Données invalides',
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(label, {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

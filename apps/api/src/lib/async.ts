import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Enveloppe les contrôleurs async pour propager les rejets au middleware
 * de gestion d'erreurs (sinon : requête suspendue à jamais).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

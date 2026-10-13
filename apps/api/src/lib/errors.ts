/** Erreur applicative contrôlée — jamais de détail interne exposé au client. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = status < 500;
  }
}

export const badRequest = (message = 'Requête invalide', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Authentification requise') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Accès refusé') => new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Ressource introuvable') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message = 'Conflit', details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const tooMany = (message = 'Trop de requêtes') => new AppError(429, 'RATE_LIMITED', message);

export const unprocessable = (message = 'Traitement impossible', details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE', message, details);

export const internal = (message = 'Erreur interne') => new AppError(500, 'INTERNAL', message);

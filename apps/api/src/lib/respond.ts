import type { Response } from 'express';
import type { ApiSuccess, Paginated } from '@logismart/shared';

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200): void {
  const payload: ApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  res.status(status).json(payload);
}

export function paginated<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

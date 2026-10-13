import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ok } from '../../lib/respond.js';
import { asyncHandler } from '../../lib/async.js';
import { env } from '../../config/env.js';

export const health = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, { status: 'ok', uptime: Math.round(process.uptime()), env: env.NODE_ENV });
});

export const ready = asyncHandler(async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { status: 'ready', database: 'up', latencyMs: Date.now() - startedAt });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: { code: 'NOT_READY', message: 'Base de données inaccessible', requestId: _req.id },
    });
  }
});

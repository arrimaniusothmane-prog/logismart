import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

/** Singleton Prisma — évite d'épuiser les connexions lors des rechargements à chaud. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: envLog(),
  });

function envLog() {
  if (process.env.NODE_ENV === 'test') return [];
  return [
    { level: 'warn' as const, emit: 'event' as const },
    { level: 'error' as const, emit: 'event' as const },
  ];
}

prisma.$on('warn' as never, (e: unknown) => {
  logger.warn('prisma', { message: (e as { message?: string }).message });
});
prisma.$on('error' as never, (e: unknown) => {
  logger.error('prisma', { message: (e as { message?: string }).message });
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function closePrisma(): Promise<void> {
  await prisma.$disconnect();
}

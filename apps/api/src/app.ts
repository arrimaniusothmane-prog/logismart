import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { companiesRouter } from './modules/companies/companies.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { driversRouter } from './modules/drivers/drivers.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { trackingRouter } from './modules/tracking/tracking.routes.js';
import { platformRouter } from './modules/platform/platform.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { jobsRouter, candidatesRouter } from './modules/recruitment/recruitment.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { portalRouter } from './modules/portal/portal.routes.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Le frontend et le widget sont servis depuis une autre origine.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        // Requêtes sans origine (curl, tests, server-to-server) : autorisées.
        if (!origin) return cb(null, true);
        if (env.corsOrigin.includes(origin)) return cb(null, true);
        // Autorise tout domaine localhost en développement (ports Vite variables).
        if (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
        return cb(new Error('Origine CORS non autorisée'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    }),
  );

  app.use(cookieParser(env.cookieSecret));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(requestId);
  app.use(globalLimiter);

  // Fichiers locaux (preuves de livraison, CV, documents) — jamais exécutables.
  app.use(
    '/uploads',
    express.static(env.STORAGE_LOCAL_DIR, {
      index: false,
      dotfiles: 'deny',
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
      },
    }),
  );

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/drivers', driversRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/public/track', trackingRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/candidates', candidatesRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/portal', portalRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

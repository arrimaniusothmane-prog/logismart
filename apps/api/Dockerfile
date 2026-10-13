# ============================================================
# LogiSmart — API (Express + Prisma)
# Construction en deux étapes : dépendances + build, puis runtime.
# ============================================================
FROM node:22-alpine AS build
WORKDIR /app

# Copie du monorepo (le .dockerignore exclut node_modules, dist, .git…)
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

RUN npm ci -w @logismart/shared -w @logismart/api

# Client Prisma généré selon le schéma, puis builds compilés (output dans dist/)
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @logismart/shared \
  && npm run build -w @logismart/api

# ---------------------------- runtime ----------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0

# Les variables SECRETS et DATABASE_URL sont injectées par docker-compose / orchestrateur.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/tsconfig.base.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api

# Dossier de stockage local (preuves, CV…) hors sources.
RUN mkdir -p apps/api/uploads

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health/ready >/dev/null || exit 1

# AUTO_MIGRATE=1 (docker-compose) applique les migrations Prisma au démarrage.
CMD ["npm", "run", "start:api"]
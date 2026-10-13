# ============================================================
# LogiSmart — Frontend (React + Vite + Tailwind)
# Build Node → runtime nginx (SPA + proxy vers l'API).
# ============================================================
FROM node:22-alpine AS build
WORKDIR /app

# Url de l'API vue depuis le NAVIGATEUR.
# Vide (défaut) : le frontend appelle la même origine (/api proxyfié par nginx),
# ce qui évite tout problème CORS/cookies cross-origin.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

RUN npm ci -w @logismart/shared -w @logismart/web
RUN npm run build -w @logismart/shared && npm run build -w @logismart/web

# ---------------------------- runtime : nginx ----------------------------
FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
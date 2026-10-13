FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build the shared package first
COPY packages/shared packages/shared
RUN npm run build -w @logismart/shared

# Build the local client
COPY apps/local-client apps/local-client
RUN npm run build -w @logismart/local-client

FROM node:22-alpine AS release
WORKDIR /app

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/local-client apps/local-client
COPY --from=build /app/packages/shared packages/shared

ENV LOGISMART_API_URL=http://localhost:4000
ENV ELECTRON_DISABLE_SECURITY_WARNINGS=true

CMD ["npm", "run", "start", "-w", "@logismart/local-client"]

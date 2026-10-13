# LogiSmart — project instructions

Respond in French by default. Keep code, identifiers, and commit messages consistent with the surrounding project.

## Project structure

- This is an npm workspaces monorepo. `apps/api` is the Express + Prisma + Zod API; `apps/web` is the React + Vite web app; `apps/local-client` is the Electron/React driver client; `packages/shared` contains types, Zod schemas, roles, and statuses shared across apps.
- Keep shared contracts and business rules in `packages/shared` when they must stay consistent between the API and clients.
- Follow the existing module, middleware, validation, error-handling, and test patterns. Trace the relevant API, shared, and UI surfaces before changing behavior.

## Required invariants

- Enforce tenant isolation on the server. Derive company scope from the authenticated context; never trust a tenant or company identifier supplied by a client.
- Preserve role-based authorization at the relevant route and service layers.
- Keep authentication secrets in environment configuration. Never expose `.env` contents, add secrets to source control, or use demo credentials as production values.
- Do not represent mock or unavailable functionality as real. Surface errors using established project handlers instead of silently swallowing them.
- When changing Prisma models, use the existing migration workflow and add a migration; do not rewrite migrations that may already have been applied.

## Working and verification

- Make focused changes; do not reformat or modify unrelated code. Avoid adding dependencies unless the task requires them.
- Add or update tests for behavior changes, especially authorization, tenant boundaries, validation, and status transitions.
- Run the narrowest relevant checks first. Root commands include `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; workspace-specific scripts are available with `npm run <script> -w @logismart/<workspace>`.
- API tests use Vitest and a real test database. Check the existing test setup before running database-dependent tests.
- Update the README or other directly related documentation when behavior or developer workflows change.

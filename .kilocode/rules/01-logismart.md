# LogiSmart project rules

- Read and follow the repository-root `AGENTS.md` before making changes; it is the shared source of project conventions and verification commands.
- Respond in French by default and preserve the surrounding code style.
- This is an npm workspaces monorepo: `apps/api` (Express, Prisma, Zod), `apps/web` (React, Vite), `apps/local-client` (Electron, React), and `packages/shared` (cross-app contracts and business rules).
- Keep tenant boundaries server-enforced: derive company scope from authenticated context, never from client-provided identifiers. Preserve RBAC and do not leak secrets or `.env` values.
- For Prisma model changes, add a migration using the established workflow. For behavior changes, add/update relevant tests and run the narrowest applicable check.
- Make surgical edits, avoid unnecessary dependencies, and do not report tests or checks as passing unless they were run successfully.

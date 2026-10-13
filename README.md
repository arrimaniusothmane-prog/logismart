# LogiSmart

SaaS multi-tenant pour entreprises de livraison : **logistique de tournées, support client IA et recrutement de livreurs assisté par IA**. Frontend React (Vite + Tailwind), API Node/Express, PostgreSQL via Prisma — tout en TypeScript dans un monorepo npm.

> Livré par phases vérifiées (lint, typecheck, tests, smoke) — chaque phase expose uniquement du réel, jamais de données simulées présentées comme vraies.

## Fonctionnalités disponibles

| Module | État | Détail |
| --- | --- | --- |
| Comptes & rôles | ✅ | RBAC 5 rôles, JWT httpOnly, refresh avec rotation/révocation, multi-tenant strict |
| Entreprises / utilisateurs | ✅ | CRUD utilisateurs, compta plateforme SUPER_ADMIN, gestion d'entreprise + mot de passe |
| **Logistique (Phase 2)** | ✅ | Commandes (CRUD, affectation livreur, transitions de statut journalisées, n° de suivi), clients, livreurs, **page de suivi public** |
| Cartographie temps réel | ⏳ Phase 3 | Positions live (socket.io) + preuves de livraison |
| Support IA (chat) | ⏳ Phase 4 | Chatbot RAG sur FAQ/notices + escalade humaine |
| Recrutement IA | ⏳ Phase 5 | Analyse CV, scores, questions d'entretien, querying vectoriel |

## Architecture

```
apps/api      Express 4 + Prisma + Zod — API REST /api, middleware sécurité
apps/web      React 19 + Vite 8 + Tailwind 4 — dashboard, app livreur, suivi public
packages/shared  Zod, statuts/transitions, RBAC — source de vérité FE/BE
scripts/      db.mjs (Postgres embarqué) + dev.mjs (lancement API + web + api)
```

- **Multi-tenant** : chaque ressource métier porte `companyId`, le périmètre vient du jeton, jamais du client.
- **RBAC** : matrice de permissions dans `packages/shared/src/roles.ts`, appliquée au niveau route **et** service (ex. un livreur ne voit que ses propres livraisons).
- **Postgres embarqué** en local (dev 5433 / test 5434) pour ne rien installer — ou PostgreSQL/`pgvector` via Docker (montée du RAG vectoriel documentée plus bas).

## Démarrage rapide (dev, sans Docker)

Prérequis : **Node ≥ 20.11**, npm.

```bash
npm install              # monorepo
npm run db:start         # démarre le Postgres embarqué (port 5433)
cp .env.example .env     # puis ajuster si besoin
npm run build            # compile shared → api → web
npm run db:migrate       # schéma de base
npm run db:seed          # données de démonstration
npm run dev              # API (4000) + frontend Vite (5173) + api reload
```

### Comptes de démonstration (seed)

Mot de passe unique : `Demo!Pass123`

| E-mail | Rôle |
| --- | --- |
| `super@demo.test` | SUPER_ADMIN (plateforme) |
| `admin@demo.test` | admin du démo |
| `dispatch@demo.test` | dispatcheur (commandes, affectations) |
| `recruteur@demo.test` | recruteur |
| `livreur1@demo.test` / `livreur2@demo.test` | livreurs |
| `admin@acme.test` | admin d'une seconde entreprise (isolation tenant) |

Le suivi public s'explore via une URL `http://localhost:5173/track/<token>` : le jeton est généré à la création de chaque commande (interrogez la base ou ajoutez une commande puis utilisez le n° du `TrackingToken`). Le seed expose un lien stable pour la démo : `http://localhost:5173/track/demo-suivi-ls-cmll-01` (commande `LS-CMLL-DEMO-01`).

## Démarrage rapide (Docker)

```bash
docker compose up -d --build
#   Frontend : http://localhost:3000
#   API      : http://localhost:4000/api/health/ready
docker compose exec api npm run seed -w @logismart/api   # données de démo (optionnel)
```

Le frontend nginx proxifie `/api` et `/uploads` vers l'API (même origine ⇒ pas de CORS, cookies OK). Les migrations Prisma sont appliquées au démarrage de l'API (`AUTO_MIGRATE=1`).

## Configuration

Copier `.env.example` vers `.env` puis compléter (toutes les clés y sont commentées). Clés sensibles imposées : `DATABASE_URL`, `JWT_SECRET` (≥ 16 caractères), `COOKIE_SECRET`. Secrets de production : `openssl rand -base64 48`.

Pour le RAG vectoriel (Phase 5), les embeddings sont stockés en `double precision[]` (portable, sans extension). Montée à l'échelle en **pgvector** : utiliser l'image `pgvector/pgvector` (déjà choisie dans `docker-compose.yml`), déclarer `vector` dans le schéma et passer le score de similarité en SQL brut — sans changement de contrat d'API.

## Tests & qualité

```bash
npm run lint      # ESLint (API + web)
npm run typecheck # tsc (shared + api + web)
npm test          # Vitest : API (supertest + Postgres de test réel) + web
```

Le jeu API couvre : auth, RBAC, isolation multi-tenant, et le cycle logistique complet (création → affectation → manutention → livraison, suivi public, révocation de jeton).

## API (Phase 2 — logistique)

```
GET    /api/orders            liste (filtres statut/livreur/client/dates, pagination)
POST   /api/orders            création (client existant ou à la volée)
GET    /api/orders/:id        détail + historique
PATCH  /api/orders/:id        modification (avant prise en charge)
PATCH  /api/orders/:id/assign affectation / désaffectation livreur
PATCH  /api/orders/:id/status transition validée par la matrice de statuts
DELETE /api/orders/:id        suppression (jamais prise en charge)

GET /api/customers · POST /api/customers · GET/PATCH /api/customers/:id
GET /api/drivers · GET /api/drivers/:id · PATCH /api/drivers/me/availability
GET /api/public/track/:token   suivi public (jeton opaque, expiration + révocation)
```

## Scripts utiles

| Commande | Effet |
| --- | --- |
| `npm run db:start` / `db:reset` | Postgres embarqué dev / remise à zéro |
| `npm run db:migrate` / `db:seed` | migration / données de démo |
| `npm run preview` | build + API en mode production |
| `npm test` | suite complète (API 71 + web 9) |

## Assistants de code

Les consignes partagées du dépôt sont dans [`AGENTS.md`](./AGENTS.md) : OpenCode les charge automatiquement depuis la racine. Kilo Code reçoit une règle de projet dans [`.kilocode/rules/`](./.kilocode/rules/), qui renvoie vers ces consignes pour garder les deux outils alignés. Aucun modèle ni fournisseur d’IA n’est imposé par la configuration du dépôt.
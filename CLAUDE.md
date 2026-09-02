# CLAUDE.md

## Project Overview

A single Node.js/TypeScript backend that serves three personal/hobby projects in one deployable service. Motivated by the cost of running free-tier PaaS instances — consolidating into one repo keeps everything on a single host.

Live at: https://portfolio-rsaw409.onrender.com

### Served apps
- **Portfolio** (`/portfolio`) — https://portfolio.rsaw409.me/ (Google OAuth + portfolio data API)
- **Split** (`/split`) — Android expense-splitting app (OneSignal push notifications)
- **Tic-tac-toe** (`/tictoe`) — https://tictoe-rsaw409.onrender.com/ (Socket.IO realtime multiplayer)

## Tech Stack

- **Runtime:** Node.js (ESM, `"type": "module"`, target ES2022)
- **Language:** TypeScript (strict)
- **Framework:** Express 4
- **DB:** PostgreSQL via Sequelize 6 — a single Postgres instance with two schemas (`portfolio_backend`, `split_backend`)
- **Realtime:** Socket.IO 4
- **Auth:** Passport + passport-google-oauth20, cookie-session, lusca CSRF
- **Object storage / auth:** Supabase (`@supabase/supabase-js`) — for portfolio profile pictures
- **File uploads:** multer (memory storage, 2MB cap, image-only whitelist)
- **Validation:** express-validator
- **Security middleware:** express-rate-limit (100 req / 15 min, skips `/health`), lusca CSRF, helmet-style cookie hardening
- **Logging:** winston + `response-time` request logger (ignores `/health`, `/db_health`)
- **Encryption:** Node `crypto` AES-256-GCM for invite IDs
- **Push:** OneSignal REST API
- **Tests:** vitest + supertest (with `--coverage` via `@vitest/coverage-v8`)
- **Lint/format:** ESLint 9 + Prettier 3, flat config
- **Hooks:** husky 9
- **CI:** GitHub Actions — test → docker build/push to ghcr.io → webhook deploy
- **Container:** Multi-stage Dockerfile (`node:lts-slim`), runs as non-root, exposes 3000

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run with `tsx --watch` (auto-reload), loads `.env` via `--env-file` |
| `npm run build` | `tsc` → `dist/` |
| `npm start` | `node dist/src/index.js` (production) |
| `npm test` | `vitest run --coverage` |
| `npm run lint` / `lintfix` | ESLint over `src/**/*.{ts,tsx}` |
| `npm run format` | Prettier write |
| `npm run prepare` | husky install |

## Source Layout

```
src/
├── index.ts                # Entry point — boots DB, mounts routers, starts HTTP/Socket.IO
├── postgres.ts             # DBConnection singleton — Sequelize instance, init, sync, index creation
├── @rsaw409/               # Shared internal utilities
│   ├── constant.ts         # ErrorMessage enum
│   ├── crypto.ts           # AES-256-GCM encrypt/decrypt (used for split invite IDs)
│   ├── logger.ts           # winston logger + request-time middleware
│   └── supabase.ts         # Supabase storage wrapper (upload/delete in portfolio_images bucket)
├── types/                  # Shared TypeScript interfaces
│   ├── portfolio.d.ts      # Certificate, Education, Project, Skill, WorkExperience, User
│   └── split.d.ts          # createGroupPayload, saveTransactionPayload, etc.
├── portfolio-backend/      # /portfolio — public portfolio data + Google OAuth
│   ├── index.ts            # Router: cors, cookie-session, lusca CSRF, passport init
│   ├── auth-routes.ts      # /login/success, /login/failed, /logout, /google, /google/callback
│   ├── routes.ts           # Public GET routes (projects, skills, certificates, educations, experiences, user)
│   ├── protected-routes.ts # Authenticated POST/DELETE routes; Passport GoogleStrategy config
│   ├── controller.ts       # All HTTP handlers (try/catch, log via @rsaw409/logger)
│   ├── utils/
│   │   ├── validator.ts    # express-validator chains for query/body
│   │   ├── auth-check.ts   # checkAuthenticated — verifies session email matches user_id
│   │   └── file-validation.ts # file-type MIME check against image whitelist
│   └── db/
│       ├── postgres.ts     # initModels — registers all models in schema
│       ├── models/         # user, project, certificate, education, skill, work-experience
│       └── queries/        # get/add/delete helpers for each entity
├── split-backend/          # /split — expense splitting API
│   ├── index.ts            # Router mount
│   ├── routes.ts           # All POST endpoints
│   ├── controller.ts       # Handlers; encrypts group IDs into invite IDs
│   ├── utils/send_notification.ts # OneSignal push helper
│   └── db/
│       ├── postgres.ts     # initModels for split schema
│       ├── models/         # Group, User, Transaction, TransactionPart
│       └── queries/        # group / user / transaction queries (raw SQL for overview + transactions listing)
└── tic-toe-backend/        # /tictoe — Socket.IO only, no HTTP
    ├── index.ts            # Re-exports addSocket
    └── socket.ts           # Game room logic (max 2 players, join/move/restart/leave/disconnect)
```

Tests live in `__test__/` mirroring the `src/` tree. `__test__/index.test.ts` mocks the entry-point dependencies to verify the server boots.

## Architectural Notes

- **Single Express app, three sub-routers** mounted at `/portfolio`, `/split`, plus Socket.IO on `/tictoe`. `/health` and `/db_health` are top-level.
- **One Postgres, two schemas.** `DBConnection` (singleton) creates a single Sequelize instance; each sub-app's `initModels` registers its models against its own schema name. `sync({ alter })` runs at boot. Indexes are created via raw `create unique index if not exists` queries on `init({ alter: true })`.
- **Auth model (portfolio only):** Google OAuth via Passport; session stored in signed cookies. CSRF via lusca. Protected routes additionally require that the session user's email resolves to the `user_id` in the query — done in `utils/auth-check.ts`.
- **Profile pictures** are uploaded to Supabase Storage (`portfolio_images` bucket) keyed as `<user_email>/<user_id>_<timestamp>`. Uploads first delete any prior files under the user's prefix.
- **Split invite IDs** are AES-256-GCM-encrypted group IDs (so the client can carry an opaque token in the `invite_id` field; decrypted server-side to look up the group).
- **Tic-tac-toe** uses in-memory `games` state keyed by `gameId` (plain object via `Object.create(null)`); max 2 players per room; emits `users` only when the room fills.
- **HTTP server timeouts:** 10s request timeout with a `408` reply, plus auto-retry on `EADDRINUSE`.
- **Trust proxy** is set to `1` (one hop) — required so rate limiter sees real client IPs behind Render's proxy.

## Conventions

- ESM imports use the explicit `.js` extension (TypeScript NodeNext module resolution).
- Controllers are async, wrap DB calls in try/catch, log errors via `logger`, and return `{ message }` on 4xx.
- Query helpers live under each sub-app's `db/queries/`, one file per entity.
- New entity model = new file under `<sub-app>/db/models/` + a `createXModel` factory called from the sub-app's `db/postgres.ts` + matching query file.
- Validation is centralised in `<sub-app>/utils/validator.ts` as `express-validator` chains + an `errorHandler` middleware.
- Secrets only via env vars; no secrets in code. `.env` is not committed; `postgresConnStr`, `GOOGLE_CLIENT_ID/SECRET`, `CLIENT_ADDRESS1/2`, `ENCRYPTION_KEY`, `SUPABASE_URL/KEY`, `ONESIGNAL_KEY` are required at boot (asserted in each sub-app's `index.ts`).
- Prettier: 2-space, single quotes, trailing commas, 80 cols, semis on.

## Common Tasks

**Add a new portfolio entity (e.g. awards):**
1. Add the type in `src/types/portfolio.d.ts`.
2. Add model factory in `src/portfolio-backend/db/models/awards.ts` and register it in `db/postgres.ts`.
3. Add query helpers in `db/queries/awards.ts`.
4. Add controller handlers in `controller.ts`, wire them in `routes.ts` (GET) and `protected-routes.ts` (POST/DELETE).
5. Add validators in `utils/validator.ts`.

**Add a new split endpoint:**
1. Add payload type in `src/types/split.d.ts`.
2. Add the controller in `split-backend/controller.ts` and wire it in `routes.ts`.
3. Add query helpers in the relevant `db/queries/*.ts` (reuse raw SQL if it's an aggregation like the overview query).

**Run locally:**
```
npm install
cp .env.example .env   # if not present; populate all required vars
npm run dev
```

**Run tests with coverage:**
```
npm test
```

## Environment Variables (required)

- `postgresConnStr` — Postgres connection string
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — for `/portfolio` Google login
- `CLIENT_ADDRESS1`, `CLIENT_ADDRESS2` — allowed CORS origins (production + dev)
- `ENCRYPTION_KEY` — used by lusca CSRF + AES-256-GCM
- `SUPABASE_URL`, `SUPABASE_KEY` — Supabase project for portfolio_images storage
- `ONESIGNAL_KEY` — push notifications for split-backend
- `PORT` — optional, defaults to 3000
- `NODE_ENV` — toggles cookie `secure` flag and CORS/domain defaults

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
- **Validation:** express-validator (portfolio), zod (split)
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
│   ├── utils/
│   │   ├── send_notification.ts # OneSignal push to a group's registered devices
│   │   └── validator.ts         # zod schemas + `parse` helper for every route
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
- **Idempotent split writes.** One key per written row, supplied by the client as `idempotency_key` **in the request body** of `saveTransaction`, `savePayment` and every element of the `savePayments` array, and stored on `transactions.idempotency_key` under a unique index. (Body, not a header, so the batch — which writes one row per payment — follows the same rule as the single-row routes.) Writes go straight to the DB with no pre-check — the unique index is the gate. A rejected write rolls back, the existing row is looked up by key, and that is returned instead (HTTP 200, same body) with no second push notification. `savePayments` saves each payment in its own transaction, so a batch repeating an earlier one writes only what is new in a single pass; it reports this as a `written: boolean[]` parallel to the request, which the controller uses to notify only the payments it actually wrote. **The batch is deliberately not atomic** — a payment failing for a non-key reason leaves the ones before it committed. The per-payment keys are what make that safe: retrying the same batch replays the committed payments and writes the rest, so the client must keep its keys until the call succeeds. Postgres treats NULL keys as distinct, so clients that send no key keep the old at-least-once behaviour. `createGroup` follows the same rule with its own key on `groups.idempotency_key` (unique index `groups_idempotency_key`): it creates the group and its `members` (as users) in one transaction, and a replay returns the existing group with its current members. No expiry is needed: a key lives and dies with the transaction row it tags. Key rules are payload validation, applied in the controller by parsing through the zod schema in `utils/validator.ts` before the query layer is reached: a blank key normalises to NULL, an oversized one is rejected, and a batch must be keyed throughout or not at all with no key repeated.
- **Amounts are integer minor units.** `transactions.amount` and `transaction_parts.amount` are `BIGINT` holding the group currency's smallest unit (paise for INR: ₹120.50 → `12050`), and the API sends and receives the same: zod rejects fractional amounts, and a transaction's parts must sum *exactly* to `totalAmount`. node-postgres returns int8 as a string by default, so `src/postgres.ts` registers an INT8 type parser (`parseBigInt`) that returns a number and throws beyond `Number.MAX_SAFE_INTEGER`. Sequelize is given that same `pg` module via `dialectModule`. The parser also makes `count(*)` results numbers. `sum()` over BIGINT yields NUMERIC, which comes back as a string, so aggregate queries cast it with `::bigint`. A group's `currency` is any ISO 4217 code in `Intl.supportedValuesOf('currency')` (case-insensitive; made-up codes are rejected). App versions from before per-group currencies read every amount as paise, so they must be updated before non-INR groups exist. Each group stores its scale in `groups.currency_decimals` (`SMALLINT`, default 2): the number of decimals in its currency's minor unit, sent by the app — required by `createGroup`, and by `updateGroup` exactly when `currency` is sent — and rejected unless it is the currency's standard value per `Intl` (2 for INR). It changes only with the currency, under the same no-transactions rule. Push notifications format amounts with `utils/format_amount.ts`: `Intl.NumberFormat` for the currency's symbol, the group's stored decimals for the scale (`12050` is `₹120.50` in INR/2, `¥12,050` in JPY/0). The sender reads currency and decimals with the group's devices, so callers pass the text as a function of the group.
- **Schema comes from `sync`.** `DB.init()` runs `sync({ alter })`; `src/index.ts` passes no `alter`, so production only creates missing tables and missing indexes. The idempotency unique index is declared on the `Transaction` model so `sync` creates it (and skips it where `transactions_idempotency_key` already exists). `sync({ alter: false })` never adds or changes columns on an existing table, so a column change on a live table needs a one-off SQL change. The rupee→paise conversion was done that way and has already run on the live DB. `groups.currency_decimals` also needs it before deploying: `ALTER TABLE split_backend.groups ADD COLUMN IF NOT EXISTS currency_decimals smallint NOT NULL DEFAULT 2;` `users.avatar` (nullable `TEXT`, the seed the app renders a user's avatar from) needs the same: `ALTER TABLE split_backend.users ADD COLUMN IF NOT EXISTS avatar text;` `#createIndexes` is gated on `alter` and therefore never runs in production today.
- **Group details are pulled, not pushed.** `POST /getGroups { group_ids }` returns the current `{ id, name, inviteId, currency }` of each listed group that exists, in request order; it is how members' apps pick up changes made through `POST /updateGroup { group_id, name?, currency? }`, which changes only the fields sent (same rules as `createGroup`) and returns the same shape. The currency can change only while the group has no expenses or payments (amounts carry no currency of their own): for a currency change `updateGroup` takes `LOCK TABLE transactions IN SHARE MODE` before checking, which waits for in-flight writes and holds new ones at their INSERT until it commits. The write paths take no extra lock. The wait is capped by `SET LOCAL lock_timeout = '2s'` so a slow write cannot queue every group's writes behind it; on timeout the change fails with `ErrorMessage.GroupBusy` and can be retried.
- **Split push notifications are targeted by the backend.** Devices call `POST /registerDevice` with their OneSignal `subscription_id` and the *complete* list of `group_ids` they follow; `split_backend.device_groups` (PK `(subscription_id, group_id)`, indexed on `group_id`, created by `sync`) is replaced to match in a single SQL statement (the app calls it on every launch), and unknown group ids are skipped. An unchanged launch writes nothing: `updated_at` is refreshed at most once a day. `send_push_notification` takes the acting user (`by`/`from`) or a `group_id` (used by `updateGroup`, which notifies only when a value actually changed, naming old and new), resolves the group name and subscriptions from the DB in one query, and sends with `include_subscription_ids` in chunks of 20,000 — no OneSignal tags or segments. The request's `groupName` is ignored (zod strips it). It never throws, so controllers fire it without awaiting.
- **Avatars.** `createUser` takes an optional `avatar`, and `createGroup`'s `members` may mix plain names (older apps) with `{ name, avatar? }` objects; the validator turns both into objects. An avatar sent must be non-blank and at most 64 characters. `createGroup` returns `avatar` (null when none) on each member, and `getOverviewDataInGroup` returns it per member: the app builds its member lists from that endpoint, so no other read carries it.
- **An expense or payment stays within one group.** `insertTransaction` writes the `transactions` row with `INSERT … SELECT … WHERE` the payer and every split user (or payer and payee) exist and share one group, so the check costs no extra query; otherwise it throws `ErrorMessage.UsersNotInOneGroup` and the write rolls back. `mapToModel` keeps the returned instance identical to `Transaction.create`'s.
- **Tic-tac-toe** uses in-memory `games` state keyed by `gameId` (plain object via `Object.create(null)`); max 2 players per room; emits `users` only when the room fills.
- **HTTP server timeouts:** 10s request timeout with a `408` reply, plus auto-retry on `EADDRINUSE`.
- **Trust proxy** is set to `1` (one hop) — required so rate limiter sees real client IPs behind Render's proxy.

## Conventions

- ESM imports use the explicit `.js` extension (TypeScript NodeNext module resolution).
- Controllers are async, wrap DB calls in try/catch, log errors via `logger`, and return `{ message }` on 4xx.
- Query helpers live under each sub-app's `db/queries/`, one file per entity.
- New entity model = new file under `<sub-app>/db/models/` + a `createXModel` factory called from the sub-app's `db/postgres.ts` + matching query file.
- Validation is centralised in `<sub-app>/utils/validator.ts`: `express-validator` chains + an `errorHandler` middleware in portfolio, zod schemas + a `parse` helper in split. Controllers pass the *parsed* result downstream, never `req.body`, so ids arrive coerced and optional fields normalised.
- `getAllTransactionInGroup`'s `payments` filter is a real boolean: `true` payments only, `false` expenses only, absent/null no filter.
- Secrets only via env vars; no secrets in code. `.env` is not committed; `postgresConnStr`, `GOOGLE_CLIENT_ID/SECRET`, `CLIENT_ADDRESS1/2`, `ENCRYPTION_KEY`, `SUPABASE_URL/KEY`, `ONESIGNAL_KEY` are required at boot (asserted in each sub-app's `index.ts`).
- Prettier: 2-space, single quotes, trailing commas, 80 cols, semis on.

## Common Tasks

**Add a new portfolio entity (e.g. awards):**
1. Add the type in `src/types/portfolio.d.ts`.
2. Add model factory in `src/portfolio-backend/db/models/awards.ts` and register it in `db/postgres.ts`.
3. Add query helpers in `db/queries/awards.ts`.
4. Add controller handlers in `controller.ts`, wire them in `routes.ts` (GET) and `protected-routes.ts` (POST/DELETE).
5. Add validators in `utils/validator.ts`.

**Make a split write idempotent:** take an optional `idempotencyKey` in the query helper, check `findExistingTransaction(key)` before writing, set `idempotency_key` on the created row, and catch `UniqueConstraintError` to return the winner's row. The controller parses the body through its zod schema first and skips side effects such as push notifications when the returned `replayed` is true; the query layer trusts the key it is given. For a multi-row write, take a key per row from the body and use `findExistingTransactions(keys)` instead.

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

**Run tests with coverage** (`vitest.config.ts` excludes `dist/`, where `npm run build` also compiles the tests):
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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js 15 (App Router) trademark search / monitoring / portfolio app. It ingests the USPTO bulk daily-applications dataset into Postgres for fast text search, queries the IP Australia API live, runs CLIP-based visual similarity and Google-Vision OCR for logo matching, gates everything with Supabase Auth + RBAC, and bills via Stripe.

## Commands

Package manager is **pnpm** (HeroUI requires `public-hoist-pattern[]=*@heroui/*` in `.npmrc`, already set).

```bash
pnpm dev                  # next dev --turbopack
pnpm build                # next build
pnpm start
pnpm lint                 # eslint --fix

# USPTO ingestion (also exposed as pnpm scripts of the same name)
pnpm uspto:auto           # download_latest_trtdxfap.ts — pulls latest TRTDXFAP zip & imports
pnpm uspto:auto-dry       # dry run (lists, doesn't download)
pnpm uspto:download-only  # download zip but skip importer
pnpm uspto:daily          # download_daily_applications.ts (date-range mode)

# Direct script invocation
npx tsx scripts/uspto/import_daily_applications.ts --zip=./downloads/apc260212.zip
npx tsx scripts/uspto/import_daily_applications.ts --from=2025-02-10 --to=2025-02-13
npx tsx test-uspto-setup.ts   # verify DB schema/extensions/search function
```

There is **no test runner configured**. `lib/__tests__/*.test.ts` files use Jest syntax but `jest` is not in `package.json` — running them requires installing Jest first. Treat existing tests as documentation, not CI.

## Environment

Copy `.env.local.example` → `.env.local`. Critical vars:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by SSR + browser clients and middleware.
- `SUPABASE_SERVICE_ROLE_KEY` — only via `lib/supabase/admin.ts`, server-side only.
- `DATABASE_URL` — **must** be the Supabase **transaction pooler** URL (port `6543`), not the direct connection. `lib/db/postgres.ts` opens a `pg.Pool` against this for trademark search; pooler is required because Vercel serverless can't hold long-lived connections.
- `USPTO_API_KEY` — Bulk Datasets API (`api.uspto.gov`).
- `IP_AU_CLIENT_ID` / `IP_AU_CLIENT_SECRET` / `IP_AU_BASE_URL` / `IP_AU_TOKEN_URL` / `IP_AU_OAUTH_SCOPE` — IP Australia OAuth2.
- `EUIPO_API_KEY` / `EUIPO_API_SECRET` / `EUIPO_TOKEN_URL` / `EUIPO_API_BASE_URL` — EUIPO IBM gateway. **Token URL is the bare `euipo.europa.eu` host** (not `api.euipo.europa.eu`); per the OpenAPI spec the CAS auth server lives off the gateway. Token endpoint is hit with HTTP Basic (`EUIPO_API_KEY`:`EUIPO_API_SECRET`) and `scope=uid`; the resulting bearer token is sent on every search call alongside `X-IBM-Client-Id: ${EUIPO_API_KEY}`.
- `GOOGLE_CREDENTIALS_JSON` — full service-account JSON inline (used by `@google-cloud/vision`).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `AREEBA_*` — second payment provider (MPGS hosted checkout). `AREEBA_MERCHANT_ID` + `AREEBA_API_PASSWORD` are hard requirements (initiate returns 501 `GATEWAY_NOT_CONFIGURED` otherwise). `AREEBA_GATEWAY_BASE_URL` defaults to `https://epayment.areeba.com`, `AREEBA_API_VERSION` defaults to `100`. `AREEBA_HASH_SECRET` is **forensic-only** — does not drive payment status. See "Payments" below.
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — outbound mail for monitor alerts.
- `CRON_SECRET` — bearer token for `/api/cron/*` endpoints (set in Vercel).
- `NEXT_PUBLIC_APP_URL` — used to build absolute URLs for email confirmations; set to live domain in production.

## Architecture

### Two parallel database access paths (don't unify them)

Both talk to the same Supabase Postgres, but for different reasons:

1. **Supabase JS client** (`lib/supabase/{client,server,admin,auth-route}.ts`) — for auth, sessions, RLS-gated tables (`profiles`, `brands`, `contact_submissions`, `subscriptions`, `transactions`, `usage_tracking`, `portfolio_*`, `watchlists`). Picks the right client per context: `client.ts` (browser), `server.ts` (RSC/route handlers, awaits `cookies()`), `admin.ts` (service role, bypasses RLS — server-only).
2. **Direct `pg` Pool** (`lib/db/postgres.ts`) — for the `trademarks` table USPTO search. Uses `pg_trgm` and custom SQL functions (`search_trademarks`, similarity SQL in `hybrid-similarity-v2.sql` / `two-stage-similarity.sql`) that the Supabase client can't express. The pool retries once on transient connection-pooler errors.

Adding a feature on Supabase-managed tables → use the JS client. Adding to USPTO trademark search → use `queryRows`/`queryOne` from `lib/db/postgres.ts`.

### Auth & RBAC: defense in depth

Roles live in `profiles.role` (`'user' | 'admin'`, default `'user'`). Admin gating happens at **four** layers — when adding admin functionality, wire all four:

1. **Middleware** (`middleware.ts`) — refreshes Supabase session, redirects unauthenticated users to `/login`, blocks non-admins from `/admin/*`. Public routes are listed in `publicRoutes`; the matcher excludes `_next/*` and image extensions.
2. **Server component guard** (`app/(admin)/layout.tsx`) — calls `requireAdmin()` from `lib/auth.ts` on every render.
3. **API guard** (`lib/api-middleware.ts::verifyAdminApi`) — call at the top of every `/api/admin/*` route; check the result with `isErrorResponse` and return it directly if so.
4. **Postgres RLS** — policies use the SQL helper `is_admin()` (see `supabase-rbac-migration.sql`). The service-role client (`createAdminClient`) bypasses RLS — only use it in cron routes / admin tasks where bypass is intentional.

### Route groups

- `app/(site)/*` — public/auth-walled user surface (`/`, `/search`, `/portfolio`, `/monitor`, `/profile`, `/pricing`, `/blog`, `/docs`, `/contact`, `/payment`, `/subscriptions`, `/register`).
- `app/(admin)/admin/*` — admin dashboard (`/admin`, `/admin/brands`, `/admin/contacts`, `/admin/trademarks`); separate layout enforces `requireAdmin()`.
- `app/api/*` — route handlers. `/api/admin/*` requires `verifyAdminApi`. `/api/cron/*` requires `Authorization: Bearer ${CRON_SECRET}`.

### Cron jobs (Vercel)

`vercel.json` schedules:
- `/api/cron/uspto-daily` at `0 6 * * *` UTC — runs `lib/uspto/runDailyImport.ts` (downloads latest TRTDXFAP file, parses XML, batches into `trademarks` via `BatchAccumulator`).
- `/api/cron/watchlists-daily` at `0 8 * * *` UTC — runs `lib/watchlists/runWatchlistCheck.ts`, sends alert emails via Resend.

Routes use Node runtime and can run up to 300s. The standalone scripts under `scripts/uspto/` (download, parse, db-ops) are also the source of truth used by `lib/uspto/runDailyImport.ts` — keep them in sync. Downloaded zips land in `./downloads/` with a `.download.lock` guard against concurrent runs; old zips are pruned to keep the 3 most recent by default.

### Trademark search pipeline

Three offices, three strategies:
- **USPTO**: ingested locally → `trademarks` table. Search at `/api/trademarks/search` runs SQL with `pg_trgm` similarity scoring. Brand text is normalized via `lib/normalizeBrandText.ts` (uppercase, leetspeak `0→O`/`1→I`/`5→S`/`8→B` mapping) before query and on ingest.
- **IP Australia**: queried live via OAuth2 (`lib/ipaustralia/{client,search,types}.ts`); token caching is in `client.ts`.
- **EUIPO**: queried live over the IBM API gateway (`lib/euipo/{client,search,types}.ts`). Token endpoint is hit with HTTP Basic (`EUIPO_API_KEY`:`EUIPO_API_SECRET`) and `scope=uid`; the bearer token is cached until 80% of `expires_in`. Search calls send `X-IBM-Client-Id` + `Authorization: Bearer <token>` (no client secret) to `/trademarks?query=wordMarkSpecification.verbalElement==*<term>*&page=0&size=…`. Results are tagged `office: 'EUIPO'` and rendered with an EU badge.

Both `/api/trademarks/search` and `/api/trademarks/multi-search` fan out to all three providers via `Promise.allSettled`. **USPTO failures are hard-fail** (the route throws); IP Australia and EUIPO are **soft-fail** — failures are logged via `console.error` and surfaced in the response `warnings[]`. OCR-driven flow: image → `lib/imagePreprocessing.ts` → `lib/googleVision.ts` (text detection) → `lib/queryGeneration.ts` (candidate queries with stopword filtering) → multi-search.

### Payments

Two providers run in parallel against the same `transactions` table; the `provider` column ('stripe' | 'areeba') distinguishes rows.

- **Stripe** (existing): `app/api/payments/create-checkout/route.ts`, `app/api/webhooks/stripe/route.ts`. Subscription/recurring model.
- **Areeba**: `lib/areeba/{config,client,hash,reconcile,types}.ts`, `app/api/payments/initiate/route.ts`, `app/api/payments/areeba/callback/route.ts`, `app/api/payments/[ref]/route.ts`, `app/api/payments/[ref]/reconcile/route.ts`, `app/(site)/payment/result/page.tsx`. One-time charge per billing period; on success, creates a `subscriptions` row with `current_period_end = now + 1 month or 1 year`.

**Areeba load-bearing contracts — do not weaken:**
1. **GET `/api/rest/.../order/{id}` is the source of truth** (per Areeba's own guidance). The webhook is unreliable and treated as log-only; status transitions live exclusively inside `lib/areeba/reconcile.ts::reconcileTransaction`. That helper is idempotent, no-ops on terminal status, and validates returned `amount`/`currency` against the stored values before transitioning.
2. **Hash secret is forensic-only.** `verifyAreebaHash` runs against webhook payloads (when `AREEBA_HASH_SECRET` is set) and the boolean is logged inside `raw_response`. It does not drive `pending → succeeded|failed` decisions. If Areeba ever reverses guidance, gating logic is one branch in `reconcileTransaction`.
3. **`createAreebaSession` requires `AREEBA_API_PASSWORD`.** Generated from the merchant dashboard at `https://epayment.areeba.com/ma/login.s`. Until set, initiate returns 501 `GATEWAY_NOT_CONFIGURED`. `AREEBA_GATEWAY_BASE_URL` and `AREEBA_API_VERSION` default to `https://epayment.areeba.com` and `100` respectively — override only if the integration doc says otherwise.
6. **Hosted-checkout redirect uses the JS SDK, not a URL.** There is no static `/checkout.html` to direct-redirect to — that path 404s on Areeba's gateway and falls back to the HPF help page. `/api/payments/initiate` returns `{ sessionId, checkoutScriptUrl }`; the frontend (`subscriptions/page.tsx`) loads the SDK and calls `Checkout.configure({ session: { id }})` then `Checkout.showPaymentPage()`, which performs the page-level redirect. **For API version ≥ 63** the SDK URL is `<gateway>/static/checkout/checkout.min.js` (we're on v100); the legacy `/checkout/version/<V>/checkout.js` returns the runtime error "The URL of checkout.js has moved." See `areebaCheckoutScriptUrl()` in `lib/areeba/client.ts`.
7. **`apiOperation` MUST be `INITIATE_CHECKOUT`.** Areeba's `/api/rest/version/100` rejects the modern `CREATE_CHECKOUT_SESSION` with `INVALID_REQUEST` (verified empirically against MID `test222208365001`). Don't "modernize" this op name — sessions created via `INITIATE_CHECKOUT` are still accepted by `Checkout.configure()` on the frontend.
4. **Idempotency**: UNIQUE index on `transactions.transaction_reference` + status guard inside reconcile.
5. **Amount is always computed server-side** from `subscription_plans.price`. Frontend POSTs `{ planSlug, billingCycle }` only — never a price.

Result-page flow: `/payment/result?ref=<uuid>` POSTs `/api/payments/[ref]/reconcile` on mount (forces a GET against Areeba and updates the row), then GETs `/api/payments/[ref]` to render. Both are auth-gated and ownership-checked.

DB migration: `supabase-areeba-migration.sql` (extends `transactions`, adds enum values `pending_verification` / `cancelled`, seeds Starter/Growth/Enterprise plans). Apply via Supabase SQL Editor. `pending_verification` is reserved for future use; the GET-as-truth flow doesn't currently transition rows into it.

### Visual similarity

`lib/imageEmbeddings.ts` lazy-loads CLIP (`Xenova/clip-vit-base-patch16`) via `@xenova/transformers` to produce 512-d embeddings. `/api/logo-similarity` and the watchlist visual-hits flow compare embeddings. The model loads once per process — first request is slow.

### Path alias

`@/*` → repo root (`tsconfig.json`). Use `@/lib/...`, `@/components/...`.

## Conventions worth knowing

- Use `createClient` from `lib/supabase/server.ts` inside RSCs/route handlers (it `await`s `cookies()`); use `lib/supabase/client.ts` only in `'use client'` components.
- The middleware's `getUser()` call **must** stay before any branching — Supabase SSR docs are explicit that this is what refreshes the session cookie.
- A handful of in-repo `.sql` files (`supabase-schema.sql`, `supabase-rbac-migration.sql`, `supabase-referral-migration.sql`, `uspto-trademark-schema.sql`, `portfolio-schema.sql`, `hybrid-similarity-v2.sql`, etc.) are the canonical schema/migrations — apply them via the Supabase SQL Editor. There is no migration tool; ordering is manual.
- The repo has many `*.txt` design docs at the root (`RBAC-*.txt`, `ADMIN-*.txt`, `AUTH-REDESIGN.txt`, `BACKEND-SETUP.txt`, `API-REFERENCE.txt`, `HOW-TO-RUN.txt`). They predate code in places — prefer reading the actual source, but check them for intent when a piece of architecture isn't obvious.

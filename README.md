# Nuxt Auth Starter

Nuxt 4 starter with a public UI shell and a Better Auth server backed by Drizzle/Neon. Phase 3 adds the initial migration and live auth tests; email delivery, Google and production authentication policy remain Phase 4 work in the [roadmap](docs/roadmap/roadmap.md). See [auth setup and test commands](docs/current/auth.md).

## Setup

Use Node **24**, at least **24.11.0**; `.nvmrc` records the tested patch **24.21.0**. Use the same Node major in development, CI and Vercel. With nvm-windows, run `nvm install 24.21.0` and `nvm use 24.21.0`; with POSIX nvm, run `nvm install` and `nvm use`.

Install the pinned [pnpm](https://pnpm.io/installation), then install the locked dependencies:

```sh
npm install --global pnpm@12.3.4
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in a POSIX shell). Leave service values blank when working only on the public shell.

```sh
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm preview
```

Development uses `http://localhost:3000`. Installation runs `nuxt prepare` through `postinstall`. The lockfile and `packageManager` pin make installation reproducible. `pnpm-workspace.yaml` permits only the existing esbuild, unrs-resolver and vue-demi dependency build scripts; its existing `@lucide/vue@1.42.0` release-age exception is retained.

## Private configuration

All seven keys live outside `runtimeConfig.public`. [Nuxt runtime overrides](https://nuxt.com/docs/4.x/getting-started/configuration) use the matching `NUXT_*` names at runtime; no secrets are assigned from other variables at build time.

| Variable | Purpose and validation boundary |
| --- | --- |
| `NUXT_DATABASE_URL` | PostgreSQL/Neon URL (`postgres://` or `postgresql://` with a host). Required when Nuxt server database functionality is used; mirrors pooled `DATABASE_URL`. |
| `NUXT_BETTER_AUTH_SECRET` | Independently generated random secret, at least 32 characters; required when auth initializes. Generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Validation checks length, not randomness. |
| `NUXT_BETTER_AUTH_URL` | Canonical app origin; no credentials, path other than `/`, query or fragment. HTTPS required except `http://localhost` during development. |
| `NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET` | Required by `server/auth/providers/google.ts` when composed into Better Auth (Phase 4). |
| `NUXT_RESEND_API_KEY`, `NUXT_EMAIL_FROM` | Required by `server/email/providers/resend.ts` when delivery is initialized (Phase 4). Sender is an email address or `App <verified@example.com>`. |

`server/database/config.ts` owns `parseDatabaseConfig`; `server/auth/config.ts` owns `parseAuthConfig`. Each domain parses its own schema and reuses only sanitized error formatting from `server/utils/config-error.ts`. Google owns its strict provider configuration in `server/auth/providers/google.ts`; Resend owns `parseResendConfig` in `server/email/providers/resend.ts`. The server auth utility passes `useRuntimeConfig(event)` to the relevant parsers before assembling Better Auth; auth callers also pass `import.meta.dev`. Each parser checks only its functionality. Errors identify variable names without including values or raw Zod errors. No startup plugin validates unused services, and builds and the public homepage require no credentials. The parsers themselves do not establish connections or initialize Better Auth.

Better Auth explicitly receives the parsed secret and base URL: these renamed variables are not Better Auth's automatic defaults. The mounted endpoint is `/api/auth`; no public auth URL or cross-origin cookie configuration is needed. Set a local development secret and `NUXT_BETTER_AUTH_URL=http://localhost:3000` to use it locally. Phase 4 must require the settings for enabled Google/email methods rather than silently disabling them.

## Local, preview and production

| Environment | App origin | Services and secrets |
| --- | --- | --- |
| Local | `http://localhost:3000` | Isolated development database, development auth secret, development Google credentials and test sender/recipients. |
| Preview | Controlled, stable HTTPS preview hostname | Separate preview database target and auth secret, preview Google credentials and verified test sender. |
| Production | Eventual canonical HTTPS production origin | Production database target and independent auth secret, production Google credentials and verified production sender. |

Populate the same variable names with environment-specific values. Nuxt development/build and local `pnpm preview` load `.env`; standalone built output (`node .output/server/index.mjs`) receives settings from its process environment and does not load `.env`. On Vercel, configure Development, Preview and Production scopes separately in [environment settings](https://vercel.com/docs/environment-variables). `pnpm preview` is a local build check, distinct from a Vercel Preview deployment. Environment files are ignored except `.env.example`.

Use a stable, controlled preview hostname for complete OAuth testing. Arbitrary preview URLs are not automatically trusted. Register Google's callback against each exact origin during Phases 4/9. This phase documents conventions; it does not provision databases, domains, credentials or deployments.

## Database tooling and email plan

2026-09-10 02:36 — Neon development setup

Local CLI `neon@4.14.3` is used through `pnpm exec neon ...`. `.neon` links this repository to project `ancient-water-37006854`, branch `dev` (`br-green-sky-zadolgsg`). Local development uses `.env` with `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH=dev`; `.env.local` is no longer used. Retain both `DATABASE_URL` and `NUXT_DATABASE_URL` without renaming or normalization. Nuxt and Drizzle load `.env` by default. `.env.production` is an ignored local reference only; Vercel owns actual Preview/Production values.

The installed `neon`, `neon-postgres`, `neon-postgres-branches` and `neon-object-storage` skills came from `pnpm exec neon skills`; use that command if more are needed. Authentication remains self-hosted Better Auth, with no Neon Auth. Do not introduce `neon config init`, `neon.ts`, `neon deploy` or `@neon/config`. See [database state](docs/current/database.md) for remaining verification and the template's branch-value distinction.

Drizzle Kit runs outside Nuxt: `drizzle.config.ts` loads `dotenv/config` and reads **`DATABASE_URL_UNPOOLED`** directly. Neon-managed `DATABASE_URL` and `DATABASE_URL_UNPOOLED` coexist with `NUXT_DATABASE_URL`; keep the duplication for now. No automatic alias mapping or shared Nuxt configuration abstraction is implemented. Dotenv loads the root `.env` by default; supplied process variables take precedence. For another local file, set `DOTENV_CONFIG_PATH` in the invoking process; for controlled deployment tooling, inject the target environment's variables explicitly.

Configuration includes `dbCredentials` only when the direct URL is nonempty. Kit owns command-specific credential checks; credential-free generation needs no custom command detection. Malformed values may fail in the driver. The generated auth schema and initial migration use the existing schema and migration paths. The production workflow remains schema → generate → review/commit → migrate; `push` is for appropriate development use only.

The established email plan is the [Resend HTTP API](https://resend.com/docs/api-reference/emails/send-email), using the existing server fetch stack in Phase 4. No SDK is needed now. Before sending, configure a verified sender and controlled test recipients. Provider verification, delivery and enabled-method checks belong to Phase 4.

See [current project state](docs/current/project-state.md) for validation evidence and remaining work. `pnpm test:run` requires explicit disposable database settings; it runs parser tests and live Nitro authentication tests. See [test commands and target checks](docs/current/auth.md#test-target-and-commands).


2026-09-10 14:38 — Phase 2 complete: live dev connectivity, identity/permissions, empty schema, failure handling and runtime/client privacy checks passed. No tables or migrations were created. See [database validation](docs/current/database.md#validation).

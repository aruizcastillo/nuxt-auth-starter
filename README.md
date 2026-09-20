# Nuxt Auth Starter

## Project overview

A reusable Nuxt 4 starter with a public application UI and a server-side Better Auth foundation backed by Drizzle and Neon Postgres.

The current implementation includes the Better Auth server endpoint, core auth schema, and reviewed initial migration. It does not yet include sign-in/account pages, email verification or password-recovery delivery, Google OAuth, protected application pages, or a production-ready authentication policy. Those remain planned work in the [roadmap](docs/roadmap/roadmap.md).

## Requirements

* Node.js `>=24.11.0 <25`
* pnpm `12`
* A Neon account with an isolated Postgres development branch/database

Tested with Node `24.21.0` and pnpm `12.3.4`.

> `.nvmrc` pins the tested Node version, while the `packageManager` field in `package.json` pins the project's pnpm version for reproducible installs.

With nvm:

```sh
nvm install 24
nvm use 24
```

Install the tested pnpm version:

```sh
npm install --global pnpm@12.3.4
```

## Quick start

1. Clone the repository and enter it:

   ```sh
   git clone https://github.com/aruizcastillo/nuxt-auth-starter.git
   cd nuxt-auth-starter
   ```

2. Install exactly the locked dependency graph:

   ```sh
   pnpm install --frozen-lockfile
   ```

   Installation also runs `nuxt prepare` through the `postinstall` script.

3. Create the local environment file:

   ```sh
   cp .env.example .env
   ```

4. Create or select an isolated development database in Neon, then complete `.env` as described in [Environment configuration](#environment-configuration) and [Database setup](#database-setup).

5. Apply the committed migrations:

   ```sh
   pnpm db:migrate
   ```

6. Start the development server:

   ```sh
   pnpm dev
   ```

7. Open `http://localhost:3000`.

The public pages can start with empty service values, but the database and auth endpoint are not usable until the required local values below are configured and the migration is applied.

## Environment configuration

Keep local secrets in `.env`; environment files other than `.env.example` are ignored by Git. Do not commit credentials.

The minimal usable local database/auth setup requires `NUXT_DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NUXT_BETTER_AUTH_SECRET`, and `NUXT_BETTER_AUTH_URL`. The template contains these database and auth settings:

| Variable | Requirement |
| --- | --- |
| `NUXT_DATABASE_URL` | Required for server database/auth requests. Use the Neon pooled connection string. |
| `DATABASE_URL` | Not read by the application or Drizzle Kit. Configure it when using Neon tooling that expects the standard pooled URL, and keep it identical to `NUXT_DATABASE_URL`. |
| `DATABASE_URL_UNPOOLED` | Required by Drizzle Kit for migrations and other database commands. Use the direct connection string for the same database. |
| `NEON_BRANCH` | Not read by the application or migration command. Set it to the selected branch name when using target-aware Neon/test tooling. |
| `NUXT_BETTER_AUTH_SECRET` | Required when the auth endpoint initializes. Use an independently generated random secret of at least 32 characters. |
| `NUXT_BETTER_AUTH_URL` | Required when the auth endpoint initializes. Use `http://localhost:3000` locally. Non-local origins must use HTTPS. |

Generate a secure Better Auth secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set the result as `NUXT_BETTER_AUTH_SECRET`.

The following pairs are reserved for Phase 4 and should remain blank for the current implementation:

| Variables | When required |
| --- | --- |
| `NUXT_DATABASE_URL` | PostgreSQL/Neon URL (`postgres://` or `postgresql://` with a host). Required when Nuxt server database functionality is used; mirrors pooled `DATABASE_URL`. |
| `NUXT_BETTER_AUTH_SECRET` | Independently generated random secret, at least 32 characters; required when auth initializes. Generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Validation checks length, not randomness. |
| `NUXT_BETTER_AUTH_URL` | Canonical app origin; no credentials, path other than `/`, query or fragment. HTTPS required except `http://localhost` during development. |
| `NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET` | Required by `server/auth/providers/google.ts` when composed into Better Auth (Phase 4). |
| `NUXT_RESEND_API_KEY`, `NUXT_EMAIL_FROM` | Required by `server/email/providers/resend.ts` when delivery is initialized (Phase 4). Sender is an email address or `App <verified@example.com>`. |

`server/database/config.ts` owns `parseDatabaseConfig`; `server/auth/config.ts` owns `parseAuthConfig`. Each domain parses its own schema and reuses only sanitized error formatting from `server/utils/config-error.ts`. Google owns its strict provider configuration in `server/auth/providers/google.ts`; Resend owns `parseResendConfig` in `server/email/providers/resend.ts`. The server auth utility passes `useRuntimeConfig(event)` to the relevant parsers before assembling Better Auth; auth callers also pass `import.meta.dev`. Each parser checks only its functionality. Errors identify variable names without including values or raw Zod errors. No startup plugin validates unused services, and builds and the public homepage require no credentials. The parsers themselves do not establish connections or initialize Better Auth.

All `NUXT_*` settings are private Nuxt runtime configuration. For local `dev`, `build`, and `preview`, Nuxt loads `.env`. A standalone built server receives these values from its process environment.

## Database setup

1. Create a project in the [Neon dashboard](https://console.neon.tech/) and create or select an isolated development branch.

2. Authenticate the local Neon CLI and link this repository to the project:

```sh
pnpm exec neon auth
pnpm exec neon link
```

3. Select the development branch:

```sh
pnpm exec neon checkout dev
```

4. Pull the database environment variables into `.env`:

```sh
pnpm exec neon env pull --file .env --env DATABASE_URL --env DATABASE_URL_UNPOOLED --env NEON_BRANCH
```

The pull preserves the other entries in `.env`.

Copy the pooled `DATABASE_URL` value to `NUXT_DATABASE_URL`. Neon does not manage this Nuxt-specific variable.

Ensure `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NUXT_DATABASE_URL` reference the intended Neon database and branch before applying migrations.

5. Apply the committed migrations:

```sh
pnpm db:migrate
```

Drizzle Kit reads `DATABASE_URL_UNPOOLED` directly from `.env`, while the Nuxt server uses `NUXT_DATABASE_URL`.

For future schema changes, use the reviewed workflow:

1. Change the typed schema under `server/database/schema/`.
2. Run `pnpm db:generate`.
3. Review and commit every generated SQL and metadata artifact.
4. Run `pnpm db:migrate` against the explicitly selected target.

Do not rewrite an applied migration. `pnpm db:push` is for appropriate development use only and is not the production migration workflow. See [database documentation](docs/current/database.md#migration-procedure) for operational detail.

## Authentication setup

Set `NUXT_BETTER_AUTH_SECRET` and `NUXT_BETTER_AUTH_URL`, configure the database variables, and apply the migration. The Better Auth handler is then mounted at `/api/auth` and stores users, sessions, accounts, and verification records in Postgres.

This is the completed server foundation from Phase 3, not a finished authentication product. Basic email/password behavior exists for backend lifecycle validation, but there is no auth UI, email delivery, verified-email access policy, recovery flow, Google provider, protected application route, or production hardening yet. Do not advertise or deploy those Phase 4+ capabilities as complete. See [current auth state](docs/current/auth.md) and [Phase 4](docs/roadmap/phase4.md).

The default password policy is 8–128 characters. It follows modern password-security guidance by supporting long passphrases, avoiding composition rules, preserving whitespace, and not silently truncating passwords. Applications with stricter assurance requirements may increase the minimum length or require MFA.

## Development and validation commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Nuxt development server. |
| `pnpm lint` | Run ESLint across the repository. |
| `pnpm typecheck` | Run Nuxt/Vue TypeScript checks. |
| `pnpm exec vitest run --project unit` | Run database-independent configuration tests. |
| `pnpm test` | Run Vitest in watch mode. |
| `pnpm test:run` | Run all tests once, including live database auth tests. See the constraint below. |
| `pnpm build` | Create the production build. |
| `pnpm preview` | Preview a completed production build locally. |
| `pnpm db:generate` | Generate a migration from schema changes. |
| `pnpm db:migrate` | Apply committed migrations using `DATABASE_URL_UNPOOLED`. |
| `pnpm db:push` | Push schema changes directly for deliberate development-only use. |
| `pnpm db:studio` | Open Drizzle Studio for the configured database. |

Run the reproducible local checks with:

```sh
pnpm lint
pnpm typecheck
pnpm exec vitest run --project unit
pnpm build
```

`pnpm test:run` includes live auth tests that create and remove accounts. Before running it, provision a separate disposable Neon test branch, migrate it, configure its test environment values, and make sure `test/helpers/auth.ts` explicitly recognizes that exact target. The guard intentionally rejects arbitrary database URLs, so a fresh clone cannot enable the live suite through environment configuration alone. Never point it at development or production. See the [test-target procedure](docs/current/auth.md#test-target-and-commands) for the required variables and commands.

There is currently no Markdown-specific validation script.

## Deployment

`pnpm build` produces the current server build, and `pnpm preview` runs it locally. Vercel with Neon is the intended hosting path, but a verified production deployment workflow is not yet complete.

Vercel deployments must configure the required variables separately for Development, Preview, and Production, using isolated database targets, independent auth secrets, and the correct canonical HTTPS `NUXT_BETTER_AUTH_URL` for each environment. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

The controlled production migration step, provider callbacks, production security checks, and recovery procedures remain [Phase 9 work](docs/roadmap/phase9.md). Do not treat the starter as reproducibly production-deployable until that work is complete.

## Further documentation

- [Current project state](docs/current/project-state.md) — implemented stack, architecture, compatibility notes, and validation evidence.
- [Database foundation](docs/current/database.md) — database integration, environment conventions, migration policy, and operational evidence.
- [Better Auth server](docs/current/auth.md) — current auth implementation, schema generation, live-test boundary, and validation evidence.
- [Roadmap](docs/roadmap/roadmap.md) — completed phases, incomplete functionality, dependencies, and production definition of done.
- [Phase 3 validation record](docs/reference/phase-3-auth-database-validation.md) — detailed migration and auth-server verification history.

# Nuxt Auth Starter

## Project overview

A reusable Nuxt 4 starter with a public application UI and a server-side Better Auth foundation backed by Drizzle and Neon Postgres.

The current implementation includes the Better Auth server endpoint, core auth schema, and reviewed initial migration. It does not yet include sign-in/account pages, email verification or password-recovery delivery, Google OAuth, protected application pages, or a production-ready authentication policy. Those remain planned work in the [roadmap](docs/roadmap/roadmap.md).

The public shell lives in `app/`, with an index page, default layout and generated shadcn-vue components under `app/components/ui/`. English and Spanish messages live in `i18n/locales/`; routing uses `no_prefix`, English as default, and root-only browser detection with the `i18n_redirected` cookie. The HTML language follows the active locale. Tailwind 4 styles and theme tokens live under `app/assets/styles/`; the app currently fixes light styling and mounts a global toaster. The homepage, external header link and public sitemap/robots origin still contain starter placeholders. Forms, a locale switcher and theme controls are not implemented.

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

The following integrations are not yet connected; leave their values blank until implementing the corresponding roadmap work:

| Variables | Purpose |
| --- | --- |
| `NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET` | Google OAuth credentials; both are required by the provider module when composed into auth. |
| `NUXT_RESEND_API_KEY`, `NUXT_EMAIL_FROM` | Resend credentials and sender (`App <verified@example.com>` or an email address); validated by the provider module when used. Delivery is not implemented. |

See [authentication configuration](docs/authentication.md#configuration-boundaries) for validation behavior and [deployment](docs/deployment.md#environment-isolation) for runtime loading and environment isolation.

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

For schema changes, follow the [database migration procedure](docs/database.md#migration-procedure) and [versioned migration policy](docs/decisions/004-versioned-migrations.md).

## Authentication setup

Set `NUXT_BETTER_AUTH_SECRET` and `NUXT_BETTER_AUTH_URL`, configure the database variables, and apply the migration. The Better Auth handler is then mounted at `/api/auth` and stores users, sessions, accounts, and verification records in Postgres.

See [authentication](docs/authentication.md) for current credential behavior and limitations, and the [roadmap](docs/roadmap/roadmap.md#phase-4) for email delivery, verification, recovery, Google and authorization work.

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

`pnpm test:run` creates and removes test accounts. Follow the [disposable test-target procedure](docs/testing.md#test-target-and-commands) before running it; a fresh clone needs deliberate allowlist configuration as well as environment values.

## Deployment

Build with `pnpm build` and inspect it locally with `pnpm preview`. See [deployment](docs/deployment.md) for current support and environment requirements; the production release workflow remains [planned](docs/roadmap/roadmap.md#phase-9).

## Further documentation

- [Authentication](docs/authentication.md) — server integration, credential behavior and configuration boundaries.
- [Database](docs/database.md) — persistence, schema generation and migration procedure.
- [Testing](docs/testing.md) — test projects, coverage and disposable-target setup.
- [Deployment](docs/deployment.md) — build support and environment isolation.
- [Roadmap](docs/roadmap/roadmap.md) — unfinished functionality and production acceptance criteria.
- Architectural decisions: [Better Auth](docs/decisions/001-better-auth.md), [Neon HTTP](docs/decisions/002-neon-http.md), [cookie cache](docs/decisions/003-cookie-cache-disabled.md), [versioned migrations](docs/decisions/004-versioned-migrations.md).

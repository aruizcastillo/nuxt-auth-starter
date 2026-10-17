# Nuxt Auth Starter

## Project overview

A reusable Nuxt 4 starter with a public application shell and server-side authentication powered by Better Auth, Drizzle and PostgreSQL.

Neon is the default PostgreSQL provider, but the database layer is structured so another PostgreSQL client can be used without changing the schema, migrations or authentication model.

The current implementation includes the Better Auth server endpoint, auth schema, initial migration, and email verification and password recovery, using Resend as the reference email provider.

The first version focuses on email/password, email verification, password recovery, sessions and server-side authorization. Sign-in and account pages, verification/recovery screens, protected application pages and the remaining authorization/security work are pending in the [roadmap](docs/roadmap/roadmap.md).

The frontend uses shadcn-vue, Tailwind CSS 4 and Nuxt i18n. English and Spanish are currently configured.

## Requirements

- Node.js 24
- pnpm 12
- PostgreSQL

> The included database client and setup workflow use Neon. See [Using another PostgreSQL provider](#using-another-postgresql-provider) if you want to use a different PostgreSQL provider.

Tested with Node `24.21.0` and pnpm `12.3.4`.

Install Node.js if needed. With nvm:

```sh
nvm install 24
nvm use 24
```

Install pnpm if needed:

```sh
npm install --global pnpm@12.3.4
```

## Quick start

1. Clone the repository:

   ```sh
   git clone https://github.com/aruizcastillo/nuxt-auth-starter.git
   cd nuxt-auth-starter
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create the local environment file:

   ```sh
   cp .env.example .env
   ```

4. Configure PostgreSQL, Better Auth and email delivery (Resend by default) as described in [Environment configuration](#environment-configuration) and [Database setup](#database-setup).

5. Apply the migrations:

   ```sh
   pnpm db:migrate
   ```

6. Start the development server:

   ```sh
   pnpm dev
   ```

7. Open `http://localhost:3000`.

## Environment configuration

Local secrets belong in `.env`. Environment files other than `.env.example` are ignored by Git.

The current database and auth setup uses:

| Variable | Purpose |
| --- | --- |
| `NUXT_DATABASE_URL` | Runtime database connection used by Nuxt and Better Auth. Use the pooled connection string. |
| `DATABASE_URL` | Standard pooled Neon URL used by Neon tooling. Keep it aligned with NUXT_DATABASE_URL. |
| `DATABASE_URL_UNPOOLED` | Direct database connection used by Drizzle Kit for migrations and database commands. |
| `NEON_BRANCH` | Selected Neon branch used by Neon/test tooling. |
| `NUXT_BETTER_AUTH_SECRET` | Better Auth secret. Use a random value of at least 32 characters. |
| `NUXT_BETTER_AUTH_URL` | Application origin used by Better Auth. Use `http://localhost:3000` locally. |
| `NUXT_RESEND_API_KEY` | Sending key for the reference Resend transport. |
| `NUXT_EMAIL_FROM` | Email sender authorized by the chosen provider, as `sender@example.com` or `App <sender@example.com>`. |

Generate a Better Auth secret with:

```sh
pnpm auth:secret
```

The CLI generates a `BETTER_AUTH_SECRET` entry. Copy its value into `NUXT_BETTER_AUTH_SECRET` in your `.env` file.

For the included Resend transport, configure a sending key and an authorized sender in [Resend](https://resend.com/docs/dashboard/domains/introduction). Use a controlled recipient when testing; Resend's test sender restricts recipients. Both values are required when starting the production server. In Nuxt development, both may be empty to work without sending mail; partial or invalid settings fail initialization. Credentials stay enabled and require verification: registration without a transport can leave a pending account that cannot sign in. Auth schema tooling does not require email settings.

Resend is the reference email provider. Other providers can be integrated by replacing the email transport and its configuration without changing Better Auth or background execution. See the [email transport boundary](docs/authentication.md#isolated-email-transport) for replacement details.

Background delivery targets Nitro development and persistent Node servers. Serverless support, including Vercel, needs a later lifecycle adaptation and validation; see [deployment](docs/deployment.md#background-tasks).

See [authentication](docs/authentication.md) for configuration details and [deployment](docs/deployment.md) for environment isolation.

## Database setup

PostgreSQL is required. Neon is only the reference provider included with the starter.

### Neon

1. Create a project in the [Neon dashboard](https://console.neon.tech/) and create or select a development branch.

2. Authenticate the Neon CLI and link the repository:

   ```sh
   pnpm exec neon auth
   pnpm exec neon link
   ```

3. Select the development branch:

   ```sh
   pnpm exec neon checkout dev
   ```

4. Pull the Neon environment variables:

   ```sh
   pnpm exec neon env pull --file .env --env DATABASE_URL --env DATABASE_URL_UNPOOLED --env NEON_BRANCH
   ```

5. Copy the pooled `DATABASE_URL` value to `NUXT_DATABASE_URL`.

6. Apply the migrations:

   ```sh
   pnpm db:migrate
   ```

Drizzle Kit uses `DATABASE_URL_UNPOOLED`, while the Nuxt server uses `NUXT_DATABASE_URL`.

For schema changes, follow the [database migration procedure](docs/database.md#migration-procedure) and [versioned migration policy](docs/decisions/004-versioned-migrations.md).

### Using another PostgreSQL provider

Neon is the reference implementation, not a requirement of the application architecture.

To use another PostgreSQL provider:

1. Replace `server/database/providers/neon.ts` with a Drizzle-compatible PostgreSQL client for your runtime.
2. Update `server/database/index.ts` to export the new `createDatabase` implementation.
3. Provide the corresponding runtime and migration connections through `NUXT_DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
4. Review driver-specific behavior, including the Better Auth adapter's `transaction: false` setting.
5. Adapt provider-specific tooling, deployment and test setup.

The schema, relations, migrations and Better Auth PostgreSQL integration should remain unchanged.

The current Neon implementation uses the HTTP driver for stateless, serverless-friendly database access. See [ADR 002](docs/decisions/002-neon-http.md) for the reasoning and transaction constraints.

## Authentication setup

Better Auth is exposed at `/api/auth` and stores users, sessions, accounts and verification records in PostgreSQL. Follow the environment and database setup above.

See [authentication](docs/authentication.md) for credential verification, reset-session revocation and the session helper, [Phase 4](docs/roadmap/roadmap.md#phase-4) for pending endpoint authorization/input work, and [Phase 9](docs/roadmap/roadmap.md#phase-9) for real email/deployment acceptance.

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server. |
| `pnpm lint` | Run ESLint. |
| `pnpm typecheck` | Run Nuxt/Vue TypeScript checks. |
| `pnpm test` | Run Vitest in watch mode. |
| `pnpm test:run --project unit` | Run database-independent unit tests for quick feedback. |
| `pnpm test:run` | Run the complete suite, including the HTTP tests' internal build. |
| `pnpm build` | Create a production build. |
| `pnpm preview` | Preview the production build locally. |
| `pnpm db:generate` | Generate migrations from schema changes. |
| `pnpm db:migrate` | Apply committed migrations. |
| `pnpm db:push` | Push schema changes directly for development use. |
| `pnpm db:studio` | Open Drizzle Studio. |

Choose checks using [validation scope](docs/testing.md#validation-scope). The full suite requires an isolated [test database](docs/testing.md#test-target-and-commands).

## Deployment

Build the application with:

```sh
pnpm build
```

and preview it locally with:

```sh
pnpm preview
```

The reference deployment target is Vercel with Neon PostgreSQL.

See [deployment](docs/deployment.md) for the current environment requirements. The complete production deployment workflow is covered by [Phase 9](docs/roadmap/roadmap.md#phase-9).

### Build performance on Windows

Production builds on Windows are affected by a [known Nitro 2 performance issue](https://github.com/nuxt/nuxt/issues/34753) involving dependency resolution and file tracing.

The project retains Nuxt 4 / Nitro 2 and Nitro's default dependency tracing. See [planned maintenance](docs/roadmap/roadmap.md#planned-maintenance) for the future migration to Nuxt 5 / Nitro 3 and its compatibility conditions.

## Documentation

- [Authentication](docs/authentication.md) — authentication behavior and configuration.
- [Database](docs/database.md) — database integration, schema and migrations.
- [Testing](docs/testing.md) — test structure and disposable database setup.
- [Deployment](docs/deployment.md) — build and environment configuration.
- [Roadmap](docs/roadmap/roadmap.md) — remaining work and production acceptance criteria.
- Architectural decisions:
  - [Better Auth](docs/decisions/001-better-auth.md)
  - [Neon HTTP](docs/decisions/002-neon-http.md)
  - [Cookie cache](docs/decisions/003-cookie-cache-disabled.md)
  - [Versioned migrations](docs/decisions/004-versioned-migrations.md)
  - [Background execution](docs/decisions/005-background-tasks.md)

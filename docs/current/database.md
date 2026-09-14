# Database foundation

2026-09-10 15:54 — Phase 3 core auth migration applied after disposable validation

The generated migration `20260910134024_bumpy_baron_strucker` is applied to `dev` and `test-phase3`, with matching catalogs/history and idempotent reruns. Only the migration changed dev; all credential-flow tests ran on the disposable branch. See [auth validation](auth.md#validation-checkpoint). Phase 2 verification below remains historical evidence for the pre-auth foundation.

2026-09-10 14:48 — Completed database foundation and environment convention

`server/database/clients/neon.ts` exports `createDatabase(databaseUrl: string)` with its typed return inferred. It constructs `drizzle({ client: neon(databaseUrl), relations })` with the installed Neon 1.1.0 and Drizzle ORM 1.0.0-rc.4. Phase 3 adds full core-table Relations v2 entries followed by generated auth relation parts. This matches the [official Neon integration](https://orm.drizzle.team/docs/connect-neon) and the installed RC.4 types. It creates no persistent pool or module-global client. Constructing the client does not execute a query.

Server consumers obtain `useRuntimeConfig(event)`, validate it with `parseDatabaseConfig`, and pass its `databaseUrl` to the factory. Runtime lookup stays at the call site. The auth utility uses this same factory and passes the client to Better Auth; no public database probe or startup query exists. Keep database imports under `server/` and never return driver errors or connection objects to clients.

The selected transport is HTTP for one-shot queries. It does not support interactive `db.transaction(callback)`. Better Auth explicitly sets `transaction: false`. See [auth state](auth.md) for the generated schema, migration and disposable integration target.

## Development target

Verified through the authenticated Neon CLI metadata and read-only queries using the existing Drizzle factory:

| Setting | Current value |
| --- | --- |
| Local CLI | `neon@4.14.3`, invoked with `pnpm exec neon ...` |
| Project | `ancient-water-37006854` |
| Active branch | `dev` |
| Branch ID | `br-green-sky-zadolgsg` |
| Endpoint | `ep-patient-mud-zacnbylx` |
| Region | `aws-eu-west-2` (London) |
| Database | `nuxt_auth_starter_db` |
| Role / database owner | `nuxt_auth_starter_db_owner` |
| Repository link | `.neon` |
| Local development environment | `.env` |

## Environment convention

| Location | Purpose |
| --- | --- |
| `.env` | Local development only; loaded by default by Nuxt and the existing Drizzle dotenv integration. Current `NEON_BRANCH` is `dev`. |
| `.env.example` | Committed template: variable names with empty values and no secrets. All values are currently empty, including `NEON_BRANCH`; use `dev` locally. |
| `.env.production` | Optional local-only production reference, ignored and untracked. Never load it by default, commit it, or use it as deployment configuration. |
| Vercel environment configuration | Authoritative values for Preview and Production, scoped separately. |

`NUXT_DATABASE_URL` is the private Nuxt runtime override and mirrors Neon’s pooled `DATABASE_URL`. Neon manages `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (direct) and `NEON_BRANCH`. Both URL names remain intentional; there is no build-time alias mapping. The direct URL is designated for migration tooling. `drizzle.config.ts` reads `DATABASE_URL_UNPOOLED` directly and includes `dbCredentials` only when it is nonempty. Drizzle Kit owns command-specific credential requirements.

The current `.env` contains matching pooled `NUXT_DATABASE_URL`/`DATABASE_URL` and a direct `DATABASE_URL_UNPOOLED`; all three URLs request TLS. `.env.production` has the same arrangement for its production-labelled reference. Live checks matched the development URL to the dev endpoint and verified database identity/permissions. Production reference values were not loaded for these checks.

The installed Neon CLI 4.14.3 help confirms `--file` selects the destination and preserves non-Neon lines. For a future explicit development pull, use:

```sh
pnpm exec neon env pull --project-id ancient-water-37006854 --branch dev --file .env --env DATABASE_URL --env DATABASE_URL_UNPOOLED --env NEON_BRANCH
```

The variable allowlist restricts the pull to the database variables and branch label. After pulling, explicitly synchronize `NUXT_DATABASE_URL` with the new pooled `DATABASE_URL`; Neon does not manage that Nuxt key. Do not pull a production/preview branch into `.env`. This command was verified through installed CLI help, not executed.

Nuxt and Drizzle retain their default `.env` loading. `.env.production` is not automatically loaded by this project's Nuxt/Drizzle setup; do not select it with dotenv flags, source it into a shell, or add loader scripts for it. Existing process variables can override file values, so local shells must not carry production credentials. Built deployment output receives its variables from the deployment environment rather than these local files.

A gitignored plaintext production reference still risks exposure through backups/sync, explicit loading, copying, or forced Git inclusion. It is permitted as a local reference under the stated constraints, but an encrypted password-manager entry is the safer place for production values; a names-only reference avoids keeping another plaintext copy. Vercel remains authoritative either way.

The installed skills are `neon`, `neon-postgres`, `neon-postgres-branches` and `neon-object-storage`, installed with `pnpm exec neon skills`. Use that same command if additional Neon skills are needed later. Skill availability does not mean Object Storage or other Neon services are integrated.

Authentication remains self-hosted Better Auth; Neon Auth is intentionally unused. Do not run or introduce `neon config init`, `neon.ts`, `neon deploy` or `@neon/config`.

The existing non-default `dev` branch has its own endpoint, and its database has no user tables or views. Neon records its original creation as `parent-data`; the current empty database was verified without connecting to the parent or production. Reused the existing London region as instructed; align Vercel compute with it during Phase 9 rather than moving the database in this phase.

The development role owns the database, has database CREATE and public-schema CREATE/USAGE, and is not a superuser. These catalog checks establish the privileges needed for the planned initial migration without testing them through DDL. Actual migration generation/application remains Phase 3. Local non-secret target notes are in ignored `.data/neon-development.md`. Production runtime and elevated migration credentials remain separate Phase 9 concerns.

To rotate development credentials, select the exact project/branch/role and reset that role's password in Neon, then replace the local connection URL. Resetting credentials interrupts connections; verify the target first. See [Neon's role password operation](https://api-docs.neon.tech/reference/resetprojectbranchrolepassword).

One-off checks used the current factory and validated development URL for `select 1`, identity and catalog queries. No query runs on application startup and no diagnostic endpoint was added. Errors were caught and sanitized in the one-off diagnostic process; the factory continues to expose normal driver errors to server callers, which must handle them appropriately when endpoints are introduced.

## Migration procedure

Drizzle Kit 1.0.0-rc.4 owns migration generation and metadata. Its installed types and `generate --help`/`migrate --help` confirm the existing configuration and commands. Keep:

- Schema: `server/database/schema/*.ts`.
- Migrations: `server/database/migrations`.
- Scripts: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio`.

The production workflow is **generate → review SQL and metadata → commit all generated artifacts → migrate**. Before migration, identify the project/branch/endpoint in Neon and compare the selected database/role with the intended target. Confirm backups/recovery arrangements and review destructive statements and data transformations. Kit uses the direct `DATABASE_URL_UNPOOLED` for database access, independently of the private Nuxt runtime override. Kit loads dotenv outside Nuxt and does not share a runtime abstraction with the application.

Let RC.4 generate its own directory and metadata format; do not hand-author snapshots or assume the old 0.x journal layout. Never rewrite a migration already applied to a shared environment. Fix mistakes with reviewed forward migrations. `db:push` is development-only. Do not migrate during requests, imports, builds or function cold starts.

Phase 3 owns initial auth schema generation and the first migration, documented in [auth state](auth.md). Acceptance requires reviewing and committing every generated artifact, replaying against an isolated empty target, and verifying that corrective changes use forward migrations. No schema or migration was generated or applied in Phase 2.

References: [Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate), [Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate).

## Validation

2026-09-10 14:35 — Phase 2 live verification

- Node 24.21.0 / pnpm 12.3.4; Nuxt 4.5.2, Drizzle ORM/Kit 1.0.0-rc.4, Neon driver 1.1.0 and CLI 4.14.3 confirmed unchanged.
- CLI branch and endpoint metadata match project `ancient-water-37006854` and branch `br-green-sky-zadolgsg`. Local pooled/direct URLs share that development target; no process-level URL override was present.
- `select 1` through the current Drizzle/Neon factory passed. Database/role ownership, schema privileges and absence of user relations passed read-only checks.
- Deliberately wrong credentials were rejected by `NeonDbError` with an authentication-failure message and an empty code; no SQLSTATE is claimed. A reserved unreachable hostname with disposable credentials failed. Missing configuration produced the variable-name-only error.
- One-off fetches used a 15-second timeout and suppressed raw driver errors.
- `pnpm lint` and `pnpm typecheck`: passed.
- `pnpm test:run`: exit 1, no test files found, as expected for this phase; not a passing test suite.
- `pnpm build`: passed with Nitro `node-server`, run outside the sandbox due to the previously established file-tracing permission restriction. Non-fatal Rolldown timing, Zod annotation and Vue/VueUse export warnings remain.
- Built Nuxt `useRuntimeConfig()` → existing validated Drizzle factory → dev SQL: passed. Kit resolves the same dev target through its direct URL. Homepage HTTP 200; rendered HTML and client assets contain no database credentials, private database keys or database code.
- Source boundaries, absence of schema/migration artifacts, ignored local notes and diff whitespace checks passed.

No database, domain/auth schema, migration, role, branch or production resource was modified. No credentials were added to tracked files. The next implementation phase is Better Auth server and initial migration (Phase 3).

2026-09-14 18:41 — Schema composition separated from Neon construction

`server/database/schema/index.ts` owns the provider-independent `authTables` mapping and composed `relations`, preserving the existing merge order. It sits beside the generated `auth.ts` so regeneration cannot overwrite application composition. `clients/neon.ts` only constructs the Neon-backed Drizzle client using those relations. Better Auth imports its table mapping directly from the schema module; its inferred client type remains a type-only import from the concrete factory. Schema definitions, adapter settings and runtime behavior are unchanged.

Validation: lint, typecheck and all nine focused unit tests passed. Drizzle Kit reported no schema changes and produced no migration. Full build/live-server tests were not repeated for this ownership-only move.

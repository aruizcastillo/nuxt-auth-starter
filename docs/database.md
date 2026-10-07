# Database

## Runtime integration

`server/database/clients/neon.ts` exports `createDatabase(databaseUrl: string)` with an inferred typed return. It constructs `drizzle({ client: neon(databaseUrl), relations })` using Neon 1.1.0 and Drizzle ORM 1.0.0-rc.4. Constructing it does not execute a query; there is no persistent pool, global client, public database probe or startup query.

Server consumers obtain `useRuntimeConfig(event)`, validate it with `parseDatabaseConfig` from `server/database/config.ts`, and pass `databaseUrl` to the factory. Validation requires a PostgreSQL protocol and hostname. Keep imports under `server/`; callers must handle driver errors without returning connection objects or credentials to clients.

`server/database/schema/index.ts` owns the provider-independent `authTables` mapping and composed relations: full `defineRelations(authTables)` entries followed by generated `authRelations`. This keeps regeneration separate from application composition. The auth adapter imports the table mapping directly. See [ADR 002](decisions/002-neon-http.md) for the HTTP transport constraint.

## Environment convention

[README](../README.md#environment-configuration) is the canonical variable and setup reference. Nuxt uses its matching private runtime override; Neon tooling and Kit retain their own variable names. There is no build-time alias mapping. `drizzle.config.ts` loads `dotenv/config`, reads `DATABASE_URL_UNPOOLED`, and includes `dbCredentials` only when nonempty. Kit owns command-specific credential requirements; there is no command detection or custom CLI parser.

Nuxt and Kit use `.env` by default. Explicit Neon pulls target that file and preserve unrelated entries; synchronize the Nuxt URL after pulling. Existing process variables can override file values. Environment isolation and deployment loading are described in [deployment](deployment.md).

## Auth schema and generation

The generated schema contains `user`, `session`, `account` and `verification`: 34 columns, four primary keys, unique user email and session token constraints, three lookup indexes, and two user foreign keys with cascade deletion. Generated token/password fields, timestamps and model names are preserved. Better Auth supplies session/account update timestamps; they intentionally have no SQL default. There are no domain/plugin tables.

`server/auth/cli.ts` loads dotenv, uses the domain parsers and calls the same auth factory outside Nuxt. Client construction does not connect to the database. Run the pinned CLI and format its generated TypeScript:

```sh
pnpm auth:generate --yes
pnpm exec eslint server/database/schema/auth.ts --fix
```

The script pins `auth@1.7.3` and writes `server/database/schema/auth.ts`. Runtime and CLI both consume the generated mapping. For credential-free schema generation, use a fresh PowerShell session with placeholder connection settings:

```powershell
$env:NUXT_DATABASE_URL = 'postgresql://schema:schema@localhost/schema'
$env:NUXT_BETTER_AUTH_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:NUXT_BETTER_AUTH_URL = 'https://schema.example.test'
pnpm auth:generate --yes
pnpm exec eslint server/database/schema/auth.ts --fix
```

Close that shell before selecting a real migration/test target. The committed migration is `server/database/migrations/20260910134024_bumpy_baron_strucker/`, containing `migration.sql` and RC `snapshot.json` (version 8). `drizzle.__drizzle_migrations` is Kit-owned bookkeeping.

## Migration procedure

Drizzle Kit 1.0.0-rc.4 owns migration generation and metadata. Its installed types and `generate --help`/`migrate --help` confirm the existing configuration and commands. Keep:

- Schema: `server/database/schema/*.ts`.
- Migrations: `server/database/migrations`.
- Scripts: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio`.

The versioned workflow is explained in [ADR 004](decisions/004-versioned-migrations.md); the setup commands are in [README](../README.md#database-setup). Before migration, identify the project/branch/endpoint in Neon and compare the selected database/role with the intended target. Confirm backups/recovery arrangements and review destructive statements and data transformations. Kit uses the direct `DATABASE_URL_UNPOOLED` for database access, independently of the private Nuxt runtime override. Kit loads dotenv outside Nuxt and does not share a runtime abstraction with the application.

For a schema change:

1. Change the typed schema under `server/database/schema/` (regenerate auth-owned schema through its CLI).
2. Run `pnpm db:generate`.
3. Review and commit every generated SQL and metadata artifact.
4. Run `pnpm db:migrate` against the explicitly selected target.

See [testing](testing.md#migration-validation) for empty-target replay, catalog inspection, idempotence and drift checks.

References: [Neon integration](https://orm.drizzle.team/docs/connect-neon), [Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate), [Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate).

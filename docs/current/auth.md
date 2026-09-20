# Better Auth server

2026-09-10 15:46 — Phase 3 implementation and validation

## Architecture

`server/auth/options.ts` is the single typed Better Auth factory. It accepts parsed auth settings and the existing Drizzle client. `server/utils/auth.ts` assembles it from `useRuntimeConfig(event)` on demand; the standard catch-all handler returns `auth.handler(toWebRequest(event))` unchanged. There is no startup database query, additional connection layer, client auth state or auth UI.

Better Auth and adapter remain **1.7.3**, Drizzle ORM/Kit **1.0.0-rc.4**, Neon HTTP **1.1.0**, Nuxt **4.5.2**. The adapter uses `@better-auth/drizzle-adapter/relations-v2`, PostgreSQL and an explicit core table mapping. The database schema composition merges full `defineRelations` entries before generated `authRelations`; the Neon factory consumes the resulting relations. Its return type is inferred to preserve the relation types. HTTP does not support interactive transactions, so adapter transactions remain explicitly disabled; joins remain disabled by default.

Sessions are stored in PostgreSQL; cookie caching is disabled for authoritative revocation. Email/password is enabled directly in Better Auth with explicit 8–128 character bounds, matching the installed 1.7.3 defaults. Better Auth retains password hashing, credential endpoints and normalization; no application credential layer or password-policy helper exists. Disabling or removing `emailAndPassword` disables credential sign-up/sign-in without changing core users, accounts, sessions or sign-out. Google, email delivery, verification requirements and recovery policy remain Phase 4 work. No plugins, fake verification or runtime test bypasses were added. The intermediate server is not production-ready.

## Credential request coverage (Phase 4.1)

`test/e2e/auth-server.test.ts` exercises the existing catch-all against the real Nitro server and explicitly allowlisted disposable database. It covers required registration fields, invalid email, rejected 7/129 and accepted 8/128 password lengths, duplicate registration, persisted user/credential/session records, native hash verification, successful sign-in, identical unknown-account/wrong-password responses, secure cookie issuance, database session revocation and repeated sign-out with stale or absent cookies. Fixtures remove only their own users, accounts and sessions.

Installed Better Auth 1.7.3 `api/routes/sign-up.mjs`, `sign-in.mjs`, `sign-out.mjs` and `@better-auth/core` option types are the behavioral reference. Registration requires a string `name`, valid `email` and nonempty `password`; a missing name is rejected, but Phase 4 imposes no additional name-content constraints. Those remain part of later profile/input validation policy. Email is lowercased. The application does not trim or otherwise transform passwords. Better Auth 1.7.3 preserves password whitespace and its native `@better-auth/utils` 0.4.2 scrypt implementation applies Unicode NFKC normalization before hashing. The application adds no hashing overrides.

With the current automatic sign-in and no verification requirement, duplicate registration returns native HTTP 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. Wrong passwords and nonexistent accounts both return HTTP 401 `INVALID_EMAIL_OR_PASSWORD` with the same public body and no session cookie. This does not claim timing equivalence or registration enumeration protection. Verification and registration response policy belong to the subsequent phase; no custom error masking is added here. Repeated sign-out returns `{ success: true }`, expires the session cookie, and leaves the revoked cookie unauthenticated.

The real server retains Better Auth's production rate limiter. The test POST helper honors the installed version's `X-Retry-After` header on HTTP 429 once, checks the delay is within its ten-second credential window, and lets a repeated rejection fail the endpoint assertion. This avoids disabling security or substituting mock request behavior for the credential matrix.

2026-09-20 validation: `pnpm exec vitest run --project e2e test/e2e/auth-server.test.ts` passed all 14 real-server cases with fixture cleanup on the existing allowlisted disposable branch. `pnpm lint`, `pnpm typecheck` and `pnpm build` passed. The initial sandboxed test build failed on Nitro's `EPERM` reading the user-directory link; the approved run outside the sandbox succeeded. The initial expanded matrix exposed native rate limiting, resolved by the bounded response-header backoff above. Existing Zod annotation and Vue/VueUse export warnings remain non-fatal. Phase 4.1 is complete; later Phase 4 integrations and policies remain pending. This work required only request tests and documentation, with no further runtime configuration or schema change.

## Generation and migration

`server/auth/cli.ts` loads dotenv and the domain-owned auth/database parsers, then calls the same factory outside Nuxt. Its client construction does not connect to the database. `pnpm auth:generate --yes` invokes the reviewed **auth@1.7.3** CLI (published dependencies pin Better Auth/core 1.7.3). Format generated TypeScript with `pnpm exec eslint server/database/schema/auth.ts --fix` before committing. Initial bootstrapping omitted the not-yet-generated schema; final runtime and CLI both consume the generated mapping without circular imports.

The generated schema contains `user`, `session`, `account` and `verification`: 34 columns, four primary keys, unique user email and session token constraints, three lookup indexes, and two user foreign keys with cascade deletion. Generated token/password fields, timestamps and model names are preserved. Better Auth supplies session/account update timestamps; they intentionally have no SQL default. There are no domain/plugin tables.

Kit generated `server/database/migrations/20260910134024_bumpy_baron_strucker/`, containing `migration.sql` and the RC snapshot format (`snapshot.json`, version 8). Do not edit migration metadata. Use **generate → review → commit → migrate**; never Better Auth's direct migration command or `push` for this workflow.

## Test target and commands

The explicitly authorized disposable branch is `test-phase3` (`br-weathered-hall-zagc439i`), created from the empty `dev` branch in project `ancient-water-37006854`. Its endpoint is `ep-rough-resonance-zadpdt75`, database `nuxt_auth_starter_db`, role `nuxt_auth_starter_db_owner`. `test/helpers/auth.ts` checks this exact target before any test account mutation. If the disposable branch is recreated, verify its Neon identity and update the allowlist deliberately.

The ignored `.env.test-phase3` is an explicitly selected local test file using **existing variable names only**. `.env` remains the development default, `.neon` remains linked to `dev`, and `.env.production` is not loaded. Runtime uses `NUXT_DATABASE_URL`; migrations use direct `DATABASE_URL_UNPOOLED`; pooled `DATABASE_URL` remains available for Neon tooling. No aliasing or default test-file loading was introduced.

For migrations in a fresh PowerShell session with no pre-existing database overrides:

```powershell
$env:DOTENV_CONFIG_PATH = '.env.test-phase3'
pnpm db:migrate
```

For tests, supply the test file's existing variables explicitly to the process (dotenv alone does not override existing process variables):

```powershell
Get-Content .env.test-phase3 | ForEach-Object {
  if ($_ -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
pnpm test:run
```

Close that shell when finished so later development commands do not inherit test settings. Missing/wrong test configuration fails explicitly; it does not skip integration checks. `pnpm exec vitest run --project unit` runs just the pure parser tests without a database.

The separate Node e2e project uses `@nuxt/test-utils/e2e` to build and start a real Nitro server. An ephemeral secret and HTTPS canonical origin exercise secure cookie attributes; local HTTP transports requests to the test server while explicitly replaying its issued cookie. Tests create unique accounts through the mounted Better Auth endpoints and clean only those accounts and their sessions/credentials. No tables are truncated. Phase 4 must update the explicitly marked unverified-email expectations.

## Validation checkpoint

2026-09-10 15:50 — Disposable migration and implementation validated

- `pnpm auth:generate --yes`: repeated generation was byte-identical, including after applying the same ESLint formatting; no network connection was needed by the auth factory.
- `pnpm db:generate`: initial SQL/snapshot generated; subsequent generation reports no schema changes.
- `pnpm db:migrate` on the verified empty disposable branch: passed; rerun retained one history entry. Catalog inspection confirmed all four tables, 34 columns, indexes and constraints.
- `pnpm exec nuxt prepare`, `pnpm lint`, `pnpm typecheck`: passed.
- `pnpm exec vitest run --project unit`: 5 passed. `pnpm test:run` with isolated settings: 9 passed, including all four live-server tests.
- `pnpm build` with isolated settings: passed. Existing non-fatal Rolldown timing, Zod annotation and Vue/VueUse export warnings remain.
- Development was rechecked empty before the committed replay and final migration. No test accounts were created there.

2026-09-10 15:54 — Phase 3 complete; committed replay and development migration verified

Implementation and full generated artifacts were committed in `8428e04`. The disposable branch was reset from the still-empty `dev` parent, confirmed empty, and the committed migration replayed successfully. Its tables, columns, constraints, indexes and migration history matched the first test application (excluding only the application timestamp). A second migrate retained exactly one history row.

Only after the live tests, build and committed replay passed was the migration applied to `dev`. The development catalog and history match the disposable target; its second migrate was also a no-op. The migration is `20260910134024_bumpy_baron_strucker`, hash `01d8d61940f53db3a97c295b6634e1daf10a8db207deff0a3c9c73131e0379e5`. The additional `drizzle.__drizzle_migrations` table is Kit-owned bookkeeping, not an auth/domain table.

Public build assets passed checks for the supplied private credentials, database runtime key and server dependency imports. No application UI changed; browser hydration/accessibility work remains with the later client/UI phases. No dependencies were upgraded, `drizzle.config.ts` and the environment variable strategy are unchanged, and production was untouched. The disposable branch is retained for explicit test runs; its local settings remain ignored. Local development auth secret/base URL remain for the developer to populate as documented in README.

All Phase 3 checklist items are complete. Phase 4 has not been implemented.

## File inventory

Created (11 tracked files):

- `server/auth/options.ts`, `server/auth/cli.ts`, `server/utils/auth.ts`.
- `server/api/auth/[...all].ts`.
- `server/database/schema/auth.ts`.
- `server/database/migrations/20260910134024_bumpy_baron_strucker/migration.sql` and `snapshot.json`.
- `test/helpers/auth.ts`, `test/e2e/auth-server.test.ts`, `test/unit/config.test.ts`.
- `docs/current/auth.md`.

Modified (9 tracked files):

- `server/database/clients/neon.ts`, `nuxt.config.ts`, `vitest.config.ts`, `package.json`.
- `README.md`, `docs/current/database.md`, `docs/current/project-state.md`.
- `docs/roadmap/phase3.md`, `docs/roadmap/roadmap.md` (completion status only).

Local-only: ignored `.env.test-phase3` holds the disposable settings. One-off diagnostics under ignored `.cache/phase3/` are not application tooling or committed deliverables.

## References

- [Better Auth Nuxt handler](https://better-auth.com/docs/integrations/nuxt), [Relations v2 adapter](https://better-auth.com/docs/adapters/drizzle), [CLI](https://better-auth.com/docs/concepts/cli).
- [Drizzle RC relations](https://orm.drizzle.team/docs/relations), [Neon integration](https://orm.drizzle.team/docs/connect-neon), [migration workflow](https://orm.drizzle.team/docs/drizzle-kit-migrate).
- Installed adapter generator/types, Nuxt test-utils 4.2.0 e2e types/source and Vitest 4.1.11 project API were checked against the implementation.

2026-09-14 18:18 — Pre-Phase 4 integration boundaries

Core auth validates only the secret and canonical URL. Google owns strict configuration and a native socialProviders object in `server/auth/providers/google.ts`. Resend owns strict settings in `server/email/providers/resend.ts`. Each module parses its own schema and uses the shared sanitized error formatter; unused integration values cannot fail core auth initialization.

This preparatory refactor does not complete Phase 4: Google is not yet composed into runtime auth, and Resend currently contains validation only. Phase 4 implements a simple `sendEmail` boundary there and connects verification/recovery callbacks. The auth factory, database, schema and session policy remain unchanged. No provider registry, delivery interface or feature flags were added.

Derived projects edit native Better Auth configuration directly. Disable email/password and remove its UI/flows; remove Google composition/module/UI and optionally env/runtime entries; replace Resend delivery without rewriting auth flows. General authorization uses users and sessions, never password presence or provider-specific user fields. Authentication methods belong to accounts.

Preserve Better Auth's normal implicit linking for trustworthy OAuth identities. The installed 1.7.3 types confirm linking defaults to enabled and disableImplicitLinking defaults to false. Retain its verification/trust safeguards; the former roadmap policy disabling linking is superseded.

Focused tests cover strict integration settings, core independence, and initialization/anonymous session reads for credentials+Google, credentials-only and Google-only using native option edits. Authenticated Google/database session coverage remains a Phase 4 acceptance requirement.

2026-09-14 18:29 — Boundary refactor validation

`pnpm lint`, `pnpm typecheck` and the nine focused unit tests passed. The production build completed with upstream plugin-timing, Zod annotation and Vue/VueUse package-export warnings. The full `pnpm test:run` used the existing explicitly allowlisted disposable settings: nine unit tests passed, but Nuxt test-utils exceeded its 240000 ms build/setup hook timeout and skipped all four live HTTP tests. Those integration tests are not validated by this run. The dependency preparation initially hit Windows permissions/network restrictions; the exact locked dependencies were restored without changing the lockfile. No schema or dependency changes were made.

2026-09-14 18:34 — Domain configuration ownership

`parseAuthConfig` lives in `server/auth/config.ts`; `parseDatabaseConfig` lives in `server/database/config.ts`. Google and Resend retain their local schemas and parsing. The former shared `parseSettings` wrapper and central config module are removed; `server/utils/config-error.ts` only formats sanitized variable-name errors. Runtime, tooling and test imports point directly to the owning domains. Schemas, parsed values, validation requirements and error messages are unchanged. Better Auth remains the sole auth configuration API; Phase 4 integration status is unchanged.

Ownership-cleanup validation: lint, typecheck and all nine focused unit tests passed. Full build/live-server tests were not repeated for this behavior-preserving move; the earlier integration setup timeout remains recorded above.

2026-09-14 18:43 — Resend provider location

Resend configuration/validation now lives in `server/email/providers/resend.ts`, leaving `server/email/` available for provider-independent email logic in Phase 4. Imports and references were updated; no behavior or additional abstraction changed.

2026-09-14 23:01 — Final Phase 3 closure after ownership refactors

Reviewed the committed ownership refactor (`daeb86e`) against the Phase 3 checklist. Domain parsers, integration-owned validation, schema composition, Neon construction, Better Auth factory, CLI/runtime assembly and the mounted handler remain coherent. No application-code or schema correction was required. Exact installed versions still match the lockfile: Better Auth/adapter 1.7.3, Drizzle ORM/Kit 1.0.0-rc.4, Neon 1.1.0, Nuxt 4.5.2, test-utils 4.2.0, Vitest 4.1.11 and Zod 4.5.4.

The four-minute Windows setup timeout reproduced during the cold Nitro build, before HTTP tests. The suite now explicitly uses test-utils' supported `setupTimeout: 600000` for build/startup only; individual test deadlines and all assertions remain unchanged. Installed 4.2.0 types/source confirm this is the build/setup budget. The rerun completed in 202.66 seconds with all 13 tests passing, including all four live HTTP tests against the existing allowlisted disposable branch and fixture cleanup. This supersedes the earlier incomplete live-test validation.

Final validation: `pnpm lint`, `pnpm typecheck`, full `pnpm test:run` (13 passed), and `pnpm build` passed. Pinned `pnpm auth:generate --yes` followed by the documented ESLint formatting reproduced the committed schema exactly; `pnpm db:generate` reported no changes. The generated schema and migration artifacts are unchanged from the already replayed Phase 3 migration, so that recorded replay/application evidence remains valid; no new migration or development/production database mutation was needed. Public build assets contain none of the supplied private test configuration values. Existing non-fatal plugin-timing, Zod annotation and Vue/VueUse export warnings remain.

Phase 3 is closed for its defined server/schema/session scope. Google runtime composition, real email delivery, verification/recovery policy and authorization helpers remain Phase 4 requirements; the intermediate starter is not production authentication policy. No UI changed. The user-owned AGENTS.md update was left untouched.

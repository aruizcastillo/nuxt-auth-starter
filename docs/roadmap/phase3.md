# Phase 3 — Better Auth server and initial migration

2026-09-10 15:54 — Complete; implementation, committed replay and validation evidence are in [auth state](../current/auth.md).

2026-09-14 23:01 — Closure reconfirmed after ownership refactors: lint, typecheck, all 13 tests and production build passed; schema regeneration is stable and no migration drift exists. See the final closure entry in [auth state](../current/auth.md).

## Goal

Establish a typed Better Auth server, its generated PostgreSQL schema, a replayable initial migration and the first meaningful integration tests.

## Preconditions

- Phases 1–2 are complete; use isolated development and disposable integration databases with explicit target checks.
- Recheck Better Auth/adapter 1.7.3 and Drizzle ORM/Kit 1.0.0-rc.4. The installed adapter exports `@better-auth/drizzle-adapter/relations-v2`, declares RC compatibility and generates `defineRelationsPart` output. Use this entry point rather than the default Relations v1 adapter. [Official adapter documentation](https://better-auth.com/docs/adapters/drizzle).
- Phase 4 completes real email delivery, Google credentials and access policy; do not expose this intermediate server as production-ready.

## 1. Configure Better Auth and its Drizzle adapter for the selected authentication methods.

- [x] Create `server/auth/options.ts` as a small explicit Better Auth factory accepting validated settings and the Drizzle client. Keep runtime assembly in `server/utils/auth.ts`, which reads `useRuntimeConfig(event)`. This separation exists so the CLI can load the same auth definition outside Nuxt; it is not a generic auth framework.
- [x] Import `betterAuth` and the Relations v2 `drizzleAdapter`; configure `provider: 'pg'`, explicit schema mapping once generated, `baseURL`, `secret` and `/api/auth`. Keep `transaction: false` with Neon HTTP; keep joins disabled unless their value is demonstrated.
- [x] Establish email/password as the initial method. Include only email/password and Google in the planned configuration; enable Google once paired credentials and its policies are connected in Phase 4. Both use the core auth tables; no plugin tables are needed now.
- [x] Keep database-backed sessions and cookie caching disabled to make revocation authoritative. Do not enable organizations, admin roles or other deferred plugins.
- [x] Make the factory importable without Nuxt auto-imports or a network connection. Use explicit imports in files loaded by CLI; keep `#imports` and `useRuntimeConfig` in runtime assembly only.

## 2. Produce the compatible auth schema without additional domain tables.

- [x] Add `server/auth/cli.ts` to load dotenv, parse the Phase 1 variables and export an `auth` instance from the same factory. Do not duplicate the configuration. For the first generation, omit the not-yet-existing schema/relations from factory assembly; do not create a circular import into the generated output.
- [x] Check the official CLI's published version/help for compatibility with Better Auth 1.7.3; pin that verified release in the documented command or a dev script. Run its `generate --config ./server/auth/cli.ts --output ./server/database/schema/auth.ts` flow. Never use an unreviewed `@latest` or Better Auth's direct migration command with Drizzle. [Better Auth CLI](https://better-auth.com/docs/concepts/cli).
- [x] Inspect generated user, session, account and verification tables, unique constraints, indexes, timestamps, foreign keys and deletion behavior. Preserve generated password/token columns and model names; do not manually recreate auth internals.
- [x] Verify generated relations use `defineRelationsPart` with the v2 adapter. Wire a full `defineRelations` table configuration plus generated relation parts into the RC Drizzle client, spreading partial relations after full entries. Pass the auth table mapping to the adapter. [Drizzle Relations](https://orm.drizzle.team/docs/relations).
- [x] Re-run generation and typecheck to prove the CLI/runtime share an equivalent schema. Inspect local `node_modules/@better-auth/drizzle-adapter/dist/relations-v2/` and generator types if online examples disagree; stop on an actual compatibility defect rather than switching to 0.x relations.

## 3. Generate, review and commit the initial migration.

- [x] Run `pnpm db:generate` with installed Kit RC.4 against `server/database/schema/*.ts`. Inspect every generated artifact under `server/database/migrations/`.
- [x] Review SQL for exactly the core auth tables and required constraints; check uniqueness of user email/session tokens and relationships to user records. Resolve any schema mismatch before applying SQL.
- [x] Commit the generated schema and complete migration output together with the configuration change when implementing this phase. Do not hand-edit migration metadata or include credentials.

## 4. Apply the migration and verify setup against an empty database.

- [x] Confirm the isolated target identity, run `pnpm db:migrate`, inspect the resulting tables/constraints and rerun migrate to verify no pending changes are reapplied.
- [x] Replay the committed migration on a second empty disposable database. Compare schema and migration history; do not use `push` to repair a failed replay.
- [x] Establish `test/helpers/` fixtures that require an explicitly supplied test target, create uniquely identified test accounts through Better Auth, and clean only their own records in foreign-key-safe order. Never truncate a development/production database by default.
- [x] Add the first live-server test file under `test/e2e/auth-server.test.ts`. Add a separate Node Vitest project for `@nuxt/test-utils/e2e`; existing `test/nuxt/` uses the Nuxt runtime environment and is not a live Nitro HTTP server. Do not mix the two APIs in one file. [Nuxt testing](https://nuxt.com/docs/4.x/getting-started/testing).

## 5. Expose the documented Nuxt auth handler and verify session creation, lookup and revocation.

- [x] Add `server/api/auth/[...all].ts` returning the auth instance's `handler(toWebRequest(event))` from `defineEventHandler`. Preserve the returned status, headers, cookies and response body; do not wrap it in a custom response envelope. [Nuxt integration](https://better-auth.com/docs/integrations/nuxt).
- [x] Test the mounted handler over HTTP: health endpoint, sign-up/sign-in with a disposable account, session lookup using the issued cookie, sign-out and rejection of that revoked cookie. Inspect cookie attributes without storing actual cookie values in reports.
- [x] Add invalid-password, malformed-request, missing-cookie and expired-session cases. Use a real migrated database for adapter behavior; mock only external providers in later phases.
- [x] Add `test/unit/config.test.ts` for Phase 1's parser and invalid setting combinations. Extend TypeScript test inclusion for new test paths without replacing the generated Nuxt references.
- [x] Keep temporary Phase 3 credential-flow expectations clearly identified; Phase 4 must update them for required email verification. No fake verified flag or permanent test-only auth bypass may enter runtime configuration.

## Phase verification

- [x] Generate a stable schema, replay migrations on an empty database and verify a second migrate is a no-op.
- [x] Confirm handler routing and real session lifecycle assertions pass, including revocation and expired cookies.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build` with isolated test settings. Missing database access is an explicit unmet integration check, not a silently skipped pass.

## Expected state after completion

Better Auth owns persisted identity and sessions behind the standard Nitro handler. The initial schema/migration is reproducible, and meaningful tests already exercise it. Production authentication policy and delivery remain Phase 4 work.

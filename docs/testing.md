# Testing

## Test projects

`vitest.config.ts` defines `unit` (Node, pure configuration and auth-boundary tests), `nuxt` (Nuxt runtime via `defineVitestProject`, currently no cases), and `e2e` (Node plus `@nuxt/test-utils/e2e`, a real built Nitro server). The lockfile resolves Vitest 4.1.11 and Nuxt Test Utils 4.2.0. No browser harness, coverage gate or required CI workflow is implemented.

Use the [README command table](../README.md#development-and-validation-commands) for lint, typecheck, unit tests and build. `pnpm test:run` includes database mutations; it requires the explicit disposable target below. Missing infrastructure fails rather than silently skipping the suite. No Markdown-specific validation script exists.

## HTTP coverage

`test/e2e/auth-server.test.ts` exercises the existing catch-all against the real Nitro server and explicitly allowlisted disposable database. It covers required registration fields, invalid email, rejected 7/129 and accepted 8/128 password lengths, duplicate registration, persisted user/credential/session records, native hash verification, successful sign-in, identical unknown-account/wrong-password responses, secure cookie issuance, database session revocation and repeated sign-out with stale or absent cookies. Fixtures remove only their own users, accounts and sessions.

The real server retains Better Auth's production rate limiter. The test POST helper honors the installed version's `X-Retry-After` header on HTTP 429 once, checks the delay is within its ten-second credential window, and lets a repeated rejection fail the endpoint assertion. This avoids disabling security or substituting mock request behavior for the credential matrix.

The e2e setup uses `setupTimeout: 600000` because cold Nitro builds on Windows can exceed the default four-minute setup budget. This changes only build/startup allowance, not individual test deadlines or assertions. HTTP tests do not establish browser hydration or full accessibility coverage.

## Test target and commands

The current integration test setup deliberately remains Neon-specific. Its branch allowlist and connection workflow validate the reference provider; they are not requirements of the application's PostgreSQL contract. A provider replacement must adapt this setup before running the suite. Provider-neutral integration coverage remains future work.

`test/helpers/auth.ts` is the canonical allowlist for the branch label, exact pooled endpoint and database path. Provision a separate disposable target, verify its Neon identity, and deliberately update that allowlist if it is replaced. Environment configuration alone cannot authorize an arbitrary database. Never point the suite at development or production.

The ignored `.env.test-phase3` is an explicitly selected local test file using **existing variable names only**. The file is not loaded by default.

Create `.env.test-phase3` with the established variable names and values for the verified disposable target:

```dotenv
NEON_BRANCH=<branch label accepted by test/helpers/auth.ts>
NUXT_DATABASE_URL=<pooled test URL>
DATABASE_URL=<same pooled test URL>
DATABASE_URL_UNPOOLED=<direct URL for the same test database>
```

The e2e setup supplies its own ephemeral auth secret and canonical HTTPS origin and clears unused provider settings. Use plain unquoted values with the PowerShell loader below. Check branch, endpoint and database against the allowlist before migrating; the migration command does not invoke the test guard.

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

The separate Node e2e project uses `@nuxt/test-utils/e2e` to build and start a real Nitro server. An ephemeral secret and HTTPS canonical origin exercise secure cookie attributes; local HTTP transports requests to the test server while explicitly replaying its issued cookie. Tests create unique accounts through the mounted Better Auth endpoints and clean only those accounts and their sessions/credentials. No tables are truncated. Verification-policy work must update the explicitly marked unverified-email expectations.

## Migration validation

Use a verified empty disposable database, apply the committed migrations, inspect core tables/constraints/indexes and Kit history, then run migrate again and confirm it is a no-op. Do not reset a branch from a populated parent and call that an empty replay. 

For drift checks, use a disposable checkout: regenerate and format the auth schema as described in [database](database.md#auth-schema-and-generation), run `pnpm db:generate`, and inspect for unexpected schema or migration changes. Do not rewrite applied migrations or commit drift automatically. CI automation, browser coverage and external-provider acceptance are [future work](roadmap/roadmap.md#phase-7).

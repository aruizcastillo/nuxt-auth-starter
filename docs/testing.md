# Testing

## Validation scope

Choose checks according to the change; these are separate validation paths:

| Command | When to use it |
| --- | --- |
| `pnpm test:run --project unit` | Quick feedback from database-independent unit tests. |
| `pnpm test:run` | Full integration validation, including the HTTP tests' own compilation and test database access. |
| `pnpm build` | Validate the actual production compilation when relevant, including before deployment. |

Run lint and typecheck when relevant to the change. The full suite builds its own test server; it does not reuse `.output` and does not require a preceding `pnpm build`. A separate production build is not an automatic follow-up to every full test run. Run both when both kinds of evidence are needed. For documentation-only changes, review the diff and affected references.

## Test projects

`vitest.config.ts` defines `unit` (Node, pure configuration and auth-boundary tests), `nuxt` (Nuxt runtime via `defineVitestProject`, currently no cases), and `e2e` (Node plus `@nuxt/test-utils/e2e`, a real built Nitro server). The lockfile resolves Vitest 4.1.11 and Nuxt Test Utils 4.3.3. No browser harness, coverage gate or required CI workflow is implemented.

Use the [README command table](../README.md#development-commands) for lint, typecheck, unit tests and build. `pnpm test:run` includes database mutations; it requires the explicit disposable target below. Missing infrastructure fails rather than silently skipping the suite. No Markdown-specific validation script exists.

## Email transport coverage

`test/unit/resend.test.ts` exercises the isolated Resend sender with an injected fetch function and native `Response` objects. It covers acceptance and payload shape, configurable sender, malformed JSON and success schemas, key/permission errors, sender rejection, HTTP 429, provider failures, network errors, sanitized exceptions and absence of automatic retries/logging. Two tests exercise the real ten-second abort deadline while waiting for headers or consuming a stalled body. No emails are sent and no Resend credentials or database are needed for these tests. Run `pnpm test:run --project unit`.

These tests do not establish real delivery, verification/reset links or serverless background lifetime; those checks belong to the remaining Phase 4 work.

## HTTP coverage

`test/e2e/auth-server.test.ts` exercises the existing catch-all against the real Nitro server and explicitly allowlisted disposable database. It covers required registration fields, invalid email, rejected 7/129 and accepted 8/128 password lengths, duplicate registration, persisted user/credential/session records, native hash verification, successful sign-in, identical unknown-account/wrong-password responses, secure cookie issuance, database session revocation and repeated sign-out with stale or absent cookies. Fixtures remove only their own users, accounts and sessions.

The real server retains Better Auth's production rate limiter. The test POST helper honors the installed version's `X-Retry-After` header on HTTP 429 once, checks the delay is within its ten-second credential window, and lets a repeated rejection fail the endpoint assertion. This avoids disabling security or substituting mock request behavior for the credential matrix.

The e2e setup uses `setupTimeout: 600000` because cold Nitro builds on Windows can exceed the default four-minute setup budget. This changes only build/startup allowance, not individual test deadlines or assertions. HTTP tests do not establish browser hydration or full accessibility coverage.

## Test target and commands

The current integration test setup deliberately remains Neon-specific. Its branch allowlist and connection workflow validate the reference provider; they are not requirements of the application's PostgreSQL contract. A provider replacement must adapt this setup before running the suite. Provider-neutral integration coverage remains future work.

`test/helpers/auth.ts` is the canonical allowlist for the branch label, exact pooled endpoint and database path. Provision a separate disposable target, verify its Neon identity, and deliberately update that allowlist if it is replaced. Environment configuration alone cannot authorize an arbitrary database. Never point the suite at development or production.

The ignored `.env.test` is the single local test configuration file. The current Vitest configuration loads it through Nuxt Test Utils when preparing its Nuxt project. Existing process variables take precedence, so use a fresh shell without development or production database overrides. The test target guard still validates the effective values before database access.

Create `.env.test` with the established variable names and values for the verified disposable target:

```dotenv
NEON_BRANCH=test
NUXT_DATABASE_URL=<pooled test URL>
DATABASE_URL=<same pooled test URL>
DATABASE_URL_UNPOOLED=<direct URL for the same test database>
```

The e2e setup supplies its own ephemeral auth secret and canonical HTTPS origin and clears unused provider settings. Check branch, endpoint and database against the allowlist before migrating; the migration command does not invoke the test guard.

For migrations in a fresh PowerShell session with no pre-existing database overrides:

```powershell
$env:DOTENV_CONFIG_PATH = '.env.test'
pnpm db:migrate
```

For tests, the current configuration loads `.env.test` automatically:

```powershell
pnpm test:run
```

Close that shell when finished so later development commands do not inherit test settings. Missing/wrong test configuration fails explicitly; it does not skip integration checks. `pnpm test:run --project unit` runs the database-independent unit tests.

The separate Node e2e project uses `@nuxt/test-utils/e2e` to build and start a real Nitro server. An ephemeral secret and HTTPS canonical origin exercise secure cookie attributes; local HTTP transports requests to the test server while explicitly replaying its issued cookie. Tests create unique accounts through the mounted Better Auth endpoints and clean only those accounts and their sessions/credentials. No tables are truncated. Verification-policy work must update the explicitly marked unverified-email expectations.

## Migration validation

Use a verified empty disposable database, apply the committed migrations, inspect core tables/constraints/indexes and Kit history, then run migrate again and confirm it is a no-op. Do not reset a branch from a populated parent and call that an empty replay. 

For drift checks, use a disposable checkout: regenerate and format the auth schema as described in [database](database.md#auth-schema-and-generation), run `pnpm db:generate`, and inspect for unexpected schema or migration changes. Do not rewrite applied migrations or commit drift automatically. CI automation, browser coverage and external-provider acceptance are [future work](roadmap/roadmap.md#phase-7).

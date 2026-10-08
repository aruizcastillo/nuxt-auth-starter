# Authentication

## Server integration

`server/auth/options.ts` is the single typed Better Auth factory. It accepts parsed auth settings and the existing Drizzle client. `server/utils/auth.ts` assembles it from `useRuntimeConfig(event)` on demand; the standard catch-all handler returns `auth.handler(toWebRequest(event))` unchanged. There is no startup database query, additional connection layer, client auth state or auth UI.

Better Auth and its adapter resolve to **1.7.3**. The adapter uses `@better-auth/drizzle-adapter/relations-v2`, PostgreSQL and the explicit core table mapping described in [database](database.md#runtime-integration). Adapter transactions are explicitly disabled for the reference driver's capabilities; joins remain disabled by default. See [Neon HTTP](decisions/002-neon-http.md) for the rationale and when to review that setting.

Sessions are stored in PostgreSQL; cookie caching is disabled (see [ADR 003](decisions/003-cookie-cache-disabled.md)). Email/password is enabled directly in Better Auth with explicit 8–128 character bounds, matching the installed 1.7.3 defaults. Better Auth retains password hashing, credential endpoints and normalization; no application credential layer or password-policy helper exists. Disabling or removing `emailAndPassword` disables credential sign-up/sign-in without changing core users, accounts, sessions or sign-out. Google, email delivery, verification requirements and recovery policy remain [planned work](roadmap/roadmap.md#phase-4). No plugins, fake verification or runtime test bypasses were added. The intermediate server is not production-ready.

## Credential behavior

Installed Better Auth 1.7.3 `api/routes/sign-up.mjs`, `sign-in.mjs`, `sign-out.mjs` and `@better-auth/core` option types are the behavioral reference. Registration requires a string `name`, valid `email` and nonempty `password`; a missing name is rejected, but the application imposes no additional name-content constraints. Those remain part of later profile/input validation policy. Email is lowercased. The application does not trim or otherwise transform passwords. Better Auth 1.7.3 preserves password whitespace and its native `@better-auth/utils` 0.4.2 scrypt implementation applies Unicode NFKC normalization before hashing. The application adds no hashing overrides.

With the current automatic sign-in and no verification requirement, duplicate registration returns native HTTP 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. Wrong passwords and nonexistent accounts both return HTTP 401 `INVALID_EMAIL_OR_PASSWORD` with the same public body and no session cookie. This does not claim timing equivalence or registration enumeration protection. Verification and registration response policy remain planned; no custom error masking is added here. Repeated sign-out returns `{ success: true }`, expires the session cookie, and leaves the revoked cookie unauthenticated.

## Configuration boundaries

Core auth validates only the secret and canonical URL. Google owns strict configuration and a native socialProviders object in `server/auth/providers/google.ts`. Resend owns strict settings in `server/email/providers/resend.ts`.

Google is not yet composed into runtime auth, and Resend currently contains validation only. Delivery and verification/recovery callbacks are planned in the [roadmap](roadmap/roadmap.md#phase-4).

Core settings are parsed by `server/auth/config.ts`. The secret requires at least 32 non-padding characters; randomness must be supplied by the operator. The base URL must be a canonical origin without credentials, a non-root path, query or fragment. HTTPS is required except for localhost development. The runtime utility passes `import.meta.dev`; the CLI uses `NODE_ENV === 'development'`.

Only sanitized variable-name error formatting is shared in `server/utils/config-error.ts`. Each domain/integration owns its parser; unused providers do not block core auth. There is no startup plugin validating unused services.

See [README configuration](../README.md#environment-configuration) for setup, [database](database.md) for generated schema and tooling, and [testing](testing.md) for HTTP coverage and the disposable target procedure. [ADR 001](decisions/001-better-auth.md) records auth ownership and integration constraints.

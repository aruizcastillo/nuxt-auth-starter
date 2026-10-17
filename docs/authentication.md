# Authentication

## Server integration

`server/auth/options.ts` is the single typed Better Auth factory. It accepts parsed auth settings, the existing Drizzle client and an optional prepared email sender. The tooling entrypoint omits the sender and needs no mail or hosting configuration. Runtime assembly in `server/utils/auth.ts` always supplies it, checks the build-selected background provider's availability per request and reads `useRuntimeConfig()`. The catch-all imports `defineEventHandler` from `nuxt/server` and returns `useServerAuth(event).handler(event.req)`. There is no startup database query, additional connection layer, client auth state or auth UI.

Better Auth and its adapter resolve to **1.7.9**. The adapter uses `@better-auth/drizzle-adapter/relations-v2`, PostgreSQL and the explicit core table mapping described in [database](database.md#runtime-integration). Adapter transactions are explicitly disabled for the reference driver's capabilities; joins remain disabled by default. See [Neon HTTP](decisions/002-neon-http.md) for the rationale and when to review that setting.

Sessions are stored in PostgreSQL; cookie caching is disabled (see [ADR 003](decisions/003-cookie-cache-disabled.md)). Email/password is enabled directly in Better Auth with explicit 8–128 character bounds, matching the installed 1.7.9 defaults. Better Auth retains password hashing, credential endpoints and normalization; no application credential layer or password-policy helper exists. Disabling or removing `emailAndPassword` disables credential sign-up/sign-in without changing core users, accounts, sessions or sign-out. Google, verification requirements and recovery session policy remain [planned work](roadmap/roadmap.md#phase-4). No Better Auth plugins, fake verification or runtime test bypasses were added. The intermediate server is not production-ready.

## Credential behavior

Installed Better Auth 1.7.9 `api/routes/sign-up.mjs`, `sign-in.mjs`, `sign-out.mjs` and `@better-auth/core` option types are the behavioral reference. Registration requires a string `name`, valid `email` and nonempty `password`; a missing name is rejected, but the application imposes no additional name-content constraints. Those remain part of later profile/input validation policy. Email is lowercased. The application does not trim or otherwise transform passwords. Better Auth 1.7.9 preserves password whitespace and its native `@better-auth/utils` 0.5.0 scrypt implementation applies Unicode NFKC normalization before hashing. The application adds no hashing overrides.

With the current automatic sign-in and no verification requirement, duplicate registration returns native HTTP 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. Wrong passwords and nonexistent accounts both return HTTP 401 `INVALID_EMAIL_OR_PASSWORD` with the same public body and no session cookie. This does not claim timing equivalence or registration enumeration protection. Verification and registration response policy remain planned; no custom error masking is added here. Repeated sign-out returns `{ success: true }`, expires the session cookie, and leaves the revoked cookie unauthenticated.

## Configuration boundaries

Core auth validates only the secret and canonical URL. Google owns strict configuration and a native socialProviders object in `server/auth/providers/google.ts`. Resend owns strict settings in `server/email/providers/resend.ts`.

Google is not yet composed into runtime auth. Runtime auth composes Resend through `server/email/index.ts`; [background providers](deployment.md#background-tasks) own hosting-specific lifetime support.

### Verification and recovery delivery

The native `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword` callbacks send plain text with Better Auth's supplied `url` unchanged. Better Auth owns tokens, validation and expiry (the installed defaults are one hour for both links). `sendOnSignUp: true` enables registration email. Verification is still optional: automatic registration sign-in remains enabled, unverified users can sign in and reset does not revoke other sessions. Those policies belong to the next phase.

Both callbacks use the prepared `sendEmail` function. It registers a caught delivery promise before starting network I/O, then resolves without waiting for Resend. No `advanced.backgroundTasks.handler` is configured: installed Better Auth 1.7.9 defers some callback paths through `runInBackgroundOrAwait`, but directly awaits explicit verification resend. Scheduling inside the callbacks covers both paths once. See the official [verification](https://github.com/better-auth/better-auth/blob/v1.7.9/packages/better-auth/src/api/routes/email-verification.ts) and [recovery](https://github.com/better-auth/better-auth/blob/v1.7.9/packages/better-auth/src/api/routes/password.ts) source.

Operational events are `auth_email_requested`, `auth_email_accepted` and `auth_email_failed`, correlated by a random `deliveryId` and fixed purpose (`verification` or `password_reset`). Failures add only a local transport code, `unexpected` or `background_registration`. No recipient, subject, body, link, token or credentials are logged. Acceptance means Resend returned a validated ID, not inbox delivery. A synchronous registration failure prevents I/O and is reported through the same sanitized failure event. Delivery/registration failures do not change account-dependent HTTP acknowledgements. Missing hosting capability fails before Better Auth looks up an account; see [deployment](deployment.md#background-tasks).

This removes provider delivery latency and provider errors from the HTTP response; it does not claim equal timing for every database path. Better Auth's native responses, rate limits and unauthenticated resend timing floor remain intact. Current duplicate-registration behavior is described above. [ADR 005](decisions/005-background-tasks.md) explains the execution boundary and accepted reliability tradeoff.

### Isolated email transport

`createResendSender(config, fetcher?)` in `server/email/providers/resend.ts` validates the private Resend settings and returns `sendEmail({ to, subject, text })`. The email module supplies runtime configuration from its caller. The transport has no environment reads, request retention or auth/hosting imports. Changing to a verified domain only requires changing `NUXT_EMAIL_FROM`.

The sender uses native `fetch` to POST bearer-authenticated JSON to [Resend's send API](https://resend.com/docs/api-reference/emails/send-email), without a Resend SDK. `AbortSignal.timeout(10_000)` bounds both the request and response body consumption. Native fetch is used here because installed ofetch 1.5.1 clears its built-in timeout after receiving headers, before reading the body. Redirects are rejected and POST requests are never automatically retried.

Success requires a JSON object with a UUID `id`; only `{ id }` is returned. This means provider acceptance, not confirmed inbox delivery. `ResendDeliveryError.code` distinguishes `authentication`, `rate_limit`, `rejected`, `provider`, `timeout`, `network` and `invalid_response`. The [documented Resend errors](https://resend.com/docs/api-reference/errors) distinguish key/permission failures from sender restrictions, including their shared HTTP 403 status. Unknown 4xx failures are classified as `rejected`, 5xx as `provider`. Invalid JSON on an HTTP error still preserves its status-based classification.

Errors contain only a fixed message and local code; no raw cause, request, provider response or message is retained or logged. Timeout/network failures leave acceptance uncertain, so retrying could duplicate a message. The injectable native-fetch boundary allows tests without network or credentials; coverage is described in [testing](testing.md#email-transport-coverage). Real receipt and deployed Vercel lifecycle still require the controlled checks in [deployment](deployment.md#background-tasks).

Core settings are parsed by `server/auth/config.ts`. The secret requires at least 32 non-padding characters; randomness must be supplied by the operator. The base URL must be a canonical origin without credentials, a non-root path, query or fragment. HTTPS is required except for localhost development. The runtime utility passes `import.meta.dev`; the CLI uses `NODE_ENV === 'development'`.

Only sanitized variable-name error formatting is shared in `server/utils/config-error.ts`. Each domain/integration owns its parser; unused providers do not block core auth. There is no startup plugin validating unused services.

See [README configuration](../README.md#environment-configuration) for setup, [database](database.md) for generated schema and tooling, and [testing](testing.md) for HTTP coverage and the disposable target procedure. [ADR 001](decisions/001-better-auth.md) records auth ownership and integration constraints.

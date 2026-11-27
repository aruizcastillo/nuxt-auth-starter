# Authentication

## Server integration

`server/auth/options.ts` is the typed Better Auth factory. It accepts parsed auth settings, the existing Drizzle client and an optional `SendEmail` function. The CLI omits the function and needs no email or Nitro initialization. Runtime assembly creates auth per request and supplies a function that registers delivery with that request's `event.waitUntil`. The catch-all forwards `event.req` to the native handler.

Better Auth, its Drizzle adapter and the schema CLI resolve to **1.7.27**. The adapter uses `@better-auth/drizzle-adapter/relations-v2`, PostgreSQL, explicit table mapping and `transaction: false` for the reference Neon HTTP driver's capabilities. See [database](database.md#runtime-integration) and [ADR 002](decisions/002-neon-http.md). Sessions are database-authoritative and cookie caching is disabled ([ADR 003](decisions/003-cookie-cache-disabled.md)).

## Credential and verification policy

Email/password is enabled explicitly, with 8–128 character password bounds, `requireEmailVerification: true` and `revokeSessionsOnPasswordReset: true`. Missing email credentials never change these options. Better Auth owns hashing, normalization, tokens, expiry and endpoint validation. Password whitespace is preserved and the installed scrypt implementation applies Unicode NFKC normalization.

Registration sends verification through `sendOnSignUp: true`, creates no session and returns `token: null`. Duplicate registration uses Better Auth's generic synthetic-user response rather than the former HTTP 422. Do not treat its user ID as proof that a new database account exists. Wrong passwords and nonexistent users return the same native HTTP 401. A correct password for an unverified account returns HTTP 403 `EMAIL_NOT_VERIFIED`.

Verification uses Better Auth's URL unchanged. `autoSignInAfterVerification: false` requires explicit sign-in afterward. `sendOnSignIn: false` avoids adding another mail trigger; the native resend endpoint remains available. Tokens default to one hour. Replaying a valid verification link for an already verified account succeeds without creating a session; missing, altered and expired links fail through native responses/redirects.

Recovery also uses the native callback and link. A successful reset consumes its token, revokes all prior sessions and requires new sign-in. With the reference adapter's transactions disabled, token consumption, revocation and password update are not an atomic unit. Failures can consume the token before all operations finish; do not automatically retry or claim rollback guarantees.

## Session requirement

`server/utils/require-session.ts` exports `requireSession(event)`. It reads Better Auth's session using the request headers and returns only `{ id, name, email, emailVerified }`. A missing/expired session raises HTTP 401 with `data.code: UNAUTHENTICATED`. Lookup errors propagate as server errors.

The helper checks session validity and preserves the actual `emailVerified` value. Better Auth enforces verification during credential sign-in. Resource-specific requirements belong to the server handler that owns the resource.

## Custom endpoint authorization and input

Derive identity from the Better Auth session on the server. Apply any resource-specific ownership, role or verification requirement using authoritative server data. Page middleware controls navigation. Client-supplied user IDs, identity headers, roles, ownership claims and verification flags carry no authority.

Validate custom query parameters and bodies with Zod at the handler boundary. Define the accepted fields explicitly, reject unexpected fields and pass only validated writable properties to persistence. A custom mutation must enforce its own origin and CSRF protections. Better Auth owns validation, trusted-origin checks, CSRF protection and response contracts for its native endpoints.

### Current-account endpoint contract

`GET /api/account` exposes a read-only projection of the current user. The route sets `Cache-Control: private, no-store` before session lookup or query validation so it applies to success and errors. Keep the route outside prerendering, cached handlers and shared SWR or ISR rules.

| Result | Condition |
| --- | --- |
| `200` | A valid session and an empty query. Return exactly `{ user: { id, name, email, emailVerified } }` from `requireSession(event)`. A valid session grants access with either value of `emailVerified`. |
| `401` with `data.code: UNAUTHENTICATED` | Better Auth finds no valid session. This takes precedence over input validation. |
| `400` | A valid session and at least one query parameter. Use a generic validation error and keep submitted values out of the response. |
| `5xx` | Session lookup fails. Use the server error path with sanitized response details. |

Use `z.literal(0)` to validate `event.url.searchParams.size`. Nuxt 4.6.1's parsed query helper filters certain parameter names, so validating its result against an empty object would miss some inputs.

### Session-aware navigation

The same-origin Vue client uses Better Auth's [`useSession(useFetch)` integration](https://better-auth.com/docs/integrations/nuxt#use-the-session). Better Auth 1.7.27 resolves the session path relative to the app when `baseURL` is inferred. Nuxt forwards the incoming request on SSR and reuses the navigation result during hydration. The fetch keeps Better Auth's signal, uses an explicit Nuxt key for invalidation and serializes only whether a session resolved. The account page fetches its display data separately through `/api/account`.

The `auth` middleware protects `/account`. The `guest` middleware redirects authenticated users away from `/sign-in` and `/register`. Both set private, no-store headers on server-rendered responses and redirects. A session lookup failure surfaces a retryable error. Verification and password recovery pages remain reachable regardless of session state.

The optional `redirect` query accepts a single local destination. `safeRedirect()` allows `/` and `/account`, preserves valid query strings and fragments, and otherwise defaults to `/account`. The links between the credential screens preserve the validated destination.

The account view subscribes to Better Auth's native Vue session observer in the browser. This activates the library's focus and cross-tab listeners. An observed revocation or an account `401` clears the account and navigation data before returning to sign-in, where the native session check resolves current access. Successful native sign-out also clears the view. An error returned to the browser leaves the current account view available for a retry. Better Auth can clear the browser cookie after logging a database deletion failure, so verify database revocation by testing the previous session against the protected endpoint.

### Credential screens

`/register` and `/sign-in` compose their cards and navigation in the page. Their forms own vee-validate state, local Zod validation and native Better Auth requests. Password bounds are shared with the server configuration. Sign-in checks for a nonempty password within the maximum length, while registration also enforces the minimum.

Registration sends new and duplicate accounts to the same verification screen. Sign-in routes there when Better Auth returns `EMAIL_NOT_VERIFIED`. After successful credential sign-in, the page invalidates the navigation session data and replaces the current history entry with the validated destination.

### Verification and password recovery screens

`/verify-email` pre-fills the email address from the preceding registration or sign-in using one-time client memory. Direct visits and reloads start with an empty field. The verification and recovery request forms use native `sendVerificationEmail` and `requestPasswordReset`. Both acknowledge accepted requests generically, permit manual retries and honor the native retry interval on HTTP 429.

Verification links return to `/sign-in` with the validated destination. A recognized verification-link error offers a way to request a new link. A signed-in visitor can open the verification page and return to Account.

Recovery links land on `/reset-password`. The page checks the query shape, serves a private, no-store response with `Referrer-Policy: no-referrer` and sends the token and the new password in the native request body. The confirmation field stays in the form. On this route, remove Nuxt 4.6's copy of the token-bearing request URL from the hydration payload. The client router reads the browser URL. Invalid, expired and used tokens lead back to the recovery request. After success, the page replaces the current URL with its token-free form and offers a fresh sign-in. If a session remains active after the reset, the person can visit Account to switch accounts.

### Profile edits through Better Auth

[Phase 6](roadmap/roadmap.md#phase-6) uses native `updateUser` for display-name edits. Scope a Better Auth [before hook](https://better-auth.com/docs/concepts/hooks#before-hooks) to `/update-user` and validate a body containing only `name`. The native endpoint also accepts `image`, so enforce the field allowlist on the server. Use Better Auth's `APIError` for validation failures and preserve the native session and origin checks and success response. The name constraints are part of the Phase 6 form contract.

## Configuration and initialization

Auth owns validation of its secret and canonical origin; database and provider modules own their settings. Only sanitized variable-name error formatting is shared. HTTPS is required outside localhost development.

A synchronous Nitro plugin initializes the email transport once per runtime from effective `useRuntimeConfig()` values. The email module selects the transport and the reference provider classifies and validates its own configuration. Prerender skips email initialization. The build and auth CLI do not need production email credentials.

| Runtime | Email configuration |
| --- | --- |
| Nuxt development, both provider settings absent or exactly empty | Print verification and reset messages to the local server terminal. |
| Nuxt development, both provider settings valid | Send through the configured provider. |
| Nuxt development, partial or invalid settings | Fail initialization with a sanitized configuration error. |
| Production server, including Preview | Require valid provider settings at initialization. |

The development transport writes the recipient, purpose and plain-text message with its complete native link directly to the server's standard output. Start `pnpm dev --no-tui` to stream the output and look for `[auth-email:development]` after submitting a new registration, verification resend or password reset request. The interactive terminal folds output into its log history. [Nuxt dev command](https://nuxt.com/docs/4.x/api/commands/dev#disabling-the-ui)

Use **Resend verification email** on `/verify-email` to request another link for an unverified address. Duplicate registration returns the generic confirmation without triggering a send. Keep the local terminal output private and open the printed link to complete verification or recovery. Restart the runtime after changing provider settings.

### Verification and recovery delivery

The email service waits for the provider's result and propagates failures. Only the request integration registers its promise with `event.waitUntil`, observes rejection and returns without waiting for provider acceptance. Registration occurs before transport I/O. A registration failure prevents the send, logs a sanitized event and throws a sanitized integration error. There is no auth preflight hook, sender-preparation cache, execution provider or `advanced.backgroundTasks.handler`.

Better Auth's `runInBackgroundOrAwait` catches callback failures during registration and recovery. Explicit verification resend awaits the callback directly and may expose a registration failure as an HTTP error. Anonymous resend retains its native 500 ms floor. Provider failures inside the registered task leave the HTTP acknowledgement intact. See the matching [context](https://github.com/better-auth/better-auth/blob/v1.7.27/packages/better-auth/src/context/create-context.ts) and [resend source](https://github.com/better-auth/better-auth/blob/v1.7.27/packages/better-auth/src/api/routes/email-verification.ts).

Provider delivery emits `auth_email_requested`, `auth_email_accepted` and `auth_email_failed` with a random `deliveryId` and fixed purpose. Acceptance includes `providerMessageId`. Failures contain a sanitized local code. The request integration also reports `background_registration` or `sender_not_initialized`. These structured events exclude recipients, message contents, links, tokens and credentials.

An acknowledgement is not provider acceptance or inbox delivery. A validly configured provider can fail after account creation; retain the unverified account and request a new link later. Timeout/network failures can leave acceptance unknown, so retries could duplicate messages. Background execution removes provider latency from the response, not all database/timing differences. Preserve native generic responses and rate limits without promising timing equivalence. See [deployment](deployment.md#background-tasks) and [ADR 005](decisions/005-background-tasks.md).

### Isolated email transport

`server/email/index.ts` composes the console transport with the selected provider. `server/email/providers/resend.ts` owns the Resend setting names, validation, native-fetch HTTP transport and mapping to sanitized delivery errors. It has no auth, Nitro, Vercel or environment imports. Zod validates the settings during initialization.

The transport uses native `fetch`, rejects redirects, never automatically retries and keeps a ten-second `AbortSignal.timeout` deadline through body consumption. Native fetch is intentional: installed ofetch 1.5.1 clears its built-in timeout before reading the body. Success requires a UUID `id` and means provider acceptance. Error codes distinguish authentication, rate limiting, rejection, provider failure, timeout, network failure and invalid response. Raw provider messages and causes are discarded.

## Adapting authentication methods

The reference runtime uses email/password only. Methods can be combined or replaced deliberately through Better Auth's native options, without environment-derived feature flags or registries. Google OAuth and account linking are an [optional future extension](roadmap/roadmap.md#planned-future-work); no Google module, credentials or validated integration are included.

- **Credentials only:** keep the reference composition and configure its email transport.
- **Replace credentials in a derived project:** review the entire native method configuration, including recovery and verification callbacks. In 1.7.27, password recovery remains active when `sendResetPassword` is configured and `emailAndPassword.enabled` is false. Preserve the actual `emailVerified` value and keep method policy separate from resource authorization.
- **Remove unused mail:** remove the startup plugin, runtime sender and scheduling composition, email-module imports/types, provider files and unused `runtimeConfig` keys/environment values. Adjust setup documentation and email fixtures/tests. Preserve session lookup and the native auth handler.
- **Replace Resend:** implement the replacement provider's configuration check, sender and sanitized error mapping. Wire that provider in `server/email/index.ts` and update the runtime setting declarations, setup and provider fixtures. The shared development console behavior applies when the replacement provider's settings are absent or empty.

These are explicit source changes for a derived project; no runtime capability detection is provided. [ADR 001](decisions/001-better-auth.md) owns the authentication boundary.

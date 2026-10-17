# Authentication

## Server integration

`server/auth/options.ts` is the typed Better Auth factory. It accepts parsed auth settings, the existing Drizzle client and an optional `SendEmail` function. The CLI omits the function and needs no email or Nitro initialization. Runtime assembly creates auth per request and supplies a function that registers delivery with that request's `event.waitUntil`. The catch-all forwards `event.req` to the native handler.

Better Auth and its adapter resolve to **1.7.9**. The adapter uses `@better-auth/drizzle-adapter/relations-v2`, PostgreSQL, explicit table mapping and `transaction: false` for the reference Neon HTTP driver's capabilities. See [database](database.md#runtime-integration) and [ADR 002](decisions/002-neon-http.md). Sessions are database-authoritative and cookie caching is disabled ([ADR 003](decisions/003-cookie-cache-disabled.md)).

## Credential and verification policy

Email/password is enabled explicitly, with 8–128 character password bounds, `requireEmailVerification: true` and `revokeSessionsOnPasswordReset: true`. Missing email credentials never change these options. Better Auth owns hashing, normalization, tokens, expiry and endpoint validation. Password whitespace is preserved and the installed scrypt implementation applies Unicode NFKC normalization.

Registration sends verification through `sendOnSignUp: true`, creates no session and returns `token: null`. Duplicate registration uses Better Auth's generic synthetic-user response rather than the former HTTP 422. Do not treat its user ID as proof that a new database account exists. Wrong passwords and nonexistent users return the same native HTTP 401. A correct password for an unverified account returns HTTP 403 `EMAIL_NOT_VERIFIED`.

Verification uses Better Auth's URL unchanged. `autoSignInAfterVerification: false` requires explicit sign-in afterward. `sendOnSignIn: false` avoids adding another mail trigger; the native resend endpoint remains available. Tokens default to one hour. Replaying a valid verification link for an already verified account succeeds without creating a session; missing, altered and expired links fail through native responses/redirects.

Recovery also uses the native callback and link. A successful reset consumes its token, revokes all prior sessions and requires new sign-in. With the reference adapter's transactions disabled, token consumption, revocation and password update are not an atomic unit. Failures can consume the token before all operations finish; do not automatically retry or claim rollback guarantees.

## Session requirement

`server/utils/require-session.ts` exports `requireSession(event)`. It reads Better Auth's session using the request headers and returns only `{ id, name, email, emailVerified }`. A missing/expired session raises HTTP 401 with `data.code: UNAUTHENTICATED`. Lookup errors propagate as server errors.

The helper does not infer an authentication method or require `emailVerified`. It preserves that field's actual value. Email/password verification is enforced by Better Auth during credential sign-in; OAuth applies its own provider policy. Any stricter resource authorization must be explicit. A client redirect or caller-supplied identity header is never an authorization source. No account API or client auth state is implemented yet.

## Configuration and initialization

Auth owns validation of its secret and canonical origin; database and provider modules own their settings. Only sanitized variable-name error formatting is shared. HTTPS is required outside localhost development.

A synchronous Nitro plugin initializes the reference email transport once per runtime, using effective `useRuntimeConfig()` values. Importing modules does not read configuration or create a sender. There is no network probe or per-request validation. Prerender skips email initialization; the build and auth CLI do not need production email credentials.

| Runtime | Email configuration |
| --- | --- |
| Nuxt development, both values exactly empty | Application starts without a transport; attempted sends fail observably. |
| Development, partial or invalid settings | Initialization throws a sanitized configuration error. |
| Production Node server | Both settings must be valid at initialization. |

Runtime callbacks remain configured even when development has no transport. A registration can therefore create an unverified account before the send fails; password sign-in remains blocked. Sessions and existing-link consumption need no new send. After adding email settings, restart the runtime to initialize the transport. This is availability of the configured integration, not automatic selection of auth methods.

### Verification and recovery delivery

The email service waits for the provider's result and propagates failures. Only the request integration registers its promise with `event.waitUntil`, observes rejection and returns without waiting for provider acceptance. Registration occurs before transport I/O. A registration failure prevents the send, logs a sanitized event and throws a sanitized integration error. There is no auth preflight hook, sender-preparation cache, execution provider or `advanced.backgroundTasks.handler`.

Better Auth 1.7.9's `runInBackgroundOrAwait` catches callback failures during registration and recovery; explicit verification resend awaits the callback directly and may expose a registration failure as an HTTP error. Anonymous resend retains its native 500 ms floor. There is no uniform preflight HTTP 503. Provider failures inside the registered task do not change the HTTP acknowledgement. See the matching [context](https://github.com/better-auth/better-auth/blob/v1.7.9/packages/better-auth/src/context/create-context.ts) and [resend source](https://github.com/better-auth/better-auth/blob/v1.7.9/packages/better-auth/src/api/routes/email-verification.ts).

Own events are `auth_email_requested`, `auth_email_accepted` and `auth_email_failed`, with a random `deliveryId` and fixed purpose. Acceptance includes `providerMessageId`; failures contain a local code, including `not_configured` or `background_registration` at the runtime boundary. No recipient, subject, body, link, token or credentials are logged by these events.

An acknowledgement is not provider acceptance or inbox delivery. A validly configured provider can fail after account creation; retain the unverified account and request a new link later. Timeout/network failures can leave acceptance unknown, so retries could duplicate messages. Background execution removes provider latency from the response, not all database/timing differences. Preserve native generic responses and rate limits without promising timing equivalence. See [deployment](deployment.md#background-tasks) and [ADR 005](decisions/005-background-tasks.md).

### Isolated email transport

`server/email/providers/resend.ts` owns Resend configuration, native-fetch HTTP transport and sanitized errors. It has no auth, Nitro, Vercel or environment imports. Configuration is checked by Zod before sending; `Email` is a TypeScript interface, not a second runtime input schema.

The transport uses native `fetch`, rejects redirects, never automatically retries and keeps a ten-second `AbortSignal.timeout` deadline through body consumption. Native fetch is intentional: installed ofetch 1.5.1 clears its built-in timeout before reading the body. Success requires a UUID `id` and means provider acceptance. Error codes distinguish authentication, rate limiting, rejection, provider failure, timeout, network failure and invalid response. Raw provider messages and causes are discarded.

## Adapting authentication methods

Methods are changed deliberately through Better Auth's native options, not environment-derived feature flags or registries.

- **Credentials only:** keep the reference composition and configure its email transport.
- **Credentials plus Google:** compose `createGoogleProvider(config)` into native `socialProviders`, configure both Google credentials and review the existing linking policy. Google is not connected in the reference runtime yet.
- **OAuth only:** disable/remove `emailAndPassword` and remove `sendResetPassword`. In 1.7.9, `enabled: false` alone does not disable recovery when its callback remains. Review `emailVerification.sendVerificationEmail`, `sendOnSignUp`, `sendOnSignIn`, `autoSignInAfterVerification` and related options against the chosen OAuth provider policy; remove the entire block if unused. `sendOnSignUp` can also send to new OAuth users whose provider reports an unverified address. Keep the real `emailVerified` field and evaluate each provider's verification guarantees.
- **Remove unused mail:** remove the startup plugin, runtime sender and scheduling composition, email-module imports/types, provider files and unused `runtimeConfig` keys/environment values. Adjust setup documentation and email fixtures/tests. Preserve session lookup and the native auth handler.
- **Replace Resend:** replace the transport and provider-specific configuration/error mapping in the email module, then update environment settings, setup and transport fixtures/tests. Better Auth and HTTP scheduling do not change.

These are explicit source changes for a derived project; no runtime capability detection is provided. [ADR 001](decisions/001-better-auth.md) owns the authentication boundary.

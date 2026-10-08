# Roadmap

This file describes future work only. Current behavior lives in [authentication](../authentication.md), [database](../database.md), [testing](../testing.md) and [deployment](../deployment.md); setup lives in [README](../../README.md). Architectural constraints live in [ADRs](../decisions/001-better-auth.md).

Phase numbers are retained for dependency references. Phases 1–3 and credential registration/sign-in/sign-out are represented by current documentation, not completed checklists. Recheck exact installed versions and official guidance before implementing each phase. Required and quality/hardening work both gate production.

Implement one architectural or security decision at a time, test it, and review its ownership boundary before advancing. Within Phase 4, proceed through email transport/callbacks, verified-email/reset policy, Google/linking, then the authorization/input contract.

<a id="phase-4"></a>

## Phase 4 — Authentication methods and server authorization

### Goal

Complete the server's email/password, verified-email, recovery and Google policies. Add policy tests now; page access and the account endpoint follow in Phase 5.

### Preconditions

- Phase 3's handler, shared auth factory, migration and live-server fixtures pass. Recheck Better Auth/adapter 1.7.3 and Zod 4.5.4 against installed source/types.
- Obtain a Resend sending key, verified sender, controlled recipient mailbox and Google web OAuth credentials. Use [README configuration](../../README.md#environment-configuration). These external resources were not created during planning.
- Read the official Better Auth setup, email/password and security skills, but verify their generic examples against 1.7.3. In particular, do not copy unpinned CLI commands, obsolete hooks or old rate-limit custom storage APIs.

### Boundary acceptance

- [ ] Keep email/password directly configured in Better Auth, Google in its concrete provider module, and email callbacks using a simple sendEmail boundary. No registries or mirrored feature configuration.
- [ ] Verify authenticated users/accounts, sessions and authorization with credentials+Google, credentials-only and Google-only. Credentials UI/flows may be removed manually. Removing Google must remove its settings requirements without changing core identity handling.

### 2. Connect real email delivery for verification and password recovery, following [Better Auth's email guidance](https://better-auth.com/docs/concepts/email).

- [ ] Implement `server/email/providers/resend.ts` as one typed Resend sender. POST to `https://api.resend.com/emails` with bearer authentication and `from`, `to`, `subject` and text content. Use a bounded timeout and no blind automatic POST retries; validate success and classify provider errors without logging request bodies. [Resend send API](https://resend.com/docs/api-reference/emails/send-email).
- [ ] Connect `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword` to the sender, preserving Better Auth's supplied URL. Do not generate verification/reset tokens, store duplicate tokens or replace their expiry checks. Use simple text emails; no template platform is required.
- [ ] Connect `advanced.backgroundTasks.handler` to the current Nitro event's supported `waitUntil` lifetime. Extend `server/utils/auth.ts` to pass a request-scoped scheduler into the factory; never retain an event globally. In both email callbacks, register the actual delivery promise with that scheduler and resolve after registration. Installed 1.7.3's resend path directly awaits `sendVerificationEmail`, so the background option alone does not make every callback nonblocking. Verify the installed H3/Nitro event API and Vercel preset before deployment. [Better Auth options](https://better-auth.com/docs/reference/options), [H3 event lifetime](https://h3.dev/guide/api/h3event).
- [ ] Ensure sending does not create an account-existence timing distinction, and scheduled failures reach sanitized operational reporting. Do not use a detached `void sendEmail()` that Vercel may terminate. Add a test proving the promise is registered with the event lifecycle and rejection is handled.
- [ ] Verify real receipt and usable links with a controlled mailbox. Test provider timeout, 429, rejected sender and invalid key using an injected test transport, not actual repeated mail. User-facing acceptance means the request was accepted, not proof of inbox delivery.

### 3. Define verified-email access and password-reset session behavior.

- [ ] Set `emailAndPassword.requireEmailVerification: true`, `emailVerification.sendOnSignUp: true`, and choose `autoSignInAfterVerification: false` so verification leads to explicit sign-in. Document link lifetimes from the actual configured options. [Email verification guidance](https://better-auth.com/docs/concepts/email).
- [ ] Add `server/utils/require-session.ts`: resolve identity using `auth.api.getSession({ headers: event.headers })`, return 401 for absent/expired identity and 403 with a stable safe code for an unverified identity. Return only the server-verified user needed by callers. The verified-email rule must apply to Google sessions too; the credential option alone does not enforce that.
- [ ] Set `emailAndPassword.revokeSessionsOnPasswordReset: true`. Require sign-in with the new password after reset; retain disabled cookie caching so old sessions cannot survive in a cache.
- [ ] Add integration cases for sign-in before/after verification, missing/tampered/expired verification and recovery tokens, repeated reset-token use, old-password rejection and revocation of two preexisting sessions. Test documented verification replay behavior rather than inventing a token contract.
- [ ] Capture callback URLs through the test email transport and exercise Better Auth's real token endpoints. Never set `emailVerified` directly merely to bypass verification in end-to-end tests.

### 4. Configure Google OAuth credentials, callbacks and account-linking policy.

- [ ] Configure a Google OAuth web application with consent/test users as applicable. Register `http://localhost:3000/api/auth/callback/google` plus the exact controlled preview and production HTTPS callbacks. Store credentials in the private config pair and reject incomplete configuration when Google is enabled. [Google integration](https://better-auth.com/docs/authentication/google).
- [ ] Compose `createGoogleProvider(config)` from `server/auth/providers/google.ts` into native `socialProviders`; the module requires both credentials. Use its documented default identity scopes; do not request offline access or unrelated Google API permissions for sign-in.
- [ ] Preserve Better Auth's normal implicit linking for trustworthy OAuth identities with its verification/trust safeguards. Do not force explicit linking or add provider fields to users. [Account linking](https://better-auth.com/docs/concepts/users-accounts).
- [ ] Preserve Better Auth's OAuth state/cookie validation and callback checks. Handle canceled consent, provider errors, absent/unverified email claims and a same-email collision without granting unintended account access.
- [ ] Add tests for provider configuration and linking decisions using provider-boundary fixtures. Record a separate real Google sign-in/cancel/manual callback check; mocked OAuth alone cannot prove Google console configuration.

### 5. Validate custom endpoint input and return appropriate authentication/authorization errors.

- [ ] Define the endpoint contract for Phase 5: `GET /api/account` accepts no user selector and returns a minimal current-user projection. Return 401 for no session, 403 for a verified-email policy failure, and 400 for malformed custom input. Use 404 for inaccessible resources only if a resource endpoint is actually introduced later.
- [ ] Test `require-session.ts` in a Nuxt-aware/server fixture now, including a forged identity header and a null session. Do not introduce a speculative public endpoint solely to test the helper.
- [ ] For any custom input introduced in this or subsequent phases, parse body/query with Zod 4 at the handler and explicitly allowlist writable properties. Never trust `userId`, `emailVerified`, roles or ownership supplied by a browser.
- [ ] Leave Better Auth's built-in input validation and response format intact. Profile updates in Phase 6 use its `updateUser` API; add narrow supported server validation for name constraints, not an auth proxy.
- [ ] Preserve auth-origin/CSRF defaults now; custom future mutations need their own verified protection. The planned account endpoint is read-only, so no separate mutation/CSRF framework is justified.

### Phase verification

- [ ] Verify real email receipt, verification, recovery and Google sign-in with controlled development accounts; log only redacted outcomes.
- [ ] Run the new tests for verification policy, token failure cases, session revocation, provider failures and accepted/rejected linking decisions. Update Phase 3 tests to obey verified-email sign-in.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build`. Missing provider access remains an explicit incomplete manual check.

### Expected state after completion

Authentication methods and server identity policy work independently of UI. Emails have a reliable serverless lifecycle, reset revokes sessions, trustworthy OAuth identities link through Better Auth’s normal account model, and policy tests accompany the implementation.

<a id="phase-5"></a>

## Phase 5 — Client sessions and page access

### Goal

Connect Better Auth's authoritative session to Nuxt SSR and navigation, with server-protected current-account data and safe redirects.

### Preconditions

- Phase 4's server policies, real handler and tests pass. Relevant versions are Nuxt 4.5.2, Better Auth 1.7.3, Vue 3.5.42 and i18n 10.6.0.
- Installed `better-auth/dist/client/vue/index.d.mts` confirms the Nuxt overload `useSession(useFetch)`. Its implementation uses a stable Nuxt fetch key and watches the Better Auth session signal. The returned SSR overload has `data`, `error` and a resolved `isPending: false`; do not assume it exposes every AsyncData method.
- Keep `no_prefix` locale routing. The chosen route contract is `/sign-in`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` and `/account`; full screens belong to Phase 6.

### 1. Protect a minimal account endpoint using server-verified identity and ownership.

- [ ] Add `server/api/account.get.ts`; call Phase 4's `require-session.ts` before reading data. Derive the user exclusively from the verified session.
- [ ] Return an explicit projection such as `{ user: { id, name, email, emailVerified } }`. Do not serialize the session record, cookie token, account rows, OAuth tokens, password hash, IP or user agent.
- [ ] Accept no `userId` parameter. Reject unsupported selector query input with 400 using a small strict query schema; this makes the ownership contract unambiguous without adding user-by-ID CRUD.
- [ ] Set `Cache-Control: private, no-store` on success and errors. Keep this route outside Nitro cached handlers and SWR/ISR rules.
- [ ] Add live-server tests for anonymous 401, unverified 403, own-account success and attempts by user A to select user B. Prove B's data never appears and forged identity headers have no effect.

### 2. Integrate the Better Auth client as the single session authority.

- [ ] Create `app/lib/auth-client.ts` exporting `createAuthClient()` from `better-auth/vue` with the same-origin default endpoint. No database imports, server factory imports or public secret values are allowed.
- [ ] Use this client directly for auth actions. Do not add a generic API wrapper, Pinia session store, parallel `useState` session, localStorage token or custom `/api/session` proxy.
- [ ] Infer types from client results or type-only auth inference where supported. Ensure a type-only reference does not become a runtime import across the server boundary.

### 3. Resolve sessions correctly during SSR, hydration and client navigation.

- [ ] Use `await authClient.useSession(useFetch)` in setup and route middleware for session-dependent rendering. This is the documented 1.7.3 Nuxt integration; no manual cookie forwarding is needed. [Better Auth Nuxt integration](https://better-auth.com/docs/integrations/nuxt).
- [ ] Fetch `/api/account` with relative `useFetch` from the account page so Nuxt carries the current request context and reuses hydration data. Keep its result as account-page data, not another authentication authority.
- [ ] Preserve the library's cache key/session signal behavior. Do not use the client-only `useSession()` overload as the source of protected SSR HTML, or wrap protected content in `ClientOnly` to hide a mismatch.
- [ ] Add concurrent user-A/user-B SSR requests and compare their rendered payloads to detect cross-request state leakage. Test authenticated refresh, guest refresh and navigation with revoked cookies.
- [ ] Add Nuxt runtime tests under `test/nuxt/` for middleware and session consumers, plus live-server SSR cases under `test/e2e/`. Do not treat happy-dom assertions as a real browser hydration check.

### 4. Add authenticated-page and guest-page access rules.

- [ ] Add named `app/middleware/auth.ts` and `app/middleware/guest.ts`; await session resolution, handle fetch errors separately from a valid null session, and always return `navigateTo` when redirecting.
- [ ] Auth middleware sends guests to `/sign-in?redirect=...`, and unverified signed-in users to `/verify-email`. Guest middleware redirects a verified signed-in user from `/sign-in` or `/register` to the safe destination or `/account`.
- [ ] Add minimal route shells only as needed to make this phase's navigation executable. Opt `/account` into auth middleware and sign-in/register into guest middleware via `definePageMeta`; Phase 6 replaces shell contents with forms.
- [ ] Keep verification and reset landing routes reachable regardless of guest middleware. Otherwise an existing session could prevent completion of a recovery link. Do not apply a global redirect to `/api/auth` callbacks.
- [ ] Assert missing-session, verified, unverified and upstream-error outcomes. A session service outage must present a retry/error state, not an endless sign-in redirect.

### 5. Preserve safe return destinations without redirect loops.

- [ ] Add a pure `shared/utils/safe-redirect.ts` helper for the route contract. Accept a single local path, validate it with URL parsing against a fixed trusted origin, and return the normalized pathname/search/hash only for allowlisted application destinations (initially `/account` and `/`). Fall back to `/account`.
- [ ] Reject arrays, protocol-relative URLs, schemes, backslashes, control characters and encoded attempts that normalize to an external destination. Reject auth form routes, `/api/` and unsupported paths to prevent loops.
- [ ] Apply the same helper whenever consuming `redirect` for sign-in, registration and Google success callbacks. Preserve it through verification only when it can be carried safely; otherwise use `/account` consistently. Do not pass raw query values to `navigateTo` or OAuth callback parameters.
- [ ] Add `test/unit/safe-redirect.test.ts` with local query/hash preservation, external URLs, `//host`, backslashes, encoded separators, duplicate query values and loop destinations. Keep it independent of Nuxt.

### 6. Handle session loading, expiry and sign-out consistently.

- [ ] Distinguish unresolved/error states from a resolved guest in navigation and page shells. Use the documented hook's actual return types; track mutation pending state locally in the component rather than duplicating identity.
- [ ] After successful sign-out, let Better Auth invalidate its session signal, clear account-page data through Nuxt's data API and navigate to `/sign-in`. Do not clear identity optimistically on a failed sign-out request; show a retryable error.
- [ ] On account API 401, clear only stale page data and resolve the authoritative session before returning to sign-in. On 403 show the verification path. Keep transient 5xx failures distinct.
- [ ] Test sign-out from a second tab, session expiry while a page is open, browser back navigation and an expired cookie on hard refresh. Verify no old account content remains visible after revocation is observed.

### Phase verification

- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build` with both unit and server fixtures.
- [ ] Manually inspect a production-preview browser: direct `/account` load, refresh, client navigation, sign-out/back, and concurrent sessions. Confirm no hydration warnings or protected-content flash.
- [ ] Confirm account ownership is enforced over direct HTTP without relying on route middleware, and all untrusted redirect cases fall back safely.

### Expected state after completion

The account endpoint enforces identity and ownership. SSR, hydration and navigation use Better Auth's supported Nuxt session integration, with minimal route shells ready for the Phase 6 screens.

<a id="phase-6"></a>

## Phase 6 — Authentication and account UI

### Goal

Deliver usable, localized and accessible authentication/account screens on the server and session foundations, with tests for each form's meaningful behavior.

### Preconditions

- Phases 3–5 pass, including email, recovery, Google, account ownership and route-shell behavior. Preserve the Phase 5 URL contract and middleware.
- Relevant resolved versions: vee-validate 5.0.0-beta.1, Zod 4.5.4, Vue 3.5.42, Reka UI 2.10.4, shadcn-nuxt 2.8.2, Tailwind 4.3.3 and i18n 10.6.0. Read the Vue, shadcn-vue, Reka and i18n skills before their implementation work.
- Reuse existing `UiInput`, field/label/error components, button, card, spinner, skeleton and `UiPageContainer`. `app/app.vue` already mounts a toaster and sets reactive HTML language. `components.json` owns `app/components/ui/` and `app/lib/utils.ts`.

### 1. Build registration, sign-in and Google sign-in screens.

- [ ] Implement `app/pages/register.vue` with name/email/password and `app/pages/sign-in.vue` with email/password. Use native forms, correct input types/autocomplete, submit buttons and the named guest middleware.
- [ ] Submit through `authClient.signUp.email` and `authClient.signIn.email`. Include only validated fields and Phase 5's safe callback destination. On registration, show a generic check-email outcome consistent with the server's duplicate-account behavior.
- [ ] Add a Google button using `authClient.signIn.social({ provider: 'google', ... })`, with safe success and error destinations. Give it `type="button"` inside forms and prevent duplicate actions while pending.
- [ ] Link sign-in, registration, forgotten password and the public home using Nuxt links. Do not nest links inside actual button elements; use the existing `as-child` composition where appropriate.
- [ ] Add component tests for valid submission, rejected fields, safe redirects, disabled pending actions and provider-start failure, using client-boundary mocks rather than mocking the forms themselves.

### 2. Add email-verification, resend, forgotten-password and reset-password screens.

- [ ] Implement `app/pages/verify-email.vue` as the check-email/resend/result screen. Let the Better Auth verification endpoint consume its token and return to this page; avoid reimplementing verification in a custom Nitro route.
- [ ] Use `authClient.sendVerificationEmail` for explicit resend with a validated email and safe callback URL. Display a generic acknowledgement and a retry state; do not reveal whether an address is registered or already verified.
- [ ] Implement `app/pages/forgot-password.vue` with `authClient.requestPasswordReset`, using the absolute reset destination built from the configured same-origin flow. Keep known/unknown address outcomes indistinguishable.
- [ ] Implement `app/pages/reset-password.vue`: validate the token/query shape, show a new-password/confirmation form, and call `authClient.resetPassword`. Handle missing, invalid, expired and used tokens with a link to request another email. Never persist tokens in localStorage or log them.
- [ ] On reset success, remove the sensitive token query via replacement navigation and send the user to sign-in. Keep verification/reset screens available even when a session exists, as specified in Phase 5.
- [ ] Test resend, recovery acceptance, invalid links and successful reset through component tests; extend live-server tests to follow the URLs captured by the email fixture.

### 3. Add a protected account page with basic profile editing and sign-out.

- [ ] Replace the `/account` shell with SSR account data from `useFetch('/api/account')` and the auth middleware. Display the server-provided name, email and verification state.
- [ ] Scope basic editing to the display name (for example trimmed 1–100 characters). Keep email read-only; email change, account deletion, uploads and linked-provider management remain deferred.
- [ ] Submit through `authClient.updateUser({ name })`, preserving Better Auth ownership checks. Enforce the same name rule server-side in a supported narrow Better Auth user-create/update hook in `server/auth/options.ts`; throw a documented safe API error for invalid names. Do not add a parallel profile mutation proxy.
- [ ] After successful update, let the client signal refresh session consumers and refresh the account page's fetched data. Preserve unsaved text on failure; update displayed data only after confirmed success.
- [ ] Wire sign-out to Phase 5's behavior and account/header navigation into `AppHeader.vue`. Add tests proving forged `userId`/`emailVerified` updates cannot change identity or another user's data through the built-in endpoint.

### 4. Apply vee-validate + Zod to forms while retaining authoritative server validation.

- [ ] Add small schemas in `shared/validation/auth.ts` and `shared/validation/profile.ts` only where safe rules are shared. Keep auth secrets, adapter configuration and database types out of them.
- [ ] Pass Zod schemas directly to `useForm({ validationSchema, initialValues })`. vee-validate v5 supports Standard Schema; do not add `@vee-validate/zod` or `toTypedSchema`. Explicitly initialize fields and required UI attributes instead of relying on removed schema-default/required inference. [v5 migration](https://vee-validate.logaretm.com/v5/guide/migration/).
- [ ] Bind fields through the installed v5 APIs to existing shadcn input/field components. Follow current field composition, while checking any online shadcn sample against the beta's types. [shadcn form composition](https://shadcn-vue.com/docs/forms/vee-validate).
- [ ] Add password confirmation as a client-only cross-field rule; send only the new password and token to Better Auth. Keep sign-in passwords untransformed and keep length rules aligned with Phase 4.
- [ ] Map stable Better Auth error codes and server validation errors to localized field/form messages. Treat unknown errors as a generic retryable failure; never render raw provider/server HTML or stack traces.
- [ ] Add unit tests for actual boundary rules and component tests proving invalid input never invokes a mutation. Test direct server requests independently to prove bypassing the client cannot bypass validation.

### 5. Cover pending, success, invalid-input, expired-link and provider-failure states.

- [ ] For each screen define and implement idle, submitting, success and error behavior; include network timeout, 429, invalid credentials, unverified identity, Google cancellation/collision and email-delivery uncertainty where relevant.
- [ ] Block duplicate mutations and expose visible pending text/spinners. Keep operation-specific state local; ensure an error restores usable controls and does not strand focus on a disabled element.
- [ ] Honor Better Auth's returned rate-limit retry header (1.7.3 documents `X-Retry-After`) for useful retry messaging. UI throttling is only feedback; the server remains authoritative.
- [ ] Clear password fields after success/navigation, never place them in URLs, and preserve non-sensitive fields on recoverable errors. Avoid optimistic success when the API returned an error object.
- [ ] Add behavioral tests for double submit, slow response, invalid/expired links, rate limit and provider failure. Do not replace these with static snapshots alone.

### 6. Localize starter UI and verify keyboard access, labels and focus behavior.

- [ ] Add equivalent auth/account/navigation/error keys to `i18n/locales/en.json` and `es.json`. Preserve `strategy: 'no_prefix'`, the existing `i18n_redirected` cookie and root-only detection. [i18n routing](https://i18n.nuxtjs.org/docs/guide).
- [ ] Use locale-aware schema messages or map safe validation codes at render time; ensure switching language updates visible errors without losing entered values. Do not store translated text in a global server singleton.
- [ ] Associate every input ID with `UiFieldLabel`, descriptions and error IDs; use `aria-invalid` and `aria-describedby`. Keep errors available inline, with an appropriate live status for submit results; toasts alone are insufficient.
- [ ] Focus the first invalid input using the existing `UiInput` `inputRef` support. Use Reka primitives for menus/focus behavior, preserve visible focus rings and avoid nested interactive controls.
- [ ] Test keyboard-only tab order, Enter submission, dropdown Escape/focus return, browser autofill/password-manager behavior, narrow viewport and both languages. Verify SSR language and hydrated content agree.

### Phase verification

- [ ] Exercise registration → real email verification → sign-in → edit name → sign-out and recovery → new-password sign-in. Exercise Google sign-in/cancel/collision independently.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build`; include the new unit, Nuxt component and live-server cases.
- [ ] Inspect production-preview refresh/navigation in both languages with no hydration warnings, duplicate session authority or private data in page payloads beyond the allowed user projection.
- [ ] Record manual keyboard/focus/mobile findings and fix failures before considering the phase done.

### Expected state after completion

All scoped authentication and account screens are usable and tested alongside implementation. Phase 7 strengthens cross-flow/browser coverage and makes the checks mandatory in CI.

<a id="phase-7"></a>

## Phase 7 — Tests and CI gates

### Goal

Complete the tests introduced during Phases 3–6 and make meaningful validation a required merge/deployment gate. This phase does not defer basic implementation testing until the end.

### Preconditions

- Phases 3–6 already contain config/schema/redirect unit tests, Nuxt component/middleware tests and live-server auth/account tests.
- Recheck Vitest 4.1.11, Nuxt Test Utils 4.2.0, Vue Test Utils 2.5.0, happy-dom 20.14.0, TypeScript 6.0.3 and the Phase 1 Node/pnpm pair.
- The current test projects are described in [testing](../testing.md). Nuxt Test Utils 4.2.0 exports `e2e` and `playwright`; Playwright is an optional peer, not an installed direct project dependency. Add a browser dependency only for this concrete browser-testing requirement.

### 1. Define test-specific environment configuration.

- [ ] Document required test values in `docs/testing.md`; keep actual `.env.test` ignored. Use Phase 1's runtime variable names when starting Nuxt, with a unique test auth secret, localhost origin and isolated database URL.
- [ ] Require an explicit test database identity/allowlist before fixture cleanup or migration replay. Refuse absent configuration and development/production targets. Create an empty ephemeral branch/database for CI, or a dedicated isolated test target with serialized jobs.
- [ ] Select test email transport at the test factory/fixture boundary, never through a public production toggle or unauthenticated inbox endpoint. Keep OAuth mocks inside test fixtures; no real Google credentials are needed for ordinary deterministic CI.
- [ ] Load test environment configuration before constructing the Nuxt server and auth instance. Avoid accidentally inheriting developer `.env` credentials; use unique per-run test data and clean it in `finally`/teardown.

### 2. Cover pure validation and utilities with Vitest.

- [ ] Inventory `test/unit/` against Phase 1 settings parsing, Phase 5 safe redirects and Phase 6 validation. Add missing edge cases and meaningful expected outcomes, not tests that merely reproduce implementation expressions.
- [ ] Cover empty/whitespace names, password bounds and confirmation, invalid email, query arrays, encoded redirect attacks and partial private settings. Assert sensitive values do not appear in settings errors.
- [ ] Keep these tests in the existing Node environment with explicit imports. Do not boot Nuxt for pure schemas/helpers or introduce a new test framework.

### 3. Cover server authorization and session behavior with Nuxt-aware tests.

- [ ] Keep `test/nuxt/` for runtime composables, middleware and components using `@nuxt/test-utils/runtime`. Keep `test/e2e/` for a real Nitro server via `@nuxt/test-utils/e2e` in a separate Node project. [Nuxt test environments](https://nuxt.com/docs/4.x/getting-started/testing).
- [ ] Exercise real `/api/auth` and `/api/account` handlers with actual migrated test data for session creation, expiry, revocation, 401/403 and safe account projection. Do not substitute an always-authenticated mock for the security gate.
- [ ] Cover session lookup errors separately from guests, two independent cookie jars, concurrent SSR requests, unverified identities and forged headers/selectors.
- [ ] Keep time-sensitive unit behavior deterministic and integration lifetimes short/configured. Avoid arbitrary sleeps; wait on explicit state or controlled clock behavior where supported.

### 4. Test authentication flows, recovery links and cross-user access rejection.

- [ ] Complete sign-up → captured verification email → verification endpoint → sign-in → account → profile update → sign-out through real HTTP. Assert identity and database effects, not merely status 200.
- [ ] Complete recovery → captured reset URL → password replacement → old-password rejection → all-old-session rejection → fresh sign-in. Include missing/tampered/expired/reused tokens.
- [ ] Create users A and B and prove A cannot select B's account or mutate B through `updateUser`; verify B's persisted name and verification state remain unchanged. Do not add a new user-by-ID endpoint just to create a cross-user test.
- [ ] Test known/unknown email request responses, repeated resend and provider transport failure with deterministic transport fixtures. Keep tokens/cookies/passwords out of snapshots and CI artifacts.
- [ ] Cover Google cancellation, state mismatch and linking policy with provider-boundary mocks, while maintaining a manual real-provider smoke checklist for Phase 9. CI must not claim that a mock verifies Google's callback registration.

### 5. Verify protected-page refreshes, redirects and hydration in a browser.

- [ ] Add a compatible pinned `@playwright/test` development dependency and Chromium installation for the browser job; verify the release against Nuxt Test Utils' optional peer range. Keep it separate from happy-dom tests. Use `@nuxt/test-utils/playwright` or the documented e2e browser integration, not both competing harnesses.
- [ ] Add `playwright.config.ts`, a `test:browser` script and `test/browser/` cases. Start a production-built app with isolated test settings, wait for readiness, and close the process/fixtures after each run.
- [ ] Test anonymous direct `/account`, successful sign-in redirect, authenticated hard refresh, safe return query, sign-out/back navigation, reset landing with an existing session and session expiry in another tab.
- [ ] Capture browser console/page errors and fail on hydration mismatch. Assert protected account data is absent from guest HTML and no other user's payload leaks across sessions.
- [ ] Cover one English and one Spanish form flow, field labels, invalid-field focus and keyboard submission. Store failure traces only with short retention and scrub/avoid credential-bearing URLs and bodies.

### 6. Test migrations against an isolated empty database.

- [ ] In a dedicated CI step, provision/choose an empty permitted test target and run `pnpm db:migrate` using committed migrations only. Confirm core tables and constraints, then run again and assert no new migration is applied.
- [ ] Run auth integration tests against that migrated target. This proves the committed schema supports the current adapter instead of relying on a developer database updated by `push`.
- [ ] Run `pnpm db:generate` in a disposable checkout after tests and fail on unexpected tracked/untracked migration changes. Do not commit generated drift from CI or modify the migration under test.
- [ ] Dispose of only the per-run target after completion. Keep branch API credentials scoped to test infrastructure and never expose them to untrusted pull-request code.

### 7. Require lint, typecheck, actual tests and production build in CI.

- [ ] Create the repository-host CI workflow (for GitHub, `.github/workflows/ci.yml`) with the supported Node/pnpm versions and `pnpm install --frozen-lockfile`. Preserve the lockfile and package-manager trust/build settings.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build`, plus `pnpm test:browser`. Configure jobs so migrations precede database tests and the production build precedes browser tests.
- [ ] Fail on zero discovered tests, skipped required suites, migration drift and any command failure. Report missing test infrastructure as a failed required gate rather than a success with silent skips.
- [ ] Configure required checks/branch protection and deployment gating. Separate secret-free lint/unit checks for untrusted contributions from trusted integration execution; do not use a privileged workflow to run unreviewed fork code with secrets.
- [ ] Verify a deliberately broken auth assertion and a deliberate type error fail the expected checks, then remove those temporary failures. Record commands, test counts and manual-only checks in `docs/testing.md`.

### Phase verification

- [ ] A clean CI run discovers and passes actual unit, Nuxt, server and browser tests using migrations replayed from an empty target.
- [ ] A failure in any required command blocks merge/deployment, and untrusted code receives no protected secrets.
- [ ] Confirm no `passWithNoTests`, blanket skips, production test bypasses or leaked auth artifacts exist.

### Expected state after completion

The starter has reliable repeatable tests and mandatory CI checks. Real provider and deployment behavior remains explicitly covered by Phase 9's manual environment smoke tests.

<a id="phase-8"></a>

## Phase 8 — Security and operational readiness

### Goal

Verify production security assumptions and document manageable operational recovery before deployment. Keep the roadmap's deferred infrastructure and full recovery rehearsal out of scope.

### Preconditions

- Phases 1–7 pass. Inspect final auth options, built responses and test fixtures rather than assuming defaults alone establish security.
- Recheck Better Auth/adapter 1.7.3, Drizzle RC.4 and deployment behavior. The installed security skill has some generic legacy examples; current 1.7.3 docs/types take precedence where they differ (for example atomic rate-limit consumption).
- Use test/preview targets and controlled accounts. No production credentials or external infrastructure changes were made while writing this plan.

### 1. Verify trusted origins, secure cookies, CSRF protection and safe redirects.

- [ ] Review configured canonical origins for local, controlled preview and production. Restrict trusted origins to controlled hosts; do not reflect arbitrary `Host`/forwarded headers into the allowlist or trust all `*.vercel.app` projects.
- [ ] Keep Better Auth origin/CSRF checks enabled. Exercise requests from allowed, foreign and missing origins plus relevant Fetch Metadata combinations, comparing results to documented behavior rather than disabling checks for tests. [Better Auth options](https://better-auth.com/docs/reference/options).
- [ ] Inspect real HTTPS response cookies for Secure, HttpOnly, appropriate SameSite and path/domain scope. Keep host-scoped defaults; do not enable cross-subdomain cookies or weaken them for OAuth without a demonstrated need.
- [ ] Re-run the safe-redirect attack corpus against both client consumption and Better Auth callback URLs. Confirm Google state/callback cookies survive the real flow and a modified state is rejected.

### 2. Verify that the selected authentication rate-limiting strategy is appropriate for Vercel's serverless deployment model.

- [ ] Select Better Auth's built-in database storage on Neon (`rateLimit.storage: 'database'`) with rate limiting explicitly enabled in the tested production configuration. In-memory counters do not aggregate across Vercel instances; Redis and custom storage are unnecessary for this starter. [Rate limiting](https://better-auth.com/docs/concepts/rate-limit).
- [ ] Regenerate the auth schema through the pinned Phase 3 CLI after this option changes. Review the added rate-limit table/unique key and produce a new versioned migration; do not rewrite the initial migration. This is auth infrastructure required by this checklist item, not a new domain feature.
- [ ] Review default rules and set justified limits for sign-in, sign-up, resend and reset using exact mounted-library-relative rule paths from installed types/source. Do not copy a skill example's `/api/auth` prefix without checking its matcher.
- [ ] Verify trusted proxy/IP handling on Vercel and prevent caller-controlled forwarded headers from selecting arbitrary limit identities. Test IPv4/IPv6 and shared-IP behavior with controlled traffic.
- [ ] Test simultaneous requests through separate auth instances sharing the test database: counters aggregate, excess attempts produce 429 with retry metadata, windows expire, and database failure has understood behavior. Check the built-in adapter's atomic implementation; do not introduce the obsolete custom `get`/`set` limiter shape.
- [ ] Measure reasonable request latency and table growth for the expected starter workload; document maintenance using supported database operations if needed. Do not add a queue, cron service or cache infrastructure speculatively. If concurrency enforcement fails, block deployment and investigate the supported adapter behavior.

### 3. Check account enumeration, OAuth linking and session-revocation behavior.

- [ ] Compare existing/non-existing addresses for registration, sign-in, resend and recovery at the HTTP boundary, including status/body and gross timing differences. Confirm slow email delivery does not determine response timing. Do not promise mathematically identical network timing.
- [ ] Verify trustworthy same-email OAuth identities link normally while unsafe linking is rejected, provider identity is not synthesized, and unverified sessions cannot access `/api/account`.
- [ ] Confirm sign-out invalidates its session, reset invalidates all prior sessions, and expired cookies cannot read account data. Keep cookie caching off unless a later explicit requirement justifies and tests its revocation delay. [Session management](https://better-auth.com/docs/concepts/session-management).
- [ ] Add regression cases for every discovered gap to the Phase 7 suite; do not treat a manual audit as a substitute for repeatable authorization tests.

### 4. Ensure personalized responses cannot leak through shared caching.

- [ ] Audit `nuxt.config.ts` route rules, Nitro handlers and Vercel cache settings. Exclude `/api/auth/**`, `/api/account` and personalized pages from prerendering, ISR/SWR and shared response caches.
- [ ] Set/test private no-store behavior for account, auth and personalized page responses, including redirects/errors and cookies. Remove any broader cache rule that overrides this intent; do not rely on `Vary: Cookie` alone.
- [ ] Fetch the same URL in order as user A, guest and user B through preview's actual delivery path. Compare body/HTML/payload and cache headers; no prior identity may appear.
- [ ] Keep static public asset caching intact. Browser history state must also clear after sign-out as tested in Phase 5.

### 5. Keep passwords, tokens and sensitive user data out of responses and logs.

- [ ] Audit auth/account serializers, `console` calls, exception reporters and provider failures. Keep logs to event category, safe error code, timestamp and correlation identifier; redact cookies, Authorization, database URLs and sensitive request/query bodies.
- [ ] Keep the minimum intended current-user fields in session/account responses. Never serialize raw account/password/OAuth records; do not attempt to remove fields required by Better Auth's supported client contract without verification.
- [ ] Check reset/verification URL handling, referrer policy and third-party page requests so credential-bearing links are not sent as referrers. Use `Referrer-Policy: no-referrer` for these screens and avoid unnecessary third-party resources there.
- [ ] Inspect test traces, provider logs and deployed exception logs with disposable marker secrets; ensure reports and support instructions do not request raw tokens or passwords.

### 6. Document secret rotation, database recovery and failed-deployment handling.

- [ ] Create the operations runbook to be added to `docs/deployment.md` listing secret owners, storage location, rotation sequence and verification for auth secret, Neon password, Google secret and Resend key; record no actual values.
- [ ] For auth-secret rotation, inspect 1.7.3's supported rotation options and document effects on sessions, verification links and any encrypted stored OAuth data. Do not assume changing one string preserves all encrypted material; require reauthentication/relinking where necessary.
- [ ] Document Neon's configured restore retention, responsible operator and restore-to-new-branch/cutover procedure, with checks of schema, migrated version and user/session consistency. A complete database-recovery rehearsal remains deferred. [Neon recovery](https://neon.com/docs/introduction/branch-restore).
- [ ] Describe failed migration/deployment handling: stop rollout, identify the last compatible application/schema pair, preserve migration history, prefer forward correction, and roll back application code only when schema-compatible. Never run destructive reverse SQL automatically.
- [ ] Include email-provider outage handling, investigation using safe event IDs, user resend/recovery guidance and credential compromise response. Keep this a short runbook, not a new monitoring platform.

### Phase verification

- [ ] All origin/cookie/redirect, shared rate-limit, revocation and cache-isolation checks pass on isolated targets.
- [ ] Replay the additional rate-limit migration and run `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` and browser tests.
- [ ] Review the runbook with the deployment owner and confirm no unresolved security failure is waved through to production.

### Expected state after completion

The starter has verified production safeguards, shared database-backed auth throttling and a concrete operational runbook. It is ready for the controlled preview/production rollout in Phase 9.

<a id="phase-9"></a>

## Phase 9 — Vercel and Neon deployment

### Goal

Deploy the validated starter through an isolated preview to production, with controlled migration sequencing and real provider verification.

### Preconditions

- Phases 1–8 pass, including required CI/browser checks, the rate-limit migration and operational runbook. Production is blocked by unresolved auth, isolation or migration failures.
- Obtain Vercel/Neon project access, domain/DNS control, Google console access, verified Resend sender and controlled test accounts. Confirm the intended production release and infrastructure targets before applying changes during implementation.
- Use Node 24 with the Nuxt-required minimum and the pinned pnpm version from Phase 1. Recheck platform support at deployment time. [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

### 1. Configure Vercel environments with appropriately isolated Neon databases.

- [ ] Import the repository as a Nuxt project using Vercel's supported framework detection and server deployment. Use `pnpm build`, not `pnpm generate`; this starter requires server auth routes. Do not copy generic static-output settings into the project. [Nuxt on Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt).
- [ ] Configure Development, Preview and Production values using the [README environment variables](../../README.md#environment-configuration). Verify both build and function runtime receive the intended values without printing them.
- [ ] Assign isolated Neon targets to each environment; previews must not use production user data. For concurrent previews, use separate branches or a deliberately serialized controlled preview target.
- [ ] Set runtime and migration credentials with only their required permissions. Pass the direct elevated URL to the migration job under `DATABASE_URL_UNPOOLED`; do not deploy it as the normal function credential.
- [ ] Match Vercel compute and Neon regions where practical. Verify frozen installation and the preserved pnpm build allowances on Vercel.

### 2. Configure production URLs, Google callbacks and a verified email sender.

- [ ] Configure the controlled preview hostname and production domain with working TLS. Set each canonical auth URL explicitly; neither arbitrary request hosts nor unreviewed preview hostnames should define security policy.
- [ ] Register exact `/api/auth/callback/google` URLs in the corresponding Google application and verify consent publishing/test-user settings appropriate to each environment. Configure safe application return destinations independently of Google's provider callback.
- [ ] Complete Resend sender-domain verification using its required DNS records. Send a controlled message from the configured sender and inspect verification/reset links for the correct target environment.
- [ ] Ensure preview deployment protection allows the authorized test browser to complete Google/email redirects without weakening app origin checks. Keep real credentials and callback URLs out of reusable example files.

### 3. Establish a controlled migration step before deploying dependent application changes.

- [ ] Add a trusted release job or documented operator step that selects the target, checks migration review/CI results and runs `pnpm db:migrate` once before releasing dependent code. Serialize migration jobs per database.
- [ ] Apply committed artifacts only; no `db:push`, schema generation or migrations in Vercel build/request/cold-start hooks. Preview branch creation and migration must finish before preview traffic depends on the new schema.
- [ ] Prevent an automatic production deployment from racing ahead of the migration step: configure a gated promotion/deploy workflow and test the ordering on preview.
- [ ] Check compatibility with the currently running application before changing a shared schema. Use additive changes first; on a failed migration, stop deployment and follow the operations runbook to be added to `docs/deployment.md` rather than blindly retrying or deleting migration history.
- [ ] Record release commit, migration identifiers and target branch in deployment notes without secrets. Verify no pending migration remains for the deployed commit.

### 4. Deploy a preview and exercise complete authentication and account flows.

- [ ] Deploy the tested commit to the isolated controlled preview, verify correct server routes/runtime and run the browser smoke suite against that URL with controlled accounts.
- [ ] Manually complete registration → real verification email → sign-in → account refresh → profile edit → sign-out, then password recovery → new sign-in. Verify reset invalidates earlier sessions.
- [ ] Complete real Google sign-in, canceled consent and same-email collision checks. Confirm the normal implicit-linking policy with verification/trust safeguards behaves as documented.
- [ ] Test anonymous/unverified account rejection, cross-user selectors, safe redirects, English/Spanish rendering, keyboard flows and no hydration warnings. Inspect HTTPS cookie and no-store headers through the deployed delivery path.
- [ ] Verify email background work completes after HTTP response under Vercel, and provider failure is visible through sanitized reporting. Recheck shared rate limits across separate function requests.

### 5. Deploy production and verify homepage, protected routes, OAuth and email delivery.

- [ ] Promote/deploy the exact passing commit only after the production migration and required gates succeed. Confirm production variables and callbacks again rather than inheriting preview settings implicitly.
- [ ] Check public `/`, direct unauthenticated `/account`, authenticated refresh, profile update and sign-out with a controlled production test account.
- [ ] Complete one real verification/recovery delivery and Google login. Confirm generated links and redirects use the production domain and no preview credential/data appears.
- [ ] Inspect both locales, mobile layout, console/hydration output, cookie attributes and private response headers. Clean only the controlled test data according to the runbook; do not remove unrelated accounts.
- [ ] Record release success/failures. Halt promotion or invoke the documented compatible rollback/forward-fix procedure if a required auth flow fails.

### 6. Confirm useful error reporting and document database recovery procedures.

- [ ] Use Vercel's existing logs/error facilities to verify actionable records for configuration failure, database outage and email rejection. Add a small correlation/error-code convention only if necessary; no analytics or observability platform is required.
- [ ] Confirm logs contain no passwords, session cookies, recovery tokens, provider keys or connection strings. Check the actual deployed error path, not just unit mocks.
- [ ] Update the operations runbook to be added to `docs/deployment.md` with real project/branch identifiers, restore retention, responsible operators and links to the provider consoles, excluding credentials. Verify the documented recovery/cutover capability exists for the selected Neon plan. [Neon branch restore](https://neon.com/docs/introduction/branch-restore).
- [ ] Confirm the last compatible release and migration record can be located and that deployment rollback does not imply database rollback. Keep the full restore rehearsal deferred as specified in the roadmap.

### Phase verification

- [ ] CI evidence for `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` and browser tests is attached to the released commit.
- [ ] Record passing preview and production real-provider smoke checks, migration targets and deployment URLs without secrets.
- [ ] Verify application credentials cannot reach the wrong environment and the controlled migration step precedes dependent release traffic.

### Expected state after completion

The starter runs on Vercel with isolated Neon targets, real Google/email flows and verified SSR/session behavior. Release ordering and recovery procedures are documented for the actual environment.

<a id="phase-10"></a>

## Phase 10 — Documentation and reusable-starter cleanup

### Goal

Make the completed starter reproducible by a new maintainer without undocumented local state, while removing obsolete examples and deployment-specific defaults.

### Preconditions

- Phases 1–9 are complete, with reproducible migrations, passing quality gates and recorded real deployment/provider checks.
- Review the implementation and documentation together; the initial inspection found a generic multi-package-manager README, `Hello Nuxt!`, a header link to `example.com`, and `nuxt-auth-starter.com` in `public/robots.txt` and `public/sitemap.xml`.
- Keep all roadmap deferrals: no organizations, roles framework, billing, MFA, passkeys, extra providers, Redis, queues, generic service/repository layers or full recovery rehearsal.

### 1. Document setup from a fresh clone through migration and first sign-in.

- [ ] Extend the existing README setup path using the supported Node/pnpm pair, `pnpm install --frozen-lockfile`, `.env.example` copying and each prerequisite account. Keep the final commands aligned with actual package scripts.
- [ ] Provide the exact order: create isolated Neon target → configure environment → `pnpm db:migrate` using committed migrations → `pnpm dev` → register → open the real verification email → sign in → open `/account`.
- [ ] Distinguish consuming the starter's committed migrations from changing its auth schema. Put the pinned Better Auth schema-generation command and generate/review/migrate developer workflow in a concise linked database section.
- [ ] Explain missing credentials, wrong callback URL, unverified sender and absent migrations with symptoms and concrete checks that do not expose secrets. Do not recommend disabling security, using `push` in production or setting a verified flag manually.

### 2. Document environment variables, Google setup, email delivery and deployment.

- [ ] Extend README environment configuration with every actual `NUXT_*` variable, runtime key, required phase/environment, safe example and purpose. Link the database document for tooling lookup; keep each variable definition in one canonical home.
- [ ] Document Google console setup, exact provider callback path, safe application return destinations, consent/test-user requirements and normal implicit linking with verification/trust safeguards. Explain accepted trustworthy linking and rejected unsafe collisions.
- [ ] Document Resend sender verification, private key/sender configuration, controlled test recipient, generic request acknowledgements and background-delivery diagnostics. Use plain templates and the implemented provider only.
- [ ] Finish `docs/deployment.md` with Vercel environment isolation, Node/pnpm settings, controlled preview hostname, migration-before-release sequence and production smoke checklist. Link the operations runbook to be added to `docs/deployment.md` for recovery/rotation.
- [ ] Keep documentation provider links current and applicable to the implemented versions: [Better Auth Nuxt](https://better-auth.com/docs/integrations/nuxt), [Drizzle Neon](https://orm.drizzle.team/docs/connect-neon), [Vercel Nuxt](https://vercel.com/docs/frameworks/full-stack/nuxt). Do not copy release-line-changing `@latest` commands into setup instructions.

### 3. Explain session ownership, server authorization and test boundaries briefly.

- [ ] Add a short architecture section identifying `app/lib/auth-client.ts`, server auth factory/runtime assembly, `/api/auth/[...all]`, `require-session.ts`, `/api/account`, `server/database/` and safe `shared/` validation/redirect utilities.
- [ ] Explain that Better Auth owns identity/session state, route middleware handles navigation UX, and server handlers enforce verified identity/ownership independently. Describe `useSession(useFetch)` SSR integration and why a second session store is absent.
- [ ] State the deliberate profile scope (display name only), verification/access policy, reset revocation, normal implicit linking with verification/trust safeguards, HTTP adapter transaction setting and database-backed rate limiter.
- [ ] Link `docs/testing.md`: pure Node unit tests, Nuxt runtime tests, live Nitro/database integration tests and real browser tests. Separate deterministic provider fixtures from mandatory real-provider deployment checks.
- [ ] Keep this explanation short enough to use as a file map; do not add an architecture layer merely to make the documentation diagram more elaborate.

### 4. Remove obsolete examples, placeholder branding and deployment-specific values.

- [ ] Replace the homepage placeholder with concise starter setup/status guidance and working auth/account navigation. Remove the obsolete `example.com` header link. Keep localization parity in English and Spanish.
- [ ] Review app title/description, `AppLogo.vue`, footer text and favicon for a neutral reusable identity. Keep existing tool-owned UI paths and Tailwind 4 CSS structure; no design-system rebuild is needed.
- [ ] Remove the hardcoded `nuxt-auth-starter.com` sitemap/robots references or replace them with the implemented configurable production-origin approach. Do not publish private/auth/recovery URLs in a sitemap, and do not treat robots rules as authorization.
- [ ] Remove temporary connectivity probes, route shells, stale auth examples and unused code from implementation phases. Preserve intentional UI components and unrelated changes; do not delete files merely because they were not used in the first screen.
- [ ] Search tracked application/docs/config files for real domain values, keys, private emails, token examples and obsolete environment names. Replace deployment-specific documentation with placeholders or clearly separated operational notes.
- [ ] Move implemented behavior from the roadmap into the canonical topic documentation and remove completed checklist items. Keep these plans as future-agent guidance rather than silently claiming every planned verification was executed.

### 5. Verify a fresh clone can pass validation and deploy using only the documentation.

- [ ] Use a clean disposable checkout with no inherited `.env`, `.nuxt`, installed modules or test database. Follow README exactly on the supported Node/pnpm pair; record missing steps and correct documentation immediately.
- [ ] Provision isolated credentials/targets as documented, install from the lockfile and apply committed migrations to an empty database. Verify first sign-in, account editing, recovery and sign-out without manual database edits.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` and browser tests with documented test configuration. Confirm actual tests are discovered and migration replay/drift checks pass.
- [ ] Deploy the clean checkout to an isolated Vercel preview using only `docs/deployment.md`. Complete real Google/email smoke checks; document external credentials/access as prerequisites rather than claiming zero configuration.
- [ ] Verify generated output/secret files remain ignored and the checkout has no unexplained tracked changes after setup. Remove only disposable validation resources that were created for this exercise.

### Phase verification

- [ ] Trace every roadmap definition-of-done item to passing automated evidence or a recorded real-environment manual check.
- [ ] Confirm README, `.env.example`, actual scripts, CI and deployment settings agree; all referenced local files and instructions exist.
- [ ] Confirm a fresh-clone setup and isolated preview deployment succeeded, or explicitly report the exact unmet external prerequisite without declaring the phase complete.
- [ ] Verify no deferred feature or unnecessary dependency was introduced during cleanup.

### Expected state after completion

A new maintainer can install, configure, migrate, test and deploy the starter from its documentation. The reusable baseline retains only the intended auth/account scope, with clear security, SSR, testing and operational boundaries.

## Dependency chain

Foundation → Configuration → Database connection → Auth schema and migration → Auth server and authorization → Client sessions and page access → Auth/account UI → Final quality gates → Production → Reusable-starter cleanup

Tests accompany implementation; CI and security gates must pass before production.

## Definition of done

- [ ] Email/password, Google OAuth, verification, recovery and sign-out work end to end.
- [ ] Protected APIs enforce identity and ownership independently of page middleware.
- [ ] Sessions and protected pages work correctly across SSR, refreshes and navigation.
- [ ] Forms are validated, accessible and handle expected failures.
- [ ] Versioned migrations reproduce the database from scratch.
- [ ] Meaningful tests, lint, typecheck and build pass in CI.
- [ ] Vercel/Neon deployment and email delivery are verified, and recovery procedures are documented.
- [ ] A new developer can configure and launch the starter from its documentation.

## Defer for later

- Organizations, multi-tenancy, invitations, roles and permission-management frameworks.
- Billing, subscriptions, dashboards and application-specific CRUD.
- MFA, passkeys, additional OAuth providers and advanced account-management UI.
- Generic repositories, service layers, DI containers and runtime schema systems.
- Duplicate auth state, Axios wrappers and generic API-client frameworks.
- Redis, queues, caching infrastructure, uploads and realtime features without a concrete need.
- A custom email-template platform, analytics suite or elaborate design system.
- A full database-recovery rehearsal.

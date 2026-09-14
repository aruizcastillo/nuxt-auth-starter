# Phase 4 — Authentication methods and server authorization

## Goal

Complete the server's email/password, verified-email, recovery and Google policies. Add policy tests now; page access and the account endpoint follow in Phase 5.

## Preconditions

- Phase 3's handler, shared auth factory, migration and live-server fixtures pass. Recheck Better Auth/adapter 1.7.3 and Zod 4.5.4 against installed source/types.
- Obtain a Resend sending key, verified sender, controlled recipient mailbox and Google web OAuth credentials. Use Phase 1's private `NUXT_*` names. These external resources were not created during planning.
- Read the official Better Auth setup, email/password and security skills, but verify their generic examples against 1.7.3. In particular, do not copy unpinned CLI commands, obsolete hooks or old rate-limit custom storage APIs.

## Boundary acceptance

- [ ] Keep email/password directly configured in Better Auth, Google in its concrete provider module, and email callbacks using a simple sendEmail boundary. No registries or mirrored feature configuration.
- [ ] Verify authenticated users/accounts, sessions and authorization with credentials+Google, credentials-only and Google-only. Credentials UI/flows may be removed manually. Removing Google must remove its settings requirements without changing core identity handling.

## 1. Enable email/password registration, sign-in and sign-out.

- [ ] Complete `emailAndPassword` in `server/auth/options.ts`; use Better Auth's sign-up, sign-in and sign-out endpoints through the existing catch-all. Keep its password hashing and normalization behavior rather than writing credential handlers.
- [ ] Set an explicit password length policy matching the documented supported bounds, initially 8–128 characters. Share these limits in a small safe constants module only when client schemas need them in Phase 6; never trim or silently transform passwords. [Email/password API](https://better-auth.com/docs/authentication/email-password).
- [ ] Require name and email on registration. Add request tests for invalid email, missing name, password boundaries, duplicate registration, wrong password and repeated sign-out; verify no plaintext password is persisted or returned.
- [ ] Verify the issued cookie, revoked session and error response via real HTTP requests. Keep generic credential errors; do not expose whether an email exists through custom messages.

## 2. Connect real email delivery for verification and password recovery, following [Better Auth's email guidance](https://better-auth.com/docs/concepts/email).

- [ ] Implement `server/email/providers/resend.ts` as one typed Resend sender. POST to `https://api.resend.com/emails` with bearer authentication and `from`, `to`, `subject` and text content. Use a bounded timeout and no blind automatic POST retries; validate success and classify provider errors without logging request bodies. [Resend send API](https://resend.com/docs/api-reference/emails/send-email).
- [ ] Connect `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword` to the sender, preserving Better Auth's supplied URL. Do not generate verification/reset tokens, store duplicate tokens or replace their expiry checks. Use simple text emails; no template platform is required.
- [ ] Connect `advanced.backgroundTasks.handler` to the current Nitro event's supported `waitUntil` lifetime. Extend `server/utils/auth.ts` to pass a request-scoped scheduler into the factory; never retain an event globally. In both email callbacks, register the actual delivery promise with that scheduler and resolve after registration. Installed 1.7.3's resend path directly awaits `sendVerificationEmail`, so the background option alone does not make every callback nonblocking. Verify the installed H3/Nitro event API and Vercel preset before deployment. [Better Auth options](https://better-auth.com/docs/reference/options), [H3 event lifetime](https://h3.dev/guide/api/h3event).
- [ ] Ensure sending does not create an account-existence timing distinction, and scheduled failures reach sanitized operational reporting. Do not use a detached `void sendEmail()` that Vercel may terminate. Add a test proving the promise is registered with the event lifecycle and rejection is handled.
- [ ] Verify real receipt and usable links with a controlled mailbox. Test provider timeout, 429, rejected sender and invalid key using an injected test transport, not actual repeated mail. User-facing acceptance means the request was accepted, not proof of inbox delivery.

## 3. Define verified-email access and password-reset session behavior.

- [ ] Set `emailAndPassword.requireEmailVerification: true`, `emailVerification.sendOnSignUp: true`, and choose `autoSignInAfterVerification: false` so verification leads to explicit sign-in. Document link lifetimes from the actual configured options. [Email verification guidance](https://better-auth.com/docs/concepts/email).
- [ ] Add `server/utils/require-session.ts`: resolve identity using `auth.api.getSession({ headers: event.headers })`, return 401 for absent/expired identity and 403 with a stable safe code for an unverified identity. Return only the server-verified user needed by callers. The verified-email rule must apply to Google sessions too; the credential option alone does not enforce that.
- [ ] Set `emailAndPassword.revokeSessionsOnPasswordReset: true`. Require sign-in with the new password after reset; retain disabled cookie caching so old sessions cannot survive in a cache.
- [ ] Add integration cases for sign-in before/after verification, missing/tampered/expired verification and recovery tokens, repeated reset-token use, old-password rejection and revocation of two preexisting sessions. Test documented verification replay behavior rather than inventing a token contract.
- [ ] Capture callback URLs through the test email transport and exercise Better Auth's real token endpoints. Never set `emailVerified` directly merely to bypass verification in end-to-end tests.

## 4. Configure Google OAuth credentials, callbacks and account-linking policy.

- [ ] Configure a Google OAuth web application with consent/test users as applicable. Register `http://localhost:3000/api/auth/callback/google` plus the exact controlled preview and production HTTPS callbacks. Store credentials in the private config pair and reject incomplete configuration when Google is enabled. [Google integration](https://better-auth.com/docs/authentication/google).
- [ ] Compose `createGoogleProvider(config)` from `server/auth/providers/google.ts` into native `socialProviders`; the module requires both credentials. Use its documented default identity scopes; do not request offline access or unrelated Google API permissions for sign-in.
- [ ] Preserve Better Auth's normal implicit linking for trustworthy OAuth identities with its verification/trust safeguards. Do not force explicit linking or add provider fields to users. [Account linking](https://better-auth.com/docs/concepts/users-accounts).
- [ ] Preserve Better Auth's OAuth state/cookie validation and callback checks. Handle canceled consent, provider errors, absent/unverified email claims and a same-email collision without granting unintended account access.
- [ ] Add tests for provider configuration and linking decisions using provider-boundary fixtures. Record a separate real Google sign-in/cancel/manual callback check; mocked OAuth alone cannot prove Google console configuration.

## 5. Validate custom endpoint input and return appropriate authentication/authorization errors.

- [ ] Define the endpoint contract for Phase 5: `GET /api/account` accepts no user selector and returns a minimal current-user projection. Return 401 for no session, 403 for a verified-email policy failure, and 400 for malformed custom input. Use 404 for inaccessible resources only if a resource endpoint is actually introduced later.
- [ ] Test `require-session.ts` in a Nuxt-aware/server fixture now, including a forged identity header and a null session. Do not introduce a speculative public endpoint solely to test the helper.
- [ ] For any custom input introduced in this or subsequent phases, parse body/query with Zod 4 at the handler and explicitly allowlist writable properties. Never trust `userId`, `emailVerified`, roles or ownership supplied by a browser.
- [ ] Leave Better Auth's built-in input validation and response format intact. Profile updates in Phase 6 use its `updateUser` API; add narrow supported server validation for name constraints, not an auth proxy.
- [ ] Preserve auth-origin/CSRF defaults now; custom future mutations need their own verified protection. The planned account endpoint is read-only, so no separate mutation/CSRF framework is justified.

## Phase verification

- [ ] Verify real email receipt, verification, recovery and Google sign-in with controlled development accounts; log only redacted outcomes.
- [ ] Run the new tests for verification policy, token failure cases, session revocation, provider failures and accepted/rejected linking decisions. Update Phase 3 tests to obey verified-email sign-in.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build`. Missing provider access remains an explicit incomplete manual check.

## Expected state after completion

Authentication methods and server identity policy work independently of UI. Emails have a reliable serverless lifecycle, reset revokes sessions, trustworthy OAuth identities link through Better Auth’s normal account model, and policy tests accompany the implementation.

# Phase 8 — Security and operational readiness

## Goal

Verify production security assumptions and document manageable operational recovery before deployment. Keep the roadmap's deferred infrastructure and full recovery rehearsal out of scope.

## Preconditions

- Phases 1–7 pass. Inspect final auth options, built responses and test fixtures rather than assuming defaults alone establish security.
- Recheck Better Auth/adapter 1.7.3, Drizzle RC.4 and deployment behavior. The installed security skill has some generic legacy examples; current 1.7.3 docs/types take precedence where they differ (for example atomic rate-limit consumption).
- Use test/preview targets and controlled accounts. No production credentials or external infrastructure changes were made while writing this plan.

## 1. Verify trusted origins, secure cookies, CSRF protection and safe redirects.

- [ ] Review configured canonical origins for local, controlled preview and production. Restrict trusted origins to controlled hosts; do not reflect arbitrary `Host`/forwarded headers into the allowlist or trust all `*.vercel.app` projects.
- [ ] Keep Better Auth origin/CSRF checks enabled. Exercise requests from allowed, foreign and missing origins plus relevant Fetch Metadata combinations, comparing results to documented behavior rather than disabling checks for tests. [Better Auth options](https://better-auth.com/docs/reference/options).
- [ ] Inspect real HTTPS response cookies for Secure, HttpOnly, appropriate SameSite and path/domain scope. Keep host-scoped defaults; do not enable cross-subdomain cookies or weaken them for OAuth without a demonstrated need.
- [ ] Re-run the safe-redirect attack corpus against both client consumption and Better Auth callback URLs. Confirm Google state/callback cookies survive the real flow and a modified state is rejected.

## 2. Verify that the selected authentication rate-limiting strategy is appropriate for Vercel's serverless deployment model.

- [ ] Select Better Auth's built-in database storage on Neon (`rateLimit.storage: 'database'`) with rate limiting explicitly enabled in the tested production configuration. In-memory counters do not aggregate across Vercel instances; Redis and custom storage are unnecessary for this starter. [Rate limiting](https://better-auth.com/docs/concepts/rate-limit).
- [ ] Regenerate the auth schema through the pinned Phase 3 CLI after this option changes. Review the added rate-limit table/unique key and produce a new versioned migration; do not rewrite the initial migration. This is auth infrastructure required by this checklist item, not a new domain feature.
- [ ] Review default rules and set justified limits for sign-in, sign-up, resend and reset using exact mounted-library-relative rule paths from installed types/source. Do not copy a skill example's `/api/auth` prefix without checking its matcher.
- [ ] Verify trusted proxy/IP handling on Vercel and prevent caller-controlled forwarded headers from selecting arbitrary limit identities. Test IPv4/IPv6 and shared-IP behavior with controlled traffic.
- [ ] Test simultaneous requests through separate auth instances sharing the test database: counters aggregate, excess attempts produce 429 with retry metadata, windows expire, and database failure has understood behavior. Check the built-in adapter's atomic implementation; do not introduce the obsolete custom `get`/`set` limiter shape.
- [ ] Measure reasonable request latency and table growth for the expected starter workload; document maintenance using supported database operations if needed. Do not add a queue, cron service or cache infrastructure speculatively. If concurrency enforcement fails, block deployment and investigate the supported adapter behavior.

## 3. Check account enumeration, OAuth linking and session-revocation behavior.

- [ ] Compare existing/non-existing addresses for registration, sign-in, resend and recovery at the HTTP boundary, including status/body and gross timing differences. Confirm slow email delivery does not determine response timing. Do not promise mathematically identical network timing.
- [ ] Verify trustworthy same-email OAuth identities link normally while unsafe linking is rejected, provider identity is not synthesized, and unverified sessions cannot access `/api/account`.
- [ ] Confirm sign-out invalidates its session, reset invalidates all prior sessions, and expired cookies cannot read account data. Keep cookie caching off unless a later explicit requirement justifies and tests its revocation delay. [Session management](https://better-auth.com/docs/concepts/session-management).
- [ ] Add regression cases for every discovered gap to the Phase 7 suite; do not treat a manual audit as a substitute for repeatable authorization tests.

## 4. Ensure personalized responses cannot leak through shared caching.

- [ ] Audit `nuxt.config.ts` route rules, Nitro handlers and Vercel cache settings. Exclude `/api/auth/**`, `/api/account` and personalized pages from prerendering, ISR/SWR and shared response caches.
- [ ] Set/test private no-store behavior for account, auth and personalized page responses, including redirects/errors and cookies. Remove any broader cache rule that overrides this intent; do not rely on `Vary: Cookie` alone.
- [ ] Fetch the same URL in order as user A, guest and user B through preview's actual delivery path. Compare body/HTML/payload and cache headers; no prior identity may appear.
- [ ] Keep static public asset caching intact. Browser history state must also clear after sign-out as tested in Phase 5.

## 5. Keep passwords, tokens and sensitive user data out of responses and logs.

- [ ] Audit auth/account serializers, `console` calls, exception reporters and provider failures. Keep logs to event category, safe error code, timestamp and correlation identifier; redact cookies, Authorization, database URLs and sensitive request/query bodies.
- [ ] Keep the minimum intended current-user fields in session/account responses. Never serialize raw account/password/OAuth records; do not attempt to remove fields required by Better Auth's supported client contract without verification.
- [ ] Check reset/verification URL handling, referrer policy and third-party page requests so credential-bearing links are not sent as referrers. Use `Referrer-Policy: no-referrer` for these screens and avoid unnecessary third-party resources there.
- [ ] Inspect test traces, provider logs and deployed exception logs with disposable marker secrets; ensure reports and support instructions do not request raw tokens or passwords.

## 6. Document secret rotation, database recovery and failed-deployment handling.

- [ ] Create `docs/operations.md` listing secret owners, storage location, rotation sequence and verification for auth secret, Neon password, Google secret and Resend key; record no actual values.
- [ ] For auth-secret rotation, inspect 1.7.3's supported rotation options and document effects on sessions, verification links and any encrypted stored OAuth data. Do not assume changing one string preserves all encrypted material; require reauthentication/relinking where necessary.
- [ ] Document Neon's configured restore retention, responsible operator and restore-to-new-branch/cutover procedure, with checks of schema, migrated version and user/session consistency. A complete database-recovery rehearsal remains deferred. [Neon recovery](https://neon.com/docs/introduction/branch-restore).
- [ ] Describe failed migration/deployment handling: stop rollout, identify the last compatible application/schema pair, preserve migration history, prefer forward correction, and roll back application code only when schema-compatible. Never run destructive reverse SQL automatically.
- [ ] Include email-provider outage handling, investigation using safe event IDs, user resend/recovery guidance and credential compromise response. Keep this a short runbook, not a new monitoring platform.

## Phase verification

- [ ] All origin/cookie/redirect, shared rate-limit, revocation and cache-isolation checks pass on isolated targets.
- [ ] Replay the additional rate-limit migration and run `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` and browser tests.
- [ ] Review the runbook with the deployment owner and confirm no unresolved security failure is waved through to production.

## Expected state after completion

The starter has verified production safeguards, shared database-backed auth throttling and a concrete operational runbook. It is ready for the controlled preview/production rollout in Phase 9.

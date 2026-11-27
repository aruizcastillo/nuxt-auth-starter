# Roadmap

This file describes remaining scope, dependencies and acceptance criteria. Current behavior lives in [authentication](../authentication.md), [database](../database.md), [testing](../testing.md) and [deployment](../deployment.md); setup lives in [README](../../README.md). Working instructions belong to [AGENTS.md](../../AGENTS.md).

Phase numbers are retained for dependency references.

## Scope and acceptance

- **Requirements:** Phases 4–10 cover the first version's email/password, verification, recovery, sessions and authorization, including mandatory security and quality outcomes. [Planned future work](#planned-future-work) and [planned maintenance](#planned-maintenance) are separate from first-version requirements and never gate production release.
- **Agreed decisions:** preserve [Better Auth ownership](../decisions/001-better-auth.md), [Neon HTTP and transaction constraints](../decisions/002-neon-http.md), [disabled cookie caching](../decisions/003-cookie-cache-disabled.md), [versioned migrations](../decisions/004-versioned-migrations.md), [HTTP-boundary background execution](../decisions/005-background-tasks.md) and the explicit route, helper and policy contracts below. Simplifying an implementation recipe does not reopen these decisions. ADR 001's future linking policy applies only when the optional extension is implemented.
- **Technical proposals:** choices explicitly marked for evaluation remain open decisions. The [scope exclusions](#out-of-scope) apply throughout.

Validation follows [testing scope](../testing.md#validation-scope). Tests accompany implementation and Phase 7 completes coverage and CI. Phase 9 owns real Preview, provider and serverless acceptance. All applicable Preview gates precede production promotion, and production smoke checks gate release acceptance.

<a id="phase-4"></a>

## Phase 4 — Email/password and server authorization

The [credential baseline](../authentication.md) and [authorization and input contract](../authentication.md#custom-endpoint-authorization-and-input) define the starting point for Phase 5. [Phase 9](#phase-9) covers real email delivery and serverless acceptance.

<a id="phase-5"></a>

## Phase 5 — Client sessions and page access

The [current-account endpoint](../authentication.md#current-account-endpoint-contract) and [session-aware navigation](../authentication.md#session-aware-navigation) provide the baseline for Phase 6. See [HTTP coverage](../testing.md#http-coverage) for the local acceptance boundary. Phase 7 adds automated browser coverage.

<a id="phase-6"></a>

## Phase 6 — Authentication and account UI

### Goal

Deliver localized, accessible authentication/account screens with meaningful behavioral coverage.

### Preconditions

- Phases 4–5 server/session/navigation contracts pass locally. Preserve their routes, middleware and safe-return helper.
- Screens use the existing shadcn-vue/Reka components, page container, toaster, vee-validate + Zod and i18n configuration.

### 3. Add the protected account screen, display-name editing and sign-out.

- [ ] Complete `/account` with SSR current-user data, name/email/verification display and navigation from `AppHeader.vue`.
- [ ] Implement the [profile edit contract](../authentication.md#profile-edits-through-better-auth) through native `updateUser` and enforce the chosen display-name rule server-side.
- [ ] Refresh displayed session/account data only after confirmed success; preserve unsaved input on failure. Forged user selectors or verification fields cannot change another user's data or authority.
- [ ] Use Phase 5 sign-out behavior. Email changes, deletion, uploads and linked-provider management remain outside scope.

### 4. Validate forms with authoritative server checks.

- [ ] Keep safely shared rules in `shared/validation/auth.ts` and `shared/validation/profile.ts` where useful. Client and server rules agree, including documented password bounds and the chosen display-name constraint; passwords remain untransformed.
- [ ] Integrate vee-validate/Zod with the existing field components, without an overlapping validation adapter.
- [ ] Password confirmation is client-only and is not sent to auth endpoints. Map safe validation/auth codes to localized field/form errors; unknown failures remain generic and retryable.
- [ ] Prove meaningful boundary rules, prevention of invalid submissions and authoritative rejection when client validation is bypassed. A specific name-length limit remains to be confirmed during implementation; previous example values are not a new policy decision.

### 5. Provide usable pending, success and failure states.

- [ ] Cover invalid credentials, unverified identity, invalid/expired links, network/server failure, rate limits and email-delivery uncertainty where relevant.
- [ ] Block duplicate mutations, show progress and restore usable controls/focus after errors. Respect supported retry metadata without treating UI throttling as security enforcement.
- [ ] Clear passwords after success/navigation and keep them out of URLs; preserve non-sensitive input on recoverable failures. Never report success when the native action returned an error.

### 6. Localize and verify accessibility.

- [ ] Maintain equivalent auth, account, navigation and error messages across configured locales. Preserve the [locale selection policy](../i18n.md#locale-selection) on direct entries to the auth and account pages.
- [ ] Language changes update visible errors without losing form values; SSR language agrees with hydration and no translated state leaks between requests.
- [ ] Provide associated labels/descriptions/errors, accessible submit status, visible focus and first-invalid-field focus. Inline errors remain usable without toasts; preserve primitive keyboard/focus behavior.
- [ ] Verify keyboard submission and tab order, menu dismissal and focus return, autofill and password managers, and narrow viewports in each configured locale. Fix discovered usability and accessibility failures.

### Cross-flow acceptance

- [ ] Relevant form, runtime and HTTP checks cover registration → fixture verification → credential sign-in → profile edit → sign-out, and recovery → new-password sign-in with prior sessions revoked.

<a id="phase-7"></a>

## Phase 7 — Tests and CI gates

### Goal

Close remaining coverage gaps, add browser tests, automate migration reproducibility and make meaningful checks mandatory in CI.

### Preconditions

- Existing test projects, ignored `.env.test`, target guard, fixtures and real HTTP coverage are documented in [testing](../testing.md).
- Phases 4–6 have implementation coverage; remaining gaps and browser tooling are pending here.

### 1. Close unit, runtime and integration coverage gaps.

- [ ] Inventory actual coverage against Phases 4–6 and add missing cases, reusing existing projects and email-provider fixtures. Cover settings/validation/redirect boundaries, credential failures, session errors, verification/reset policy, ownership and profile updates.
- [ ] Exercise real handlers, migrated data and independent users/cookies where authority depends on them. Include concurrent SSR isolation, forged identity/selector input and protection against unintended cross-user updates.
- [ ] Coverage uses the real authorization/session boundaries without production test bypasses or sensitive snapshots/artifacts. Provider fixtures remain distinct from Phase 9's real-provider acceptance.

### 2. Add real browser coverage.

- [ ] Add compatible Playwright tooling with one supported Nuxt integration, the planned `test:browser` command and `test/browser/` cases. Happy-dom does not establish browser hydration or accessibility.
- [ ] Run against a production-built server with isolated settings and reliable startup/teardown. Cover protected direct loads/refresh, sign-in/safe redirects, sign-out/back, cross-tab expiry/revocation and recovery links with an existing session.
- [ ] Fail on hydration/page errors and private-data leakage across users or into guest HTML. Cover forms, labels, invalid-field focus and keyboard submission in each configured locale.
- [ ] Keep browser traces and failure artifacts free of credentials/tokens and apply short retention.

### 3. Automate empty-database migration and drift checks.

- [ ] Apply committed migrations to an actually empty isolated target, verify required schema/history/constraints and confirm a second migrate is a no-op. Run auth integration coverage against the migrated result.
- [ ] Automate the [documented drift procedure](../testing.md#migration-validation) in a disposable checkout, including auth-schema regeneration. Fail on unexpected schema/migration changes; never rewrite applied migrations or commit drift automatically.
- [ ] Explicitly verify target identity before migration/cleanup. Provision per-run targets or serialize dedicated-target jobs; scope provisioning credentials to test infrastructure and dispose only of resources created for that run.

### 4. Establish required CI and deployment gates.

- [ ] Add repository-host CI using the supported Node/pnpm setup and frozen lockfile installation, preserving package-manager trust/build settings.
- [ ] Require relevant lint, typecheck, actual unit/runtime/HTTP/browser tests and production compilation evidence. Order migrations before database tests and the appropriate build before browser tests; avoid redundant builds where artifacts/evidence can be reused.
- [ ] Fail on missing required suites, zero tests, silent skips, drift and command failures. Prove representative test/type failures block the expected checks, then remove deliberate failures.
- [ ] Configure required merge/deployment checks. Keep untrusted contribution checks secret-free and protected integration credentials inaccessible to unreviewed code.
- [ ] `docs/testing.md` describes the final commands, infrastructure prerequisites and manual acceptance boundaries.

<a id="phase-8"></a>

## Phase 8 — Security and operational readiness

### Goal

Close security gaps, select a justified serverless abuse-control strategy and prepare operational procedures. All security outcomes are mandatory; checks requiring the deployed delivery path are accepted in Phase 9.

### Preconditions

- Phases 4–7 provide the implemented flows and automated coverage under review. Real-host acceptance follows in Phase 9.

### 1. Enforce origin, cookie, CSRF and redirect protections.

- [ ] Restrict trusted origins to controlled canonical hosts, without reflecting arbitrary host/forwarded headers or trusting all Vercel projects.
- [ ] Preserve Better Auth origin/CSRF checks and verify allowed/foreign/missing-origin and relevant Fetch Metadata behavior against supported rules. Keep appropriate Secure/HttpOnly/SameSite and host/path scope; no speculative cross-subdomain relaxation.
- [ ] Cover redirect attacks and verification/recovery link integrity. Phase 9 confirms cookies and link behavior over real HTTPS.

### 2. Evaluate and verify serverless authentication rate limiting.

- [ ] Choose and document an effective strategy for sign-in, sign-up, resend and reset across multiple Vercel instances. Per-process counters alone do not meet this requirement.
- [ ] **Decision to review:** evaluate Better Auth's supported storage and applicable hosting controls for concurrency correctness, failure behavior, latency, operating cost and maintenance. Database storage on Neon is a candidate, not a preselected requirement; additional infrastructure remains subject to the scope exclusions.
- [ ] Verify actual rule matching, trustworthy proxy/IP identity, IPv4/IPv6 and shared-IP behavior. Caller-controlled forwarded headers must not enable bypass.
- [ ] Prove concurrent attempts are counted correctly across independent instances, excessive requests receive 429/retry guidance, windows expire, and storage/control failures have understood behavior. Document expected growth/maintenance for the chosen approach.
- [ ] If the choice changes auth schema, generate/review a new versioned migration through the existing workflow. A rate-limit table/migration is conditional on that choice, not a prerequisite by itself. Phase 9 verifies enforcement through deployed function requests; unresolved enforcement failures block production.

### 3. Prevent enumeration and stale-session access.

- [ ] Review known/unknown email outcomes for registration, sign-in, resend and recovery, including public status/body and gross timing differences. Provider delivery latency must not expose account existence; do not promise identical network timing.
- [ ] Preserve native credential verification without adding a global resource verification gate or bypassing verification in recovery flows.
- [ ] Preserve authoritative sign-out, expiry and reset revocation with cookie caching disabled. Add regression coverage for discovered gaps rather than replacing repeatable checks with a manual audit.

### 4. Prevent personalized data leakage through caching.

- [ ] Exclude auth routes, `/api/account` and personalized pages from prerendering and shared ISR/SWR/response caches. Enforce private no-store behavior on auth endpoints and personalized responses, including redirects and errors; `Vary: Cookie` alone is insufficient.
- [ ] Preserve public static-asset caching and post-sign-out removal of stale account content. Phase 9 verifies sequential user A → guest → user B requests through the actual deployed cache path.

### 5. Protect secrets and sensitive data in responses, links and logs.

- [ ] Keep intended minimal user projections and Better Auth's supported client contract; never serialize raw credential/account records. Redact cookies, authorization, database URLs, passwords, provider keys and token-bearing bodies/queries from errors and logs.
- [ ] Use safe event/error identifiers for diagnostics. Keep credential-bearing verification/reset links out of referrers with `Referrer-Policy: no-referrer` on those screens and avoid unnecessary third-party requests there.
- [ ] Review test artifacts and reporting paths as well as application output. Phase 9 confirms sanitized failures in deployed/provider logs with controlled data.

### 6. Prepare the operational runbook.

- [ ] Document ownership, safe storage, rotation and verification for auth, database and email secrets in `docs/deployment.md`, without secret values. Verify supported auth-secret rotation and effects on sessions and verification/recovery links; require reauthentication or fresh links where necessary.
- [ ] Describe database restore-to-new-target/cutover, schema/history/user/session checks and responsible roles. Phase 9 records actual provider retention/recovery capabilities; a full recovery rehearsal remains out of scope.
- [ ] Define failed migration/deployment handling: stop rollout, identify the compatible application/schema pair, preserve history, prefer forward correction and roll back code only when schema-compatible. No automatic destructive reverse SQL.
- [ ] Include email outages, safe diagnostic IDs, resend/recovery guidance and credential compromise response, using existing operational facilities; the deployment owner reviews the runbook.

<a id="phase-9"></a>

## Phase 9 — Vercel and Neon deployment

### Goal

Own real-infrastructure acceptance: isolated Preview, external providers, release sequencing, serverless behavior and production smoke checks.

### Preconditions and gates

- A controlled Preview may be prepared earlier as its features/controls become available; it does not require Phase 8's deployed acceptance to have passed already.
- Final Preview acceptance requires Phases 4–8 implementation, automated gates and runbook preparation. Production promotion requires all applicable Preview/provider/security checks below, including previously deferred email lifecycle acceptance.
- Obtain controlled Vercel/Neon targets, domain/DNS access, authorized Resend sender and test mailboxes/accounts. Verify current platform support for the repository's runtime/tooling at deployment time.

### 1. Configure isolated environments.

- [ ] Use Vercel's supported Nuxt server deployment and production build, not static generation. Confirm build/runtime settings and frozen installation match the repository.
- [ ] Configure private values from the [README contract](../../README.md#environment-configuration), scoped separately to Development, Preview and Production. Verify correct build/function values without printing secrets.
- [ ] Isolate databases, auth secrets and provider credentials/settings as appropriate. Previews never use production user data; concurrent previews need separate targets or deliberate serialization.
- [ ] Use least-privilege runtime credentials and separate direct migration credentials. Keep elevated migration access out of ordinary functions and align compute/database regions where practical.

### 2. Configure real domains and email delivery.

- [ ] Establish controlled Preview/production HTTPS origins and safe application return destinations for verification and recovery links.
- [ ] Verify the Resend sender/domain and controlled recipient access. Real verification/recovery links must target the correct environment and remain usable through authorized Preview deployment protection without weakening app checks.

### 3. Gate dependent releases on reviewed migrations.

- [ ] Establish a trusted serialized release job or operator procedure that verifies target/review/CI evidence and applies committed migrations before dependent code receives traffic.
- [ ] No schema generation, `push` or migrations during build, requests or cold starts. Preview target creation/migration precedes dependent Preview traffic; production deployment cannot race ahead of its migration gate.
- [ ] Check compatibility with the running application, prefer additive changes and stop rollout on migration failure. Follow the runbook; do not blindly retry or rewrite history.
- [ ] Record release/migration/target identifiers without secrets and confirm no pending migration for the deployed commit.

### 4. Accept the controlled Preview and real providers.

- [ ] On the tested commit, complete registration → real verification → sign-in → account refresh/edit → sign-out, and recovery → new sign-in with all prior sessions revoked.
- [ ] Introduce and verify any required localized HTTP-boundary serverless bridge, then confirm real Resend receipt, correct usable links and background completion after HTTP response and sanitized rejection/failure reporting, as specified in [background-task acceptance](../deployment.md#background-tasks). Verify function budget/serverless lifetime limits; `waitUntil` does not promise durable delivery.
- [ ] Verify deployed origins/CSRF, HTTPS cookies, safe redirects, anonymous/cross-user denial, credential verification and rate limiting across function requests with trustworthy IP handling.
- [ ] Check shared-cache isolation using independent identities through the delivery path, private headers on personalized responses/errors, SSR refresh/navigation and no hydration/private-payload leakage. Include both locales and keyboard/mobile smoke checks.
- [ ] Inspect deployed configuration/database/email error paths for actionable sanitized records, keeping tokens, credentials and sensitive data out of provider/application logs and test artifacts.

### 5. Promote production and run environment-specific smoke checks.

- [ ] Release the exact passing commit only after migration and Preview/CI gates succeed. Reconfirm production origins, credentials and email links rather than implicitly inheriting Preview settings.
- [ ] Verify public home, protected direct load/refresh, profile edit and sign-out with controlled production data; complete real verification/recovery and credential sign-in on the production domain.
- [ ] Check representative locale/mobile rendering, hydration, secure cookies and private response headers. Remove only owned disposable test data; follow the compatible rollback/forward-fix runbook on required failures.

### 6. Confirm operational readiness against the actual deployment.

- [ ] Confirm recovery retention/cutover capabilities, operational owners and access to provider consoles for the chosen environment. Record environment-specific operational details in deployment documentation, separate from reusable setup examples and without secrets.
- [ ] Locate the last compatible application release and migration records. Confirm rotation/outage procedures and the distinction between application rollback and database restore are usable by the deployment owner.
- [ ] Associate passing automated and Preview/production acceptance evidence with the released commit, including migrations, environment isolation, provider delivery and serverless/security outcomes. Unresolved required failures block release acceptance.

<a id="phase-10"></a>

## Phase 10 — Documentation and reusable-starter cleanup

### Goal

Make setup reproducible from a clean clone, finish canonical documentation and remove obsolete starter content without repeating prior acceptance unnecessarily.

### Preconditions

- Phases 4–9 have implementation and acceptance evidence; this phase closes remaining documentation/cleanup gaps.

### 1. Finish the setup and topic documentation.

- [ ] Verify README's clean clone → frozen install → configure → migrate → run → validate path, including prerequisites and first verified sign-in. README, environment examples, scripts, CI and deployment instructions agree and distinguish consuming migrations from changing schema.
- [ ] Keep variable definitions/setup in README, current auth/database/testing/deployment behavior in topic documents and durable rationale in ADRs. Document the agreed verification, reset/session, display-name-only and provider boundaries without duplicating them across documents; keep optional future work separate from implemented functionality.
- [ ] Cover email setup, safe verification/recovery links, the chosen rate-limit strategy and deployment/operations procedures actually implemented. Troubleshooting must not recommend weakening security, production `push` or manual verification flags.
- [ ] Documentation links and API/CLI examples match the final repository, with no obsolete implementation notes or completed work presented as pending.

### 2. Clean reusable starter content.

- [ ] Replace obsolete homepage/header examples and placeholder branding with neutral localized starter guidance and working navigation. Review title/description/logo/favicon/footer without rebuilding the design system or moving tool-owned files.
- [ ] Remove hardcoded deployment domains from sitemap/robots or use the implemented origin configuration. Private/auth/recovery routes do not belong in a public sitemap; robots rules are not authorization.
- [ ] Remove obsolete probes, route shells, stale examples and demonstrated unused code while retaining intentional components. Check tracked app/docs/config for secrets, private addresses, obsolete variables and deployment-specific values; use placeholders or separate operational notes where appropriate.

### 3. Verify reproducibility from a clean clone.

- [ ] In a disposable clean checkout without inherited environment/generated files, follow the documented supported setup and apply committed migrations to an empty isolated target. Prove first sign-in, account editing, recovery and sign-out without manual database changes.
- [ ] Documented validation discovers real tests and produces the required migration, browser and compilation evidence from the clean checkout, reusing applicable Phase 7/9 evidence.
- [ ] Confirm the documented deployment path is reproducible from a clean checkout. This can be the same clean checkout used for Phase 9 Preview acceptance; repeat a deployment/provider check only if missing evidence or subsequent changes require it.
- [ ] Verify secret/generated files remain ignored, setup leaves no unexplained tracked changes and only owned disposable validation resources are cleaned up.

## Dependency chain

Foundation and server authorization contract (Phases 1–4) → client sessions/page access (5) → email/password/account UI (6) → coverage/CI (7) → security controls/runbook (8) → final Preview acceptance and production release (9) → reproducibility/cleanup (10).

Preview provisioning/provider acceptance may begin before Phase 8 is complete. Phase 8 prepares controls/runbooks; Phase 9 accepts them in the deployed environment. Phase 10 may share Phase 9's clean-checkout deployment evidence.

## Definition of done

- [ ] Email/password, verification, recovery and sign-out meet Phase 4/6 contracts with real email/deployment acceptance in Phase 9.
- [ ] Protected APIs enforce validated sessions and ownership independently of page middleware; reset/sign-out/expiry revoke access authoritatively.
- [ ] SSR, hydration, refresh/navigation, safe redirects and cross-user/cache isolation meet Phases 5/7/8 acceptance.
- [ ] Forms are validated, localized, accessible and handle expected failures.
- [ ] Committed migrations reproduce an empty database without drift; dependent releases follow controlled migration ordering.
- [ ] Required lint, typecheck, meaningful tests/browser checks and production compilation evidence pass in CI.
- [ ] Serverless security/abuse controls, real delivery and operational procedures are verified for the actual Vercel/Neon deployment.
- [ ] Clean-clone setup and documented deployment are reproducible, with no unfinished acceptance hidden by cleanup.

## Planned future work

### Optional Google OAuth and account linking

This planned extension is outside the mandatory scope of the first version. It does not block Phases 4–10, their Definition of done or publication. No Google-specific module, runtime settings, UI or integration tests are currently included; implementation and real validation remain future work.

- Compose Google through native Better Auth `socialProviders`, preserving the existing identity/session/authorization boundaries without an architecture redesign, provider registry or mirrored auth state. Keep settings/validation in the owning integration, require both private credentials only when configured, and request only normal identity scopes, without offline access or unrelated permissions.
- Preserve native account linking for trustworthy identities with Better Auth's verification/trust safeguards ([ADR 001](../decisions/001-better-auth.md)). Authentication methods remain accounts, not provider fields on users. Evaluate provider email guarantees independently of credential verification; absent/unverified claims and unsafe same-email collisions must not grant unintended access or change the global session requirement.
- Preserve origin/CSRF, OAuth state, cookies, callback integrity and safe return destinations. Review secret rotation, encrypted provider tokens and reauthentication/relinking consequences when introducing the integration.
- Add provider-boundary tests for configuration, accepted/rejected linking, cancellation and failure paths when implementing it. Verify credentials + Google, credentials-only and Google-only compositions through native options, adapting UI and unused email callbacks deliberately.
- Before accepting the extension, validate controlled Preview and production HTTPS origins, exact `/api/auth/callback/google` console registrations, consent/test-user settings, real sign-in/cancellation and linking/collision behavior. Mocks do not establish real provider acceptance; these are extension-specific gates, separate from first-version release acceptance.

## Planned maintenance

- [ ] Migrate to Nuxt 5 / Nitro 3 once Nuxt 5 is stable and dependency/deployment compatibility is verified; see [Build performance on Windows](../../README.md#build-performance-on-windows).
- [ ] Update the email startup plugin for the target Nitro plugin API. Preserve one-time initialization, prerender behavior and runtime configuration validation. Keep HTTP handlers on the portable `nuxt/server` APIs. See the [Nuxt upgrade guide](https://nuxt.com/docs/5.x/getting-started/upgrade#migration-to-nitro-v3).
- [ ] Verify the chosen versions of i18n and Nuxt Test Utils in development and with the built server. The current i18n integration imports Nitro 2 and h3 v1 APIs, so verify its behavior with the chosen module version or Nuxt's module compatibility layer. Run the [HTTP suite](../testing.md#http-coverage) for the mounted Better Auth and Drizzle/Neon boundaries. Verify [locale selection](../i18n.md#locale-selection) and hydration in a browser.
- [ ] Recheck the generated Vercel function runtime and background execution using the [Preview lifecycle test](../deployment.md#background-tasks). Preserve the [ADR 005](../decisions/005-background-tasks.md) guarantees and review the semantics of any cache, header or redirect route rules in use when migrating.

## Out of scope

The following capabilities and operational activities are excluded from the starter's current scope and are not committed future work.

**Capabilities**

- Organizations, multi-tenancy, invitations, roles and permission-management frameworks.
- Billing, subscriptions, dashboards and application-specific CRUD.
- MFA, passkeys, additional OAuth providers and advanced account-management UI.
- Redis, queues, caching infrastructure, uploads and realtime features without a concrete need.
- A custom email-template platform, analytics suite or elaborate design system.

**Operational activities**

- A full database-recovery rehearsal.

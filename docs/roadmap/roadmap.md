# Roadmap

Keep the audited foundation. **Required** phases deliver starter functionality; **Quality / hardening** phases are also required before production. Optional enhancements remain deferred.

Version baseline: Nuxt **4.5.2**, Better Auth/adapter **1.7.3**, Drizzle ORM/Kit **1.0.0-rc.4**, Neon **1.1.0**, vee-validate **5.0.0-beta.1**, Zod **4.5.4**. Before implementing version-sensitive work, recheck resolved versions against applicable official documentation and local guidance.

## Phase 1 — Environment and configuration · Required

- [x] Document supported Node/pnpm versions and reproducible installation.
- [x] Connect private runtime configuration and validate required settings.
- [x] Keep database tooling and application environment names consistent.
- [x] Define environment-specific configuration for local, preview and production.
- [x] Extend `.env.example` with email delivery settings when the provider is selected.

## Phase 2 — Database foundation · Required

2026-09-10 14:37 — Complete; [database setup and validation](../current/database.md).

- [x] Provision an isolated Neon development database.
- [x] Establish the server-only Drizzle connection using the supported Neon integration.
- [x] Confirm connectivity without exposing credentials or database code to the client.
- [x] Establish the reviewed, version-controlled migration workflow.

## Phase 3 — Better Auth server and initial migration · Required

2026-09-10 15:54 — Complete; [auth implementation and validation](../current/auth.md).

- [x] Configure Better Auth and its Drizzle adapter for the selected authentication methods.
- [x] Produce the compatible auth schema without additional domain tables.
- [x] Generate, review and commit the initial migration.
- [x] Apply the migration and verify setup against an empty database.
- [x] Expose the documented Nuxt auth handler and verify session creation, lookup and revocation.

## Phase 4 — Authentication methods and server authorization · Required

- [x] Enable email/password registration, sign-in and sign-out.
- [ ] Connect real email delivery for verification and password recovery, following [Better Auth’s email guidance](https://better-auth.com/docs/concepts/email).
- [ ] Define verified-email access and password-reset session behavior.
- [ ] Configure Google OAuth credentials, callbacks and account-linking policy.
- [ ] Validate custom endpoint input and return appropriate authentication/authorization errors.

## Phase 5 — Client sessions and page access · Required

- [ ] Protect a minimal account endpoint using server-verified identity and ownership.
- [ ] Integrate the Better Auth client as the single session authority.
- [ ] Resolve sessions correctly during SSR, hydration and client navigation.
- [ ] Add authenticated-page and guest-page access rules.
- [ ] Preserve safe return destinations without redirect loops.
- [ ] Handle session loading, expiry and sign-out consistently.

## Phase 6 — Authentication and account UI · Required

- [ ] Build registration, sign-in and Google sign-in screens.
- [ ] Add email-verification, resend, forgotten-password and reset-password screens.
- [ ] Add a protected account page with basic profile editing and sign-out.
- [ ] Apply vee-validate + Zod to forms while retaining authoritative server validation.
- [ ] Cover pending, success, invalid-input, expired-link and provider-failure states.
- [ ] Localize starter UI and verify keyboard access, labels and focus behavior.

## Phase 7 — Tests and CI gates · Quality / hardening

Add focused tests alongside Phases 3–6; this phase completes their coverage.

- [ ] Define test-specific environment configuration.
- [ ] Cover pure validation and utilities with Vitest.
- [ ] Cover server authorization and session behavior with Nuxt-aware tests.
- [ ] Test authentication flows, recovery links and cross-user access rejection.
- [ ] Verify protected-page refreshes, redirects and hydration in a browser.
- [ ] Test migrations against an isolated empty database.
- [ ] Require lint, typecheck, actual tests and production build in CI.

## Phase 8 — Security and operational readiness · Quality / hardening

- [ ] Verify trusted origins, secure cookies, CSRF protection and safe redirects.
- [ ] Verify that the selected authentication rate-limiting strategy is appropriate for Vercel’s serverless deployment model.
- [ ] Check account enumeration, OAuth linking and session-revocation behavior.
- [ ] Ensure personalized responses cannot leak through shared caching.
- [ ] Keep passwords, tokens and sensitive user data out of responses and logs.
- [ ] Document secret rotation, database recovery and failed-deployment handling.

## Phase 9 — Vercel and Neon deployment · Required + hardening

- [ ] Configure Vercel environments with appropriately isolated Neon databases.
- [ ] Configure production URLs, Google callbacks and a verified email sender.
- [ ] Establish a controlled migration step before deploying dependent application changes.
- [ ] Deploy a preview and exercise complete authentication and account flows.
- [ ] Deploy production and verify homepage, protected routes, OAuth and email delivery.
- [ ] Confirm useful error reporting and document database recovery procedures.

## Phase 10 — Documentation and reusable-starter cleanup · Required

- [ ] Document setup from a fresh clone through migration and first sign-in.
- [ ] Document environment variables, Google setup, email delivery and deployment.
- [ ] Explain session ownership, server authorization and test boundaries briefly.
- [ ] Remove obsolete examples, placeholder branding and deployment-specific values.
- [ ] Verify a fresh clone can pass validation and deploy using only the documentation.

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

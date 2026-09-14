# Phase 9 — Vercel and Neon deployment

## Goal

Deploy the validated starter through an isolated preview to production, with controlled migration sequencing and real provider verification.

## Preconditions

- Phases 1–8 pass, including required CI/browser checks, the rate-limit migration and operational runbook. Production is blocked by unresolved auth, isolation or migration failures.
- Obtain Vercel/Neon project access, domain/DNS control, Google console access, verified Resend sender and controlled test accounts. Confirm the intended production release and infrastructure targets before applying changes during implementation.
- Use Node 24 with the Nuxt-required minimum and the pinned pnpm version from Phase 1. Recheck platform support at deployment time. [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 1. Configure Vercel environments with appropriately isolated Neon databases.

- [ ] Import the repository as a Nuxt project using Vercel's supported framework detection and server deployment. Use `pnpm build`, not `pnpm generate`; this starter requires server auth routes. Do not copy generic static-output settings into the project. [Nuxt on Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt).
- [ ] Configure Development, Preview and Production values using Phase 1's `NUXT_DATABASE_URL`, `NUXT_BETTER_AUTH_SECRET`, `NUXT_BETTER_AUTH_URL`, Google pair, `NUXT_RESEND_API_KEY` and `NUXT_EMAIL_FROM`. Verify both build and function runtime receive the intended values without printing them.
- [ ] Assign isolated Neon targets to each environment; previews must not use production user data. For concurrent previews, use separate branches or a deliberately serialized controlled preview target.
- [ ] Set runtime and migration credentials with only their required permissions. Pass the elevated URL to the migration job under `NUXT_DATABASE_URL`; do not deploy it as the normal function credential.
- [ ] Match Vercel compute and Neon regions where practical. Verify frozen installation and the preserved pnpm build allowances on Vercel.

## 2. Configure production URLs, Google callbacks and a verified email sender.

- [ ] Configure the controlled preview hostname and production domain with working TLS. Set each canonical auth URL explicitly; neither arbitrary request hosts nor unreviewed preview hostnames should define security policy.
- [ ] Register exact `/api/auth/callback/google` URLs in the corresponding Google application and verify consent publishing/test-user settings appropriate to each environment. Configure safe application return destinations independently of Google's provider callback.
- [ ] Complete Resend sender-domain verification using its required DNS records. Send a controlled message from the configured sender and inspect verification/reset links for the correct target environment.
- [ ] Ensure preview deployment protection allows the authorized test browser to complete Google/email redirects without weakening app origin checks. Keep real credentials and callback URLs out of reusable example files.

## 3. Establish a controlled migration step before deploying dependent application changes.

- [ ] Add a trusted release job or documented operator step that selects the target, checks migration review/CI results and runs `pnpm db:migrate` once before releasing dependent code. Serialize migration jobs per database.
- [ ] Apply committed artifacts only; no `db:push`, schema generation or migrations in Vercel build/request/cold-start hooks. Preview branch creation and migration must finish before preview traffic depends on the new schema.
- [ ] Prevent an automatic production deployment from racing ahead of the migration step: configure a gated promotion/deploy workflow and test the ordering on preview.
- [ ] Check compatibility with the currently running application before changing a shared schema. Use additive changes first; on a failed migration, stop deployment and follow `docs/operations.md` rather than blindly retrying or deleting migration history.
- [ ] Record release commit, migration identifiers and target branch in deployment notes without secrets. Verify no pending migration remains for the deployed commit.

## 4. Deploy a preview and exercise complete authentication and account flows.

- [ ] Deploy the tested commit to the isolated controlled preview, verify correct server routes/runtime and run the browser smoke suite against that URL with controlled accounts.
- [ ] Manually complete registration → real verification email → sign-in → account refresh → profile edit → sign-out, then password recovery → new sign-in. Verify reset invalidates earlier sessions.
- [ ] Complete real Google sign-in, canceled consent and same-email collision checks. Confirm the normal implicit-linking policy with verification/trust safeguards behaves as documented.
- [ ] Test anonymous/unverified account rejection, cross-user selectors, safe redirects, English/Spanish rendering, keyboard flows and no hydration warnings. Inspect HTTPS cookie and no-store headers through the deployed delivery path.
- [ ] Verify email background work completes after HTTP response under Vercel, and provider failure is visible through sanitized reporting. Recheck shared rate limits across separate function requests.

## 5. Deploy production and verify homepage, protected routes, OAuth and email delivery.

- [ ] Promote/deploy the exact passing commit only after the production migration and required gates succeed. Confirm production variables and callbacks again rather than inheriting preview settings implicitly.
- [ ] Check public `/`, direct unauthenticated `/account`, authenticated refresh, profile update and sign-out with a controlled production test account.
- [ ] Complete one real verification/recovery delivery and Google login. Confirm generated links and redirects use the production domain and no preview credential/data appears.
- [ ] Inspect both locales, mobile layout, console/hydration output, cookie attributes and private response headers. Clean only the controlled test data according to the runbook; do not remove unrelated accounts.
- [ ] Record release success/failures. Halt promotion or invoke the documented compatible rollback/forward-fix procedure if a required auth flow fails.

## 6. Confirm useful error reporting and document database recovery procedures.

- [ ] Use Vercel's existing logs/error facilities to verify actionable records for configuration failure, database outage and email rejection. Add a small correlation/error-code convention only if necessary; no analytics or observability platform is required.
- [ ] Confirm logs contain no passwords, session cookies, recovery tokens, provider keys or connection strings. Check the actual deployed error path, not just unit mocks.
- [ ] Update `docs/operations.md` with real project/branch identifiers, restore retention, responsible operators and links to the provider consoles, excluding credentials. Verify the documented recovery/cutover capability exists for the selected Neon plan. [Neon branch restore](https://neon.com/docs/introduction/branch-restore).
- [ ] Confirm the last compatible release and migration record can be located and that deployment rollback does not imply database rollback. Keep the full restore rehearsal deferred as specified in the roadmap.

## Phase verification

- [ ] CI evidence for `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` and browser tests is attached to the released commit.
- [ ] Record passing preview and production real-provider smoke checks, migration targets and deployment URLs without secrets.
- [ ] Verify application credentials cannot reach the wrong environment and the controlled migration step precedes dependent release traffic.

## Expected state after completion

The starter runs on Vercel with isolated Neon targets, real Google/email flows and verified SSR/session behavior. Release ordering and recovery procedures are documented for the actual environment.

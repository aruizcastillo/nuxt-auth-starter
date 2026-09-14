# Phase 10 — Documentation and reusable-starter cleanup

## Goal

Make the completed starter reproducible by a new maintainer without undocumented local state, while removing obsolete examples and deployment-specific defaults.

## Preconditions

- Phases 1–9 are complete, with reproducible migrations, passing quality gates and recorded real deployment/provider checks.
- Review the implementation and documentation together; the initial inspection found a generic multi-package-manager README, `Hello Nuxt!`, a header link to `example.com`, and `nuxt-auth-starter.com` in `public/robots.txt` and `public/sitemap.xml`.
- Keep all roadmap deferrals: no organizations, roles framework, billing, MFA, passkeys, extra providers, Redis, queues, generic service/repository layers or full recovery rehearsal.

## 1. Document setup from a fresh clone through migration and first sign-in.

- [ ] Rewrite README around the supported Node/pnpm pair, `pnpm install --frozen-lockfile`, `.env.example` copying and each prerequisite account. Keep the final commands aligned with actual package scripts.
- [ ] Provide the exact order: create isolated Neon target → configure environment → `pnpm db:migrate` using committed migrations → `pnpm dev` → register → open the real verification email → sign in → open `/account`.
- [ ] Distinguish consuming the starter's committed migrations from changing its auth schema. Put the pinned Better Auth schema-generation command and generate/review/migrate developer workflow in a concise linked database section.
- [ ] Explain missing credentials, wrong callback URL, unverified sender and absent migrations with symptoms and concrete checks that do not expose secrets. Do not recommend disabling security, using `push` in production or setting a verified flag manually.

## 2. Document environment variables, Google setup, email delivery and deployment.

- [ ] Create or finish `docs/configuration.md` with every actual `NUXT_*` variable, runtime key, required phase/environment, safe example and purpose. Explain the intentional replacement of the original unprefixed names and the direct tooling lookup.
- [ ] Document Google console setup, exact provider callback path, safe application return destinations, consent/test-user requirements and normal implicit linking with verification/trust safeguards. Explain accepted trustworthy linking and rejected unsafe collisions.
- [ ] Document Resend sender verification, private key/sender configuration, controlled test recipient, generic request acknowledgements and background-delivery diagnostics. Use plain templates and the implemented provider only.
- [ ] Finish `docs/deployment.md` with Vercel environment isolation, Node/pnpm settings, controlled preview hostname, migration-before-release sequence and production smoke checklist. Link `docs/operations.md` for recovery/rotation.
- [ ] Keep documentation provider links current and applicable to the implemented versions: [Better Auth Nuxt](https://better-auth.com/docs/integrations/nuxt), [Drizzle Neon](https://orm.drizzle.team/docs/connect-neon), [Vercel Nuxt](https://vercel.com/docs/frameworks/full-stack/nuxt). Do not copy release-line-changing `@latest` commands into setup instructions.

## 3. Explain session ownership, server authorization and test boundaries briefly.

- [ ] Add a short architecture section identifying `app/lib/auth-client.ts`, server auth factory/runtime assembly, `/api/auth/[...all]`, `require-session.ts`, `/api/account`, `server/database/` and safe `shared/` validation/redirect utilities.
- [ ] Explain that Better Auth owns identity/session state, route middleware handles navigation UX, and server handlers enforce verified identity/ownership independently. Describe `useSession(useFetch)` SSR integration and why a second session store is absent.
- [ ] State the deliberate profile scope (display name only), verification/access policy, reset revocation, normal implicit linking with verification/trust safeguards, HTTP adapter transaction setting and database-backed rate limiter.
- [ ] Link `docs/testing.md`: pure Node unit tests, Nuxt runtime tests, live Nitro/database integration tests and real browser tests. Separate deterministic provider fixtures from mandatory real-provider deployment checks.
- [ ] Keep this explanation short enough to use as a file map; do not add an architecture layer merely to make the documentation diagram more elaborate.

## 4. Remove obsolete examples, placeholder branding and deployment-specific values.

- [ ] Replace the homepage placeholder with concise starter setup/status guidance and working auth/account navigation. Remove the obsolete `example.com` header link. Keep localization parity in English and Spanish.
- [ ] Review app title/description, `AppLogo.vue`, footer text and favicon for a neutral reusable identity. Keep existing tool-owned UI paths and Tailwind 4 CSS structure; no design-system rebuild is needed.
- [ ] Remove the hardcoded `nuxt-auth-starter.com` sitemap/robots references or replace them with the implemented configurable production-origin approach. Do not publish private/auth/recovery URLs in a sitemap, and do not treat robots rules as authorization.
- [ ] Remove temporary connectivity probes, route shells, stale auth examples and unused code from implementation phases. Preserve intentional UI components and unrelated changes; do not delete files merely because they were not used in the first screen.
- [ ] Search tracked application/docs/config files for real domain values, keys, private emails, token examples and obsolete environment names. Replace deployment-specific documentation with placeholders or clearly separated operational notes.
- [ ] Reconcile roadmap/phase completion notes with actual behavior and deviations; preserve identifiable roadmap checklist items. Keep these plans as future-agent guidance rather than silently claiming every planned verification was executed.

## 5. Verify a fresh clone can pass validation and deploy using only the documentation.

- [ ] Use a clean disposable checkout with no inherited `.env`, `.nuxt`, installed modules or test database. Follow README exactly on the supported Node/pnpm pair; record missing steps and correct documentation immediately.
- [ ] Provision isolated credentials/targets as documented, install from the lockfile and apply committed migrations to an empty database. Verify first sign-in, account editing, recovery and sign-out without manual database edits.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` and browser tests with documented test configuration. Confirm actual tests are discovered and migration replay/drift checks pass.
- [ ] Deploy the clean checkout to an isolated Vercel preview using only `docs/deployment.md`. Complete real Google/email smoke checks; document external credentials/access as prerequisites rather than claiming zero configuration.
- [ ] Verify generated output/secret files remain ignored and the checkout has no unexplained tracked changes after setup. Remove only disposable validation resources that were created for this exercise.

## Phase verification

- [ ] Trace every roadmap definition-of-done item to passing automated evidence or a recorded real-environment manual check.
- [ ] Confirm README, `.env.example`, actual scripts, CI and deployment settings agree; all referenced local files and instructions exist.
- [ ] Confirm a fresh-clone setup and isolated preview deployment succeeded, or explicitly report the exact unmet external prerequisite without declaring the phase complete.
- [ ] Verify no deferred feature or unnecessary dependency was introduced during cleanup.

## Expected state after completion

A new maintainer can install, configure, migrate, test and deploy the starter from its documentation. The reusable baseline retains only the intended auth/account scope, with clear security, SSR, testing and operational boundaries.

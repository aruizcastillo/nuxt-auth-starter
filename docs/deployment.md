# Deployment

## Current support

`pnpm build` produces the server build and `pnpm preview` runs it locally. `nuxt.config.ts` has no explicit Nitro deployment preset or custom route rules. There is no repository CI/release workflow establishing a verified production deployment. Vercel with Neon is the intended hosting path; the starter is not yet reproducibly production-deployable.

Use the [README](../README.md#requirements) for the supported Node/pnpm versions and setup commands. This application requires server auth routes; static generation is not its deployment path.

## Environment isolation

All `NUXT_*` settings are private runtime configuration. Local Nuxt dev/build/preview loads `.env`; standalone built output receives process environment variables. Vercel environment settings are authoritative for Development, Preview and Production, scoped separately with isolated database targets, independent auth secrets and the correct canonical HTTPS auth origin. Preview targets must not use production user data.

`.env.production` is an optional ignored local reference, not automatically loaded by this setup and not deployment configuration. Do not source it into a development/test shell or select it through dotenv flags. Prefer encrypted storage for production values; ignored plaintext can still leak through backups, sync or accidental copying. Use a fresh shell for each database target.

The [README environment table](../README.md#environment-configuration) owns the variable contract; [database](database.md#environment-convention) describes tooling lookup. Production migration ordering, provider callbacks, shared rate limiting, security checks and recovery runbooks remain in the [roadmap](roadmap/roadmap.md#phase-9).

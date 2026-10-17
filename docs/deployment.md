# Deployment

## Current support

`pnpm build` produces the server build and `pnpm preview` runs it locally. `nuxt.config.ts` has no explicit Nitro deployment preset or custom route rules. There is no repository CI/release workflow establishing a verified production deployment. Vercel with Neon remains the reference deployment target, but this delivery implementation targets persistent Node first. The starter is not yet reproducibly production-deployable. PostgreSQL is required, while the database provider can be replaced through the [documented client boundary and setup changes](../README.md#using-another-postgresql-provider).

Use the [README](../README.md#requirements) for the supported Node/pnpm versions and setup commands. This application requires server auth routes; static generation is not its deployment path.

The Vercel function runtime is explicitly `nodejs24.x` through `nitro.vercel.functions.runtime`, matching the project's Node 24 requirement. Installed Nitro 2.13.4's automatic mapping stops at Node 22, so building under Node 24 alone is insufficient. Vercel [supports Node 24](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions); select 24.x for the project's build environment as well. Recheck this explicit setting when upgrading Nitro.

## Background tasks

The request integration registers the email promise directly with Nitro 2's `event.waitUntil`; it contains no hosting detection or execution providers. The sender is initialized by a synchronous Nitro plugin, with the development/production policy in [authentication](authentication.md#configuration-and-initialization). Only the sender is shared; request events are never retained globally.

Nuxt 4.6.1's portable `RequestEvent` does not declare `waitUntil`. Nitro 2.13.4 adds it at runtime, records promises and forwards them when `event.context.waitUntil` exists. A small structural check at registration accommodates the type difference; method presence does not certify hosting lifetime support.

The base acceptance target is `node-server`: a persistent Node process can finish sending after returning HTTP. Tests hold the provider pending, receive HTTP, release delivery and observe completion. This is not a queue: process shutdown, restart or failure can interrupt work. There are no automatic retries or durable delivery guarantees.

**Serverless acceptance is pending.** Installed Nitro 2.13.4's Vercel Node adapter does not itself connect the platform's request lifetime to its event method. Removing the old Vercel integration therefore removes that explicit bridge; do not promote this implementation as verified for Vercel background delivery. A later change must test the deployed path and add only a necessary HTTP-boundary bridge, leaving auth and email unchanged. No `@vercel/functions` application dependency or private Vercel-context access remains.

Before accepting Vercel, use an isolated Preview and controlled mailbox: receive the HTTP acknowledgement while delivery remains pending, then confirm provider acceptance/receipt, usable environment-correct links and sanitized failure reporting. A fast successful send can finish before HTTP and does not prove lifecycle extension. Respect the remaining function duration, including auth/database work and the transport's ten-second deadline. See [Phase 9](roadmap/roadmap.md#phase-9).

## Environment isolation

All `NUXT_*` settings are private runtime configuration. Local Nuxt dev/build/preview loads `.env`; standalone built output receives process environment variables. Vercel environment settings are authoritative for Development, Preview and Production, scoped separately with isolated database targets, independent auth secrets and the correct canonical HTTPS auth origin. Preview targets must not use production user data.

`.env.production` is an optional ignored local reference, not automatically loaded by this setup and not deployment configuration. Do not source it into a development/test shell or select it through dotenv flags. Prefer encrypted storage for production values; ignored plaintext can still leak through backups, sync or accidental copying. Use a fresh shell for each database target.

The [README environment table](../README.md#environment-configuration) owns the variable contract; [database](database.md#environment-convention) describes tooling lookup. Security controls, the serverless rate-limit choice and recovery runbooks remain in [Phase 8](roadmap/roadmap.md#phase-8); real email delivery, usable verification/recovery links, deployed acceptance and migration/release ordering belong to [Phase 9](roadmap/roadmap.md#phase-9). First-version deployment requires only the email/password integration; the [optional future authentication extension](roadmap/roadmap.md#planned-future-work) does not gate publication.

# Deployment

## Current support

`pnpm build` produces the server build and `pnpm preview` runs it locally. `nuxt.config.ts` has no explicit Nitro deployment preset or custom route rules. There is no repository CI/release workflow establishing a verified production deployment. Vercel with Neon is the reference hosting path; the starter is not yet reproducibly production-deployable. PostgreSQL is required, while the database provider can be replaced through the [documented client boundary and setup changes](../README.md#using-another-postgresql-provider).

Use the [README](../README.md#requirements) for the supported Node/pnpm versions and setup commands. This application requires server auth routes; static generation is not its deployment path.

The Vercel function runtime is explicitly `nodejs24.x` through `nitro.vercel.functions.runtime`, matching the project's Node 24 requirement. Installed Nitro 2.13.4's automatic mapping stops at Node 22, so building under Node 24 alone is insufficient. Vercel [supports Node 24](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions); select 24.x for the project's build environment as well. Recheck this explicit setting when upgrading Nitro.

## Background tasks

`server/background/index.ts` uses `import.meta.preset`, fixed by Nitro during the build from explicit configuration or hosting detection. Auth requests that can send email obtain the corresponding handler during [sender preparation](authentication.md#verification-and-recovery-delivery); other operations do not require it. The host is not detected dynamically. There is no global plugin or shared request state. [ADR 005](decisions/005-background-tasks.md) records the rationale and rejected alternatives.

| Preset | Provider | Supported lifetime |
| --- | --- | --- |
| `nitro-dev`, `node-server` | `providers/nitro.ts` | Local development and persistent Node servers; uses Nitro 2's `event.waitUntil`. |
| `vercel` | `providers/vercel.ts` | Vercel Node Functions; uses the public `@vercel/functions.waitUntil`. |
| Anything else | None | Email-sending auth flows fail explicitly; another serverless host needs a verified integration. |

Installed Nuxt 4.6.1's portable `RequestEvent` does not declare `waitUntil`. Nitro 2.13.4 attaches it at runtime and delegates to `event.context.waitUntil` when supplied; its Vercel preset does not wire that context. The Nitro provider checks the actual event method; the Vercel provider registers directly with the hosting helper. See [Nitro 2 runtime](https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/app.ts) and [Vercel API](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).

`@vercel/functions` is pinned to **3.10.1**. Its installed `wait-until.js` silently returns when request context lacks `waitUntil`, and its public exports offer no capability check. To detect that failure, only `providers/vercel.ts` reads the internal `Symbol.for('@vercel/request-context')` reader and verifies its current context has an invocable `waitUntil`, both during assembly and registration. Actual task registration still uses the public helper. Neither a Vercel environment variable nor `getDeadline()` proves this capability. This narrow internal dependency is justified by the no-silent-loss requirement; do not import private package paths or spread this check outside the provider. Recheck the pinned package implementation and tests on upgrade. Official source: [context](https://github.com/vercel/vercel/blob/main/packages/functions/src/get-context.ts), [registration](https://github.com/vercel/vercel/blob/main/packages/functions/src/wait-until.ts).

Missing/invalid support logs only `background_tasks_unavailable` within the provider. Auth sender preparation reports generic unavailability and stops email-sending flows before account lookup, without sending. Later transport/registration failure is reported through the [email events](authentication.md#verification-and-recovery-delivery), preserving native acknowledgements.

Vercel background work shares the function's maximum duration and can be canceled on timeout; process termination can also interrupt work. The transport's ten-second deadline must fit within the remaining function budget, including auth/database work. Provider timeout/network failure can leave acceptance uncertain.

Before treating a Vercel deployment as verified, use an isolated preview and controlled mailbox to send verification and recovery emails, confirm correct environment URLs and usable links, and confirm completion after the HTTP response. Exercise a provider rejection and inspect sanitized logs. Automated fixtures and a local Vercel-preset build do not establish real receipt or deployed lifecycle support; those external checks remain pending.

## Environment isolation

All `NUXT_*` settings are private runtime configuration. Local Nuxt dev/build/preview loads `.env`; standalone built output receives process environment variables. Vercel environment settings are authoritative for Development, Preview and Production, scoped separately with isolated database targets, independent auth secrets and the correct canonical HTTPS auth origin. Preview targets must not use production user data.

`.env.production` is an optional ignored local reference, not automatically loaded by this setup and not deployment configuration. Do not source it into a development/test shell or select it through dotenv flags. Prefer encrypted storage for production values; ignored plaintext can still leak through backups, sync or accidental copying. Use a fresh shell for each database target.

The [README environment table](../README.md#environment-configuration) owns the variable contract; [database](database.md#environment-convention) describes tooling lookup. Production migration ordering, provider callbacks, shared rate limiting, security checks and recovery runbooks remain in the [roadmap](roadmap/roadmap.md#phase-9).

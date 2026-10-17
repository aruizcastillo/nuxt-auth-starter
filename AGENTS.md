# Nuxt Starter — Agent Instructions

This repository is a clean, reusable Nuxt application starter.

Use idiomatic approaches compatible with the installed dependencies while preserving the project's agreed scope and architecture.

## Core rules

* Prefer framework/library primitives over custom abstractions.
* Keep architecture simple until a real requirement creates a meaningful boundary.
* Respect the conventions of the tool that owns each concern.
* Do not introduce speculative abstractions, dependencies, duplicated state or workarounds.
* SSR, hydration, accessibility, security and server-side authorization must remain correct where applicable.
* Never replace an intentional project decision merely because another valid approach exists.

## Project decisions and technical verification

These answer different questions:

- **Project decisions:** this file, accepted ADRs and deliberate repository conventions define requirements, scope and architectural constraints. Relevant topic documentation describes the current implementation; the roadmap distinguishes pending requirements from proposals. An alternative in official documentation does not by itself overturn an agreed choice.
- **Technical verification:** the dependency versions and verified APIs/behavior determine how those requirements can be implemented. Project instructions and examples cannot make an unsupported API valid. If a decision conflicts with technical evidence, explain the conflict and resolve it before changing the decision or introducing a workaround.

Before version-sensitive work:

1. Read `package.json` and resolve the relevant exact versions from the lockfile or installed packages.
2. Consult applicable official documentation and migration/upgrade guidance for that version or version line.
3. Check installed types, implementation or matching official source when documentation is ambiguous, differs from the installed version or leaves behavior uncertain. Resolve discrepancies using evidence from the installed dependency rather than assuming an example applies.
4. Where official guidance does not prescribe a choice, use a verified compatible ecosystem convention; use a custom solution only for a concrete unmet requirement.

Skills are auxiliary references and may be outdated, including project/library skills. Their examples and recommendations never override verified APIs or behavior of installed dependencies. Apply the same compatibility checks to skills, search results, community material and prior knowledge; none establishes a project decision on its own.

## Ambiguity

Ask before making a materially ambiguous architectural, security, data-model, UX or dependency decision.

Proceed without asking when the choice is mechanical, directly implied by the existing project, explicitly prescribed by official guidance, already established as a project convention, or trivial.

Do not implement around an unresolved decision if that could constrain the eventual choice.

## Documentation

Review the relevant topic documents in `docs/` and architectural decisions in `docs/decisions/` before changing an established area.

Maintain:

* `README.md`: the user-facing clean clone → install → configure → migrate → run → validate path, with deployment prerequisites and links.
* `docs/*.md`: current implementation details and operational/validation procedures.
* `docs/roadmap/*`: remaining scope, dependencies and acceptance criteria, distinguishing requirements, agreed decisions and proposals.
* `docs/decisions/*`: durable architectural decisions and rationale.

Update existing topic files instead of creating documentation for every small task.

Keep each fact in one canonical home and link to it from other documents. Remove completed phase summaries, migration checkpoints and obsolete implementation notes; Git preserves their history. Retain important architectural reasoning in ADRs, not historical logs.

When implementation changes the normal setup or usage path, update the README in the same work.

Keep README brief, with concrete commands and required values checked against the repository. Keep phase logs, investigation history, agent/CLI setup notes, disposable infrastructure identifiers and internal validation details out of it. Never document planned functionality as already available.

## Architecture

Prefer:

```text
framework/library primitive
→ small project-specific abstraction when useful
→ application code
```

Keep integration-specific configuration, validation and implementation in the owning module, for example `database/providers/neon.ts`, `email/providers/resend.ts` or `auth/providers/google.ts`. Provider-independent domain logic stays outside it; consumers use a simple owning-module boundary rather than importing provider internals.

Prefer composition over generic registries or plugin systems. If removing or replacing an integration requires changes to unrelated code, review that boundary before proceeding.

## Framework ownership

Respect ownership boundaries:

* Nuxt owns routing, runtime configuration, SSR and Nitro integration.
* Better Auth owns authentication and session state.
* Drizzle owns relational schema, queries and migrations.
* shadcn-vue owns generated component conventions.
* Reka UI owns primitive component behavior.

Do not reorganize tool-owned structures merely for architectural uniformity.

## Nuxt

Maintain Nuxt 4 / Nitro 2 until the planned Nuxt 5 / Nitro 3 migration meets the [roadmap's compatibility conditions](docs/roadmap/roadmap.md#planned-maintenance). Prefer official portable APIs such as `nuxt/server` when verified against the installed version. Prepare through compatible boundaries and targeted upgrade review, without adopting future-major APIs or starting the migration early.

Use the standard boundaries:

```text
app/       client/universal code
server/    Nitro/server-only code
shared/    intentionally shared code
public/    static public files
```

Prefer Nuxt-native primitives such as `$fetch`, `useFetch`, `useAsyncData`, `useRequestFetch`, `useRuntimeConfig`, middleware, Nitro handlers and plugins.

Do not hide SSR issues with `ClientOnly`, `onMounted()`, arbitrary delays or manual header/cookie forwarding when a supported SSR-safe solution exists.

## Better Auth

Better Auth is the sole authentication authority.

Do not:

* duplicate session state in Pinia or another store;
* build unnecessary auth proxies/controllers;
* manually synchronize auth state;
* introduce fake verification or client-only authorization.

Server-side identity and authorization remain authoritative.

## Drizzle

Use typed relational schemas and relations/query/migration APIs compatible with the installed Drizzle prerelease. Stable-release examples and metadata layouts are potentially incompatible; verify them before use.

Do not use generic JSONB models, runtime tables or runtime DDL to avoid deliberate schema design.

Use reviewed, committed, versioned migrations for shared environments ([ADR 004](docs/decisions/004-versioned-migrations.md)); follow the [database procedure](docs/database.md#migration-procedure). `push` is limited to deliberate development use, not production migration.

## Neon and Vercel

The reference deployment architecture is Vercel-first, with Neon as the default PostgreSQL provider.

PostgreSQL and Drizzle define the database contract. Keep Neon-specific client behavior and operational workflow isolated within its provider integration.

The reference implementation uses `@neondatabase/serverless` with the Neon HTTP driver for stateless, serverless-friendly database access. Review driver-specific capabilities, including transaction behavior, when replacing the database client.

Do not introduce long-running Node server or traditional pool assumptions into the reference serverless implementation.

Keep local, preview and production databases/secrets isolated.

## Frontend stack

Use shadcn-vue conventions for generated components and verified Reka UI behavior for composition, focus, keyboard interaction, portals and controlled state. Maintain valid, accessible HTML.

The project uses Tailwind CSS 4 with `@tailwindcss/vite`. Do not introduce Tailwind 3 configuration or legacy setup.

Forms use vee-validate + Zod. Client validation improves UX; server validation remains authoritative.

Use installed `@nuxtjs/i18n` conventions and preserve the agreed locale/routing behavior.

Prefer VueUse for common reactive/browser behavior when appropriate, especially where SSR matters.

## State and HTTP

Use Vue/Nuxt primitives for application state and HTTP according to their SSR and client-side roles.

Small domain-oriented service modules are valid for imperative HTTP operations. Keep them focused on transport and API contracts, not duplicated state or application logic.

## Testing

Use Vitest for pure unit tests and `@nuxt/test-utils` when Nuxt runtime behavior is required.

Use real integration boundaries when behavior depends on database access, cookies, sessions, routing or Nitro.

Mock external providers where appropriate, not framework/database behavior that should be tested directly.

Tests must not silently pass because required integration infrastructure is unavailable.

Choose checks and commands according to [validation scope](docs/testing.md#validation-scope), including its separate full-suite and production-build paths.

## TypeScript and ESLint

Keep Nuxt's generated ESLint flat configuration as the base.

The current TypeScript major is intentional; upgrading it requires a compatibility review.

Do not fix type problems with broad `any`, unsafe casts, `@ts-ignore` or disabled rules unless an external defect is documented and the workaround is narrowly scoped.

## Dependencies

Do not add dependencies without a concrete requirement.

Before adding one:

1. Check whether Nuxt, Vue or an installed dependency already solves the need.
2. Verify compatibility with exact installed versions.
3. Prefer official integrations.
4. Avoid overlapping libraries.

Axios, Pinia, Prisma, Firebase, Clerk, Supabase Auth, TanStack Query, Redis, tRPC, GraphQL and Express are intentionally absent unless requirements change.

## Failures and workarounds

Reproduce and isolate the failure, then use the technical verification process above to find the supported solution. Do not bypass investigation with dependency downgrades, pnpm overrides, timers or the SSR/type workarounds prohibited above. Document any necessary narrow workaround and its reason.

## Before completing work

For framework/library changes:

* verify SSR/hydration where relevant;
* verify accessibility and security where relevant;
* remove unnecessary abstractions/workarounds;
* update relevant documentation;
* run appropriate validation.

If a command cannot run or fails for unrelated reasons, report it explicitly.

Never claim completion while knowingly leaving unexplained lint, type, test or build failures.

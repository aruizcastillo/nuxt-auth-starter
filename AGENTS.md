# Nuxt Starter — Agent Instructions

This repository is a clean, reusable Nuxt application starter.

The goal is not merely to make features work. Use the current, idiomatic approach compatible with the exact installed version of each framework and library. Prefer official guidance where authoritative, verified ecosystem conventions where official guidance is silent, and custom solutions only when a concrete requirement justifies them.

## Core rules

* Prefer framework/library primitives over custom abstractions.
* Keep architecture simple until a real requirement creates a meaningful boundary.
* Respect the conventions of the tool that owns each concern.
* Do not introduce speculative abstractions, dependencies, duplicated state or workarounds.
* SSR, hydration, accessibility, security and server-side authorization must remain correct where applicable.
* Never replace an intentional project decision merely because another valid approach exists.

## Versions and sources

Before version-sensitive work:

1. Read `package.json` and the lockfile.
2. Determine the exact resolved version from the lockfile or installed package.
3. Use official documentation for that version or version line.
4. Check official migration/upgrade guidance when APIs may have changed.
5. If ambiguity remains, inspect official source, package types or the installed implementation.
6. Use ecosystem conventions only when higher-priority sources do not prescribe the choice.

Source priority:

1. `AGENTS.md`
2. Official project/library skills
3. Official documentation for the installed version
4. Official migration/upgrade guides
5. Official source and installed package types
6. Intentional repository conventions
7. Verified current ecosystem conventions
8. High-quality community material
9. Other examples
10. Agent prior knowledge

Do not assume search results, blogs, Stack Overflow, GitHub discussions, old docs or model knowledge apply to the installed version.

### Drizzle prerelease

Drizzle ORM and Kit use `1.0.0-rc.4`.

Treat stable 0.x examples as potentially obsolete. Do not introduce 0.x relations, configuration, query or migration patterns unless current 1.0 RC guidance confirms them.

## Ambiguity

Ask before making a materially ambiguous architectural, security, data-model, UX or dependency decision.

Proceed without asking when the choice is mechanical, directly implied by the existing project, explicitly prescribed by official guidance, already established as a project convention, or trivial.

Do not implement around an unresolved decision if that could constrain the eventual choice.

## Documentation

Review relevant files under `docs/current/` and `docs/deprecated/` before changing an established area.

Maintain:

* `docs/current/` — implemented architecture, integrations, current decisions and useful validation evidence.
* `docs/deprecated/` — superseded approaches and decisions that should not be reintroduced casually.
* `docs/roadmap/` — planned work and scope.

Update existing topic files instead of creating documentation for every small task.

Keep documentation focused on current project state. Preserve history only when useful for maintenance.

### README

`README.md` is the primary user-facing setup path, not an implementation log.

Its purpose is to support:

```text
clean clone → install → configure → migrate → run → validate
```

Use:

* `README.md` for installation, configuration, database setup, development, validation and deployment.
* `docs/current/` for implementation details, rationale and validation evidence.
* `docs/roadmap/` for incomplete/planned work.

When implementation changes the normal setup or usage path, update the README in the same work.

Prefer concrete commands and required values over architectural explanation.

Do not keep repository-specific development history in the README, including timestamps, phase logs, disposable branches, Neon project IDs, agent/CLI setup notes, investigation history or internal validation details.

Verify README commands, environment variables and setup instructions against the actual repository before changing them.

Never document planned functionality as already available.

## Architecture

Prefer:

```text
framework/library primitive
→ small project-specific abstraction when useful
→ application code
```

Add a layer only when it isolates real complexity, establishes a meaningful boundary or removes demonstrated duplication.

- Keep external providers and clients loosely coupled and locally owned. Integration-specific configuration, validation, and implementation should stay with that integration, while provider-independent domain logic stays outside it. Prefer simple composition over generic registries, adapters, plugin systems, or speculative abstractions.

## Framework ownership

Respect ownership boundaries:

* Nuxt owns routing, runtime configuration, SSR and Nitro integration.
* Better Auth owns authentication and session state.
* Drizzle owns relational schema, queries and migrations.
* shadcn-vue owns generated component conventions.
* Reka UI owns primitive component behavior.

Do not reorganize tool-owned structures merely for architectural uniformity.

## Nuxt

Follow Nuxt 4 conventions.

Use the standard boundaries:

```text
app/       client/universal code
server/    Nitro/server-only code
shared/    intentionally shared code
public/    static public files
```

Prefer Nuxt-native primitives such as `$fetch`, `useFetch`, `useAsyncData`, `useRequestFetch`, `useRuntimeConfig`, middleware, Nitro handlers and plugins.

SSR and hydration correctness are mandatory.

Do not hide SSR issues with `ClientOnly`, `onMounted()`, arbitrary delays or manual header/cookie forwarding when a supported SSR-safe solution exists.

## Better Auth

Better Auth is the sole authentication authority.

Use guidance compatible with installed Better Auth `1.7.x`.

Do not:

* duplicate session state in Pinia or another store;
* build unnecessary auth proxies/controllers;
* manually synchronize auth state;
* introduce fake verification or client-only authorization.

Server-side identity and authorization remain authoritative.

## Drizzle

Use current Drizzle 1.0 RC APIs.

Prefer typed relational schemas and current relations APIs.

Do not use generic JSONB models, runtime tables or runtime DDL to avoid deliberate schema design.

Production schema changes use:

```text
schema
→ drizzle-kit generate
→ review migration
→ drizzle-kit migrate
```

`push` may be used when appropriate in development, but it is not the production migration workflow.

## Neon and Vercel

Deployment is Vercel-first and PostgreSQL runs on Neon.

Use `@neondatabase/serverless` according to current Neon and Drizzle guidance.

Do not introduce long-running Node server or traditional pool assumptions into serverless code.

Keep local, preview and production databases/secrets isolated.

## Frontend stack

Use shadcn-vue as the component layer and Reka UI for primitive behavior.  

Use shadcn-vue conventions for generated components and Reka UI documentation/skills for primitive behavior such as `as-child`, focus management, portals, keyboard interaction, controlled state, dismissable layers, and menu/dialog/popover semantics.

Maintain valid HTML and accessibility.

The project uses Tailwind CSS 4 with `@tailwindcss/vite`. Do not introduce Tailwind 3 configuration or legacy setup.

Forms use vee-validate + Zod 4. Client validation improves UX; server validation remains authoritative.

Use current `@nuxtjs/i18n 10.x` conventions.

Prefer VueUse for common reactive/browser behavior when appropriate, especially where SSR matters.

## State and HTTP

Pinia and Axios are intentionally not included in the base starter.

Prefer Vue/Nuxt primitives when sufficient. Use `$fetch`, `useFetch`, `useAsyncData` and `useRequestFetch` according to their intended SSR and client-side roles.

Small domain-oriented service modules are valid for imperative HTTP operations. Keep them focused on transport and API contracts, not duplicated state or application logic.

Add Pinia, Axios or broader HTTP abstractions only when a concrete requirement justifies them.

## Testing

Use Vitest for pure unit tests and `@nuxt/test-utils` when Nuxt runtime behavior is required.

Do not boot Nuxt for pure utilities.

Use real integration boundaries when behavior depends on database access, cookies, sessions, routing or Nitro.

Mock external providers where appropriate, not framework/database behavior that should be tested directly.

Tests must not silently pass because required integration infrastructure is unavailable.

## TypeScript and ESLint

Keep Nuxt's generated ESLint flat configuration as the base.

TypeScript `6.0.x` is intentional.

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

When something fails:

1. Reproduce and isolate it.
2. Verify exact installed versions.
3. Read current official guidance.
4. Check migration/upgrade notes.
5. Inspect source/types if necessary.
6. Use the supported solution where one exists.
7. Otherwise use a verified current convention.
8. Use a custom workaround only when the supported approaches do not satisfy the requirement.

Do not reflexively use `ClientOnly`, `onMounted`, timers, `eslint-disable`, `@ts-ignore`, dependency downgrades, pnpm overrides, manual cookie forwarding or duplicated state.

Document necessary workarounds and their reason.

## Before completing work

For framework/library changes:

* confirm exact versions;
* verify against applicable official guidance;
* ensure no legacy patterns were introduced;
* verify SSR/hydration where relevant;
* verify accessibility and security where relevant;
* remove unnecessary abstractions/workarounds;
* update relevant documentation;
* run appropriate validation.

Default validation:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

If a command cannot run or fails for unrelated reasons, report it explicitly.

Never claim completion while knowingly leaving unexplained lint, type, test or build failures.

## Final rule

Choose the current, idiomatic approach compatible with the exact installed version: official guidance where authoritative, established conventions where official guidance is silent, and custom solutions only when a concrete requirement justifies them.

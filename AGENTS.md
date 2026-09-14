# Nuxt Starter — Agent Instructions

This repository is a clean, reusable Nuxt application starter.

The goal is not merely to make features work. Implementations must follow the current, idiomatic approach compatible with the exact installed version of each framework and library used by the project.

Use official project skills and official documentation where they are authoritative. When they are silent, non-prescriptive, or do not define application architecture, use a current, established ecosystem convention verified as compatible with the exact installed version. Use custom solutions only when a concrete requirement justifies them.

## Core principle

Prefer the current, idiomatic standard for the exact installed version of each technology. Official guidance is authoritative for its APIs, configuration, security guidance, and framework-owned behavior; established ecosystem conventions are valid for application choices that official guidance does not prescribe.

Before implementing anything version-sensitive:

1. Read `package.json` and the lockfile.
2. Identify the exact resolved package version from the lockfile or installed package. `package.json` remains authoritative for the project's declared dependency constraints.
3. Use documentation applicable to that version or version line.
4. Check official migration/upgrade documentation when APIs may have changed.
5. If official guidance is silent or non-prescriptive, verify a current, established ecosystem convention against that exact version.
6. If ambiguity remains, inspect official source code, package types, or the installed package before making assumptions.

Never assume that examples from search results, blog posts, Stack Overflow, GitHub discussions, old docs, or model knowledge apply to the installed version.

## Ambiguity and decision handling

If an implementation decision is unclear, underspecified, or has multiple materially different valid approaches, stop before making that decision and ask for clarification.

Do not guess, invent requirements, or silently choose an architectural, product, security, data-model, UX, or dependency decision when the intended direction is not clear.

You may proceed without asking only when:
- the choice is mechanical or directly implied by the existing codebase, roadmap, documentation, or official guidance;
- there is a single clearly established project convention;
- the difference is trivial and does not materially affect architecture, behavior, compatibility, security, data, or maintainability.

When asking:
- explain the ambiguity briefly;
- list the relevant options when useful;
- state the practical trade-off;
- wait for explicit direction before continuing that part of the implementation.

Do not continue implementing around an unresolved decision if doing so could constrain or bias the eventual choice.

## Source-of-truth hierarchy

When sources or approaches disagree, use this priority:

1. Explicit requirements in this `AGENTS.md`
2. Official skill maintained by the framework/library
3. Official documentation applicable to the installed version
4. Official migration and upgrade guides
5. Official source code and installed package types
6. Existing intentional conventions in this repository
7. Widely accepted current ecosystem conventions, verified for the exact installed version
8. High-quality community skills/documentation
9. Other community examples
10. Agent prior knowledge

Never override a documented project decision merely because another architecture is technically valid.

Use an ecosystem convention only when higher-priority sources do not prescribe the choice. It cannot override official API, security, compatibility, or framework-boundary guidance.

## Version awareness is mandatory

`package.json` is authoritative for declared dependency constraints. The lockfile or installed package is authoritative for the exact resolved version used for version-sensitive work.

### Prerelease rule

Drizzle ORM and Drizzle Kit currently use `1.0.0-rc.4`.

Treat stable Drizzle 0.x documentation and examples as potentially obsolete. Do not use Drizzle 0.x relations, configuration, query, or migration patterns unless current Drizzle 1.0 RC documentation explicitly confirms them.

Never silently adapt an outdated example with a workaround.

## Project documentation

Before planning or changing an established area, review the relevant files under `docs/current/` and `docs/deprecated/`.

Maintain this documentation as part of the implementation work:

- `docs/current/` records completed architecture, implemented integrations, current project decisions, and relevant implementation history.
- `docs/deprecated/` records superseded approaches, replaced decisions, and patterns that should not be reintroduced without explicit justification.
- When a phase or significant architectural area is completed, create or update the relevant file in `docs/current/`.
- When an established approach is replaced or intentionally abandoned, move or summarize the obsolete guidance in `docs/deprecated/`.
- Keep documentation concise and topic-oriented. Update existing topic files instead of creating a new file for every small task.
- Documentation must describe the current project state and only preserve implementation history that is useful for future maintenance.

Use this minimum format for entries:

```text
YYYY-MM-DD HH:mm — Short title
```  

## Architecture philosophy

Start simple. Add architectural layers only when a concrete requirement justifies them.

Prefer:

```text
framework primitive
→ small project-specific abstraction when useful
→ application code
```

Avoid speculative repository/service/locator/container/contract layers by default.

Introduce a layer or custom solution when a concrete use case creates a meaningful boundary, isolates real complexity, or reduces demonstrated duplication. Do not build generic CRUD frameworks, generic database abstractions, custom auth frameworks, or runtime schema systems merely in anticipation of future needs.

- Keep external providers and clients loosely coupled and locally owned. Integration-specific configuration, validation, and implementation should stay with that integration, while provider-independent domain logic stays outside it. Prefer simple composition over generic registries, adapters, plugin systems, or speculative abstractions.

## Framework ownership

Respect conventions belonging to the tool that owns the files.

Examples:

- `app/lib/utils.ts` stays there because shadcn-vue uses that convention.
- `app/components/ui/` follows shadcn-vue conventions.
- Nuxt runtime configuration uses `runtimeConfig`.
- Better Auth owns authentication/session state.
- Drizzle owns relational schema/query/migration concerns.
- Reka UI owns primitive behavior beneath shadcn-vue components.

Do not reorganize tool-owned structure merely to make it look more generically “Nuxt-like”.

## Nuxt

Follow Nuxt 4 conventions.

Primary boundaries:

```text
app/       client/universal application code
server/    Nitro/server-only code
shared/    code intentionally shared between app and server
public/    static public files
```

Prefer Nuxt-native primitives such as `useFetch`, `useAsyncData`, `$fetch`, `useRequestFetch`, `useRuntimeConfig`, route middleware, server middleware, Nitro handlers, and Nuxt plugins.

SSR and hydration correctness are mandatory.

Do not hide SSR problems with `<ClientOnly>`, `onMounted()`, arbitrary delays, or manual cookie/header forwarding when Nuxt or the integrated library provides an official SSR-safe solution.

## Better Auth

Better Auth is the sole authentication system.

Follow the installed official Better Auth skills and documentation for the installed `1.7.x` version.

Do not mirror Better Auth session state into Pinia by default.

Avoid custom auth API proxies, controllers, and manual session synchronization unless a concrete, verified integration need justifies them and Better Auth remains authoritative. Do not add first-user-admin behavior, fake email verification, or client-only authorization.

Server-side authorization remains authoritative.

## Drizzle

Use current Drizzle 1.0 RC documentation for the installed version.

Prefer typed relational schemas and current relations APIs.

Do not use generic JSONB-backed domain models, runtime tables, or runtime DDL as a way to avoid deliberate schema design or as a generic data-access abstraction. A concrete, documented operational need requires an explicit reviewed design.

Production schema evolution uses versioned migrations:

```text
schema
→ drizzle-kit generate
→ reviewed migration
→ drizzle-kit migrate
```

`push` may be used in development when appropriate, but is not the production migration workflow.

## Neon and Vercel

The deployment architecture is Vercel-first and PostgreSQL is hosted on Neon.

Use `@neondatabase/serverless` according to current Neon and Drizzle documentation.

Do not copy long-running Node server pool assumptions into serverless code.

## shadcn-vue and Reka UI

shadcn-vue is the component layer. Reka UI is the primitive layer.

Use shadcn-vue conventions for generated components and Reka UI documentation/skills for primitive behavior such as `as-child`, focus management, portals, keyboard interaction, controlled state, dismissable layers, and menu/dialog/popover semantics.

Maintain valid HTML and accessibility semantics.

## Tailwind CSS

This project uses Tailwind CSS 4 with `@tailwindcss/vite`.

Do not introduce Tailwind 3 patterns, legacy configuration, PostCSS setup, or old plugin conventions unless current Tailwind 4 documentation explicitly requires them.

## Forms and validation

Forms use vee-validate + Zod 4.

Use documentation for the installed versions. Do not copy Zod 3 patterns blindly.

Client validation improves UX; server validation remains mandatory for untrusted input.

## State management

Pinia is intentionally not installed.

Before adding state management, verify the requirement cannot be solved cleanly by Vue reactivity, Nuxt composables, `useState`, Better Auth state, router/URL state, or Nuxt data-fetching state.

## HTTP

Axios is intentionally not installed.

Prefer Nuxt’s native `$fetch`, `useFetch`, `useAsyncData`, and `useRequestFetch`.

## i18n

Use current `@nuxtjs/i18n 10.x` conventions. Do not copy configuration from older module generations without verifying compatibility.

## VueUse

Prefer official VueUse composables when they solve a common reactive/browser problem correctly, especially when SSR behavior is relevant.

## Testing

Use Vitest for pure unit tests and `@nuxt/test-utils` when Nuxt runtime behavior is required.

Do not boot Nuxt unnecessarily for pure utilities.

## ESLint and TypeScript

Keep the Nuxt-generated ESLint flat configuration as the base.

Do not replace it with a generic Vue/TypeScript ESLint setup.

TypeScript `6.0.x` is intentional. Do not change TypeScript major versions merely because npm reports a newer `latest`.

Do not solve type errors with broad `any`, unsafe casts, `@ts-ignore`, or disabled rules unless an external defect is documented and the workaround is narrowly scoped.

## Dependencies

Do not add dependencies without a concrete requirement.

Before adding a package:

1. Check whether Nuxt/Vue or an installed dependency already solves it.
2. Verify compatibility with exact installed versions.
3. Prefer official integrations.
4. Avoid overlapping libraries.

Dependencies intentionally absent include Axios, Pinia, Prisma, Firebase, Clerk, Supabase Auth, TanStack Query, Redis, tRPC, GraphQL, and Express unless requirements change.

## No workaround-first development

When something fails:

1. Reproduce and isolate it.
2. Verify the exact installed version.
3. Read current official documentation.
4. Check migration/upgrade notes.
5. Inspect package types/source if needed.
6. Implement the documented solution where one exists; where official guidance is non-prescriptive, use a verified current ecosystem convention.
7. Only then consider a workaround or custom solution, documenting why the supported and conventional options do not meet the requirement.

Do not reflexively use `<ClientOnly>`, `onMounted`, timers, `eslint-disable`, `@ts-ignore`, dependency downgrades, pnpm overrides, manual cookie forwarding, or duplicated state.

## Before completing a task

For changes involving external libraries:

- confirm installed versions;
- confirm the implementation against applicable official documentation;
- verify no legacy API or pattern was introduced;
- verify SSR/hydration where relevant;
- verify accessibility where relevant;
- remove unnecessary abstractions/workarounds;
- run relevant validation.

Default validation:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

If a command cannot run or fails for unrelated reasons, report that explicitly.

Never claim completion while knowingly leaving unexplained lint, type, test, or build failures.

## Final rule

Choose the current, idiomatic approach compatible with the exact installed version: official guidance where authoritative, established conventions where official guidance is silent, and custom solutions only when a concrete requirement justifies them.

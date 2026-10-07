# 004 — Use reviewed versioned migrations

Status: Accepted

## Context

Shared environments need reproducible schema changes with reviewable SQL and migration history. Direct schema synchronization does not provide that release record.

## Decision

Drizzle owns relational schema and migrations. Use schema → generate → review SQL and metadata → commit all generated artifacts → migrate. Let installed Drizzle Kit 1.0 RC generate its metadata format; do not substitute the stable 0.x journal layout.

Use the Better Auth CLI only to generate the auth schema. Do not use its direct migration command for this integration. Keep Kit's direct connection lookup separate from Nuxt runtime configuration.

## Consequences

Applied shared migrations are immutable; corrections use reviewed forward migrations. `db:push` is limited to deliberate development use. Migrations must not run on request, import, build or function cold start. Replay committed artifacts on an empty isolated target and check rerun idempotence. See [database procedure](../database.md#migration-procedure); release-job automation remains [planned](../roadmap/roadmap.md#phase-9).

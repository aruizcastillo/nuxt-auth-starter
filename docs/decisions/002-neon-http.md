# 002 — Use Neon HTTP for database queries

Status: Accepted

## Context

The starter requires PostgreSQL and uses Neon as its reference provider. Nuxt/Nitro requests need straightforward, stateless database access suitable for serverless deployment; there is no demonstrated need for a persistent WebSocket pool or interactive transactions.

## Decision

Use `@neondatabase/serverless` with Drizzle's `neon-http` integration in a small server-only provider factory, selected through the public database entry point. Keep schema composition and domain configuration independent of the provider. No generic database-provider interface is needed.

## Consequences

Drizzle's `neon-http` driver does not support interactive `db.transaction(callback)`, so `server/auth/options.ts` explicitly sets the Better Auth adapter's `transaction: false`. This is a capability decision for the selected driver, not a limitation of PostgreSQL or Neon generally. Neon HTTP supports non-interactive transactions, but those do not provide the callback transaction API required here. See the [official Drizzle Neon guidance](https://orm.drizzle.team/docs/connect-neon).

Multi-operation auth writes are not made atomic by that adapter option. Review the setting and connection lifecycle when replacing the database client or deployment model; enable adapter transactions only after verifying support with the chosen driver. See [database implementation](../database.md) and the [provider replacement procedure](../../README.md#using-another-postgresql-provider).

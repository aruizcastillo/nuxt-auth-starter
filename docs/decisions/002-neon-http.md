# 002 — Use Neon HTTP for database queries

Status: Accepted

## Context

The Vercel-first starter uses one-shot database queries and has no demonstrated need for a persistent WebSocket pool or interactive transactions.

## Decision

Use `@neondatabase/serverless` with Drizzle's `neon-http` integration in a small server-only factory. Keep schema composition and domain configuration independent of the provider. No generic database-provider interface is needed.

## Consequences

HTTP does not support interactive `db.transaction(callback)`, so Better Auth adapter transactions remain explicitly disabled. Multi-operation auth writes are not made atomic by that adapter option. Revisit the driver only when a concrete requirement needs interactive/atomic multi-operation transactions. See [database implementation](../database.md).

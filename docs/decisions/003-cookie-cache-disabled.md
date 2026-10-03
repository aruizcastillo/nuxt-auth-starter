# 003 — Disable session cookie caching

Status: Accepted

## Context

Session revocation must be authoritative when a cookie is replayed after sign-out. A cached session payload could continue to authenticate until its cache lifetime ends.

## Decision

Persist sessions in PostgreSQL and explicitly set `session.cookieCache.enabled: false` in the Better Auth factory. Session reads consult the database.

## Consequences

Session lookup incurs database access, and database availability matters for authentication. Preserve real HTTP revocation tests. Any future cache proposal must justify and test its revocation delay; planned password-reset session policy must retain this guarantee. See [authentication](../authentication.md) and [testing](../testing.md).

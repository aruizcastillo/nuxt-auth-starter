# 001 — Better Auth owns authentication

Status: Accepted

## Context

The starter needs one authority for identity and sessions that can be reused by Nitro and schema tooling. Duplicated session stores and custom credential controllers would create synchronization and security boundaries to maintain.

## Decision

Use Better Auth for authentication, persisted sessions, hashing and credential endpoints. Keep `server/auth/options.ts` as direct native configuration, with Nuxt runtime assembly outside it. Application authorization remains server-owned and derives identity from sessions validated by Better Auth; authentication methods belong to accounts, not provider fields on users.

Each domain owns configuration parsing; email delivery belongs to its provider module. Share only sanitized error formatting. Keep native method composition and manually adapt derived-project UI; do not introduce registries, feature mirrors, service locators or speculative provider interfaces.

The first version uses email/password, verification, recovery, sessions and server-side authorization. Google OAuth and account linking are an [optional planned extension](../roadmap/roadmap.md#planned-future-work), with no current implementation or validation. For that future integration, preserve Better Auth's normal implicit linking for trustworthy OAuth identities with its native verification/trust safeguards; keep provider settings in the owning integration.

Email/password requires verified email through its native method option. Any future OAuth integration must evaluate its provider policy independently. `requireSession()` checks session validity and preserves the actual `emailVerified` value; a verified address is not a global authorization requirement. Any resource-specific requirement must be explicit.

## Consequences

Neon supplies persistence, not a second auth authority: Neon Auth and its application configuration/deployment layer are unused. A client session store or auth proxy requires a demonstrated requirement. See [current authentication](../authentication.md) for implementation details and the [roadmap](../roadmap/roadmap.md#phase-4) for remaining work.

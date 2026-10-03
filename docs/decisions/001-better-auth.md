# 001 — Better Auth owns authentication

Status: Accepted

## Context

The starter needs one authority for identity and sessions that can be reused by Nitro and schema tooling. Duplicated session stores and custom credential controllers would create synchronization and security boundaries to maintain.

## Decision

Use Better Auth for authentication, persisted sessions, hashing and credential endpoints. Keep `server/auth/options.ts` as direct native configuration, with Nuxt runtime assembly outside it. Application authorization remains server-owned and derives identity from verified sessions; authentication methods belong to accounts, not provider fields on users.

Each domain owns configuration parsing. Google configuration stays in its integration; email delivery belongs to its provider module. Share only sanitized error formatting. Keep native provider composition and manually adapt derived-project UI; do not introduce registries, feature mirrors, service locators or speculative provider interfaces.

Preserve Better Auth's normal implicit account linking for trustworthy OAuth identities with its verification/trust safeguards when OAuth is connected. Do not restore the superseded policy disabling implicit linking.

## Consequences

Neon supplies persistence, not a second auth authority: Neon Auth and its application configuration/deployment layer are unused. A client session store or auth proxy requires a demonstrated requirement. Google composition and delivery are still planned; see [current authentication](../authentication.md) and the [roadmap](../roadmap/roadmap.md#phase-4).

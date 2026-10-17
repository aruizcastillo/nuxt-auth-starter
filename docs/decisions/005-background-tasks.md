# 005 — Register email tasks at the HTTP boundary

Status: Accepted

## Context

Authentication emails should not add provider latency to account-dependent responses. The starter needs a small execution boundary, initially verifiable on a persistent Node process, without a hosting-provider framework.

## Decision

Use Nitro 2's request `event.waitUntil` directly in the HTTP integration. Better Auth receives a generic sending callback; email and Resend remain independent of execution lifetime. Remove auth availability preflight, per-request sender preparation, preset selection and execution providers.

Initialize the reference sender once through Nitro's synchronous startup lifecycle. Development may omit both email values and report failed attempts without disabling credentials. Production requires valid email settings. Email/password requires verification through native Better Auth options.

Node is the initial acceptance target. Serverless adaptation is a later, localized HTTP-boundary change, based on deployed evidence; do not claim that method presence provides platform support.

## Consequences

Callbacks acknowledge registration, not provider acceptance or inbox delivery. Own events remain sanitized and observable; the service propagates transport errors while the registered task observes them. Native Better Auth endpoint differences remain intact.

No queue, worker, retries or persistence are introduced. Work may be interrupted by process termination, and timeout/network failure may leave acceptance unknown. Background execution does not guarantee identical account-existence timing.

[Authentication](../authentication.md) owns configuration, errors and verification policy. [Deployment](../deployment.md#background-tasks) owns runtime limitations and pending serverless validation.

# 005 — Isolate background execution by hosting provider

Status: Accepted

## Context

Verification and recovery responses must not expose email-provider latency as an account-existence signal. Background work needs an explicit hosting lifecycle; an unregistered promise may be interrupted after the response.

## Decision

Use isolated `waitUntil` providers: Nitro for local development and persistent Node servers, and Vercel for its serverless runtime. Keep Better Auth and Resend independent of hosting so lifecycle changes stay within their provider.

Select through `import.meta.preset`, fixed by Nitro during the build from explicit configuration or hosting detection. Support `nitro-dev`, `node-server` and `vercel`; other presets fail explicitly and report `background_tasks_unavailable`. Do not infer hosting compatibility dynamically from a method's presence.

## Consequences

HTTP acknowledgements do not wait for delivery. Accept that `waitUntil` does not guarantee delivery, and keep registration/delivery failures observable without sensitive data. Do not add queues, webhooks or automatic retries.

Synchronous `await` was rejected because provider latency would affect account-dependent responses. Persistent queues were rejected because durable storage, workers and recovery procedures exceed the current reliability requirement.

Review the Vercel provider for simplification or removal with Nuxt 5/Nitro 3. [Deployment](../deployment.md#background-tasks) owns API details, availability checks, execution limits and pending real-environment validation.

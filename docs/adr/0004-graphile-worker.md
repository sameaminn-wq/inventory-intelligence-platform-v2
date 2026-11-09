# ADR 0004: Graphile Worker for Durable Jobs

- **Status:** Accepted for foundation; deployment compatibility POC required.
- **Date:** 2026-11-07

## Context
Image analysis and exports are asynchronous and must survive process restarts, support bounded retries and avoid duplicate side effects.

## Decision
Use **Graphile Worker** backed by PostgreSQL initially, rather than introducing Redis solely for a queue. Run worker execution separately from the HTTP API process when deployed. Treat delivery as at-least-once and make every task idempotent.

## Consequences
- Fewer infrastructure components in the initial stack.
- Queue workload shares PostgreSQL capacity with application data.
- Worker needs a persistent PostgreSQL connection for its listening/notification behavior; verify connection mode and provider limits.
- Queue task payloads contain identifiers, not secrets, signed URLs or raw images.

## Validation gate
Verify Graphile Worker against the selected Supabase connection option. Use a direct or session-compatible connection as required; do not assume transaction pooling supports persistent LISTEN/NOTIFY. Test retries, backoff, duplicate delivery, graceful shutdown, tenant context, queue growth and dead-letter/operator replay.
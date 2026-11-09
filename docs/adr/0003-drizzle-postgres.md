# ADR 0003: Drizzle ORM with PostgreSQL

- **Status:** Accepted for foundation; schema POC required before migrations.
- **Date:** 2026-11-07

## Context
The schema relies on PostgreSQL transactions, composite tenant-aware foreign keys, constraints, indexes and transaction-local RLS context.

## Decision
Use **Drizzle ORM** as the TypeScript data-access/query layer with PostgreSQL. Use explicit SQL migrations for features where generated abstractions are insufficient. Do not weaken database constraints to accommodate ORM limitations.

## Consequences
- SQL remains visible and controllable for tenant integrity and performance.
- The team owns migration review and must understand generated SQL.
- ORM support does not itself prove correct RLS or connection-pool behavior.

## Validation gate
Create a disposable schema POC with composite foreign keys, unique constraints, transaction rollback, `SET LOCAL` tenant context, RLS policies and pooled-connection reuse. Review emitted SQL and migration rollback/recovery before production migrations.
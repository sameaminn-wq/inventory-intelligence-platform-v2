# Database Design — Initial Domain Model

**Status:** Logical proposal only. This is not a migration specification. Review constraints, indexes, deletion semantics, transaction boundaries and RLS policies before implementation.

## 1. Modeling principles

- PostgreSQL is the system of record.
- Tenant-owned data is scoped to a store. A user can belong to several stores.
- Use composite keys/foreign keys where needed to make cross-store relationships impossible at the database layer.
- Application authorization is mandatory; RLS is defense in depth, not a substitute.
- Store money as `numeric` with explicit currency; store quantities as `numeric` with documented units/precision.
- Store timestamps in UTC (`timestamptz`); render using the store timezone.
- Prefer restrictive deletion rules for financial, inventory and audit history. Define archival/anonymization separately.
- Every retryable write operation has a defined idempotency strategy.

## 2. Identity and tenancy

### Proposed entities

- `users(id, email_normalized, display_name, status, created_at, updated_at)`
- `auth_identities(id, user_id, provider, provider_subject, created_at)` (if external identity is selected)
- `auth_sessions(id, user_id, token_hash, expires_at, revoked_at, created_at, last_used_at)` (only if sessions are managed locally)
- `stores(id, name, timezone, currency, status, created_at, updated_at)`
- `memberships(id, store_id, user_id, status, created_at, updated_at)`
- `permissions(id, key, description)`
- `roles(id, store_id nullable, key, name, is_system, created_at)`
- `role_permissions(role_id, permission_id)`
- `membership_roles(membership_id, role_id)`
- `invitations(id, store_id, email_normalized, invited_by_membership_id, token_hash, expires_at, accepted_at, revoked_at, created_at)`

### Constraints and rules

- Unique normalized email according to the selected identity policy; unique `(provider, provider_subject)` for external identities.
- Unique `(store_id, user_id)` on memberships.
- Store-scoped role uniqueness: `(store_id, key)`. Global system roles need an explicit null-safe uniqueness strategy (for example separate global/store role tables or partial unique indexes).
- A membership may only receive a role global to the platform or belonging to the same store. Enforce with composite foreign keys or a normalized role-assignment design; do not rely only on application checks.
- Invitation tokens are random, stored only as hashes, single-use, expiring and revocable. Acceptance must verify normalized email and store scope.
- Platform administrators are modeled separately from store membership roles, with strong audit and restricted access.
- Do not store plaintext passwords, session tokens, invitation tokens or refresh tokens.

## 3. Catalog and per-store inventory

### Proposed entities

- `products(id, canonical_name, brand, attributes_json, created_at, updated_at)`
- `product_identifiers(id, product_id, identifier_type, identifier_value_normalized)`
- `store_products(id, store_id, product_id, local_name, base_unit_id, allows_fractional_quantity, quantity_precision, status, created_at, updated_at)`
- `units(id, key, display_name, dimension, precision)` — controlled unit definitions (for example piece, kg, litre, carton).
- `store_product_unit_conversions(id, store_id, store_product_id, from_unit_id, to_base_factor, effective_from, effective_to, created_at, created_by_membership_id)` — explicit conversion rules scoped to the store product.
- `stock_balances(id, store_id, store_product_id, quantity_base, version, updated_at)`
- `stock_movements(id, store_id, store_product_id, delta_base, entered_quantity, entered_unit_id, conversion_factor_snapshot, reason, source_type, source_id, actor_membership_id, idempotency_key, created_at)`

### Constraints and rules

- Unique `(store_id, product_id)` for a store's catalog link unless the business later supports multiple local listings for one canonical product.
- Unique `(store_id, store_product_id)` for stock balances; alternatively make `(store_id, store_product_id)` the primary key and avoid an unnecessary surrogate.
- Composite foreign keys must guarantee that `stock_balances.store_id` and `stock_movements.store_id` match the referenced `store_products.store_id`.
- Every store product has exactly one base unit. Conversion units must have a compatible dimension; each conversion factor expresses how many base units equal one entered unit.
- Stock balances and movement deltas are stored only in the base unit using PostgreSQL `NUMERIC` (initial proposal `NUMERIC(18,3)`, subject to validation); never use floating point for persisted quantities.
- Validate fractional-quantity policy and per-product precision server-side. Apply documented rounding rules; reject incompatible units and invalid precision.
- Snapshot the entered unit and conversion factor on each movement so later packaging changes cannot reinterpret historical movements. Conversion-rule changes are audited and effective-dated.
- Whether balances may go negative is an explicit business policy.
- A stock movement is append-only. Corrections are new compensating movements, not edits to history.
- Unique idempotency scope must be explicit, for example `(store_id, idempotency_key)`; reject reuse of a key with a materially different request.
- Update the balance and insert its movement in one database transaction. Protect concurrent writes with row-level locking or optimistic `version` checking.
- Product identifiers require normalization and an explicit uniqueness policy; a barcode may not be globally unique across every identifier type.

## 4. Capture, media and analysis

### Proposed entities

- `capture_sessions(id, store_id, created_by_membership_id, shelf_label, status, idempotency_key, created_at, submitted_at, completed_at)`
- `capture_images(id, store_id, capture_session_id, object_key, content_type, size_bytes, width, height, checksum, view_label, upload_status, created_at, uploaded_at)`
- `analysis_runs(id, store_id, capture_session_id, provider, model, model_version, config_version, status, attempt_count, started_at, completed_at, error_code, created_at)`
- `image_detections(id, store_id, analysis_run_id, capture_image_id, detection_key, product_id nullable, candidate_data_json, bounding_box_json, confidence, review_status, created_at)`
- `detection_matches(id, store_id, analysis_run_id, match_group_key, match_confidence, evidence_json, review_status, created_at)`
- `detection_match_members(id, store_id, detection_match_id, image_detection_id)`
- `inventory_reviews(id, store_id, capture_session_id, reviewed_by_membership_id, decision, notes, created_at)`
- `inventory_review_items(id, store_id, inventory_review_id, detection_match_id nullable, store_product_id nullable, approved_quantity, decision, notes)`

### Constraints and rules

- Each image belongs to exactly one capture session; enforce tenant consistency with composite foreign keys.
- Store object keys only. Enforce uniqueness of object keys and never make the bucket public.
- Use a unique client-generated idempotency key for session creation and a stable upload identifier per image.
- `analysis_runs` preserves every run, including model/provider/config versions. Re-analysis creates a new run; it does not overwrite old detections.
- Every detection retains its source image and analysis run. A detection is an observation in one image, not automatically a unique physical product.
- A match group is a hypothesis that detections across views represent the same physical instance. Enforce that a detection cannot be assigned to multiple active match groups within the same run unless an explicit versioned reconciliation model allows it.
- Never sum detections across views by default. The review decision records the accepted quantity and the evidence/run it came from.
- Use explicit state-transition rules for session, image, analysis and review statuses. Do not allow arbitrary client status updates.
- Confidence values must be constrained to the documented range (typically 0..1); bounding boxes must use a documented coordinate convention and valid bounds.
- Define whether re-analysis invalidates an earlier review or requires a new review. Preserve the historical decision either way.

## 5. Jobs, idempotency and transactional events

- `idempotency_records(id, store_id nullable, actor_user_id, operation, idempotency_key, request_hash, response_status, response_reference, created_at, expires_at)`
- `outbox_events(id, store_id nullable, aggregate_type, aggregate_id, event_type, payload_json, created_at, published_at, attempt_count)`
- Optional `job_records(id, store_id nullable, job_type, aggregate_id, status, attempt_count, available_at, started_at, completed_at, last_error_code)` if the chosen queue does not provide sufficient durable state.

Unique idempotency scope should include actor/tenant and operation where required. A repeated key with the same request returns the original outcome; the same key with a different request hash returns a conflict. Use an outbox or equivalent reliable transaction pattern when a database write must enqueue a job without a lost-message window. Keep secrets and signed URLs out of job payloads.

## 6. Governance, audit and exports

- `audit_events(id, store_id nullable, actor_user_id nullable, actor_membership_id nullable, action, resource_type, resource_id, request_id, metadata_json, created_at)`
- `export_jobs(id, store_id, requested_by_membership_id, format, status, object_key, created_at, expires_at, completed_at)`

Audit events and stock movements serve different purposes. Audit events record who did what and when; stock movements record quantity changes. Do not cascade-delete either history. Restrict access to audit metadata and avoid storing credentials, tokens, signed URLs or unnecessary personal data. Define retention and redaction policies.

## 7. Tenant isolation and RLS

- Tenant-owned tables should carry `store_id` where practical.
- Add composite unique keys and foreign keys such as `UNIQUE (store_id, id)` on parent tables and `FOREIGN KEY (store_id, parent_id) REFERENCES parent(store_id, id)` on children.
- Index tenant-scoped access paths, commonly `(store_id, created_at)`, `(store_id, status)`, and tenant-scoped business keys.
- Enable and force RLS on tenant tables only after policies and operational access paths are tested. Policies must cover SELECT, INSERT, UPDATE and DELETE as appropriate.
- Set tenant context transaction-locally on every request/worker transaction. Test connection-pool reuse to prove context cannot leak between tenants.
- Define a separate, tightly controlled platform-operator path; do not create a broad bypass available to ordinary application roles.
- Test cross-tenant reads, writes, joins, exports, object access and background jobs. Negative tests are release blockers.

## 8. Deletion, retention and indexing

- Define soft-delete, archive, anonymization and hard-delete semantics per entity.
- Do not cascade-delete stock ledger or audit history. Use restrictive foreign keys or tombstones where appropriate.
- Define retention for original images, derived images, raw AI outputs, exports, job payloads and audit metadata.
- Add indexes from observed query patterns, including composite tenant filters; avoid indexing every column without evidence.
- Consider partial indexes for active memberships, pending jobs and non-revoked invitations.
- Use database migrations with reviewed forward/rollback or forward-recovery plans. Test on representative data and verify constraints against existing records before adding them.

## 9. Decisions required before migrations

The following are intentionally not finalized:

1. Identity provider versus locally managed authentication/session tables.
2. Global product catalog governance and duplicate-product resolution.
3. Whether a store can maintain multiple listings/units for one canonical product.
4. Negative-stock policy, validated quantity precision/rounding and conversion-rule versioning (base-unit model is selected).
5. Exact review granularity and whether approved quantities represent distinct physical units or package counts.
6. Queue implementation and whether job state is owned by the queue or application database.
7. Data retention, store closure and user-erasure requirements.
8. Drizzle POC for composite foreign keys, partial indexes, RLS and transaction-local tenant context.

Create ADRs for these decisions and a small database proof of concept before writing production migrations.


## 10. Accepted foundation decisions

- Authentication: Supabase Auth; application memberships/roles/permissions remain in this schema. See [ADR 0002](adr/0002-auth-supabase.md).
- Data access: Drizzle ORM with PostgreSQL, pending schema POC. See [ADR 0003](adr/0003-drizzle-postgres.md).
- Durable jobs: Graphile Worker; verify a compatible persistent connection mode and idempotent tasks. See [ADR 0004](adr/0004-graphile-worker.md).
- Object storage: private Cloudflare R2 bucket; database stores keys/metadata only. See [ADR 0005](adr/0005-cloudflare-r2.md).
- Development environment: Supabase Free, Render Free, Cloudflare Pages static export and R2; this is not production approval and has no production backup/reliability guarantee. See [ADR 0007](adr/0007-development-hosting.md).
- AI: Gemini provider adapter; no real customer images on free-tier API absent reviewed contractual permission. See [ADR 0006](adr/0006-gemini-ai.md).
- Quantity model: base unit + explicit store-product conversion factors; stock ledger and balances persist base-unit quantities. See [ADR 0008](adr/0008-inventory-units.md).

These decisions do not authorize production migrations. Complete the listed POCs and review unresolved business rules before implementation.

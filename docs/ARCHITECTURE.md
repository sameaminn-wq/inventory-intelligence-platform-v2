# Architecture Blueprint

**Status:** Proposed foundation; implementation is blocked until the decisions and proof-of-concept gates below are reviewed.

## 1. Product scope and invariants

A multi-store inventory intelligence SaaS. Staff capture one or more views of the same shelf in a single capture session. The platform analyzes each image, reconciles detections across views, and presents reviewable inventory suggestions. Only an authorized human-approved decision may create an inventory adjustment.

Non-negotiable invariants:

- A user may belong to multiple stores; every request is authorized against the selected store membership.
- A client-provided `store_id` is a selector, never proof of authorization.
- Web and Android use the same versioned backend API and never connect directly to PostgreSQL, object storage credentials, or AI vendors.
- Multiple views are evidence about one shelf, not independent stock counts. Never sum view-level detections blindly.
- Every accepted stock change creates an immutable stock-movement record.
- Retries must not duplicate captures, uploads, jobs, or stock movements.
- Uncertain recognition remains reviewable; the system must not silently convert low-confidence AI output into stock.

## 2. System shape

Start with a **modular monolith** and independently deployable worker process(es), not microservices.

- **Web:** Next.js, React, TypeScript.
- **Android:** Ionic + Capacitor, built as a real Android application. It consumes the same REST API as the web client.
- **Backend API:** Dedicated NestJS + TypeScript modular monolith, separate from Next.js. REST under `/api/v1`; web and Android consume the same API.
- **API:** REST under `/api/v1`, documented with OpenAPI. Generate or contract-test client types from the API schema; do not maintain divergent hand-written contracts.
- **Database:** PostgreSQL.
- **Data access:** Drizzle ORM + PostgreSQL, subject to a POC for composite foreign keys, transactions, migrations and RLS.
- **Validation:** Shared runtime schemas (for example Zod) at every untrusted boundary. Server validation is authoritative.
- **Media:** Private Cloudflare R2 bucket (S3-compatible) for the initial environment. The database stores object keys and verified metadata, never public image URLs or long-lived credentials.
- **Jobs:** Graphile Worker on PostgreSQL, with bounded retries, backoff, dead-letter/operator replay and idempotent handlers. Validate a persistent LISTEN/NOTIFY-compatible connection; do not assume transaction pooling works.
- **AI:** Gemini behind a provider adapter with explicit model/version/configuration metadata. Use free-tier API only with synthetic/non-sensitive images; review paid-tier data terms before real customer images.
- **Observability:** Structured logs, metrics, traces, error reporting, audit events, backup monitoring, and restore drills.

Keep domain modules independent of framework-specific request/response types. Define module interfaces before considering service extraction.

## 3. Backend modules and ownership

- **Identity & Access:** users, authentication sessions, store memberships, roles, permissions, invitations.
- **Stores:** store profile, timezone, currency, settings, membership administration.
- **Catalog:** canonical product identity, barcodes and identifiers.
- **Store Catalog:** store-specific product listing, local names, units and status.
- **Inventory:** stock balances, adjustments and immutable stock movements.
- **Capture:** capture sessions, shelf/location labels, image metadata and upload lifecycle.
- **Analysis:** per-image detections, model runs, cross-view match hypotheses, review workflow.
- **Exports:** authorized report generation and expiring downloads.
- **Audit:** append-only security and business event history.
- **Billing:** later module; do not couple core inventory logic to a payment vendor.

Each module owns its data access and application rules. Cross-module operations use explicit application interfaces and database transactions where atomicity is required.

## 4. Authentication, tenant context and authorization

Use Supabase Auth for identity/session lifecycle initially. NestJS verifies access tokens and independently resolves active store membership and fine-grained permissions from application tables. Supabase Auth does not replace authorization or tenant isolation. Test revocation, refresh, web cookies and Android secure token storage. Web cookies must be Secure, HttpOnly and appropriately SameSite; Android token storage must use platform-secure storage. Never store secrets in local storage or logs.

For every tenant-scoped request:

1. Authenticate the user.
2. Resolve the requested store from the route/context.
3. Load an active membership for that user and store.
4. Check the required permission for the action and resource.
5. Establish tenant context within the database transaction.
6. Execute the operation with tenant-scoped queries and constraints.

A user may have memberships in multiple stores. Store roles are scoped to a store; platform administration is a separate privileged domain and must not be represented as a store role. Prefer explicit permission keys over role-name conditionals.

Use PostgreSQL RLS as defense in depth after application authorization is implemented. Set tenant context transaction-locally (for example with `SET LOCAL`) and verify behavior with the actual connection pool. Never rely on a session-level setting that can leak between pooled requests. Background jobs must establish tenant context from a trusted persisted job record, not user-supplied payload fields alone.

## 5. Image capture and analysis workflow

1. Client creates a capture session for one store and shelf/location using an idempotency key.
2. Client requests upload intents for each view. The API authorizes the session and returns short-lived, object-specific upload instructions.
3. Client uploads each image directly to private object storage; it then confirms completion with the API.
4. Server verifies object ownership, expected key, actual content signature, size and image dimensions before marking the image accepted. Do not trust filename or client MIME type.
5. Once the session is submitted, the server creates durable analysis jobs.
6. Each image is analyzed independently. Persist raw provider response securely when justified, plus normalized detections, model/provider/version, configuration, timestamps and source-image provenance.
7. Reconcile detections across views using visual and spatial evidence. Preserve per-image detections; a match group is a hypothesis that multiple detections refer to the same physical item.
8. Show matched, unmatched and ambiguous results with confidence and evidence for human review.
9. Only an authorized approval can create or adjust stock. The approval and resulting stock movement must be atomic or recoverable through a documented transaction/outbox design.
10. Record audit events for submission, analysis, review and inventory changes.

Never merge solely because names or brands match. Never add quantities across views unless the algorithm has established distinct physical instances under a tested counting model. Low-confidence or conflicting results require review.

## 6. Upload security and media lifecycle

- Use private buckets and deny public access by default.
- Issue short-lived, narrowly scoped upload/download URLs for one object and operation.
- Generate object keys server-side; do not accept arbitrary storage paths from clients.
- Enforce per-file and per-session byte, pixel-dimension, count and rate limits.
- Verify file signatures; allow-list formats; reject malformed or decompression-bomb inputs.
- Strip or control EXIF metadata where appropriate; do not expose internal object keys as authorization.
- Scan or sandbox media processing where feasible; process images in resource-limited workers.
- Keep original and derived assets under explicit retention/deletion rules. Deletion must respect legal, audit and recovery requirements.
- Never log signed URLs, credentials, raw secrets or unnecessary image contents.

Exact size/count limits and storage provider are deployment decisions and must be set before production.

## 7. Jobs, retries and offline-tolerant clients

Use durable jobs with states such as queued, running, succeeded, retryable-failed and terminal-failed. Define bounded attempts, exponential backoff with jitter, timeouts, dead-letter inspection and operator replay. Job handlers must be idempotent.

Android is online-first but must not lose captured work during transient connectivity loss. Persist a local pending-capture queue and image files safely until the server confirms receipt. Retry with the same idempotency keys; show upload/analysis state; allow safe cancellation before submission. Do not claim a capture is stored remotely until the API confirms it.

Use idempotency keys for capture creation, upload completion, analysis submission, review decisions and stock adjustments. Enforce uniqueness in the database and define how a repeated key with a different payload is rejected.

## 8. API and error contract

- Version routes under `/api/v1`; document request/response schemas and authentication requirements in OpenAPI.
- Use consistent error envelopes with stable machine-readable codes, safe human messages and correlation/request IDs.
- Validate authorization and input on the server for every request.
- Use pagination for collections and explicit filtering/sorting allow-lists.
- Apply rate limits by user, store, IP and sensitive operation as appropriate.
- Define upload, analysis and export state transitions explicitly.
- Do not expose provider errors, SQL errors, stack traces, internal object keys or secrets to clients.
- Maintain backward compatibility or an explicit versioning/deprecation policy for mobile clients.

## 9. Inventory consistency and audit

Stock balance is a current projection; stock movements are the auditable ledger. A quantity change must update the balance and insert its movement in one transaction. Protect against concurrent updates using row locks or optimistic version checks. Define whether negative stock is permitted as a business policy; do not assume either behavior silently.

Audit events and stock movements are not interchangeable. Stock history must not be edited to rewrite prior events. Corrections are compensating movements. Audit records must identify actor, store, action, resource, timestamp and relevant before/after context without storing secrets.

## 10. Reliability, privacy and operations

Define environment separation, secret management, least-privilege service credentials, TLS, encryption at rest, backup retention, tested restore procedures, monitoring and incident response before production. Establish data retention and account/store deletion workflows. Use UTC timestamps and render according to store timezone.

Set measurable operational targets for API availability/latency, queue delay, analysis completion, upload failure rate and recovery objectives before launch. Do not claim production readiness until tenant-isolation, authorization, restore, real-device and end-to-end analysis tests pass.

## 11. Architecture decision records and proof-of-concept gates

Accepted foundation ADRs (still subject to the validation gates in each record):

- NestJS backend: [ADR 0001](adr/0001-backend-nestjs.md).
- Supabase Auth: [ADR 0002](adr/0002-auth-supabase.md).
- Drizzle + PostgreSQL: [ADR 0003](adr/0003-drizzle-postgres.md).
- Graphile Worker: [ADR 0004](adr/0004-graphile-worker.md).
- Cloudflare R2: [ADR 0005](adr/0005-cloudflare-r2.md).
- Gemini provider adapter: [ADR 0006](adr/0006-gemini-ai.md).
- Temporary free-tier development hosting: [ADR 0007](adr/0007-development-hosting.md).
- Base units and conversions: [ADR 0008](adr/0008-inventory-units.md).

Each proof of concept must be small, reproducible and checked into the repository with a decision record. Do not create production migrations or begin broad legacy-code migration until these gates and the database model are approved.

## 12. Explicitly out of scope for the foundation

Do not introduce microservices, Kubernetes, event streaming infrastructure, complex billing, real-time market pricing, or autonomous inventory updates in the first foundation phase unless validated product requirements justify them. Excel export can precede PDF; Arabic PDF output requires a separate RTL/font/shaping and visual-regression gate.


## 13. Accepted foundation stack and hosting boundary

The selected low-cost stack is **development/demo only**: Cloudflare Pages with Next.js static export for the web UI; Render Free for early NestJS API/worker experiments; Supabase Free for PostgreSQL and Supabase Auth; Cloudflare R2 for private image objects; Gemini free tier only with synthetic/non-sensitive test images. The static frontend calls NestJS and must not depend on Next.js SSR, route handlers, server actions or server-side secrets. Render sleep/cold-start and ephemeral filesystem, Supabase Free pause/capacity/backup limitations, and worker interruption make this unsuitable for production. Do not onboard real customer data until security, privacy, backup, reliability and paid production hosting decisions are approved. See [ADR 0007](adr/0007-development-hosting.md).

The selected inventory quantity model is one base unit per store product, explicit product-specific conversion factors for alternate entry units, and base-unit values in stock balances and stock movements. Initial numeric precision proposal is `NUMERIC(18,3)`, pending domain validation; floating-point arithmetic is prohibited for persisted stock quantities. See [ADR 0008](adr/0008-inventory-units.md).

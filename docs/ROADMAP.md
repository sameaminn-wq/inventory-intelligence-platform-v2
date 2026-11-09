# Delivery Roadmap

## Phase 0 — Repository and decisions
- Establish private repository, docs, ownership, and engineering workflow.
- Confirm runtime/toolchain, deployment assumptions, and architecture decision records.
- Keep legacy repository untouched.

## Phase 1 — Foundation
- Add CI, formatting, lint, type-check, and test skeleton.
- Establish monorepo/workspace layout only after validating toolchain.
- Implement identity, store membership, permission checks, and tenant-scoped database foundation.
- Add migration and seed strategy.
- Prove tenant isolation with automated tests before business features.

## Phase 2 — Inventory core
- Catalog and store-product association.
- Stock balances and append-only stock movements.
- Manual inventory adjustments with audit trail and idempotency.
- Store-scoped inventory views and basic export.

## Phase 3 — Capture and analysis
- Capture sessions and private image upload.
- Durable job queue and provider abstraction.
- Per-image detection persistence.
- Cross-view reconciliation and review workflow.
- Human-approved inventory updates.

## Phase 4 — Web client
- Store switching and role-aware navigation.
- Inventory management and capture/review screens.
- Operational reporting and Excel export.
- Arabic UX and accessibility review.

## Phase 5 — Android client
- Begin only after API contracts and capture workflow stabilize.
- Ionic + Capacitor native camera integration.
- Online-first upload with local pending queue and safe retries.
- Device permission, lifecycle, and real-device regression tests.

## Phase 6 — Hardening and commercial readiness
- Monitoring, alerting, backups, restore drills, retention.
- Security review and tenant-isolation audit.
- AI quality evaluation and cost controls.
- Billing/subscriptions only after customer and pricing validation.

## Legacy migration policy
Treat the former repository and its branches as reference material. Inventory each candidate feature, identify its source branch/commit, review API/data contracts, migrate one bounded unit at a time, and add tests. Do not merge branches wholesale or copy the incomplete mobile build. PR #7 may inform web/API hardening; branch 55 may inform multi-image product behavior, subject to reconciliation and tests.

## Exit criteria
Each phase ends with demonstrable behavior, automated tests, documented decisions, and an explicit acceptance review. No phase advances solely because files compile.

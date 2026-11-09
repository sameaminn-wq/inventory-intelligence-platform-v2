# Quality and Release Test Plan

## Continuous integration gates
- Dependency install from lockfile.
- Formatting and lint.
- Static type checking.
- Unit tests.
- Integration tests against PostgreSQL.
- API contract/OpenAPI validation.
- Production build.
- Dependency and secret scanning.
- Migration validation.

## Domain tests
- Membership and permission matrix for every role.
- Store-scoped product and inventory operations.
- Stock ledger invariants and idempotent adjustments.
- Capture-session state transitions and retry behavior.
- Multi-image matching without cross-view quantity double counting.
- Human review and audit trail.
- Export authorization and expiration.

## Security tests
- Cross-tenant IDOR attempts across all resource types.
- Tenant context leakage through pooled DB connections.
- Unauthorized background job execution.
- Upload MIME spoofing, oversized payloads, malformed images, and pixel bombs.
- Rate-limit and abuse controls for AI processing.
- Signed URL expiry and access boundaries.
- Secrets and sensitive values absent from logs.

## Client/device tests
- Real Android devices across supported OS versions.
- Camera permission denial and recovery.
- Multiple photos per capture session.
- App background/foreground during upload.
- Network loss, retry, duplicate submission, and app restart.
- Clear upload/analysis/review progress and actionable error states.

## AI evaluation
Use a versioned labeled dataset. Report detection precision/recall, product identification accuracy, duplicate-match precision/recall, quantity error, confidence calibration, and human correction rate. Test low light, glare, occlusion, similar packaging, different angles, and partial shelf coverage.

## Release gates
Do not claim production-ready until tenant isolation, auth, database migrations/backups, real-device capture, multi-image reconciliation, monitoring, and recovery tests pass. Record known limitations and test evidence for each release.

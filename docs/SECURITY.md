# Security and Privacy Baseline

## Threat model priorities
- Cross-tenant data exposure.
- Broken object-level authorization.
- Account takeover and privilege escalation.
- Malicious or oversized image uploads.
- AI endpoint abuse and cost exhaustion.
- Private image/export URL leakage.
- Duplicate or unauthorized stock adjustments.
- Sensitive data exposure through logs, analytics, or backups.

## Required controls
- Secure authentication, session lifecycle, and account recovery.
- Membership and permission checks on every tenant-owned resource and background job.
- Derive tenant context from authenticated membership; validate any requested store selection.
- PostgreSQL RLS as defense in depth, not as a replacement for application authorization.
- Private object storage; short-lived signed URLs; verify object ownership before issuing them.
- Allowlist supported image formats; inspect actual content; enforce byte, pixel, and dimension limits; defend against decompression bombs.
- Rate-limit login, upload, analysis, export, and invitation endpoints.
- Validate inputs; parameterize queries; encode output; apply CSRF protections where cookie auth is used.
- Store secrets in a managed secret store/environment, never source control.
- Encrypt transport; use provider/database encryption at rest where available.
- Redact tokens, signed URLs, image contents, and personal data from logs.
- Audit role changes, invitations, exports, inventory adjustments, and security-sensitive actions.
- Define retention, deletion, backup, and incident-response policies.

## Tenant isolation tests
Create at least two stores and users with overlapping and non-overlapping memberships. Verify that users cannot read, mutate, enumerate, export, or download another store's data by changing IDs, URLs, payloads, filters, or job identifiers. Test background jobs and storage URL issuance as well as HTTP routes.

## Release blockers
Any confirmed cross-tenant access, missing authorization on sensitive resources, leaked secret, unbounded expensive endpoint, or unsafe upload path blocks release.

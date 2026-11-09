# ADR 0005: Cloudflare R2 for Private Image Objects

- **Status:** Accepted for foundation; upload/security POC required.
- **Date:** 2026-11-07

## Context
Shelf images are customer data, can be large, and should not be stored on ephemeral application filesystems or public buckets.

## Decision
Use **Cloudflare R2** as the initial S3-compatible object store with a private bucket. NestJS issues short-lived, object-specific signed upload/download URLs; object keys are generated server-side. PostgreSQL stores object keys and verified metadata only.

## Consequences
- Separates image storage from API compute and database capacity.
- Requires careful CORS, signed URL scope/expiry, content verification, lifecycle and deletion configuration.
- Free allowances and pricing can change; production cost and data residency/privacy requirements must be rechecked.

## Validation gate
Prove upload and download from web and Android; verify object ownership, checksum, content signature, size and dimensions server-side; test expired/replayed URLs, unauthorized cross-store access, deletion and retention. Never treat an uploaded object as accepted until API verification succeeds.
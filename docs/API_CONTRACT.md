# API Contract — Initial Direction

Base path: /api/v1. All endpoints require TLS in deployed environments. Exact schemas and status codes must be captured in OpenAPI before clients are built.

## Authentication and tenant context
- Authenticate the user with a secure session/token strategy.
- Expose the user's accessible stores through a membership-aware endpoint.
- A requested store context must be validated against active membership and permission.
- Never authorize from a raw store_id supplied by the client.

## Initial resources
- GET /me
- GET /stores
- POST /stores (authorized onboarding flow)
- GET /stores/{storeId}/members
- POST /stores/{storeId}/invitations
- GET /stores/{storeId}/products
- GET /stores/{storeId}/inventory
- POST /stores/{storeId}/capture-sessions
- POST /stores/{storeId}/capture-sessions/{sessionId}/images (upload-init or bounded multipart flow)
- GET /stores/{storeId}/capture-sessions/{sessionId}
- POST /stores/{storeId}/capture-sessions/{sessionId}/analyze
- POST /stores/{storeId}/capture-sessions/{sessionId}/review
- GET /stores/{storeId}/exports
- POST /stores/{storeId}/exports

## Response conventions
Use a consistent envelope for success and errors. Include a request_id for support and tracing. Do not expose stack traces, provider secrets, storage keys, or internal exception details. Validate all path, query, and body inputs. Paginate list endpoints and cap page sizes.

## Capture lifecycle
Suggested states: draft → uploading → queued → processing → review_required → approved/rejected → completed; failures should be explicit and retryable where safe. State transitions must be enforced server-side.

## Upload and retry behavior
Prefer short-lived pre-signed upload URLs for private object storage after the server authorizes the session and validates declared metadata. Verify actual object size/type after upload. Use idempotency keys for create/analyze/review operations. A retry must not duplicate a stock movement or job.

## API compatibility
- Version breaking changes under a new API version or documented migration.
- Generate and publish OpenAPI from the same source as runtime validation where practical.
- Keep transport DTOs separate from internal domain entities.
- Return 401 for unauthenticated requests, 403 for authenticated but unauthorized access, 404 where resource existence should not be disclosed, 409 for state/idempotency conflicts, and 422 for semantically invalid input (final policy to be standardized).

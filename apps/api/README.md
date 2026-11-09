# Inventory Core API

The Core API is the trusted application boundary. The AI integration is internal-only and does not write to inventory data.

## Runtime configuration

- `PORT` — HTTP port (default: `3001`).
- `WEB_ORIGIN` — comma-separated allowed browser origins. Set explicit production origins; do not rely on the development default.
- `AI_SERVICE_URL` — private base URL of the independently deployed AI service.
- `AI_SERVICE_TOKEN` — shared secret sent only from this API to the AI service as `x-internal-service-token`. It must match the AI service runtime value.
- `CORE_INTERNAL_API_TOKEN` — separate secret required by the internal Core API analysis endpoint as `x-core-internal-token`.

Never commit real secrets or expose them through `NEXT_PUBLIC_*` variables. Use different values for the Core API token and AI service token. Production AI service URLs must use HTTPS.

## Internal endpoint

`POST /api/v1/internal/shelf-analyses`

Requires `x-core-internal-token`. The API forwards the request to the AI service using its own server-side `AI_SERVICE_TOKEN`. It maps upstream failures to safe gateway errors and never returns upstream response bodies.

This endpoint is an integration seam for a future authenticated application workflow. It is not a public browser endpoint and does not yet provide store membership, capture-session ownership, database persistence, upload authorization, or inventory write operations. Do not expose it to end users until those controls are implemented.

## Build and tests

From the repository root:

```bash
npm install
npm run build:api
npm run test --workspace @inventory/api
```

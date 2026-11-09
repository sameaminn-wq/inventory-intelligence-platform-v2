# Inventory AI Service

An independently deployable NestJS service for multimodal shelf analysis. Gemini is the first provider behind the provider-neutral gateway.

## Runtime configuration

Set these variables in the AI service runtime only:

- `PORT` — HTTP port (default: `3002`).
- `AI_SERVICE_TOKEN` — required shared secret for internal analysis requests.
- `GEMINI_API_KEY` — Gemini API key; never expose it to web or Android clients.
- `GEMINI_MODEL` — exact model ID selected by the operator; no model ID is hard-coded.

Do not commit real values. Use synthetic or permission-cleared test images until the provider's current data terms and customer consent have been reviewed.

## Endpoints

- `GET /health` — process health only.
- `POST /internal/v1/analyses` — internal analysis operation. Requires `x-internal-service-token` and a JSON body matching `AnalyzeShelfInput`.

The request currently carries image bytes as base64 for bounded integration testing. Production integration should replace this with authorized, short-lived private object references or a trusted storage adapter before customer use.

## Limits and behavior

- Maximum 8 images per request.
- Maximum combined decoded image payload: 20 MiB.
- Supported input MIME types: JPEG, PNG and WebP.
- The provider receives all views as one logical shelf-analysis task.
- Provider output is validated before returning.
- This service does not persist analysis runs, access the inventory database, or modify stock.
- The Core API must authorize the store/session and approve any inventory changes.

## Build

From the repository root:

```bash
npm install
npm run build:ai
```

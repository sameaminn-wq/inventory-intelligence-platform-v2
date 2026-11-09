# AI Provider Contract — Visual Inventory Analysis

**Status:** Architecture contract for local prototyping. Not an implemented API or production integration.

## Purpose

Provide one stable Inventory Intelligence contract for multimodal providers while preserving the fact that model capabilities and limits differ. The first adapter is Gemini; future adapters may include OpenAI, Anthropic/Claude and other providers after validation.

## Boundary

- Capture, tenant authorization, image ownership, review and inventory rules belong to the Core API.
- The AI Provider Gateway selects an allowed provider/model and translates the canonical request into vendor-specific calls.
- Provider adapters do not access the inventory database and cannot write stock.
- Provider credentials remain server-side.
- The gateway returns a proposal; the review workflow decides whether it becomes inventory data.

## Logical operation

`analyzeCaptureSession(request)`

The request represents one capture session for one shelf/location and includes:
- immutable analysis/capture identifiers and correlation/idempotency keys;
- ordered image references owned by the authorized session (not arbitrary public URLs);
- verified media metadata (MIME type, dimensions, byte size, checksum);
- optional shelf context and store-catalog hints, scoped and authorized by Core API;
- requested schema/prompt version and server-selected provider policy.

The gateway must verify image references are authorized, private and available to the worker. Do not accept provider name, model ID, storage URL or secret directly from an untrusted client.

## Canonical result concepts

The versioned result should contain:
- analysis/run identity, provider, model, adapter, prompt and schema versions;
- per-image observations with stable IDs and source-image references;
- candidate product identity and distinguishing attributes, with identity confidence;
- visible physical instance/region and normalized bounding box when supported;
- quantity estimate only when the evidence supports it, with a clear estimate/unknown distinction;
- cross-view match groups linking observations believed to represent the same physical instance, with separate match confidence and evidence;
- unmatched, ambiguous, occluded and conflicting observations;
- review-required reasons, warnings and non-sensitive processing metadata;
- usage/latency/cost metadata when the provider exposes it.

The schema must distinguish **zero**, **unknown**, **not visible**, and **not supported**. Missing information must not be converted into zero or an invented value. Confidence is not a guarantee of correctness and must be calibrated against labeled data.

## Multi-view reconciliation

1. Validate that every image belongs to the same capture session and shelf/location.
2. Preserve each image as an independent source of evidence.
3. Analyze views using a provider-supported multi-image call or bounded staged calls.
4. Reconcile detections across views using image evidence, spatial context, packaging and identifiers where available.
5. Preserve all source observations; matching creates a hypothesis, not deletion of duplicate records.
6. Never sum per-view counts by default. A physical instance visible in multiple views must not become multiple stock units.
7. Keep unresolved matches and occlusions for human review.
8. Persist every run immutably. Re-analysis creates a new run and must not erase prior results or decisions.

For large sessions, the implementation may split work into bounded image batches, then run a reconciliation step over normalized observations. Batch strategy and model limits are adapter-specific and must be tested.

## Provider adapter interface (conceptual)

- `getCapabilities()`: declare supported inputs, limits and structured-output features.
- `analyzeImages(input)`: execute vendor-specific visual analysis.
- `normalizeResponse(raw)`: map vendor output to the canonical result.
- `classifyError(error)`: map vendor failures to safe retry/fallback categories.

The exact TypeScript interfaces and JSON Schema/Zod definitions are implementation work and must be added with contract tests. Do not treat this document as code.

## Routing policy

Initial policy:
- Gemini is the configured first provider.
- Model IDs are configuration, not hard-coded domain assumptions.
- Fallback is disabled until an alternate adapter has passed the same contract and benchmark gates.
- Optional comparison/ensemble is off by default and must require explicit tenant/admin policy, cost limits and data-processing approval.
- Do not automatically send an image to another vendor after a provider failure if that changes the applicable data terms or region.

## Reliability and safety

- Enforce upload/image count/byte/pixel limits before provider calls.
- Apply timeouts, concurrency limits, per-tenant quotas, bounded retries and idempotency.
- Validate provider output against the canonical schema and business invariants; reject or mark malformed output for review.
- Treat model text and structured output as untrusted data, never executable instructions.
- Redact secrets, signed URLs and raw image data from logs.
- Track provider/model/prompt/schema versions so results are reproducible and regressions can be detected.

## Required tests

- Adapter contract tests with recorded synthetic fixtures.
- Invalid/malformed structured output and schema rejection.
- Unsupported image type, oversized image and image-count limits.
- Multi-view duplicate matching and no-blind-summing regression cases.
- Provider timeout, rate limit, unavailable model and safe retry/fallback behavior.
- Idempotent repeated submission and immutable re-analysis.
- Tenant isolation and unauthorized image-reference rejection.
- Benchmark evaluation of accuracy, calibration, correction rate, latency and cost.

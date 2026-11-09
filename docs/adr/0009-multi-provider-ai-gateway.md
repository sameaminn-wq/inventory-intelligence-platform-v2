# ADR 0009: Provider-Neutral AI Gateway for Visual Inventory Analysis

- **Status:** Accepted for architecture and local prototyping; provider/model activation remains gated by capability checks, benchmark, cost and data terms.
- **Date:** 2026-11-09
- **Supersedes:** The single-provider direction in ADR 0006. Gemini remains the first planned adapter.

## Context

Inventory Intelligence must analyze one or more photographs of the same physical shelf, taken from different angles. Gemini is the initial provider, but the product must be able to evaluate and use other multimodal AI providers (including OpenAI and Anthropic) without rewriting capture, analysis, review or inventory modules.

Provider capabilities, model identifiers, image limits, structured-output support, pricing, latency and data terms vary and change over time. A provider-neutral interface must not pretend that all models have identical capabilities.

## Decision

1. Introduce an internal **AI Provider Gateway** boundary. Domain modules call a stable application interface; they do not import vendor SDKs or vendor-specific request/response types.
2. Implement Gemini as the first provider adapter. Design the adapter contract so OpenAI, Anthropic/Claude and additional eligible providers can be added independently after verification.
3. Keep provider credentials server-side in environment/secret management. Never expose provider keys to web or Android clients, source control, logs or job payloads.
4. Define a canonical, versioned analysis request and result schema owned by Inventory Intelligence. Validate every provider response against the schema and domain invariants before persistence.
5. Make provider/model selection an explicit server-side policy: configured primary provider/model, capability checks, and optional fallback only for eligible transient failures. Do not silently switch providers where it would violate tenant configuration, data-processing terms, region or consent.
6. Treat cross-provider comparison/ensemble as an opt-in, separately budgeted evaluation feature. Do not send customer images to multiple vendors by default.
7. Record provider, exact model identifier, adapter version, prompt version, schema version, configuration version, timestamps, token/usage metadata when available, latency, cost estimate and outcome for each run.
8. Keep image analysis separate from inventory writes. AI results are proposals; authorized human review and Core API business rules govern stock changes.

## Multi-view shelf analysis

A capture session represents one physical shelf/location and may contain several views. The analysis interface accepts the session's image set as one logical analysis task. The adapter may use one multi-image request or a bounded staged strategy according to provider capabilities and image limits.

The analysis workflow must preserve per-image observations and provenance, then reconcile cross-view detections into match hypotheses. It must not add view-level counts blindly. Match confidence and product-identity confidence are distinct. Ambiguous, occluded, conflicting or unmatched observations remain visible for review. The provider is not assumed to guarantee exact counts or identify fully hidden products.

## Provider adapter contract

Each adapter must declare capabilities and limits, including supported image MIME types, maximum images/bytes where known, structured-output mode, supported analysis features, timeout behavior and usage metadata availability. The gateway owns:
- provider-neutral request validation and policy selection;
- bounded retries and safe fallback classification;
- canonical result validation and normalization;
- correlation IDs, usage/cost recording and redacted observability.

Adapters own vendor SDK calls, vendor request formatting, response parsing and vendor error translation. Vendor-specific fields may be retained as restricted diagnostic metadata only when necessary; they must not leak into the domain contract.

## Privacy, security and cost gates

- Use synthetic, public or otherwise permission-cleared images for local/provider experiments.
- Before sending real customer/store images to any provider, review current contractual data terms, retention/training settings, region, subprocessors, consent and customer commitments for that specific plan and endpoint.
- Tenant/provider configuration must not allow a client to inject arbitrary provider names, model IDs, URLs or credentials.
- Apply per-store/user quotas, request/image limits, timeouts, concurrency controls and budget alerts before enabling paid analysis.
- Do not log raw images, signed URLs, API keys or unnecessary personal data.
- Provider outages must not cause duplicate analysis records or stock writes. Use idempotency keys and immutable analysis runs.

## Validation gates

Before production use:
1. Create a labeled, permission-cleared shelf-image benchmark covering angles, overlap, occlusion, lighting, packaging variants and product categories.
2. Compare providers on product identification, visible-instance detection, cross-view duplicate matching, quantity error, calibration, human correction rate, latency and total cost.
3. Verify structured output, malformed-output handling, rate limits, timeouts, retry behavior and image-size limits for each adapter.
4. Verify privacy/data terms and operational controls for each enabled provider.
5. Keep human approval mandatory until evidence supports a separately approved workflow change.

## Consequences

- Adding a provider should require a new adapter, capability declaration, tests and benchmark evidence—not changes to inventory domain logic.
- Provider-neutrality adds an abstraction and contract-testing burden; keep it small and do not build speculative routing/ensemble complexity in the first release.
- Gemini is the first implementation target, not a permanent hard dependency or a claim that it is the most accurate/cheapest provider.
- No paid provider, cloud resource, API key or customer-image processing is authorized by this ADR.

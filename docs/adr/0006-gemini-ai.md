# ADR 0006: Gemini Provider Adapter

- **Status:** Accepted for initial experimentation; model selection gated by benchmark and data terms.
- **Date:** 2026-11-07

## Context
The product needs image understanding and structured detection output, but model quality, latency, price and data handling must be measured against real product workflows.

## Decision
Use **Google Gemini** as the first AI provider behind a provider-neutral adapter. Keep model ID, generation settings, prompt/schema version and safety configuration in server-side configuration. Normalize and validate structured output before persisting detections. Do not couple domain logic to a specific Gemini model name.

## Data handling rule
Use only synthetic, public or otherwise non-sensitive test images with any free-tier API usage. Do not send real customer/store images through a free tier unless current contractual terms explicitly permit the intended data handling. Before production customer images, review the current paid-tier terms, privacy commitments, region/retention controls and applicable customer consent. Do not assume plan terms remain unchanged.

## Validation gate
Benchmark candidate Flash-class models on a representative, permission-cleared image set. Measure SKU/product identification, count accuracy, cross-view duplicate handling, confidence calibration, latency and cost. Human review remains mandatory; AI output never directly changes stock.
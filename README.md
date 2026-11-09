# AI Inventory Intelligence Platform

A multi-tenant inventory platform that helps retail teams capture shelf images, review AI-assisted product detections, and maintain reliable inventory records.

## Product principles
- One backend API serves the web and Android clients.
- Every store's data, users, and permissions are isolated.
- AI suggestions are reviewable; uncertain detections never silently become stock truth.
- Multiple photos in one capture session represent different views of the same shelf.
- Inventory changes are auditable and represented as stock movements.
- The legacy repository is a source for selective, tested feature migration—not a codebase to copy wholesale.

## Status
A first deployable web/API foundation is being implemented on `bootstrap/phase-1`. It is a development scaffold only; authentication, persistence, tenant authorization, inventory workflows and image analysis are not implemented yet.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [API contract](docs/API_CONTRACT.md)
- [Image analysis](docs/IMAGE_ANALYSIS.md)
- [AI provider contract](docs/AI_PROVIDER_CONTRACT.md)
- [Multi-provider AI gateway ADR](docs/adr/0009-multi-provider-ai-gateway.md)
- [Security](docs/SECURITY.md)
- [Test plan](docs/TEST_PLAN.md)
- [Roadmap](docs/ROADMAP.md)

## AI implementation status
The independently deployable NestJS AI API is scaffolded in `apps/ai-service`. It exposes `GET /health` and a service-token-protected `POST /internal/v1/analyses`, with Gemini as the first configurable provider. The Core API is not yet connected to it; private object-storage integration, persisted analysis runs, automated tests, provider alternatives and production credentials remain pending. Configure `GEMINI_MODEL`, `GEMINI_API_KEY` and `AI_SERVICE_TOKEN` only in the AI service environment. Never expose these secrets to clients.

## Working agreement
Read [AGENTS.md](AGENTS.md) before making changes. Keep changes small, tested, and documented. Never expose secrets or use client-supplied tenant identifiers as authorization.

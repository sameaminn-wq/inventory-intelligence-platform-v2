# Engineering Instructions

## Non-negotiable rules
1. Preserve tenant isolation at every read and write boundary.
2. Resolve the active store from the authenticated user's membership and authorization context—not from an untrusted request field.
3. Treat AI output as a proposal requiring validation and, where appropriate, human review.
4. Do not add or merge legacy code without identifying its source, reviewing its contracts, and adding tests.
5. Do not claim production readiness without passing the release gates in docs/TEST_PLAN.md.
6. Never commit credentials, API keys, personal data, real customer images, or production database dumps.
7. Avoid destructive migrations and force pushes. Prefer additive, reversible database changes.
8. Keep business logic independent from HTTP handlers and client frameworks.

## Product constraints
- Multi-tenant SaaS from the beginning.
- A user may belong to multiple stores through explicit memberships.
- Each store has its own inventory, employees, and role/permission assignments.
- Web and Android use the same versioned backend API.
- Android is online-first, but capture sessions must survive temporary network loss through local retry/pending-upload handling.
- Multiple images in a capture session are different views of the same shelf. Do not add quantities across views without instance-level reconciliation.
- Product catalog identity is distinct from store-specific stock balances.
- Use stock movement records as the auditable history of quantity changes.
- Do not label estimates as live market prices without a verifiable live source.
- Excel export may be implemented before Arabic PDF. PDF requires correct RTL shaping, font embedding, and visual tests.

## Engineering workflow
1. Read the relevant architecture and contract documents.
2. State assumptions and inspect existing code before editing.
3. Make the smallest coherent change.
4. Add/update unit, integration, and security tests.
5. Run formatting, lint, type-check, tests, and build where configured.
6. Summarize changed files, commands run, results, known gaps, and migration impact.

## Architecture direction
Start as a modular monolith. Do not introduce microservices without measured operational need. Keep domain modules and provider interfaces explicit. Use PostgreSQL, private object storage, background jobs for image analysis, and an AI-provider abstraction.

## Security review checklist
- Authentication and membership checks on every tenant-owned resource.
- Object-level authorization on image, export, and inventory resources.
- Input validation and bounded uploads.
- Rate limiting and abuse controls on expensive AI endpoints.
- Private storage with short-lived access URLs.
- Audit events for sensitive actions.
- No secrets or sensitive data in logs.

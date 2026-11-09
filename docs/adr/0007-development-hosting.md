# ADR 0007: Temporary Free-Tier Development Hosting

- **Status:** Accepted for development/demo only; not production approval.
- **Date:** 2026-11-07

## Context
The project needs a low-cost way to validate the web/API workflow before revenue or a production budget exists.

## Decision
Use this temporary development arrangement:
- **Web:** Cloudflare Pages with Next.js static export.
- **API and worker:** Render Free Node service for early integration experiments; worker may be run in the same service only for a small demo, not as a reliability guarantee.
- **Database and authentication:** Supabase Free (PostgreSQL + Supabase Auth).
- **Images:** Cloudflare R2 private bucket.
- **AI:** Gemini free tier only with synthetic/non-sensitive test data, subject to current terms.

The browser frontend is static and calls NestJS. Do not depend on Next.js SSR, route handlers, server actions or server-side secrets in the Pages static-export deployment.

## Known limitations / non-production boundary
- Render free services may sleep after inactivity and incur cold starts; local filesystem is ephemeral. Do not store uploads or durable job state there.
- A single Render service running API and worker is not a robust production topology; background work may be interrupted.
- Supabase Free may pause after inactivity, has limited capacity and does not provide the backup/availability guarantees required for production.
- Free quotas, limits, terms and availability may change. Monitor usage and avoid putting sensitive customer data into an unreviewed free-tier setup.
- Static export excludes server-rendered Next.js features.

## Migration path
Before a public/commercial launch, select paid or otherwise suitable hosting for API and dedicated workers, a production database plan with backups/PITR and restore testing, monitored object storage, secret management, observability, security controls and an agreed data-processing arrangement. Re-evaluate Cloudflare Workers/OpenNext or paid Vercel only after a deployment POC and cost comparison. Do not interpret this ADR as approval to launch production on free tiers.

## Validation gate
Deploy a disposable end-to-end environment; test cold starts, worker interruption/retry, Supabase connection limits, R2 CORS/signatures, environment secrets and frontend static-export constraints. Document a paid production target and migration checklist before onboarding real customers.
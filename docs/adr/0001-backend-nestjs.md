# ADR 0001: NestJS Backend API

- **Status:** Accepted for foundation; implementation subject to proof of concept.
- **Date:** 2026-11-07

## Context
The product needs one stable API shared by Next.js web and Ionic/Capacitor Android, with tenant authorization, domain boundaries, background processing and OpenAPI contracts.

## Decision
Use a dedicated **NestJS + TypeScript** backend as the owner of business logic and REST API under `/api/v1`. Keep Next.js as the web presentation layer. Android and web call the same API. Keep a modular monolith; run workers as a separate process/deployment from the same codebase where operationally appropriate.

## Consequences
- Clear separation between UI and domain logic; mobile is not coupled to Next.js internals.
- More deployment/configuration work than putting all logic in Next.js.
- Define module boundaries and OpenAPI contracts early.
- Do not put business rules or privileged secrets in the browser bundle.

## Validation gate
Build a small NestJS API POC covering auth guard, store membership/permission check, OpenAPI generation, database transaction and worker-compatible module wiring before production implementation.
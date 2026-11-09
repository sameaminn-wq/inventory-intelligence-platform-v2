# ADR 0002: Supabase Auth for Identity

- **Status:** Accepted for foundation; security and integration POC required.
- **Date:** 2026-11-07

## Context
The product needs reliable identity and session lifecycle across web and Android, while store memberships, roles and permissions are product-specific authorization data.

## Decision
Use **Supabase Auth** for authentication and identity/session lifecycle initially. The NestJS API verifies access tokens and independently resolves active store membership and fine-grained permissions from the application's PostgreSQL schema. Supabase Auth does not replace application authorization, tenant isolation or audit controls.

## Consequences
- Avoid implementing password storage and core identity flows from scratch.
- Authentication identity and product user records require a stable mapping.
- Web and Android token refresh, revocation, logout and secure storage must be explicitly tested.
- Never trust a client-supplied store ID or role claim as authorization proof.

## Security and validation gates
- Verify JWT signature, issuer, audience, expiry and key rotation using a maintained library.
- Test web cookie/session handling and Android secure token storage.
- Test account linking, disabled users, revoked sessions and membership removal.
- Confirm the chosen Supabase project region, data processing terms, backups and production plan before real customer data.
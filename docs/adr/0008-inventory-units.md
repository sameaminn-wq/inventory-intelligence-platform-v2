# ADR 0008: Base Units and Product-Specific Conversions

- **Status:** Accepted as domain direction; detailed schema and UX POC required.
- **Date:** 2026-11-07

## Context
The same product may be purchased, stored or counted in different packages (piece, box, carton, sack, kilogram). Store-specific stock must remain mathematically consistent.

## Decision
Each store product has one canonical **base unit** for inventory accounting. Define explicit product/store-product-specific conversion factors from allowed entry units to that base unit. Store stock balances and stock movements are persisted in the base unit. User-facing entry may use a configured alternate unit, which is converted server-side using a validated conversion rule.

Examples:
- Bottled water: 1 carton = 12 pieces; base unit = piece.
- Rice: 1 sack = 25 kg; base unit = kg.

Use PostgreSQL `NUMERIC` (initial proposal `NUMERIC(18,3)`, subject to domain validation) rather than floating point. Define per-product precision/rounding rules and whether fractional quantities are allowed. Do not assume every product can be fractional or that every package conversion is globally reusable.

## Consequences
- Consistent stock totals and movement ledger across purchase/counting units.
- Conversion factors must be versioned or snapshotted on movements so historical quantities remain interpretable if packaging changes.
- UI must show the entered unit and converted base quantity clearly.
- Conversion edits require authorization and audit history.

## Validation gate
Test exact and fractional conversions, rounding, package changes, returns, adjustments, imports/exports and concurrent updates. Decide whether conversion rules belong to the global product or store-product listing before migrations. Negative-stock policy remains a separate explicit decision.
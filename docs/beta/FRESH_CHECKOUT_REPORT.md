# Fresh-Checkout Reproducibility Report

**Date:** 2026-07-30 · **Method:** isolated `git worktree` at HEAD, following **only** `README.md`.
**No production credentials or data used.**

## Result: **PARTIAL — install works, verification does not**

| Step                                        | Source    | Result                                                        |
| ------------------------------------------- | --------- | ------------------------------------------------------------- |
| 1. `pnpm install`                           | README:35 | ✅ **PASS** — `--frozen-lockfile`, 3.7s, husky prepare ran    |
| 2. `cp .env.example .env.local`             | README:38 | ✅ **PASS** — `.env.example` exists (2,279 bytes, 6 env vars) |
| 3. `pnpm dev`                               | README:41 | ⚠️ **NOT ATTEMPTED** — see below                              |
| 4. Verification command                     | —         | ❌ **README DEFINES NONE**                                    |
| 5. `pnpm test` (conventional, undocumented) | —         | ❌ **FAILS**: `@life-navigator/mobile#test` exits 1           |

Package manager is correctly pinned: `"packageManager": "pnpm@9.15.0"` with a `preinstall` guard.

## Findings

**F-1 · No documented verification command.** README gives install → env → `pnpm dev`. A developer has
no documented way to answer _"is my checkout working?"_ This is the single largest reproducibility gap
and it is credential-independent to fix.

**F-2 · `pnpm test` fails on a clean checkout.** `@life-navigator/mobile#test` fails immediately
(468ms, 0 cached). The conventional verification command is red out of the box, which trains new
contributors to ignore test failures. **Not fixed here** — the mobile package is outside Prompt 2A's
scope and fixing it is product work, not baseline work.

**F-3 · `pnpm dev` cannot reach a working app without real credentials.** `.env.example` ships
placeholders (`https://your-project.supabase.co`, `eyJ...`). The web app boots but auth, data, and
retrieval fail. **There is no local synthetic stack**: no docker-compose, no emulator, no seeded
fixtures.

**F-4 · Undocumented prerequisites.** `pnpm` itself, Node ≥ engines, Rust toolchain (for worker tests),
and a Python 3.12 venv (core-api tests run from `apps/lifenavigator-core-api/.venv`, which is **not**
created by any documented step and is not in the README).

## Locally runnable boundaries — what genuinely works today

| Component                    | Command                                                                  | Works offline?                             |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Install                      | `pnpm install --frozen-lockfile`                                         | ✅ yes                                     |
| **Worker tests**             | `cd apps/ingestion-worker && cargo test --lib`                           | ✅ **yes — 90 tests, no external deps**    |
| **core-api tests**           | `cd apps/lifenavigator-core-api && .venv/bin/python -m pytest tests/ -q` | ✅ **yes — 1,015 tests, all stores faked** |
| **Architectural invariants** | `pytest tests/test_architectural_invariants.py`                          | ✅ **yes**                                 |
| **Required-check contract**  | `pytest tests/test_required_checks.py`                                   | ✅ **yes**                                 |
| Web unit tests               | `pnpm test`                                                              | ❌ mobile package fails                    |
| Web app end-to-end           | `pnpm dev`                                                               | ❌ needs real Supabase                     |

**Mocked boundaries, labelled:** core-api tests fake Neo4j, Qdrant, Supabase, and the model provider
entirely. They prove _contract_ behaviour, never live integration. The two-tenant isolation fixture
interprets the tenant predicate in generated Cypher — meaningful for regression, **not** a live
isolation proof.

## Smallest useful synthetic path — proposed, NOT built

Deliberately not implemented (the brief forbids inventing a local-platform project):

1. `pnpm verify` at the root → lint + type-check + core-api pytest + `cargo test --lib`, **excluding
   the mobile package** until F-2 is fixed. One command, no credentials, no containers.
2. Document it in README as the verification step.

That is the minimum that closes F-1 without building infrastructure. It requires a decision about the
mobile exclusion, so it is proposed rather than merged.

## Classification

| Item                   | Status                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| Install path           | **Implemented and locally verified**                                   |
| Backend test path      | **Implemented and locally verified** (1,015 + 90 offline)              |
| `pnpm verify` command  | **Not started** — needs the mobile-exclusion decision                  |
| Local synthetic stack  | **Externally blocked** — needs isolated store provisioning (Prompt 2B) |
| `pnpm dev` working app | **Externally blocked** — needs credentials                             |

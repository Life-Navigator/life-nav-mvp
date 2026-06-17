# MCP Server Audit

**Date:** 2026-06-16 · Status after sprint: **BUILT** (was absent).

## Before this sprint

There was **no MCP server** and no structured submission path. The only provenance-aware write was
`life_discovery.discover_goal()` (goals/objectives). Risks/opportunities/constraints had **no writer at
all** (a TRUST RULE deliberately blocked archetype auto-creation). So an LLM/agent had no sanctioned,
schema-checked way to persist discovered data — the gap this sprint closes.

## After this sprint

| Question                           | Answer                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does an MCP server exist?          | **Yes** — `apps/lifenavigator-core-api/mcp_server/` (stdio, `python -m mcp_server.server`)                                                                                    |
| Reachable by an LLM/agent runtime? | Yes — standard MCP stdio; Claude Desktop config in the README. (Note: the platform's own Gemini-on-Fly is not an MCP client; this server is for external MCP clients/agents.) |
| Exposes safe structured tools?     | Yes — 7 tools, each with a full JSON schema derived from a Pydantic model                                                                                                     |
| Enforces schemas?                  | Yes — `IngestionService` validates every call; invalid → structured error, **no write**                                                                                       |
| Prevents arbitrary DB writes?      | Yes — the **tool** maps to a fixed `life` table; the caller never names a table or writes SQL                                                                                 |
| Attaches provenance?               | Yes — `provenance` is a **required** field on every tool; stamped onto every row                                                                                              |
| Respects RLS / tenant boundaries?  | Yes — user/tenant resolved from a **verified** Supabase JWT; never from tool input; rows are RLS-scoped                                                                       |

## Components

- **`mcp_server/server.py`** — FastMCP server; 7 `@mcp.tool()` wrappers → `IngestionService`.
- **`mcp_server/auth.py`** — resolves the user from a verified `LIFENAV_USER_JWT` (reuses core-api `verify_jwt`); fails closed.
- **`app/services/ingestion.py`** — `IngestionService` + Pydantic schemas + enums + tool→table mapping + provenance + idempotency. **Unit-tested** (`tests/test_ingestion.py`, 10 tests).
- **Migration** `supabase/migrations/20260616160000_mcp_ingestion.sql` — `life.facts`, `life.relationships`, provenance columns; RLS. **Gated** on key rotation.

## Auth model

stdio server runs in one user's context. The user supplies their own Supabase access token via
`LIFENAV_USER_JWT`; it is **verified** with `SUPABASE_JWT_SECRET` and the `sub` claim becomes `user_id`.
The `SupabaseClient` writes as service-role but **always** scopes `user_id`/`tenant_id` from the verified
token. A local-dev bypass (`LIFENAV_USER_ID` + `LIFENAV_ALLOW_INSECURE_USER=1`) exists and fails closed
otherwise.

## Logging & error handling

Each tool call logs `tool / user / ok`. Validation failures return `{ok:false, code:"schema_validation",
errors:[{field,msg}]}`; write failures return `{ok:false, code:"write_failed"}`. No partial/silent writes.

## Honest gaps

- The server requires the `mcp` package (`mcp_server/requirements.txt`) — not installed in the core-api
  image by default (separate entrypoint).
- Live writes require the gated migration to be applied (post key-rotation).
- No token-use **audit log** yet (shared finding with `INTEGRATION_SECURITY_REPORT.md`).

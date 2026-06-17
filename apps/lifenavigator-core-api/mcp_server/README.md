# LifeNavigator MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an MCP-client LLM/agent
(Claude Desktop, an agent runtime) submit discovered user data into the LifeNavigator life model
**safely** — schema-validated, provenance-stamped, tenant-scoped, idempotent. The LLM never picks a
table or writes SQL; the tool decides where data belongs.

## Tools

| Tool                  | Writes to                | Purpose                                                                     |
| --------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `submit_life_fact`    | `life.facts`             | discrete facts (employer, has children, getting married)                    |
| `submit_goal`         | `life.candidate_goals`   | goals (buy a house, pay off debt) — candidate/inferred never auto-confirmed |
| `submit_constraint`   | `life.constraints`       | limited time/cash, health limitation, debt burden                           |
| `submit_risk`         | `life.risks`             | overcommitment, income loss, missed deadline                                |
| `submit_opportunity`  | `life.opportunities`     | promotion accelerates housing, degree improves career                       |
| `submit_narrative`    | `life.facts` (candidate) | dominant-narrative signal; canonical narrative stays _derived_              |
| `submit_relationship` | `life.relationships`     | goal supports/conflicts/blocks/accelerates another node                     |

Every tool requires a `provenance` object (`submitted_by`, `source_type`, and optional
`conversation_id`/`document_id`/`email_id`/`calendar_event_id`), a `confidence` (0–1), and a
`confirmation_status` (`confirmed`/`inferred`/`candidate`). Invalid input returns a structured error and
writes nothing. The logic lives in `app/services/ingestion.py` (unit-tested in `tests/test_ingestion.py`).

## Run (stdio)

```bash
pip install -r requirements.txt -r mcp_server/requirements.txt
LIFENAV_USER_JWT="<your supabase access token>" \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... \
python -m mcp_server.server
```

The user is resolved from the **verified** `LIFENAV_USER_JWT` (Supabase access token); all writes are
scoped to that user. For local dev only, `LIFENAV_USER_ID` + `LIFENAV_ALLOW_INSECURE_USER=1` bypasses
JWT verification.

### Claude Desktop config

```json
{
  "mcpServers": {
    "lifenavigator": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "apps/lifenavigator-core-api",
      "env": {
        "LIFENAV_USER_JWT": "...",
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "...",
        "SUPABASE_JWT_SECRET": "..."
      }
    }
  }
}
```

## Activation gate

The submission tables/columns ship in migration `supabase/migrations/20260616160000_mcp_ingestion.sql`.
**Apply it only after the exposed Supabase keys are rotated** (see
`docs/finish-line/SECURITY_CLEARANCE_REPORT.md`). Until then the server validates and is testable, but
live writes will fail on the missing columns/tables.

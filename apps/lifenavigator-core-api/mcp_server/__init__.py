"""LifeNavigator MCP server — a Model Context Protocol server exposing schema-enforced, provenance-stamped
data-submission tools so an MCP-client LLM/agent (e.g. Claude Desktop, an agent runtime) can write
discovered user data into the life model WITHOUT ever choosing a table or writing arbitrary SQL.

The tool logic lives in app.services.ingestion.IngestionService (unit-tested); this package is the thin
MCP protocol wrapper + per-user auth resolution. Run: `python -m mcp_server.server` (stdio)."""

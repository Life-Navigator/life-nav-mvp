# CORE_API_ALIGNMENT.md — Phase 3 ✅

Verified live (this sprint):

- **healthz** → `{"status":"ok"}`; release **v139**, both machines healthy.
- **WIF still works** — in-machine real call: Fly OIDC → STS → SA impersonation → Gemini → `VERTEX_OK`.
- **provider=vertex_gemini, model=gemini-2.5-pro** (proven).
- **MODEL_PROVIDER=vertex** (no AI-Studio/API-key advisor path).
- **ENABLE_VERTEX_CLAUDE=false** (Opus hybrid deployed, disabled).
- **Loud fallback** intact (VertexAuthError → deterministic + log).
- Running code == reconciled main (deployed from the same tree FF'd to main; WIF code present in the image — verified by the live WIF call).

Status: core-api aligned + keyless-Vertex healthy.

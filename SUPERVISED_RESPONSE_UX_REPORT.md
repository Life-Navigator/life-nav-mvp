# SUPERVISED_RESPONSE_UX_REPORT.md — Phase 9

- **Repair succeeds → user sees only the final polished answer.** The repair loop runs server-side inside `_enhance`; `assistant_message` is the validated final text. Repair attempts are NEVER surfaced (only in `analytics.advisor_turns` telemetry: `repair_attempts`, `validator_result`).
- **Streaming:** the web advisor uses the SSE endpoint — a fast deterministic `ack` (~1.3s) then the validated `final`. No unsafe/intermediate draft ever streams.
- **Repair fails after 2 attempts → graceful safe fallback** (the deterministic RelationshipManager reply), no scary compliance language shown to the user.
- **Latency tradeoff (honest):** a repaired turn costs an extra generation (~30s each). Live: simple turns ~29-38s, repaired turns ~59-77s. Streaming masks first-text; raw completion is slower. Mitigation: streaming (in place) + future model-speed/cap tuning.

Compliance is invisible unless the model genuinely can't produce a safe answer.

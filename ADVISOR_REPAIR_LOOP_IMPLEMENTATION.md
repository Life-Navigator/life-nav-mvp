# ADVISOR_REPAIR_LOOP_IMPLEMENTATION.md — Phase 4

`advisor_orchestrator._enhance`:

```
out = generate(context, constraints)
ok, safe, reasons = validate(out, context)
attempt = 0
while not ok and _is_repairable(reasons) and attempt < 2:
    attempt += 1
    issues = classify_issues(out, context)               # structured feedback
    repair_note = _build_repair_note(issues, reasons)    # numbered, per-span instructions
    out = generate(context, {**constraints, "repair_note": repair_note})
    ok, safe, reasons = validate(out, context)            # SAME gate re-checks
if ok: compose + stream    else: graceful safe fallback
```

- **Max 2 repair attempts**; same context preserved; model revises only flagged portions.
- **No streaming until the final validated answer** (the web advisor uses the stream endpoint, which emits a fast deterministic `ack` then the validated `final`).
- `_is_repairable` now true for ALL content failures (numbers, relationships, advice/verdict) — only malformed/non-JSON is non-repairable.
- Telemetry: `tr.repair_attempts`, `validator_result=repaired_attempt_N`.
- Trust unchanged: every draft (incl. repaired) passes the full validator; unsafe content never streams.

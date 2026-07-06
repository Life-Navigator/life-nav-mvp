# ADVISOR_PROMPT_FALLBACK_AUDIT_REPORT.md — 2026-06-25

## Headline

The advisor wasn't "timid by prompt" — **its LLM never ran for real web users.** The #1 fix is an
infrastructure permission bug; two gate over-blocks and the fallback copy were secondary.

## ROOT CAUSE #1 (the real paralysis) — Fly socket permission

- **Symptom:** every real web turn returned `llm_status=fallback:unavailable` in ~8s (llm_generate≈2.8ms) →
  the deterministic/counsel reply ("I want to give you a grounded answer…") regardless of how much the user
  supplied. Health/Career/Finance/Family/Cross all fell back.
- **Why it hid:** uvicorn runs as non-root `core` (uid 10001), but every diagnostic I ran in-machine via
  `flyctl ssh` runs as **root** — root could read the credentials, so in-machine always showed `enhanced`.
- **Cause:** keyless Vertex (WIF) mints a Fly OIDC token by connecting to `/.fly/api`, a `srwxr-xr-x root:root`
  socket — connecting needs the _write_ bit, which only root has. `core` → `VertexAuthError: Cannot reach Fly
OIDC socket /.fly/api … [Errno 13] Permission denied` → no token → LLM skipped → fallback.
- **Fix:** `entrypoint.sh` starts as root, `chmod o+rw /.fly/api`, then drops to `core` via
  `setpriv --reuid=10001 --regid=999 --init-groups uvicorn …`. Dockerfile drops `USER core`, adds the entrypoint.
  Non-root runtime preserved. Secondary: per-uid credential scratch files in `vertex_auth.py`
  (`/tmp/gcp-*-{uid}.json`) so a root ssh session can't poison the worker's files.
- **VERIFIED on the web path post-fix:** Health `enhanced` (44s, real plan), Career "I hate my job but it pays
  well" `enhanced` (43s, "golden handcuffs" counsel), cross-domain briefing renders a full synthesis in the UI.

## ROOT CAUSE #2 — number gate over-blocked percentages (would fall back once LLM ran)

- `_fabricated_personal_numbers` gated EVERY ungrounded `%`; near a money word ("a 22% raise to your pay")
  it read as a fabricated personal figure → reject → fallback. Live repro: career → `fallback:invented ['22']`.
- **Fix:** a `%` is a personal claim ONLY when tied to a personal stat (`_PERSONAL_STAT_PCT`:
  DTI/readiness/probability/success rate/savings rate). General rate %s (raise, return, 4% rule, body fat) pass.
  $-amounts and bare integers near a money cue stay strictly gated (no fabricated "your net worth is $X").

## ROOT CAUSE #3 — advice gate over-blocked colloquial usage

- `_ADVICE` affordability verdicts matched "you can afford **to** take a pay cut", "you qualify **for the role/
  aid**" → career/education fell back on "advice/medical-legal language" (~1/3 of runs).
- **Fix:** scoped to lending — "afford" excludes "afford to"; qualify/approved require a loan noun nearby.
  Lending verdicts ("you can afford this $500k home", "qualify for a mortgage") still blocked.

## Fallback copy (P6)

`_COUNSEL_FALLBACK` rewritten value-first: "Let's get you a concrete answer. Tell me a bit more… and I'll lay
out the options, the math, and the tradeoffs." (Only fires when the LLM truly can't produce a safe answer.)

## Test results

- **17-prompt suite (in-machine, clean run): 16/17 enhanced.** Only F5 fell back (LLM invented a derived
  `$21,000` — the trust spine correctly gating a fabricated personal dollar amount). Health 4/4, Career 3/3,
  Education 2/2, Family 2/2, Cross-domain 3/3, Finance 2/3.
- **Stability:** C8 (reported failure) ×4 + others = 10/10 enhanced.
- **Web path:** Health + Career confirmed `enhanced` (~43-44s) + UI screenshots.
- Unit: **688 tests pass** (+6 percentage/lending-scope regressions in test_affordability_gate.py).

## Files changed

- `apps/lifenavigator-core-api/Dockerfile`, `entrypoint.sh` — socket fix (the real one)
- `app/clients/vertex_auth.py` — per-uid credential files
- `app/services/advisor_validator.py` — percentage scope + lending-verdict scope
- `app/services/advisor_orchestrator.py` — value-first fallback copy
- `tests/test_affordability_gate.py` — +6 regressions

## Inventory (P1)

Full prompt/fallback map produced (system prompt advisor_llm.py:37-217 already answer-first; \_SAFETY in
advisor_context.py:40-53; fallbacks in advisor_orchestrator.py; deterministic discovery in
relationship_manager.py; gates in advisor_validator.py). Conclusion: the SYSTEM PROMPT was already strong
(answer-first, coaching allowed, current-turn numbers in allowed_numbers via advisor_context.py:383). The
paralysis was infra + two gate over-blocks, not the prompt — so no prompt rewrite was needed.

## Remaining limitations

- **Latency ~43s/turn** (real Gemini 2.5 Pro + supervised repair). Streaming masks first paint; consider a
  faster model tier or trimming the repair loop for simple turns.
- Occasional finance fallback when the LLM invents a derived $-amount (trust spine working; value-first copy).
- Run-to-run model variance remains (now low after the gate fixes).

## Go / No-Go

**GO for advisor quality** — the advisor now gives useful, grounded, domain-aware counsel on the live web path
across all five domains. (Email remains the separate launch gate per the prior sprint.)

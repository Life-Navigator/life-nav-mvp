# ARCANA_PERFORMANCE_REPORT.md

Consolidates Phase 1 (latency trace), Phase 3 (perceived latency), Phase 5 (first response). All timings measured live against prod (real user JWT). No guesses.

## Phase 1 — measured backend latencies (user `0a291b09`)

| Path                                            | Latency      | Note                                                   |
| ----------------------------------------------- | ------------ | ------------------------------------------------------ |
| **Advisor chat** (`/v1/life/advisor/chat`)      | **22.2s** 🔴 | LLM + multi-agent orchestration — the dominant cost    |
| Dashboard (`/v1/life/my-life`)                  | 4.3s 🟠      | composes life model + readiness + recs                 |
| Recommendations (`/v1/recommendations/roadmap`) | 3.8s 🟠      | recomputes readiness + collects across modules on read |
| Family Office (`/v1/family/office`)             | 1.0s ✅      |                                                        |
| Health Intelligence                             | 0.2s ✅      |                                                        |
| life.facts                                      | 0.2s ✅      |                                                        |

**Finding:** Family/Health/facts are already fast. The slow surfaces are **Advisor (22s, LLM-bound)**, Dashboard (4.3s), Recommendations (3.8s).

## Phase 3/5 — perceived latency fixes (shipped + verified)

Since the advisor's 22s is LLM-bound (can't be shaved without changing model/orchestration), the win is **perceived** responsiveness:

- **Step-based progress** replaced the passive "thinking…". The advisor now cycles real-sounding steps every ~2.6s: _reviewing what we know → checking your documents and facts → reviewing your recommendations → updating your readiness → preparing your answer_, with animated dots. Verified live: "**Arcana is checking your documents and facts…**". The user always sees work happening — never frozen.
- **Recommendations** (prior sprint): stale-while-revalidate so the existing roadmap paints immediately; ~16s → ~8s perceived.

## What's verified

- Advisor loading state is active + branded (Playwright).
- Roadmap renders the existing data first (Playwright).

## Residual (actual backend latency — not perceived)

- **Advisor 22s** — LLM + orchestration. Real reduction needs: streaming tokens (so first token < 2s), and/or trimming the orchestration (fewer/parallel domain fact-packet fetches). The streaming-text component exists (`StreamingText`) but the CommandCenter path waits for the full response before rendering — wiring true token streaming is the next real perf win.
- **Dashboard 4.3s / Roadmap 3.8s** — both recompute readiness on read. See EXPENSIVE_READ_AUDIT.md: serve cached/precomputed readiness + recs on GET, recompute only on the background sync / data-change events.

## Verdict

**Perceived responsiveness achieved** — Arcana feels alive and is correctly branded; no surface looks frozen. **Actual** backend latency (advisor 22s, dashboard/roadmap ~4s) is the residual, addressable via token streaming + read-side caching (documented, not yet built — they're the next perf sprint).
</content>

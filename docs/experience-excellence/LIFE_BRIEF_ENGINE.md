# Life Brief Engine

**Date:** 2026-06-16 · Status: **BUILT + LIVE in code** (backend composer + dashboard card). Pure surfacing of the existing Life Model — no new infra, model, or agent work.

## What it is

The Life Brief is the first thing a pilot user reads. It reflects their **own** life back at them in plain language — situation, tension, stakes, next move — so the first reaction is _"this understands me"_ and the second is _"this is useful."_ It is the single highest-leverage way to make the moat (the per-user life model) visible.

## Why a composer, not a model call

Everything the brief needs is already computed in `snapshot()` and the Recommendation OS. The brief is a **deterministic composition** over that intelligence — so it is free, instant, reproducible, and cannot hallucinate. It honors **No mock data — ever**: if the model is still forming, it says so instead of inventing a story.

## Implementation (real)

- **Composer:** `apps/lifenavigator-core-api/app/services/life_discovery.py` → `life_brief(snapshot, *, next_action=None, readiness=None)`.
- **Wiring:** `apps/lifenavigator-core-api/app/services/my_life.py` → `MyLifeService.my_life()` calls `life_brief(snap, next_action=next_action, readiness=readiness)` and returns it as the top-level `life_brief` field of `GET /v1/life/my-life`.
- **Frontend:** `apps/web/src/components/dashboard/LifeBrief.tsx`, mounted at the top of `apps/web/src/app/dashboard/page.tsx:71` (above `ExecutiveSummary`). The API route `apps/web/src/app/api/life/my-life/route.ts` is a pass-through, so no API changes were needed.
- **Tests:** 4 in `apps/lifenavigator-core-api/tests/test_discovery_intelligence.py` (`test_life_brief_*`). Full core-api suite: **489 passing**.

## Inputs → output

| Brief field      | Source (existing intelligence)                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `headline`       | `dominant_narrative.label` — the life STORY (e.g. "Building a family foundation"), never a single objective              |
| `situation`      | `dominant_narrative.summary` woven with `goal_portfolio` goals they're holding together                                  |
| `tension`        | derived ONLY when real: ≥2 distinct life domains competing, or `burnout` / (`distress`+`money_stress`) emotional signals |
| `stakes`         | top grounded risk from `snapshot.top_risks` — omitted if none (never invented)                                           |
| `next_move`      | Recommendation OS top action (`recommended_action` / `title`) — omitted if none                                          |
| `goals_held`     | `goal_portfolio` goal labels (max 6)                                                                                     |
| `confidence_pct` | `dominant_narrative.confidence`                                                                                          |
| `source`         | "Composed from your Life Model — narrative, goals, and recommendations"                                                  |

## Honest empty state

When `dominant_narrative` is absent or there are no stated goals, `ready=false`: headline "Your Life Brief is still forming." + an invitation to tell Arcana more. `stakes` and `next_move` are `None` whenever their grounded inputs are missing — the brief never claims a risk or a move it can't evidence.

## Example (Family persona, live composer output)

> **Building a family foundation**
> Building a family foundation while balancing finance over the next year or two. Right now you're holding several things at once — plan our wedding, buy a first home, pay off the credit card, and get promoted to senior manager. These pull on the same time, money, and energy — the real question is sequence, not whether any one of them has to be given up. Biggest thing to protect against: Retirement timeline appears inconsistent with current savings. Your next move: Redirect $400/mo to the highest-APR card.

## Roadmap (cheap, reuse-only)

- **P1:** Show the brief at the onboarding→dashboard handoff (the "holy-shit moment" — see HOLY_SHIT_MOMENT_DESIGN.md), and as the opening section of the executive report (see EXECUTIVE_REPORT_EXCELLENCE.md) and graph header (GRAPH_EXPERIENCE_REDESIGN.md).
- **P2:** Add a one-line "what changed since last week" delta to the brief using the existing recent-intelligence feed.

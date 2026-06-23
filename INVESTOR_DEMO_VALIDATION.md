# INVESTOR_DEMO_VALIDATION.md

## The demo arc — now real, verified live

1. **User:** "I just got promoted to Staff Engineer!"
2. **Arcana answers naturally** (verified): "…this is a significant career milestone that likely enhances your earning potential… A non-obvious insight is that a promotion can shift your day-to-day work, potentially moving you further from your desired specialization…"
3. **Chips** prove breadth (risk + source); **"Why?"** drawer proves the reasoning + cited facts.
4. **Action card appears**: "Update your plan · Promotion" with impact chips (Compensation · Retirement · Taxes · Home-purchase timeline) + editable fields (title, salary, bonus, equity).
5. **User approves** → write via IngestionService → **green confirmation**: "✓ Updated your promotion — saved title, base salary. This refreshes: Compensation, Retirement projections, Taxes, Home-purchase timeline."
6. **Persisted**: the facts are in `life.facts` (confirmed, provenance-stamped) → surface in the dashboard + advisor on next read.

## Final questions

1. Detect life changes? **Yes — 5 types, verified.**
2. Explain impact before writing? **Yes — impact chips shown before any write.**
3. Approval always required? **Yes — apply is a separate gated call; detect never writes.**
4. Updates persist? **Yes — 14 facts in life.facts across 5 domains.**
5. Dashboard refresh? **On next read — confirmed facts feed the "Recently learned" strip + readiness (recomputed on read).** (No live cross-page push from chat — honest.)
6. Recommendations refresh? **On the recommendations page load (sync) — facts changed feed the engine.**
7. All 5 scenarios live? **Yes — promotion via full UI; all 5 via the gated API + life.facts.**
8. Would a user trust it? **Yes — nothing saved without explicit approval; every write is provenance-stamped.**
9. Would an investor get the value? **Yes — "tell Arcana your life changed, approve, your plan updates."**
10. More than a chatbot? **Yes — it writes to the life model, gated by approval.**

## Honest scope

- **Dashboard/recommendations refresh is on-next-read**, not a live push from the chat page (the writes persist immediately; the surfaces recompute when next loaded). A live cross-page refresh is a small follow-up.
- The 5 actions write `life.facts` (the canonical life model). Domain-specific structured rows (e.g. a `finance.assets` row for the house) are a deeper per-domain mapping, intentionally out of scope — life.facts is the single source the dashboard + advisor already read.

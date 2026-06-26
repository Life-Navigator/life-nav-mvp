# ONBOARDING_COMPLETION_GATE_REPORT.md — 2026-06-25 (commit 02b546a)

Two pre-beta blockers, both fixed + live-verified.

## Blocker 1 — Advisor ignored "you missed health/career" and ended onboarding

**Fix (completion gate, relationship_manager.py):** the "what haven't I asked?" answer is now sent as
`pending_key='final_topics'` and handled by a new `_handle_completion_gate`:

- If the user names missing domains → queue a baseline for each (skipping deprioritized) and ask ONE focused
  question at a time (health first). complete=False. Never "that's everything I need to start."
- Each baseline answer is captured (domain-tagged) and the queue advances; only when empty does it complete.
- "No / that's everything" (`_NO_GAP_RE`) → completes immediately. Gate keys bypass the correction regex.

**Final summary quality:**

- Life vision = the semantic north_star; leaked classifier labels (snake_case / "Build security and progress
  through peak_earning") are dropped.
- Duplicate goals consolidated by content signature (synonym-aware: promotion≈advance, shape≈fitness,
  financial≈finances) within a domain; distinct family goals (wedding/house/kids) survive.
- Missing-data labels (discovery_coverage.py): a domain with a goal shows BASELINE detail ("current fitness
  baseline, target definition, training routine"), not "health goal"; deprioritized domains show nothing
  missing (status "deprioritized"); finance no longer demands "income" once a goal exists.

### Live verification (deployed 02b546a)

- Names missing health+career → complete=**False**, "You're right — we shouldn't open the dashboard yet. We
  still need a baseline on Health & performance and Career momentum. Let's start with health…" → baseline_health
  → baseline_career → **complete=True**. Exactly the required flow.
- "No, that's everything." → **complete=True** immediately.

## Blocker 2 — Chat input text unreadable (white-on-white)

**Fix:** all chat inputs (onboarding main + final-question, and CommandCenter — which backs the advisor,
floating, and domain-advisor chats) now have explicit `bg-white text-gray-900 placeholder-gray-500
caret-indigo-600` + dark-mode variants (`dark:bg-gray-800 dark:text-gray-100 …`).

### Live verification (browser, both schemes)

- Dark: text rgb(241,245,249) on bg rgb(30,41,59) — light-on-dark, readable; indigo caret. Screenshot:
  input_dark.png ("Build a strong financial foundation before our wedding" clearly visible).
- Light: near-black text on white bg — readable. No white-on-white, no black-on-black.

## Tests

+completion-gate (block on missing topics / complete on "nothing else" / baseline advance→complete),
+duplicate-goal consolidation. **712 tests pass.**

## Definition of done

Advisor listens when the user says something is missing ✅ · completion gated by baseline readiness ✅ ·
human life vision (no internal labels) ✅ · duplicates consolidated ✅ · accurate missing labels ✅ ·
health/career baseline discovery continues ✅ · chat inputs readable in light+dark ✅ · tests pass ✅ ·
live verification ✅.

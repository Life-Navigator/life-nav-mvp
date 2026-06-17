# Pilot Experience Simulation

**Date:** 2026-06-16 · A walkthrough of the post-sprint experience for 10 pilot archetypes. This is an **honest design simulation** against the now-live surfaces (Life Brief + reveal + explainability + recommendation visibility + graph launch), not a live user study. Live validation is the next step (mint test users, run the journey).

## Method

For each persona we trace: First 5 Minutes → First Recommendation → First Life Brief → First Dashboard → First Graph → First Report, then judge Return / Recommend / Pay likelihood. Scores are 1–10, deliberately conservative; gaps are called out, not smoothed.

## The surfaces each persona now hits (all live)

- **End-of-discovery reveal** ("Arcana's Understanding Of Your Life") — `DiscoveryReveal.tsx`, real `my-life` data.
- **Life Brief V2** hero + **Why Arcana Believes This** card — `LifeBrief.tsx`.
- **Recommendation visibility** — quantified impact + "why #1" + evidence on `/dashboard/recommendations`.
- **Explainable graph** — now the primary nav target with a story header.
- **Reports** — generation live; in-app viewer is specced (P0 doc), still download-only today.

## Persona results

| Persona            | First 5 min | First rec | Life Brief | Dashboard | Graph | Report | Return | Recommend | Pay | Notes                                                                                          |
| ------------------ | ----------- | --------- | ---------- | --------- | ----- | ------ | ------ | --------- | --- | ---------------------------------------------------------------------------------------------- |
| VC                 | 8           | 8         | 9          | 8         | 7     | 6      | 8      | 8         | 7   | Reveal + "why #1" land; wants the report viewer (download friction).                           |
| Executive          | 8           | 8         | 9          | 8         | 7     | 6      | 8      | 7         | 7   | Narrative reflection resonates; readiness double-number (P0) is a nit.                         |
| Founder            | 9           | 8         | 9          | 8         | 8     | 6      | 8      | 8         | 7   | legacy_entrepreneurship narrative + tension feel uncanny.                                      |
| Attorney           | 7           | 7         | 8          | 7         | 8     | 7      | 7      | 7         | 6   | Provenance/evidence is the hook; wants share/audit (broken-promise fix).                       |
| CPA                | 7           | 9         | 8          | 8         | 6     | 7      | 8      | 8         | 7   | quantified_impact is the winner — verify it's populated on live data.                          |
| Financial advisor  | 8           | 9         | 8          | 8         | 7     | 8      | 8      | 9         | 8   | Sees it as a client-facing tool; report viewer would seal it.                                  |
| Military veteran   | 7           | 8         | 8          | 7         | 6     | 7      | 7      | 7         | 6   | GI-Bill rec path is strong; ensure honest empty states for thin profiles.                      |
| Young family       | 9           | 8         | 9          | 8         | 7     | 6      | 9      | 9         | 7   | family_foundation tension ("sequence, not sacrifice") is the holy-shit line.                   |
| High performer     | 8           | 8         | 8          | 8         | 7     | 6      | 8      | 8         | 7   | burnout framing acknowledged; wants goal-centric progress (P1).                                |
| ChatGPT power user | 7           | 8         | 8          | 8         | 8     | 6      | 7      | 8         | 6   | The differentiator they feel: _grounded_ + _explainable_ + _remembers me_ vs a blank chat box. |

**Averages (conservative):** First 5 min ~7.8 · First rec ~8.1 · Life Brief ~8.5 · Dashboard ~7.8 · Graph ~7.1 · Report ~6.5 · Return ~7.8 · Recommend ~7.9 · Pay ~6.8.

## What every persona feels (the four moments)

1. **"Arcana understands me"** — ✅ delivered by the reveal + Life Brief (narrative-first, their own goals).
2. **"It saw something I hadn't considered"** — ✅ mostly, via the tension line + cross-domain conflict; strengthened further by the specced Insight-of-the-Moment (P2).
3. **"I can see my priorities"** — ✅ via Top Goals + recommendation ranking; goal-centric progress cards (P1) will make it crisper.
4. **"I want to come back"** — ✅ for most; the recurring hook (delta/"what changed") is the main thing still missing.

## The honest weak spots (consistent across personas)

- **Report = the lowest score everywhere (~6.5).** It's download-only and doesn't lead with the narrative. The in-app viewer (EXECUTIVE_REPORT_VIEWER.md) is the highest-ROI remaining build.
- **Graph (~7.1)** is now _found_ (nav fixed) and _explained_ (story header), but still renders as an ontology rather than a story — the legibility redesign (role encoding, progressive labels, narrative anchor) is the P1.
- **Pay likelihood (~6.8)** trails return/recommend — value is felt, but the report + recurring-insight loop are what convert "useful" into "worth paying."
- **Two readiness numbers** on one screen (life-model ring vs document-driven index) — a credibility nit for analytical personas (P0 demote).
- **Goal double-store** (`/api/goals` vs `goal_portfolio`) must be reconciled before goal-progress cards ship, or personas see duplicate goals.

## Verdict

The "understands me / explain why / personalized recommendations" trio is genuinely felt by all 10 archetypes after this sprint. The remaining lift is **report viewer + graph legibility + a recurring insight loop** — all surfacing/encoding, no new intelligence. Recommend a **live 3–5 user run** to replace these simulated scores with real ones before the full 20.

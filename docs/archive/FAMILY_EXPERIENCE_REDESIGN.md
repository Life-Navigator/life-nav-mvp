# FAMILY_EXPERIENCE_REDESIGN.md — Sprint A

The holistic redesign that ties FAMILY_COMMAND_CENTER + ESTATE_READINESS_ENGINE + FAMILY_TIMELINE into one experience. **Reuse-first: every change is surfacing or layout, not new infrastructure.**

## Design principle

> The intelligence already exists. Make it **felt** in 10 seconds.

The current Family area is a competent CRUD admin tool (14 nav links, lots of forms). It does not _feel_ like a family office because the computed intelligence (office pillars, recommendations, readiness deltas) is buried or unsurfaced. The redesign re-sequences the experience from "data entry" to "guided protection."

## Information architecture — before → after

**Before:** Overview (summary flags) + 10 sibling CRUD tabs + 3 empty stubs (Estate/Goals/Settings). All tabs equal weight; intelligence flat.

**After:** one **Command Center Overview** that leads, with CRUD demoted to "manage" depth:

```
FAMILY COMMAND CENTER (Overview)
├─ Hero:    Legacy readiness ring + weakest-pillar headline + #1 next action
├─ Pillars: Estate · Trust · Beneficiary · Survivor   (from /v1/family/office)
├─ Household: dependents/spouse/pets roster (compact)
├─ Protection: coverage vs need bar + quantified gap
├─ Risks:   active high-priority recommendations (gaps)
├─ Opportunities: non-gap recs + positives (529 headroom, "adequate—revisit")
├─ Timeline: last 5 changes (what the platform just did)
└─ Vault:   recent documents → "drives these pillars"
   (Manage ▸ members, beneficiaries, guardianship, … unchanged CRUD)
```

## Concrete changes (each maps to existing data)

1. **Wire the hidden office engine.** Add `/api/family/office` proxy; render the 5 pillars (ESTATE*READINESS_ENGINE.md). \_Highest leverage — turns an unused endpoint into the centerpiece.*
2. **Fill the 3 stubs honestly.**
   - **Estate** → the 5-pillar board (real).
   - **Goals** → reuse the canonical goals surface filtered to family domain (goals data exists cross-domain); if none, the existing empty pattern with one CTA.
   - **Settings** → fold into profile (keep the honest pointer; do not fake settings).
3. **Add Timeline** (FAMILY_TIMELINE.md) — Overview widget + full tab, from existing timestamps.
4. **Add Opportunities** — a sibling to Risks, framing college_funding + adequacy positives + `tradeoffs_json` as forward moves (data already in recommendations).
5. **Elevate Recommendations** to the Sprint F card (why/evidence/impact/confidence/escalation) — payload already carries `evidence_json`, `assumptions_json`, `tradeoffs_json`, `governance_verdict`.
6. **Change-visibility hook** — after any upload/edit, show the Timeline delta cluster and a toast ("Estate readiness 50→75"). Ties to Sprint B.

## Empty / In-Progress / Complete — enforced everywhere

Reuse `DomainEmptyState` / `FamilyTabEmpty`'s four-line pattern (know → missing → unlocks → action). No tab may render blank or a placeholder. The audit found only 3 stubs; all three get a real or honestly-empty state. **Zero dead ends** is a hard acceptance gate.

## Emotional design (investor-grade, no new tech)

- **Reassurance over alarm:** RED pillars framed as "here's how to protect them," with the attorney escalation already in the payload — not scary, actionable.
- **Progress made visible:** the Timeline + deltas turn invisible recompute into a felt "the platform is working for me."
- **One clear next move:** the hero always names exactly one highest-leverage action (from the top recommendation), so the user is never lost.
- **Provenance as trust:** every score/figure one-click to its source row/document (Evidence drawer, live via 165).

## Guardrails honored

- No new databases / infra / models. Only a read proxy + a read timeline endpoint (SELECTs over existing tables) + UI.
- No feature inflation: absent engines (disability, elder-care, special-needs, dynamic reassessment) are **named and deferred**, not half-built.
- No fabrication: every zone reflects real rows or honest empties — consistent with the platform's "no mock data" rule.

## Definition of done (Sprint A)

The 12 command-center zones render from existing data with correct Empty/In-Progress/Complete states; `/v1/family/office` is surfaced; the Estate stub is replaced by the real 5-pillar board; a uploading-a-will demo produces a visible Timeline delta cluster. Validated against the Family Builder persona in ELITE_EXPERIENCE_VALIDATION.md.
</content>

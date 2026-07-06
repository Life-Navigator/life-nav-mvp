# DOCUMENT_TRUST_EXPERIENCE.md — Sprint A

The document-trust experience assessment, grounded in live Playwright verification (see DOCUMENT_VERIFICATION_REPORT.md). Companion to the existing DOCUMENT_PIPELINE_TRACE.md and DOCUMENT_CHANGE_VISIBILITY.md (committed earlier).

## Where the experience stands (verified, not assumed)

The trust foundation the sprint asks for is **largely built and live**. A user with uploaded documents sees, on the dashboard, a "Recently learned about you" strip that lists each extracted fact, the source document, and an honest "pending your confirmation" — sourced from real `life.facts`, with no fabrication. Family Office pillars and the Documents page are live.

## The three trust questions

1. **Is the intelligence rendered?** ✅ Yes — recently-learned facts, family pillars, document intelligence page.
2. **Can the user understand it?** ✅ Mostly — labels + source doc + confidence state. Improved this sprint with currency formatting + dark-mode legibility.
3. **Can the user act on it?** 🟡 Partial — facts are flagged "pending confirmation," but the one-click confirm/edit loop (migration-165 review lifecycle) and the per-domain "apply this" surfacing are the remaining experience work.

## The "magical upload" target vs reality

- **Target:** upload Trust.pdf → ✓ received → ✓ OCR → ✓ trustee/beneficiaries identified → ✓ estate readiness changed → ✓ recommendation updated.
- **Reality:** the _persistent_ "what we learned" view exists and is correct; the _real-time per-upload delta cluster_ (showing the readiness/recommendation deltas caused by that specific upload) is the gap. The data to build it exists (`life.readiness_snapshots` deltas + `family.family_recommendations` + `life.facts` timestamps) — it's a surfacing/composition task, no new infra.

## Recommended next (within Sprint A)

1. The upload-moment delta cluster in `UploadResult` (extracted → readiness Δ → recommendation Δ → "review these").
2. Per-domain value rendering (Family pillars cite the extracted trustee/beneficiary/coverage; Career renders the offer-letter comp) per LIFE_FACTS_RENDERING_MAP.

## Verdict

Document trust is **no longer the largest gap** — the foundation is shipped and verified. What remains is experience richness, which is bounded surfacing work over existing data.
</content>

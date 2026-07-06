# ARCANA_REPORT_FORMAT_AUDIT.md — Phase 1

## Where the six-section report came from

`app/services/advisor_orchestrator.py` → `_compose(safe)`. It took the LLM's structured JSON and concatenated it into markdown with bold section headers:

- `**The tradeoffs:**` + bullets
- `**What we know:**` + bullets
- `**My read:** ` + recommendation
- `**What would change this:**` + bullets
- a verbose inline disclaimer ("…not personalized financial, legal, or tax advice — confirm with a licensed professional.")
- the next question wrapped in `**bold**` + the rationale in `_italics_`

`_compose` is the ONLY message formatter for the enhanced advisor turn. It is used by both the non-streaming (`converse`) and streaming (`converse_stream`) paths (both call `_compose(safe)` at the enhance step).

## Other paths (audited — unaffected / intentionally separate)

- **Discovery mode:** never calls `_compose`; returns the RelationshipManager's conversational text. A tripwire (`discovery_contract_violations`) asserts discovery NEVER emits the six-section artifacts. **Left untouched.**
- **Health-safety fallback:** deterministic urgent-care response, pre-LLM. **Left untouched.**
- **LLM-unavailable / invalid / exception fallbacks:** return the rule-based base text. **Left untouched.**

## Root finding

The report feel was 100% in `_compose` formatting (presentation), plus one prompt-level over-restriction that made health requests refuse (separate, see ARCANA*DOMAIN_STYLE_GUIDE.md). The LLM's structured reasoning itself is sound and validator-gated; only its \_rendering* was wrong.

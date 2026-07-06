# ONTOLOGY_USAGE_AUDIT.md — Phase 3

## Verdict: the advisor does NOT use an ontology/concept layer.

Domain selection is the **keyword router** (`route_domains`) — whole-word matching to {finance, career, education, health, family, documents}. There is no concept expansion, no taxonomy traversal, no ontology registry in the advisor path.

## What the spec wanted vs reality

| Expected ontology chain                                                                    | Reality                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fitness → health → training → injury constraints → recovery → nutrition → medical boundary | Routes to **health** (correct domain), then loads health facts + injury facts IF they exist as rows; the "chain" is not an ontology traversal — it's whatever health facts + graph edges exist. Medical boundary IS enforced (advice gate / caveat). |
| Promotion → career → compensation → skill gaps → education → finance → home/family         | Routes to **career** (+finance via keywords); cross-domain links come from **personal_graph edges**, not an ontology. Verified live (promotion→home context).                                                                                        |
| Estate → family → guardianship → will → trust → beneficiary → life insurance → survivor    | Routes to **family**; the related concepts surface only as **facts/edges that exist**, not an ontology expansion.                                                                                                                                    |
| Education → ROI → career → time cost → funding → family timeline                           | Routes to **education**; ROI/funding come from `education.*` facts + the decision engine, not ontology.                                                                                                                                              |

## The nuance

The "ontology-like" behavior the product shows comes from **two real mechanisms**, not an ontology:

1. **personal_graph edges** — actual persisted relationships between the user's goals/objectives (cross-domain links).
2. **The keyword router** — maps a message to the right domain(s) so the right facts load.

So cross-domain reasoning happens via **real graph edges**, which is arguably better than ontology inference (no fabricated concept links — the validator rejects any relationship not in the real graph). But it is **not** a domain ontology, and it won't expand "knee arthritis" → "low-impact modifications" unless that's a stored fact or the LLM supplies it from general knowledge.

## Classification

Ontology layer: **NOT WIRED** (by design). Adding an ontology engine is explicitly out of scope. The graph-edge mechanism is the de-facto relationship layer and it works + is validator-gated.
</content>

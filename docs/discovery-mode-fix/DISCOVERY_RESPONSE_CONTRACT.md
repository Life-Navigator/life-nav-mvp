# Discovery Response Contract (Step 5)

**Date:** 2026-06-16 · The strict style contract for onboarding/discovery turns (`/v1/life/discovery/chat` and `/stream`). Enforced structurally (discovery mode skips the advisor composition) and guarded by a tripwire (`discovery_contract_violations`).

## The contract

A discovery turn MUST contain at most:

- **one short reflection** (echoing the user's own words), and
- **one natural question.**

A discovery turn MUST NOT contain:

- section headers — `**The tradeoffs:**`, `**What we know:**`, `**My read:**`, `**What would change this:**`
- bullet-list analysis (no bullets unless absolutely necessary)
- a recommendation / decision frame
- tradeoff analysis
- the advice disclaimer ("…not personalized financial, legal, or tax advice … licensed professional") — unless safety-critical
- internal graph/ontology terms ("node", "edge", "primary_objective", "ontology", "lineage", …)
- the phrase "your primary objective is …" or any inferred/candidate goal stated as a confirmed fact

> Arcana should sound like a thoughtful relationship manager, not an audit report wearing cologne.

## Enforcement

| Layer                           | Mechanism                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Structural (primary)**        | In `mode="discovery"`, the orchestrator returns the `RelationshipManager` reply verbatim and **skips `_enhance`/`_compose`** — the only code paths that emit sections, disclaimer, or fact-assertion. So the forbidden content is _never generated_ in discovery.        |
| **Tripwire (defense-in-depth)** | `discovery_contract_violations(text)` (`advisor_orchestrator.py`) scans for the forbidden markers; `_enforce_discovery_contract()` logs a `discovery_contract_violation` warning + records it on the turn trace if any ever appear. Non-mutating; never breaks the turn. |
| **Tests**                       | `test_discovery_*` assert zero violations on discovery turns and that the markers DO appear in advisor mode (so the tripwire is meaningful).                                                                                                                             |

## Allowed exception

- **Safety-critical content always wins:** the deterministic health urgent-care response (911/ER/988) is emitted before discovery mode returns, in every mode. That is the only case where discovery yields non-conversational, directive text — by design.

## Examples

**BAD (advisor mode leaking into onboarding):**

> **My read:** Your primary objective is Reach financial independence. **The tradeoffs:** … **What we know:** … **What would change this:** … _…not personalized financial, legal, or tax advice…_

**GOOD (discovery mode):**

> It sounds like financial independence may be important to you — when you picture that, do you mean work becoming optional, retiring early, or simply feeling secure?

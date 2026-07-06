# FAILED_HEALTH_CONVERSATION_REPLAY.md — Phase 7

## The conversation

> **User:** body recomposition, weekly training plan, knee arthritis, shoulder injury, TRT supervised by provider, HIIT, martial arts, swimming.

## Retrieval (verified)

- **Routing:** `route_domains(msg)` → `['health']` only. No finance.
- **Facts loaded:** health facts + (for the orchestrator) all-domain facts available for cross-domain context; the `agent_domains=['health']` hint focuses the answer.
- **Graph:** personal_graph edges available (cross-domain context only if a real edge exists).
- **Citations:** provenance-carrying facts attach to the response (`citations[]`).

## Live Arcana response (prod)

> "…how to safely and effectively pursue your **health and fitness goals**, particularly given your existing **medical conditions**… **professional medical and fitness guidance**… tailored to your **knee arthritis, shoulder injury, and TRT**, minimizing risk of further injury…"

| Requirement                                                           | Result                                         |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| Routes to health/fitness                                              | ✅                                             |
| Retrieves injury constraints (knee/shoulder) + TRT + medical boundary | ✅ named in the answer                         |
| Related family/career only as context, not derailment                 | ✅ no derailment                               |
| Safety caveats / medical boundary                                     | ✅ "professional medical and fitness guidance" |
| NOT a finance pivot / credit cards / cash flow                        | ✅ zero finance leak                           |

## Honest residual (separate P0, not this sprint)

The answer is correct + in-domain + safe, but still **phrased report-style** ("The decision is… / The tradeoffs:…") rather than a natural weekly-plan chat with progression/modifications. That phrasing originates in `advisor_orchestrator.py` (formats the 6-section LLM JSON into "**The tradeoffs:** / **What we know:**" markdown). **That is the Structured-Response-Rendering P0** — out of scope for this GraphRAG-verification sprint, but it's the next high-leverage fix to make the _retrieved_ intelligence read like an advisor, not a report.

## Verdict

Retrieval + routing + grounding + safety: **correct and verified**. Presentation: still report-style (separate, known P0).
</content>

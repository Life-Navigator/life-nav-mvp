# FAILED_CONVERSATION_REPLAY.md

## The exact failed conversation

> **User:** "Can you build me a weekly training plan? I have knee arthritis and a shoulder injury, I'm on TRT with my medical provider, and I do HIIT, martial arts, and swimming."

## Before the fix (routing)

`route_domains(msg)` → would mis-route: "training" unlisted, "work"-style substring collisions, and the multi-symptom message fell toward the finance-biased fallback → Arcana redirected to credit cards / down payments / cash flow. **Trust-destroying.**

## After the fix

### 1. Router (unit)

`route_domains(msg)` → **`['health']`** (only). No finance.

### 2. Live Arcana (prod, real user, `/v1/life/advisor/chat`)

Reply (excerpt):

> "The decision is how to safely and effectively pursue your **health and fitness goals**, particularly given your existing **medical conditions** and current activities… **Seeking professional medical and fitness guidance** — Ensures your training plan is safe… tailored to your **knee arthritis, shoulder injury, and TRT**, minimizing risk of further injury…"

| Check                                                            | Result                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Stays in health/fitness                                          | ✅ training, fitness, knee arthritis, shoulder injury, TRT    |
| Medical caveat present                                           | ✅ "professional medical and fitness guidance", "specialists" |
| Finance leak (credit card / down payment / mortgage / cash flow) | ✅ **none**                                                   |

## Verdict

The failed conversation is fixed: Arcana stays in health/fitness advisor mode and gives a safe training-plan response with medical caveats. No redirect to finance.

_(Separate, out-of-scope note: the reply is still phrased as a "decision/tradeoffs" structure — that's the Structured-Response-Rendering P0, not routing.)_
</content>

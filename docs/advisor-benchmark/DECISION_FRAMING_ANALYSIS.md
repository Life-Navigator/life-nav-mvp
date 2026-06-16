# Decision Framing Analysis

**Did it structure the decision?**

|            | LifeNavigator |  Claude | ChatGPT |
| ---------- | ------------: | ------: | ------: |
| Avg (0–10) |           4.5 | **8.6** |     6.4 |

## Read — the most surprising loss

The P0 sprint **specifically upgraded decision framing** (P0.3), and the prior eval showed framing on every probe. Yet head-to-head LN scores **4.5 vs Claude's 8.6** (−4.1). The reason is a definition gap:

- **LifeNavigator's "framing" is one sentence:** it _names_ the decision and _names_ that a tradeoff exists ("This is a classic tradeoff between a fulfilling individual-contributor role and… management"), then asks a question. It announces the decision; it doesn't _structure_ it.
- **Claude's framing is a map:** it lays out the decision **and** enumerates the axes — "Reasons to take it / Reasons against," "What's working in your favor / What to verify," time-phased steps. The user can see the whole decision surface at once.
- **ChatGPT** frames in compressed lists ("VP path: more income, more influence, more travel, more politics / Director path: more balance, more family time") — less rich than Claude but more structured than LN.

## Why the P0 win didn't transfer

The P0 framing eval measured _whether LN frames vs deflects_ (a real, fixed problem). This benchmark measures _how richly it frames vs the best alternative_. LN cleared the first bar and is far below the second. Naming a tradeoff ≠ structuring the decision.

## Implication

Framing is supposed to be LN's signature move and it is currently **thin**. The fix is not architectural: the advisor should output the **decision structure** (the 2–4 variables that decide it, each option's pull) before/around its question — which it already half-does internally in the P0 "reason before asking" sequence but does not surface. Surface the reasoning. See `ADVISOR_V2_ROADMAP.md` (P0).

# Tradeoff Discovery Analysis

**Did it identify competing priorities?**

|            | LifeNavigator |  Claude | ChatGPT |
| ---------- | ------------: | ------: | ------: |
| Avg (0–10) |           4.3 | **7.4** |     5.4 |

## Read

LifeNavigator's second-weakest dimension (−3.1 vs Claude). It _gestures_ at tradeoffs but rarely _discovers_ them:

- **LifeNavigator** typically references a single, generic tension ("balancing using your cash… against your reserves") and stops. One tradeoff, named abstractly.
- **Claude** enumerates the **real competing priorities** specific to the situation: cushion vs. down-payment size, security vs. equity upside, caregiving income loss vs. professional-care cost, concentration risk vs. capital-gains tax. It names multiple, concretely, with the user's numbers attached.
- **ChatGPT** surfaces some tradeoffs in list form but fewer and shallower than Claude.

## Example (fin-11, concentrated stock)

- Claude reframes the tension as a decision test — "If I had cash today, would I invest 45% of my net worth in this stock?" — exposing the risk-vs-tax tradeoff viscerally.
- LN reflects the position and asks a question; the competing-priority structure is largely left implicit.

## Implication

Tradeoff discovery is the heart of advice, and it's where LN is thinnest relative to its self-image. Like framing, the internal P0 "tradeoffs" reasoning step exists but is **not surfaced** to the user. The model is doing the thinking and then hiding it behind a single question. See `ADVISOR_V2_ROADMAP.md`.

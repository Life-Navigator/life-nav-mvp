# Actionability Analysis

**Did the user leave smarter / with a clear next step?**

|            | LifeNavigator |  Claude | ChatGPT |
| ---------- | ------------: | ------: | ------: |
| Avg (0–10) |           3.2 | **8.7** |     6.0 |

## Read — this is the decisive gap (−5.5 vs Claude, the largest of any criterion)

Actionability is **why LifeNavigator won 0/50.** By design, the advisor frames the decision and asks one question and **does not advise** — so the user leaves with a question, not a next step.

- **LifeNavigator (3.2):** "the immediate priority is to understand your financial runway… [one question]." The user is not smarter about _what to do_; they've been asked to supply more input. On the 5 fallback turns, actionability is near zero.
- **Claude (8.7):** prioritized, often time-phased plans ("## This Week: 1. File for unemployment… 2. Review severance…"). The user leaves with concrete next steps.
- **ChatGPT (6.0):** crisp ranked action lists ("Preserve cash. Understand severance. File for unemployment…"). Less depth than Claude, but unambiguously actionable.

## This is a deliberate product stance, and it is the core problem

LifeNavigator's HARD RULE — _"never give final financial/legal/medical advice; identify missing inputs and gather them"_ — is the direct cause. The rule exists to protect trust. But the benchmark shows the cost is total: **users choose the tool that helps them act.** A safe non-answer loses to a grounded recommendation every time.

The fix is not "remove the guardrail and start hallucinating advice." It is to **let the advisor reason out loud to a recommendation built only from grounded inputs**, with appropriate hedges and "here's what would change this" — which is exactly what Claude does and what LN's validator already permits at the data level. The advisor is allowed to be grounded _and_ useful; right now it is only the former.

## Implication

**P0 fix.** Raise actionability from 3.2 toward competitive (7+) by having the advisor deliver, after its frame and question, a grounded "here's how I'd think about it / here's the likely path given what you've told me" — without asserting unprovable numbers. See `ADVISOR_V2_ROADMAP.md`.

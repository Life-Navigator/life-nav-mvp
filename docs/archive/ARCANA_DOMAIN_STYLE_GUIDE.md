# ARCANA_DOMAIN_STYLE_GUIDE.md — Phase 4

How Arcana should answer per domain, and the one prompt change that unblocked health.

## Health / Fitness — FIXED this sprint

Previously Arcana **refused** ("providing medical advice is outside my scope") on a training plan because the prompt's MEDICAL block was over-broad. Surgical prompt fix (advisor_llm.py):

- **ALLOWED:** general fitness/wellness coaching — training plan, progression, workout structure, recovery, sleep, general nutrition, tracking metrics. When an injury/condition is mentioned (knee arthritis, shoulder, TRT), give the plan + modifications (low-impact, pain-free range) + ONE brief "clear with your doctor/PT" caveat. **Never refuse a general training plan.**
- **STILL BLOCKED:** clinical medical advice only — diagnosing, prescribing/dosing a drug, naming a treatment, interpreting labs.
- Verified live: returns a phased plan with knee/shoulder modifications + provider caveat, `enhanced`, no refusal.

## Finance

Clear recommendation, the user's own numbers, affordability read, next step. Verified live ("$400k house… your liquid savings of $500…", conversational).

## Career

Promotion/career coaching, skill/comp context, suggested action. Verified live (promotion → conversational, cross-domain home context).

## Education

ROI framing, sequence (before/after), time/cost tradeoff — as prose, tradeoffs in the drawer.

## Family

Protection framing — estate/guardian/insurance/survivor implications + recommended next step. Verified live ("die tomorrow" / "having a baby" → conversational).

## Global style rules (all domains)

- Lead with the read; give substance directly; end with ONE question.
- No section headers, no inline disclaimer (UI footer covers compliance).
- Tradeoffs / evidence live in the expandable drawer, not the message.
- Numbers: only the user's own + safe derivations (unchanged guardrail).

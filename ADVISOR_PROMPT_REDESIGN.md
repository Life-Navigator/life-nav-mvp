# ADVISOR_PROMPT_REDESIGN.md — Phase 5

The advisor prompt was de-muzzled across prior sprints; this sprint adds the repair channel.

REMOVED (earlier): "avoid numbers", "do not calculate", blanket "ask first", excessive disclaimers, forced closing question.
PRESENT NOW: answer-first; use scenarios when assumptions are needed; LABEL estimates ("as a scenario, 20% of $500k is about $100,000"); benchmarks encouraged; cite/ground personal facts; never fabricate personal facts; never state a monthly payment/DTI without rate+term; hedged affordability reads instead of "you can afford".
ADDED (this sprint): a `repair_note` channel — when present, the model fixes only the flagged spans and returns the full JSON again ("revise if the validator flags issues").

Net: the model answers strongly first; the validator supervises; the repair note tells it exactly how to fix.

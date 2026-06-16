# LIOS Orchestrator Model Policy

How the (future) orchestrator selects a model per request. Provider-agnostic: it routes to a **capability
class**, the **model registry** resolves the class to the cheapest qualified model under the request's
constraints (see `MULTI_MODEL_ARCHITECTURE_BLUEPRINT.md`). The trust spine runs regardless of model.

## Selection function

```
select_model(task):
  class      = capability_class(task)              # classifier/advisor/finance/decision/critic/report/...
  candidates = registry.qualified_for(class)        # only models with a benchmark PASS for this class
  candidates = filter(candidates, by:
                 latency_ok(task.latency_budget),
                 cost_ok(task.cost_budget, user.tier),
                 compliance_ok(task.compliance_sensitivity))
  if task.risk == HIGH or task.confidence_required == HIGH or user.tier == ELITE:
      pick = highest_quality(candidates)            # premium path
  else:
      pick = cheapest_meeting_threshold(candidates, class.min_quality)   # cheapest acceptable
  return pick  with fallback_chain = [pick, balanced_default, fast_default, deterministic]
```

## The five selection modes

| Mode                    | When                                                | Pick                                               | Example                                           |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| **Cheapest acceptable** | low-stakes, free tier, latency-sensitive            | cheapest model ≥ class min-quality                 | classification → Flash-Lite; routine chat → Flash |
| **Highest quality**     | high-risk / elite / low-confidence / final sign-off | best benchmarked model for the class               | executive review → Opus                           |
| **Fastest safe**        | tight latency budget, acceptable quality exists     | fastest model ≥ threshold                          | interactive discovery → Flash                     |
| **Premium review**      | high-stakes decision or compliance-sensitive output | premium class + a critic pass                      | estate/retirement plan → Pro draft + Opus critic  |
| **Fallback**            | primary errors/unavailable/validator-rejects twice  | next tier down, ending in deterministic rule-based | Pro→Flash→deterministic opener                    |

## Signals the policy MUST consider

- **user_tier** → cost ceiling + whether premium models are even eligible (see User-Tier Policy below).
- **task_complexity** → class min-quality threshold (classification low; decision/advisor high).
- **domain** → per-domain best model (Pro everywhere measured; Opus only where its edge clears the cost bar).
- **risk_level** → HIGH routes to highest-quality + mandatory critic pass.
- **latency_budget** → interactive (<~30s) excludes Opus (61s); async/report has no limit.
- **cost_budget** → per-tier; blocks Opus on free tier; allows it on elite.
- **confidence_requirement** → low model confidence (or validator repair fired) → escalate one tier.
- **compliance_sensitivity** → health/legal/tax: keep deterministic guardrails + prefer the highest-trust model (Pro 8.7).

## Invariants (non-negotiable, model-agnostic)

1. Every output passes the **validator / number-gate / compliance** spine — proven to catch fabrication on
   every model (caught raw Claude's 3).
2. Models **never** compute final numbers — deterministic engines do; models explain/frame (number gate enforces).
3. A model may serve a class **only** if it holds a benchmark PASS for that class in the registry. No
   brand/recency/price-based assignment.
4. Fallback always terminates in the deterministic rule-based reply (never a blank or an error to the user).

## User-Tier Policy (sell outcomes, not model names)

| Tier      | Capability access                                                                                                | Typical routing                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Free**  | fast advisor, limited decision depth, basic (templated) reports                                                  | Flash-Lite (classification) + Flash (advisor/discovery); no premium escalation                 |
| **Plus**  | advisor-grade reasoning, scenario analysis, better reports, premium model **when justified** (high-stakes turns) | Gemini Pro (advisor/decisions/domains) + Flash (cheap steps); Opus only on flagged high-stakes |
| **Elite** | executive review, advanced reports, Opus-class review **when justified**                                         | Pro for interactive + Opus offline for critic/reports/executive review                         |

Users buy **outcomes and depth tiers**, never exposed model names — the registry/router can swap the
underlying model for any tier without changing the product surface or business logic.

# LifeNavigator Prompt Operating System (Prompt OS)

> The centralized, versioned prompt layer that future Gemini orchestration, multi-agent execution, and
> compliance review will compose from. **Prompt assets + specification only — no runtime wiring, no
> production behavior change, no Vertex, no Claude, no beta surfaces.** Every asset here is derived from the
> LIOS architecture and agent specs; if a prompt conflicts with those, the prompt is wrong.

Source of truth (an asset that contradicts these is a bug): `LIOS_ARCHITECTURE.md`,
`TRUTH_AND_PROVENANCE_MODEL.md`, `COMPLIANCE_AND_SAFETY_FLOW.md`, `PROMPT_OPERATING_SYSTEM_PLAN.md`, the
lifecycle docs, and `docs/lios-agent-specifications/*` (the 25 agent specs + 5 contracts).

---

## What this is

A prompt is never written by hand for a single agent. Every prompt is **composed** from layered, reusable
assets so behavior is consistent, grounded, testable, auditable, and safe. This directory holds those
assets.

## The 10-layer composition model

Every composed prompt is assembled in this order (no agent ever receives only a task prompt):

```
Layer 1  — Constitution            base/LIFE_NAVIGATOR_CONSTITUTION.md      (identical for every agent)
Layer 2  — Governance/Safety/      base/GOVERNANCE_RULES.md
           Provenance              base/SAFETY_RULES.md + base/PROVENANCE_RULES.md
Layer 3  — Subsystem Role          subsystems/<AGENT>_PROMPT.md
Layer 4  — Agent Specification     docs/lios-agent-specifications/<AGENT>_AGENT.md  (referenced, not duplicated)
Layer 5  — Domain Rules            domains/<DOMAIN>_PROMPT.md  (when domain-scoped)
Layer 6  — Task Instructions       tasks/<TASK>_TASK.md        (when a task is in play)
Layer 7  — Runtime Context Contract  the bounded context (Memory's prompt_dict) — a PLACEHOLDER here
Layer 8  — Output Schema           schemas/<X>_SCHEMA.md  (+ base envelope)
Layer 9  — Failure Rules           base + AGENT_FAILURE_BEHAVIOR.md
Layer 10 — Validator Expectations  what Compliance will check (so the agent self-conforms)
```

Cross-cutting assets that thread through several layers: `base/CONFIDENCE_RULES.md`,
`base/TOOL_USAGE_RULES.md`, `base/GRAPH_RAG_RULES.md`, `base/MEMORY_RULES.md`, `base/STYLE_GUIDE.md`.

## Directory map

```
base/         the inherited foundation (Layers 1, 2, 9, + cross-cutting)
subsystems/   per-role prompts (Layer 3) — one per LIOS agent
domains/      per-domain prompts (Layer 5)
tasks/        per-task prompts (Layer 6)
schemas/      output contracts (Layer 8)
examples/     full COMPOSED prompts (all 10 layers stitched, with placeholders)
validation/   coverage matrix, conflict audit, test plan
```

## The non-negotiables every asset inherits

Stated once in the Constitution, enforced in every layer:

- **The LLM is never the source of truth.** It reasons, summarizes, prioritizes, communicates. Truth comes
  from user-confirmed facts, documents, connected accounts, deterministic tools, and cited graph edges.
- No fabrication (numbers must be the user's; relationships need a real cited edge; recommendations need
  evidence). The LLM never persists. Compliance gates every user-facing output. Honest empty states.
  Provenance on every fact. Confidence is never vibes. No agent faces the user except the Response Composer
  after Compliance; no agent calls another directly (route via the Orchestrator).

## How to read an asset

Each asset begins with a header: its **layer**, its **source-of-truth** docs, and its **version**. The body
is the actual instruction text intended for composition (not a description of it). Runtime data is always a
clearly-labeled `{{ placeholder }}`, never fabricated.

## Status

Specification/asset phase. The next phase (Gemini-based orchestration) must not begin until this Prompt OS
is reviewed and accepted. See `validation/` for coverage, conflicts, and the test plan.

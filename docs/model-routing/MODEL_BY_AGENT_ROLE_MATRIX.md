# Model-by-Agent-Role Matrix

**Status:** Evidence-only. Every cell is labeled **[measured]** or **[inferred]**.
**Date:** 2026-06-16

Routes a candidate model to each _future agent role_. Where a role maps directly
onto something we benchmarked in-pipeline (advisor, domain explainers,
decision-making), the cell is **measured**. Where a role has no benchmark yet,
the cell is **inferred** and flagged for a harness.

---

## Measurement basis

- **Measured in-pipeline:** Flash, Pro, Opus (per-domain + overall scores; latency; cost; trust).
- **Measured offline ceiling (rawClaude):** highest raw quality (overall 8.00), strong on **actionability ~8.5** and **executive presence ~8.4**; **not a shipping in-pipeline config** — used to infer offline/batch roles.
- **NOT tested:** Flash-Lite (reachable, unbenchmarked), Sonnet, newer Claude, GPT (no creds), Nemotron (no access).
- **Trust is model-agnostic:** 0 fabrications across all in-pipeline models; trust band 8.2–8.7 (Pro highest at 8.7).

Key measured numbers reused below: Pro overall **7.60** / Cross-domain **8.27**;
Opus overall 7.30; Flash overall 6.66 (latency 12.7s, ~$0.003); Pro 26.5s ~$0.011;
Opus 61s ~$0.15.

---

## Agent-role routing matrix

Columns are candidate models. The **Recommended** column gives the route; each
cell carries **[measured]/[inferred]** + a 1-line reason.

| Agent role                                                   | Flash     | Flash-Lite | Pro         | Opus               | rawClaude (offline) | **Recommended**                    | Basis    | Reason                                                                                                                                   |
| ------------------------------------------------------------ | --------- | ---------- | ----------- | ------------------ | ------------------- | ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Classifier** (route/triage intent)                         | candidate | candidate  | overkill    | overkill           | n/a                 | **Flash-Lite → Flash**             | inferred | Cheap, fast, low-reasoning task; Flash-Lite cheapest but untested → fall back to Flash (12.7s, ~$0.003) until benchmarked.               |
| **Advisor** (lead conversational counsel)                    | weak      | n/a        | **best**    | costly             | ceiling             | **Pro**                            | measured | Pro wins overall (7.60) + highest trust (8.7); Opus's marginal wins don't justify ~14x cost / ~2.3x latency.                             |
| **Finance-explainer**                                        | weak      | n/a        | **default** | marginal +0.26     | ceiling             | **Pro** (Opus optional escalation) | measured | Opus 6.99 vs Pro 6.73 is marginal; Pro is the cost/latency-sane default.                                                                 |
| **Family-explainer**                                         | weak      | n/a        | **default** | marginal +0.08     | ceiling             | **Pro** (Opus optional escalation) | measured | Opus 8.22 vs Pro 8.14 is within noise; Pro at 8.14 is excellent and far cheaper.                                                         |
| **Career-explainer**                                         | weak      | n/a        | **best**    | behind             | ceiling             | **Pro**                            | measured | Pro 7.52 beats Opus 7.36 and Flash 6.46.                                                                                                 |
| **Education-explainer**                                      | weak      | n/a        | **best**    | weakest            | ceiling             | **Pro**                            | measured | Pro 7.24 beats Opus 6.06 by 1.18; Opus underperforms here.                                                                               |
| **Decision-engine** (weigh options / cross-domain synthesis) | weak      | n/a        | **best**    | behind             | ceiling             | **Pro**                            | measured | Cross-domain is Pro's top score (8.27), beating Opus 7.57 and raw 8.20.                                                                  |
| **Critic** (adversarial review of a draft)                   | n/a       | n/a        | viable      | **best (offline)** | basis               | **Opus**                           | inferred | Offline/batch, not latency-bound; raw quality ceiling (8.00) + actionability ~8.5 suit deep critique.                                    |
| **Report-writer** (long-form synthesis)                      | n/a       | n/a        | viable      | **best (offline)** | basis               | **Opus**                           | inferred | Offline; rawClaude actionability ~8.5 / exec-presence ~8.4 point to top-tier prose; 61s latency acceptable in batch.                     |
| **Executive-review** (board/exec-facing summary)             | n/a       | n/a        | viable      | **best (offline)** | basis               | **Opus**                           | inferred | Offline; executive-presence ~8.4 is the deciding signal; not interactive so latency is fine.                                             |
| **Document-intel** (extract/structure documents)             | candidate | candidate  | likely      | n/a                | n/a                 | **Pro**                            | inferred | NOT BENCHMARKED — needs a harness; default to proven all-domain winner; consider Flash/Flash-Lite for cheap bulk extraction once tested. |
| **GraphRAG-synth** (synthesize over retrieved graph)         | weak      | n/a        | likely      | n/a                | n/a                 | **Pro**                            | inferred | NOT BENCHMARKED — needs a harness; synthesis quality matters → start from Pro (top cross-domain synth score).                            |

---

## Summary of routes

- **Interactive / in-pipeline roles → Pro** _(measured):_ Advisor, all four
  domain explainers, Decision-engine. Pro is the all-domain winner, highest trust,
  and cost/latency-sane.
- **Offline / batch quality roles → Opus** _(inferred):_ Critic, Report-writer,
  Executive-review — chosen from rawClaude's offline ceiling (actionability ~8.5,
  exec-presence ~8.4); 61s latency is acceptable off the interactive path.
- **High-volume / low-reasoning → Flash-Lite/Flash** _(inferred):_ Classifier.
- **Not benchmarked → Pro placeholder + harness required** _(inferred):_
  Document-intel, GraphRAG-synth.

## Caveats

- **Opus for offline roles is inferred from rawClaude**, the _offline ceiling_, not
  from Opus's in-pipeline scores (Opus in-pipeline is 7.30 overall, below Pro). The
  inference assumes the un-pipelined quality signal transfers to offline use; this
  is **not yet measured** for these specific roles and should be validated.
- **Flash-Lite is reachable but untested** — do not ship it to Classifier or
  Document-intel without an in-pipeline benchmark.
- **Sonnet, newer Claude, GPT, Nemotron are not options** here (not enabled / no
  creds / no access); none can be routed until enabled and benchmarked.
- **Trust is model-agnostic** (0 fabrications across measured models) — role
  routing optimizes quality/cost/latency, not fabrication risk, which the trust
  spine handles.

## Open items (inferred → measured)

- Harness for **Document-intel** and **GraphRAG-synth** (currently NOT BENCHMARKED).
- Validate **Opus offline** quality for Critic/Report-writer/Executive-review against rawClaude assumption.
- Benchmark **Flash-Lite** before using it for Classifier or bulk Document-intel.

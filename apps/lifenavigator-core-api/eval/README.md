# Advisor evaluation harness

Dev and CI tooling. **Not in the live request path** — it imports the production services and calls
them with fixtures. No router touches it, nothing in `dependencies.py` constructs it, and deleting
this directory leaves production byte-identical.

## Run it

```bash
cd apps/lifenavigator-core-api
python -m eval.run                   # gate + routing — free, offline, no credentials. CI runs this.
python -m eval.run --probe gate
python -m eval.run --save-baseline   # freeze current state as the comparison point
python -m eval.run --json out.json
```

Exit `0` = no regression (UNMEASURED included — nothing checked is not a failure). Exit `1` = a rate
regressed, or a baseline is incomparable.

## The two layers

|              | `apps/web/advisor-eval.mjs`              | this harness                            |
| ------------ | ---------------------------------------- | --------------------------------------- |
| Measures     | the deployed system, end to end          | one pipeline stage at a time            |
| Answers      | "is production trustworthy?"             | "did this change help, and what moved?" |
| Needs        | a deployment, prod Supabase, model spend | nothing                                 |
| Runs         | manually                                 | every PR                                |
| Touches prod | yes — creates ~13 real users             | no                                      |

Both are needed. The live one is acceptance; this one is attribution.

## Probes

| Probe       | Stage                                                        | Cost                        | State                          |
| ----------- | ------------------------------------------------------------ | --------------------------- | ------------------------------ |
| `gate`      | `advisor_validator.validate()`                               | free                        | **measured**                   |
| `routing`   | `classify_domain` / `classify_risk` / `detect_health_urgent` | free                        | **measured**                   |
| `model`     | `generate()` via record/replay (`replay.py`)                 | $ to record, free to replay | machinery ready, no recordings |
| `retrieval` | `SemanticGraphRAG.retrieve()`                                | needs Neo4j+Qdrant          | **UNMEASURED — needs labels**  |

## Two rules that make the output mean something

**1. Trust and quality are never averaged.**

- `under_block_rate` — a fabricated personal figure reached the user. **Trust failure.**
- `over_block_rate` — a legitimate answer was blocked or redacted. **Quality failure.**

A gate that blocks everything scores perfectly on trust and is useless; one that passes everything
scores perfectly on quality and is dangerous. There is deliberately no overall score.

**2. UNMEASURED never looks like a pass.** A probe with no fixtures, or with cases it cannot score,
reports `UNMEASURED` — not `0 failures`. An unlabelled case is `refused` and excluded from both
rates. (This harness reported "over-block 100%" for four unlabelled stubs before that distinction
existed — a damning and entirely fictional number.)

## Known divergences

Cases labelled with what the trust policy _intends_, where the code currently differs. They run,
they appear in the scorecard, they do **not** fail CI. Deleting the annotation is how you declare one
fixed — the case failing afterwards is then a real regression.

Currently: one gate over-block (a trailing unrelated possessive clause), three routing collisions
(`insurance`/`premium` shared between health and finance; `loan`/`debt` owned by finance ahead of
education; finance vocabulary missing bare `cash`/`position`).

## What this harness found when first run

- **Four misses in the health-urgent safety net** — a deterministic, must-be-100% gate.
  `"my face is drooping and my speech is slurred"`, `"my speech is slurred"`, `"the left side of my
face is numb"` and `"I cannot breathe"` all returned `None`. The patterns matched only clinical
  noun phrases, and `can'?t` never matched `cannot`. Fixed; now 7/7 with precision pinned.
- **Risk classification broken by formatting** — `$450,000` scored LOW while `$450000` scored HIGH,
  because a leading `\b` cannot match before `$` and a thousands separator breaks `\d{4,}`. So
  half-million-dollar decisions took the fast, unsupervised path. Fixed.
- **The retrieval eval set `fly.toml` demands does not exist**, which is why
  `GRAPH_GROUNDING_ENABLED` could never be flipped on evidence.

## Labelling the retrieval set (the remaining work)

`fly.toml` gates graph grounding on "a measured win on the retrieval eval set". The runner exists;
the labels do not, and they cannot be generated — if the system could decide what was relevant there
would be nothing to measure.

For each case in `fixtures/retrieval_cases.json`: pick a real beta user, run the query, read the
edges returned, record the ids that genuinely answer it in `relevant_edge_ids`, record ids that must
**not** come back in `irrelevant_edge_ids` (this is what stops a dragnet retriever scoring perfect
recall while flooding the prompt at Opus input rates), then set `labelled: true`. ~20–30 cases across
domains detects a real regression; 5 does not.

Note `retrieval.provenance-carrying-edges-only` cannot pass until SP-010 populates provenance — 0 of
3,208 edges carry it today, and the advisor may only cite what it can trace.

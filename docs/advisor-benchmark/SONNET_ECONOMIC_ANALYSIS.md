# Sonnet Economic Analysis (Workstream I)

**Status: live run PENDING — Claude Sonnet is not yet enabled in Vertex Model Garden on the LifeNav project**
(`claude-sonnet-4-5` returns 404, exactly as Opus did before you enabled it). The 20-scenario Sonnet run is
ready to execute the moment Sonnet is enabled (same one-click Model Garden step you used for Opus). This doc
gives the methodology + a pricing-and-capability **estimate** to be confirmed by the live run.

Trigger condition met: **Opus beat Gemini** (Claude V6 7.30 > Gemini V6 6.66), so the Sonnet comparison is warranted.

## How to run it (ready)

1. Enable **Claude Sonnet 4.5** in Model Garden for project `gen-lang-client-0849161409` (global).
2. `flyctl secrets set USE_VERTEX_CLAUDE=true ADVISOR_MODEL=claude-sonnet-4-5@20250929 VERTEX_PROJECT=gen-lang-client-0849161409 VERTEX_REGION=global VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token)`
3. Run a 20-scenario subset of `benchmark-capture-ln.mjs` (or full 50), score with the same 5 judges, then `flyctl secrets unset` to revert to Gemini.

## Measured anchors (from this program)

| Model                 | Overall (LN pipeline) | Latency p50 | Est. cost/turn |
| --------------------- | --------------------: | ----------: | -------------: |
| Gemini-2.5-flash      |                  6.66 |       12.7s |        ~$0.003 |
| Claude Opus 4.1       |                  7.30 |         61s |    ~$0.12–0.18 |
| **Claude Sonnet 4.5** |         **(pending)** | est ~20–30s |     est ~$0.02 |

## Estimate (public list pricing; per ~3.5k-in / 0.7k-out advisor turn)

| Model             | $/M in | $/M out |  Est $/turn | vs Gemini | vs Opus |
| ----------------- | -----: | ------: | ----------: | --------: | ------: |
| Gemini-2.5-flash  |  ~0.30 |   ~2.50 |     ~$0.003 |        1× |   0.02× |
| Claude Sonnet 4.5 |     ~3 |     ~15 |     ~$0.021 |       ~7× |  ~0.15× |
| Claude Opus 4.1   |    ~15 |     ~75 | ~$0.12–0.18 |   ~40–50× |      1× |

## Quality-per-dollar (the decision metric)

- **Gemini:** 6.66 quality at ~$0.003 — unbeatable $/point, but quality-capped at 6.66.
- **Opus:** 7.30 at ~$0.15 — **+0.64 quality for ~50× the cost.** Poor $/point; justified only on high-stakes,
  low-frequency turns.
- **Sonnet (estimated):** Anthropic positions Sonnet 4.5 near Opus on many reasoning tasks at ~⅕ the cost and
  ~2–3× the speed. **If** Sonnet lands at ~7.0–7.2 in the LN pipeline (plausible, UNCONFIRMED), it would be the
  **best quality-per-dollar** of the three for the advisor role: ~+0.4–0.5 over Gemini at ~7× cost (vs Opus's
  ~+0.64 at ~50×), and ~2× faster than Opus.

## Provisional recommendation (to confirm with the live run)

- **Sonnet is the most likely production sweet spot for the advisor turn** if quality must rise above Gemini's
  6.66 ceiling without Opus's latency/cost. Confirm with the 20-scenario run before committing.
- **Opus** stays reserved for the highest-stakes, latency-tolerant roles (decision analysis, executive review,
  critic) where the last +0.2–0.3 over Sonnet is worth the premium.
- **Gemini** remains the default for high-frequency, low-stakes, latency-sensitive turns (discovery,
  classification, the bulk of interactive chat).

**Do not commit Sonnet to production on this estimate alone — run the benchmark first.** Numbers here are
list-price estimates, not measured.

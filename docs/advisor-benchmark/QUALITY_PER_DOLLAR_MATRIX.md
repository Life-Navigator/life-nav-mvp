# Quality-Per-Dollar Matrix (Workstream D)

Benchmarked configs only (LN pipeline). Cost is an estimate from public list pricing at ~3.5k-in/0.7k-out per
turn (tokens not captured per-turn in the harness; flagged as estimate). Latency is measured (p50).

| Model                             |  Quality |   Trust | Latency p50 | Est $/turn | **Quality / $** | Quality / sec | Trust / $ | Clears 7.5? |
| --------------------------------- | -------: | ------: | ----------: | ---------: | --------------: | ------------: | --------: | :---------: |
| Gemini 2.5 Flash                  |     6.66 |     8.5 |       12.7s |    ~$0.003 |      **~2,220** |          0.52 |    ~2,830 |     ❌      |
| **Gemini 2.5 Pro**                | **7.60** | **8.7** |       26.5s |    ~$0.011 |        **~691** |          0.29 |      ~791 |     ✅      |
| Claude Opus 4.1 (in-pipeline)     |     7.30 |     8.2 |         61s |     ~$0.15 |             ~49 |          0.12 |       ~55 |  ❌ (7.30)  |
| Claude Sonnet 4.5 (est, untested) |    ~7.2? |       ? |    ~20–30s? |    ~$0.021 |           ~343? |             ? |         ? |      ?      |

## Rankings

**Best raw quality-per-dollar:** Gemini Flash (~2,220) — but it does **not** clear the 7.5 gate, so it wins on
efficiency only for low-stakes roles.

**Best quality-per-dollar _that clears the gate_:** **Gemini 2.5 Pro (~691).** It is the efficiency frontier
for advisor-grade quality — ~14× better quality-per-dollar than Claude Opus while scoring **higher** in the
pipeline (7.60 vs 7.30) and faster (26.5s vs 61s).

**Worst quality-per-dollar:** Claude Opus (~49) — ~14× costlier per quality point than Gemini Pro, for _lower_
in-pipeline quality. Opus only earns its cost on offline/premium tasks where its raw actionability (8.5) is the
deciding factor.

## The decisive economics

- Switching **Flash → Pro** buys **+0.94 quality (6.66→7.60, clearing the gate)** for **~+$0.008/turn** (~4×
  a trivial absolute cost). Outstanding ROI.
- Switching **Pro → Opus** would **lose 0.30 quality** and **multiply cost ~14×** and **latency ~2.3×**. Negative ROI for the advisor role.
- **Sonnet** is the one open question: if it lands ~7.2–7.4 at ~$0.021, it sits between Pro and Opus on cost
  but is unlikely to beat Pro's quality-per-dollar for the advisor role. Worth testing for the _premium/offline_
  tier (cheaper than Opus), not to displace Pro.

## Conclusion

**Gemini 2.5 Pro is the quality-per-dollar winner for advisor-grade work.** Flash stays for cheap
high-frequency roles; Opus is reserved for premium offline reasoning where money is no object. The economics
strongly favor an all-Google default (Flash + Pro) with Claude as a selective premium escalation — not a
Claude-centric advisor.

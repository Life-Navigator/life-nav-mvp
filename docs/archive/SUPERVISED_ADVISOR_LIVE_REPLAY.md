# SUPERVISED_ADVISOR_LIVE_REPLAY.md — Phase 11

Live prod (Vertex Gemini 2.5 Pro via WIF), real owner context, supervised loop:

| Prompt                                          | Result                     | Latency |
| ----------------------------------------------- | -------------------------- | ------- |
| Can I afford a $500k home with $60k saved?      | ✅ **ENHANCED** (repaired) | 59s     |
| Build a workout & nutrition plan for my wedding | ✅ ENHANCED                | 37s     |
| What happens if I die tomorrow? (no will)       | ✅ ENHANCED                | 29s     |
| Start the UT AI master's before buying a house? | ✅ ENHANCED                | 38s     |
| We're having a baby in 5 months                 | ✅ ENHANCED                | 33s     |
| I got promoted to director at $185k             | ✅ ENHANCED (repaired)     | 77s     |

**6/6 ENHANCED** — including the affordability prompt that previously fell back every time. Strong model answer → validator catches real issues → guided repair → safe answer. No dumb fallback, no fabricated numbers, compliance invisible. (Latency higher on repaired turns — the honest tradeoff; streaming masks it.)

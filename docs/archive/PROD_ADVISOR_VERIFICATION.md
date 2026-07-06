# PROD_ADVISOR_VERIFICATION.md — live in-machine API verification (2026-06-25)

Verified the REAL production advisor pipeline (auth → context → WIF → Vertex Gemini 2.5 Pro → validator → compose), using a short-lived JWT minted + used **inside the Fly machine** (token never left the machine / never printed).

## Results

| Prompt                                                           | Result          | Notes                                                        |
| ---------------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| Estate ("die tomorrow, no will")                                 | ✅ **enhanced** | real Gemini 2.5 Pro answer                                   |
| Workout/nutrition (wedding)                                      | ✅ **enhanced** | concrete plan                                                |
| Finance affordability ("$140k income, $60k saved, $500k house?") | ⚠️ **fallback** | trust gate blocks model's unlabeled benchmark $              |
| Finance — Claude Opus 4.8 (single-shot)                          | ⚠️ fallback     | **same** gate block — not a model fix                        |
| Auth / WIF / provider+model metadata                             | ✅              | provider=vertex_gemini, model=gemini-2.5-pro, no key         |
| Finance canonical-summary, readiness                             | ✅ 200          | real data (owner has sparse data: net_worth 0, readiness 28) |

## Two fixes shipped this session (from the live diagnosis)

1. **Vertex client timeout 45s→120s** — Gemini 2.5 Pro advisor JSON takes ~30-90s; 45s caused ReadTimeout→fallback.
2. **NUMBERS rule 6 (mortgage/loan)** — forbid fabricating a specific monthly payment / DTI without rate+term. Verified: the invented `$3,267/mo` payment and `28%` DTI are **gone** after this.

## Remaining residual (safe, documented)

Home-affordability still falls back **intermittently** on `100000` (20% of $500k) + closing-cost figures: the model writes these benchmark-of-stated-price numbers without reliably labeling them as scenarios / supplying derivations, so the trust gate (correctly) rejects them. Key points:

- **It is SAFE**: the gate is the trust spine working — no fabricated number reaches the user; they get a safe deterministic reply.
- **Not a model problem**: both Gemini 2.5 Pro and Claude Opus 4.8 hit it.
- **The bulk works**: estate, workout, promotion, new-child, education enhance in prod.

## Cleanest next fix (owner's call — NOT done, trust-surface tradeoff)

Let the derivation verifier **auto-accept a blocked $ figure when it equals a grounded user number × a standard benchmark % (20% down, 2-5% closing, etc.)** — so down-payment/closing math passes without depending on the model to label it. Bounded (must match a grounded base × a known %), but it widens the gate slightly. Recommend reviewing before shipping.

## Status: production advisor VERIFIED working for the bulk of domains; finance-affordability conservatively (safely) falls back — known residual, fixes scoped.

# FINANCE_HEALTH_MODEL_VALIDATION.md

Both ran live on the **same** verified Vertex path (`vertex_gemini` / `gemini-2.5-pro`). The path is proven; answer quality is mixed and the causes are precise.

## Finance — ⚠️ model answer is GOOD but the number gate blocks it

**Prompt:** "I make $140k and have $60k saved. Can I afford a $500k house?"
**Outcome:** `llm_status=fallback:invented numbers not in context: ['100000', '5']` → user got the generic deterministic reply.

**What the model actually produced (verbatim, then discarded):**

> "Given these numbers, buying a $500,000 house right now looks like a significant stretch. Your $60,000 in savings would cover a **12% down payment**, but a conventional 20% down payment to avoid PMI is **$100,000**. More critically, after adding closing costs (which are often **2-5%** of the home price), you would likely use up your entire savings… leaving you with no emergency fund…"
> next_question: "Of your $60,000 in savings, how much would you want to keep as a non-negotiable cash cushion…?"

**Why it fell back (correctly, by policy):** `allowed_numbers = {140, 140000, 500, 500000, 60, 60000}`. The model wrote `100000` (20% of $500k) and `5` (closing-cost %) — **computed/benchmark figures about the user's specific purchase**, not user-stated and not in `derivations`. The personal-$ scope still gates these because they ARE personal-financial assertions. So the trust spine held — but it killed a genuinely excellent, concrete answer.

**This is the core remaining gap.** Finance advice is intrinsically _the user's money × benchmarks_ (20% down, 3-6 months, closing 2-5%), so "personal-$ only" scoping still blocks the most useful finance replies. The number gate is not the model's fault and not an auth issue — it's a deliberate trust tradeoff. Options (future, owner's call):

1. Allow clearly-labeled benchmark %/ratios even in a personal context (closer to the fabrication line — needs sign-off).
2. Prompt the model to state benchmark-derived $ qualitatively ("far more than your $60k") and never write the computed $ — but the prompt already says this and gemini-2.5-pro didn't comply here.
3. Accept finance falls back to deterministic until (1) is approved.

## Health — ✅ passed, but ⚠️ intermittent

**Prompt:** "How should I structure my week for better sleep and energy?"

- Attempt A: `fallback:contains advice/recommendation/medical-legal language` — the `_ADVICE` medical regex matched something in the reply.
- Attempt B (same prompt): `ok=True`, `enhanced` — a concrete, grounded answer (morning light 10-15 min, light/activity/fuel framework, tied to the user's stated goal).

**Cause:** model variance — when the reply strays into phrasing the `_ADVICE` regex treats as clinical (e.g. a supplement/dosing mention), the whole turn is blocked. Wellness coaching is allowed by design, so this is over-blocking on the unlucky generations.

## Net

- **Same verified Vertex path for both** ✅ (provider/model proven, no key, loud fallbacks).
- **Finance quality:** blocked by the number gate on the model's computed personal figures — consistent, and the strongest argument for either loosening the finance gate or trying Claude.
- **Health quality:** good when it passes, intermittently over-blocked by the medical-advice regex.
- Neither is an auth/routing failure.

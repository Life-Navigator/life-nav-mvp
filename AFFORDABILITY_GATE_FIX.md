# AFFORDABILITY_GATE_FIX.md — Phase 2 (implemented)

`advisor_validator._benchmark_derivation_ok(value, window, after, grounded)` — auto-accepts a blocked
$-figure ONLY if ALL hold:

1. equals a **grounded base × approved benchmark** (20% down · 2/3/4/5% closing · 3.5% FHA _only if "FHA" in sentence_ · 3-6× monthly expense reserve · 15% savings target), math within 2% tol;
2. base is in `allowed` (user-stated/verified) — `user_values(allowed)`;
3. percentage is from the approved list (no arbitrary %);
4. arithmetic verified;
5. NOT a possessive personal-holding claim (checked FIRST — "your net worth is $100k" still blocks);
6. window has NO prohibited claim (`mortgage payment|monthly payment|loan payment|DTI|debt-to-income|tax bill|retirement probability|success rate|readiness|you can afford|you qualify|approved`) and the figure isn't a `$/month` amount;
7. passing figures recorded in `safe["benchmark_derived"]` (metadata: benchmark-derived scenario, not proven data).

Also: `DTI`/`readiness` added to money cues; definitive affordability **verdicts** ("you can/qualify/approved") blocked in the advice gate. No broad regex bypass; no arbitrary percentages; no math chains.

**Known limitation (honest):** the prohibited-claim check is whole-window, so a valid benchmark $ in the SAME dense sentence as "mortgage payment" is over-blocked; and multi-step loan balances (500k−100k) aren't covered (100k is itself derived). These keep the gate conservative — safe, but they leave the flagship "Can I afford" answer intermittently on fallback.

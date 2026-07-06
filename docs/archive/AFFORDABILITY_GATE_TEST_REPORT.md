# AFFORDABILITY_GATE_TEST_REPORT.md — Phase 3

`tests/test_affordability_gate.py` — **16 pass**; full suite **673 pass**.

**Should PASS (allowed):** 20% down on $500k=$100k · 2-5% closing on $500k=$10k–$25k · 3.5% FHA (FHA mentioned)=$17,500 · 6-month reserve on $8k=$48k · 15% savings on $140k=$21k.

**Should FAIL (blocked):** mortgage payment $3,267/mo · DTI 28% · tax bill $18,200 · retirement probability 85% · readiness 72% · arbitrary 27%→$135k · wrong math ($90k) · "your net worth is $100k" (possessive wins even though 100k=20%×500k) · "your balance is $100k" · verdicts "you can afford / you qualify / approved".

Trust spine intact: possessive personal claims and prohibited categories always block; only bounded benchmark-of-grounded-base figures relax.

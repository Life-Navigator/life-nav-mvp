# HEALTH_REPAIR_LOOP_VALIDATION.md — Phase 7

- **"Build me a workout and nutrition plan for my wedding"** → **ENHANCED** live (37s): full training/nutrition plan (macros, progression, recovery), no fallback.
- Allowed (gate + tests): training/nutrition plans, macros, progression, recovery, injury modifications, TRT under provider supervision.
- Blocked → repaired/removed (test_gate_refinement, \_ADVICE): medication dosing, "start/stop/adjust your medication", diagnosing ("I'll diagnose you"), prescriptions. On a clinical overreach the loop now asks the model to reframe as coaching + "clear it with your doctor", falling back only if it won't.

Coaching stays useful; clinical boundaries preserved.

-- 159 — Sprint 46 D2/D3: mark the orphaned legacy "truth" tables deprecated. public.goals and
-- public.risk_assessments are EMPTY (0 rows) and superseded by the canonical life.life_objectives /
-- life.risk_profiles. We don't DROP (preserve history / avoid FK surprises); we comment them as
-- deprecated so the canonical source is unambiguous. Bridge reads user_persona_profile, not these.
COMMENT ON TABLE public.goals IS 'DEPRECATED (Sprint 46): superseded by life.life_objectives (canonical). Empty; do not write.';
COMMENT ON TABLE public.risk_assessments IS 'DEPRECATED (Sprint 46): superseded by life.risk_profiles (canonical). Empty; do not write.';

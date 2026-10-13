-- ============================================================================
-- Calculation persistence + the answer cache (Milestone 3.6)
--
-- Nothing stored a computed figure before this, so every advisor turn recomputed everything from
-- scratch and nothing could be compared to anything. Three capabilities depend on it:
--
--   * PLAN VS ACTUAL — "in June we said you could retire at 62" is only answerable if June's
--     figures still exist. Recomputing today's answer and presenting it as June's is the specific
--     dishonesty this prevents.
--   * AUDIT — a figure the advisor stated six months ago must remain explainable, with the inputs
--     and the law-year it rested on.
--   * THE ANSWER CACHE — the same question, asked again, should re-run the CALCULATORS (cheap and
--     deterministic) and spend model tokens only if the numbers actually moved.
--
-- WHY THE FINGERPRINT HAS TWO HALVES
-- ----------------------------------
-- `inputs_fingerprint` covers the user's own facts. `basis_fingerprint` covers the LAW the figures
-- were computed on — the tax-table year actually used, the parameter year, and whether those were
-- verified. Both must match for a cached answer to be served. Without the second half, an answer
-- computed on the carried-forward 2024 tables would keep being served after the 2026 tables were
-- verified, quietly answering this year's question with last year's law.
-- ============================================================================

CREATE TABLE IF NOT EXISTS finance.calculation_snapshots (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at           timestamptz NOT NULL DEFAULT now(),
    -- What was computed, kept whole. The packet is the audit record: results with their tier and
    -- assumptions, determinations with their authority and tests, and the gaps that were named.
    packet               jsonb NOT NULL,
    -- Fingerprints. See the header: facts and law are tracked separately on purpose.
    inputs_fingerprint   text NOT NULL,
    basis_fingerprint    text NOT NULL,
    -- Denormalized for cheap trend queries without opening the packet.
    tax_year             integer,
    calculator_count     integer NOT NULL DEFAULT 0,
    treatment_count      integer NOT NULL DEFAULT 0,
    gap_count            integer NOT NULL DEFAULT 0,
    -- Which inputs were present when this was computed, so a later "why did this change?" can
    -- answer "because you added your cost basis" rather than only showing that it did.
    inputs_present       jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS calc_snapshots_user_idx
    ON finance.calculation_snapshots (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calc_snapshots_fingerprint_idx
    ON finance.calculation_snapshots (user_id, inputs_fingerprint, basis_fingerprint);

ALTER TABLE finance.calculation_snapshots ENABLE ROW LEVEL SECURITY;
-- Owner-readable: unlike advisor_turns this is the user's OWN financial picture, and "show me what
-- changed since June" is a feature, not diagnostics.
CREATE POLICY "calc_snapshots_owner_read" ON finance.calculation_snapshots
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "calc_snapshots_service" ON finance.calculation_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);


CREATE TABLE IF NOT EXISTS finance.answer_cache (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at           timestamptz NOT NULL DEFAULT now(),
    last_served_at       timestamptz,
    hit_count            integer NOT NULL DEFAULT 0,
    -- An EXACT normalized question, never a fuzzy match. A near-match that served the wrong
    -- answer would trade the product's trustworthiness for a token saving, which is never the
    -- right trade. The original text is kept so a miss is auditable.
    question_signature   text NOT NULL,
    question_text        text NOT NULL,
    answer               text NOT NULL,
    -- Both halves must match to serve. See the header.
    inputs_fingerprint   text NOT NULL,
    basis_fingerprint    text NOT NULL,
    -- The figures the answer asserted. If a recompute moves any of them the answer is stale even
    -- when the fingerprints somehow agree, so this is the belt to the fingerprint's braces.
    cited_numbers        jsonb NOT NULL DEFAULT '[]'::jsonb,
    model               text,
    UNIQUE (user_id, question_signature, inputs_fingerprint, basis_fingerprint)
);

CREATE INDEX IF NOT EXISTS answer_cache_lookup_idx
    ON finance.answer_cache (user_id, question_signature);

ALTER TABLE finance.answer_cache ENABLE ROW LEVEL SECURITY;
-- No owner policy at all: a cache entry is machine state, the user reads it only as a delivered
-- answer, and a client that could read the table could read another turn's prose.
CREATE POLICY "answer_cache_service" ON finance.answer_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON COLUMN finance.answer_cache.basis_fingerprint IS
  'The LAW the answer rested on (table year, parameter year, verified flags). Without it, an answer computed on carried-forward 2024 tables would keep being served after 2026 was verified.';
COMMENT ON COLUMN finance.answer_cache.question_signature IS
  'Exact normalized question. Never fuzzy — a near-match serving the wrong answer trades trust for tokens.';

-- ==========================================================================
-- 077: Central GraphRAG — ontology, provenance, sync routing
--
-- The "central" graph stores curated, sourced domain knowledge that
-- every user reasons over: employer-benefit taxonomies, insurance terms,
-- credential→role probabilities, health→productivity correlations, etc.
-- It is the cross-domain knowledge the AdvisorReasoningService joins
-- against the user's personal graph.
--
-- Storage tiers
-- -------------
-- Postgres (truth)            : tables in the new `central` schema below.
-- Neo4j (central database)    : projected by the Rust ingestion worker
--                                into NEO4J_CENTRAL_DATABASE (env var,
--                                already wired in apps/api-gateway/.env).
-- Qdrant (central collection) : projected into QDRANT_CENTRAL_COLLECTION.
--
-- Sync routing
-- ------------
-- This migration adds `access_scope` to `graphrag.sync_queue` so the
-- worker can dispatch each job to the personal or central sink.
-- All triggers in 050/055/068/074/076 implicitly emit access_scope =
-- 'personal' (the column's default); central-schema triggers emit
-- access_scope = 'central'.
--
-- Provenance
-- ----------
-- Every central ontology row carries a structured `provenance` JSONB
-- and a row in `central.provenance_records`. Anonymous knowledge is
-- forbidden — the trigger raises if provenance is missing on INSERT.
-- ==========================================================================


-- -------------------------------------------------------------------------
-- 0. Sync-queue routing column
-- -------------------------------------------------------------------------
ALTER TABLE graphrag.sync_queue
  ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'personal'
    CHECK (access_scope IN ('personal','central'));

CREATE INDEX IF NOT EXISTS idx_sync_queue_scope_pending
  ON graphrag.sync_queue(access_scope, sync_status, created_at)
  WHERE sync_status = 'pending';


-- -------------------------------------------------------------------------
-- 1. Schema
-- -------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS central;
GRANT USAGE ON SCHEMA central TO authenticated, service_role;


-- -------------------------------------------------------------------------
-- 2. Domain + review_status enums (CHECK predicates, not native enums,
--    so a future seed/refresh can extend without ALTER TYPE chaos)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION central.is_domain(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'finance','career','education','health','benefits','insurance',
    'estate_planning','entrepreneurship','military_veteran','cross_domain'
  )
$$;

CREATE OR REPLACE FUNCTION central.is_review_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('draft','under_review','approved','deprecated')
$$;

CREATE OR REPLACE FUNCTION central.is_entity_type(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    -- core ontology classes
    'Goal','Constraint','Capability','Risk','Decision','Outcome',
    'Recommendation','Action',
    -- domain entities
    'Benefit','Insurance','HealthMetric','CareerRole','Credential',
    'EducationProgram','EstateDocument','EmployerBenefit',
    -- knowledge / facts
    'Concept','Fact'
  )
$$;

CREATE OR REPLACE FUNCTION central.is_relationship_label(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    -- causal / probabilistic
    'INCREASES_PROBABILITY_OF','DECREASES_PROBABILITY_OF',
    'INCREASES','DECREASES','IMPROVES','DEGRADES','IMPACTS',
    -- supportive / blocking
    'SUPPORTS','BLOCKS','PREREQUISITE_FOR','DEPENDS_ON','REQUIRES',
    'CONFLICTS_WITH','COMPETES_FOR_RESOURCES','ACCELERATES','DELAYED_BY',
    -- taxonomic
    'IS_A','PART_OF','TAGGED_WITH','RELATED_TO'
  )
$$;


-- -------------------------------------------------------------------------
-- 3. Provenance records — the canonical citation log
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS central.provenance_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type        TEXT NOT NULL                 -- 'statute','regulation','peer_reviewed',
                                                   --  'gov_data','employer_doc','vendor_catalog',
                                                   --  'expert_review','curated_textbook'
                     CHECK (source_type IN (
                       'statute','regulation','peer_reviewed','gov_data',
                       'employer_doc','vendor_catalog','expert_review',
                       'curated_textbook','self_authored'
                     )),
  source_name        TEXT NOT NULL,
  source_url         TEXT,
  retrieved_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  version            TEXT NOT NULL DEFAULT '1',
  citation_reference TEXT,                          -- "26 USC § 408(p)", DOI, ISBN, etc.
  confidence_score   NUMERIC(3,2) NOT NULL DEFAULT 0.8
                     CHECK (confidence_score BETWEEN 0 AND 1),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prov_source_type ON central.provenance_records(source_type);
CREATE INDEX IF NOT EXISTS idx_prov_source_name ON central.provenance_records(source_name);


-- -------------------------------------------------------------------------
-- 4. Ontology entities (Goal, Capability, CareerRole, EmployerBenefit, ...)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS central.ontology_entities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        TEXT NOT NULL CHECK (central.is_entity_type(entity_type)),
  canonical_name     TEXT NOT NULL,                 -- "Series 7 License", "401(k) Match", etc.
  aliases            TEXT[] NOT NULL DEFAULT '{}',  -- common synonyms
  domain             TEXT NOT NULL CHECK (central.is_domain(domain)),
  summary            TEXT,
  attributes         JSONB NOT NULL DEFAULT '{}',
  source             TEXT NOT NULL,                 -- short label for ergonomic display
  version            TEXT NOT NULL DEFAULT '1',
  confidence_score   NUMERIC(3,2) NOT NULL DEFAULT 0.7
                     CHECK (confidence_score BETWEEN 0 AND 1),
  review_status      TEXT NOT NULL DEFAULT 'approved'
                     CHECK (central.is_review_status(review_status)),
  provenance         JSONB NOT NULL DEFAULT '{}',   -- inline structured copy
  provenance_id      UUID REFERENCES central.provenance_records(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT central_entity_provenance_required
    CHECK (provenance_id IS NOT NULL OR jsonb_typeof(provenance->'source_type') = 'string')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_entity_canonical
  ON central.ontology_entities(entity_type, lower(canonical_name));
CREATE INDEX IF NOT EXISTS idx_ontology_entity_domain
  ON central.ontology_entities(domain, entity_type);
CREATE INDEX IF NOT EXISTS idx_ontology_entity_review
  ON central.ontology_entities(review_status) WHERE review_status <> 'approved';


-- -------------------------------------------------------------------------
-- 5. Ontology relationships — directed edges with weights
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS central.ontology_relationships (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id   UUID NOT NULL REFERENCES central.ontology_entities(id) ON DELETE CASCADE,
  target_entity_id   UUID NOT NULL REFERENCES central.ontology_entities(id) ON DELETE CASCADE,
  label              TEXT NOT NULL CHECK (central.is_relationship_label(label)),
  strength_score     NUMERIC(3,2) NOT NULL DEFAULT 0.5
                     CHECK (strength_score BETWEEN 0 AND 1),
  confidence_score   NUMERIC(3,2) NOT NULL DEFAULT 0.7
                     CHECK (confidence_score BETWEEN 0 AND 1),
  domain             TEXT NOT NULL CHECK (central.is_domain(domain)),
  attributes         JSONB NOT NULL DEFAULT '{}',
  source             TEXT NOT NULL,
  version            TEXT NOT NULL DEFAULT '1',
  review_status      TEXT NOT NULL DEFAULT 'approved'
                     CHECK (central.is_review_status(review_status)),
  provenance         JSONB NOT NULL DEFAULT '{}',
  provenance_id      UUID REFERENCES central.provenance_records(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT central_rel_no_self CHECK (source_entity_id <> target_entity_id),
  CONSTRAINT central_rel_provenance_required
    CHECK (provenance_id IS NOT NULL OR jsonb_typeof(provenance->'source_type') = 'string'),
  CONSTRAINT central_rel_unique UNIQUE (source_entity_id, target_entity_id, label)
);
CREATE INDEX IF NOT EXISTS idx_ontology_rel_source ON central.ontology_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_ontology_rel_target ON central.ontology_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_ontology_rel_label  ON central.ontology_relationships(label);
CREATE INDEX IF NOT EXISTS idx_ontology_rel_domain ON central.ontology_relationships(domain);


-- -------------------------------------------------------------------------
-- 6. Review log — auditable trail of approval state changes
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS central.review_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table    TEXT NOT NULL
                  CHECK (target_table IN ('ontology_entities','ontology_relationships','provenance_records')),
  target_id       UUID NOT NULL,
  previous_status TEXT,
  new_status      TEXT NOT NULL CHECK (central.is_review_status(new_status)),
  reviewer        TEXT,                              -- email / service tag
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_log_target
  ON central.review_log(target_table, target_id);


-- -------------------------------------------------------------------------
-- 7. updated_at triggers
-- -------------------------------------------------------------------------
CREATE TRIGGER set_prov_updated_at
  BEFORE UPDATE ON central.provenance_records
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_ontology_entity_updated_at
  BEFORE UPDATE ON central.ontology_entities
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_ontology_rel_updated_at
  BEFORE UPDATE ON central.ontology_relationships
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 8. RLS
--    All authenticated users can READ approved entities/relationships.
--    Only service_role can WRITE. No row-level user-binding (this is
--    global knowledge), so the policy is "approved is public".
-- -------------------------------------------------------------------------
ALTER TABLE central.provenance_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE central.ontology_entities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE central.ontology_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE central.review_log             ENABLE ROW LEVEL SECURITY;

CREATE POLICY ontology_entity_read_approved
  ON central.ontology_entities FOR SELECT
  TO authenticated USING (review_status = 'approved');
CREATE POLICY ontology_entity_service
  ON central.ontology_entities FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY ontology_rel_read_approved
  ON central.ontology_relationships FOR SELECT
  TO authenticated USING (review_status = 'approved');
CREATE POLICY ontology_rel_service
  ON central.ontology_relationships FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY prov_read_all
  ON central.provenance_records FOR SELECT
  TO authenticated USING (true);
CREATE POLICY prov_service
  ON central.provenance_records FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY review_log_service
  ON central.review_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON central.ontology_entities, central.ontology_relationships,
                central.provenance_records TO authenticated;


-- -------------------------------------------------------------------------
-- 9. GraphRAG sync — push central rows through the queue with
--    access_scope='central' so the worker routes them to the central
--    Qdrant collection + central Neo4j database.
--
--    The central queue uses a synthetic user_id (the nil UUID) because
--    sync_queue.user_id has a NOT NULL constraint, and central knowledge
--    has no owner. The worker treats access_scope='central' specially
--    and ignores tenant_id when writing the projected vector / node.
-- -------------------------------------------------------------------------
DO $$
BEGIN
  -- Ensure a placeholder profile exists for the nil-UUID central writer.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000') THEN
    -- profiles.email may be NOT NULL; insert a synthetic one. If the
    -- column has a UNIQUE constraint on a different surface, this is
    -- a no-op on conflict.
    BEGIN
      INSERT INTO public.profiles (id, email)
      VALUES ('00000000-0000-0000-0000-000000000000', 'central-graph@lifenavigator.internal')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- profiles schema may require auth.users FK; if so skip and let
      -- ops seed the placeholder via the service_role.
      RAISE NOTICE 'central placeholder profile not created: %', SQLERRM;
    END;
  END IF;
END $$;


CREATE OR REPLACE FUNCTION graphrag.enqueue_central_sync(
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_source_table TEXT,
  p_operation   TEXT,
  p_payload     JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = graphrag, central, public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO graphrag.sync_queue (
    user_id, entity_type, entity_id, source_table, operation, payload, access_scope
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_entity_type, p_entity_id,
    p_source_table, p_operation, p_payload, 'central'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;


CREATE OR REPLACE FUNCTION central.trigger_ontology_entity_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_central_sync(
      'central_ontology_entity', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  IF NEW.review_status <> 'approved' THEN
    -- Only approved rows project to the central graph.
    RETURN NEW;
  END IF;

  PERFORM graphrag.enqueue_central_sync(
    'central_ontology_entity', NEW.id,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
    jsonb_build_object(
      'entity_type',      NEW.entity_type,
      'canonical_name',   NEW.canonical_name,
      'aliases',          NEW.aliases,
      'domain',           NEW.domain,
      'summary',          NEW.summary,
      'attributes',       NEW.attributes,
      'source',           NEW.source,
      'version',          NEW.version,
      'confidence_score', NEW.confidence_score,
      'provenance',       NEW.provenance
    )
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION central.trigger_ontology_relationship_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_central_sync(
      'central_ontology_relationship', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  IF NEW.review_status <> 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM graphrag.enqueue_central_sync(
    'central_ontology_relationship', NEW.id,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
    jsonb_build_object(
      'source_entity_id', NEW.source_entity_id,
      'target_entity_id', NEW.target_entity_id,
      'label',            NEW.label,
      'strength_score',   NEW.strength_score,
      'confidence_score', NEW.confidence_score,
      'domain',           NEW.domain,
      'attributes',       NEW.attributes,
      'source',           NEW.source,
      'version',          NEW.version,
      'provenance',       NEW.provenance
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_central_ontology_entity_sync ON central.ontology_entities;
CREATE TRIGGER trigger_central_ontology_entity_sync
  AFTER INSERT OR UPDATE OR DELETE ON central.ontology_entities
  FOR EACH ROW EXECUTE FUNCTION central.trigger_ontology_entity_sync();

DROP TRIGGER IF EXISTS trigger_central_ontology_rel_sync ON central.ontology_relationships;
CREATE TRIGGER trigger_central_ontology_rel_sync
  AFTER INSERT OR UPDATE OR DELETE ON central.ontology_relationships
  FOR EACH ROW EXECUTE FUNCTION central.trigger_ontology_relationship_sync();


-- -------------------------------------------------------------------------
-- 10. Bootstrap seed — a minimum viable ontology so the AdvisorReasoning
--     service has cross-domain edges to traverse on day one. All seed
--     rows carry provenance = {source_type:'self_authored',...} which
--     is honest about their origin and will be replaced by curated data
--     in a subsequent ingestion sprint.
-- -------------------------------------------------------------------------
WITH prov AS (
  INSERT INTO central.provenance_records (source_type, source_name, version,
                                          citation_reference, confidence_score, notes)
  VALUES ('self_authored', 'LifeNavigator bootstrap ontology v0', '1',
          '077_central_graph_ontology.sql', 0.55,
          'Seed data introduced 2026-05. Replace with curated sourcing.')
  RETURNING id
),
ents AS (
  INSERT INTO central.ontology_entities
    (entity_type,    canonical_name,            domain,             summary,                                                    source,  provenance, provenance_id)
  SELECT * FROM (VALUES
    ('CareerRole',     'Software Engineer',     'career',           'Generic SWE role',                                          'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('CareerRole',     'Attorney',              'career',           'Practicing attorney',                                       'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Credential',     'JD',                    'education',        'Juris Doctor degree',                                       'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Credential',     'CFA',                   'education',        'Chartered Financial Analyst',                               'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('EducationProgram','Law School',           'education',        '3-year ABA-accredited JD program',                          'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Income',                'finance',          'Earned + passive monthly income',                           'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Income Growth',         'finance',          'Year-over-year increase in income',                         'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Financial Independence','finance',          'Passive income covers living expenses',                     'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Emergency Fund',        'finance',          '3-6 months of expenses in liquid reserves',                 'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Entrepreneurship',      'entrepreneurship', 'Operating a new venture',                                   'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Home Ownership',        'finance',          'Owning a primary residence',                                'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('HealthMetric',   'Resting Heart Rate',    'health',           'Daily average bpm at rest',                                 'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('HealthMetric',   'Sleep Quality',         'health',           'Composite sleep score',                                     'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Exercise Consistency',  'health',           'Weekly cardio + strength frequency',                        'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Productivity',          'cross_domain',     'Output per unit of effort',                                 'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Career Progress',       'career',           'Compensation + scope trajectory',                           'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Poor Health',           'health',           'Sustained sub-optimal biomarkers',                          'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Credit Utilization',    'finance',          'Pct of revolving credit in use',                            'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Concept',        'Down Payment',          'finance',          'Cash reserve toward home purchase',                         'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('EmployerBenefit','401(k) Match',          'benefits',         'Employer matching contribution',                            'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('EmployerBenefit','HSA Contribution',      'benefits',         'Employer HSA contribution',                                 'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('Insurance',      'Term Life Insurance',   'insurance',        '10-30 year level-term coverage',                            'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id),
    ('EstateDocument', 'Revocable Living Trust','estate_planning',  'Trust for probate avoidance',                               'seed', '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb, prov.id)
  ) AS v(entity_type, canonical_name, domain, summary, source, provenance, provenance_id)
  CROSS JOIN prov
  RETURNING id, entity_type, canonical_name
)
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, e.domain, 'seed',
       '{"source_type":"self_authored","source_name":"bootstrap"}'::jsonb,
       (SELECT id FROM central.provenance_records ORDER BY created_at DESC LIMIT 1)
  FROM (VALUES
    -- Credential → CareerRole
    ('JD',                    'Attorney',               'INCREASES_PROBABILITY_OF', 0.85, 0.8, 'career'),
    ('Law School',            'JD',                     'PREREQUISITE_FOR',         0.95, 0.95,'education'),
    ('CFA',                   'Software Engineer',      'RELATED_TO',               0.20, 0.5, 'career'),
    -- Career → Income
    ('Attorney',              'Income',                 'INCREASES',                0.7,  0.7, 'career'),
    ('Software Engineer',     'Income',                 'INCREASES',                0.7,  0.7, 'career'),
    -- Income → Goals
    ('Income',                'Financial Independence', 'SUPPORTS',                 0.9,  0.9, 'finance'),
    ('Income Growth',         'Financial Independence', 'SUPPORTS',                 0.85, 0.85,'finance'),
    ('Income Growth',         'Home Ownership',         'SUPPORTS',                 0.7,  0.8, 'finance'),
    ('Law School',            'Income Growth',          'SUPPORTS',                 0.65, 0.6, 'career'),
    -- Health → Productivity → Career
    ('Exercise Consistency',  'Resting Heart Rate',     'IMPROVES',                 0.7,  0.8, 'health'),
    ('Exercise Consistency',  'Sleep Quality',          'IMPROVES',                 0.65, 0.75,'health'),
    ('Resting Heart Rate',    'Productivity',           'IMPACTS',                  0.4,  0.6, 'cross_domain'),
    ('Sleep Quality',         'Productivity',           'IMPACTS',                  0.7,  0.8, 'cross_domain'),
    ('Productivity',          'Career Progress',        'IMPACTS',                  0.7,  0.75,'cross_domain'),
    ('Poor Health',           'Income Growth',          'BLOCKS',                   0.6,  0.7, 'cross_domain'),
    -- Finance support / blocks
    ('Emergency Fund',        'Entrepreneurship',       'SUPPORTS',                 0.8,  0.85,'finance'),
    ('Credit Utilization',    'Home Ownership',         'BLOCKS',                   0.6,  0.7, 'finance'),
    ('Down Payment',          'Home Ownership',         'PREREQUISITE_FOR',         0.95, 0.95,'finance'),
    -- Benefits
    ('401(k) Match',          'Financial Independence', 'SUPPORTS',                 0.75, 0.85,'benefits'),
    ('HSA Contribution',      'Financial Independence', 'SUPPORTS',                 0.6,  0.8, 'benefits'),
    -- Insurance / estate (protective)
    ('Term Life Insurance',   'Financial Independence', 'SUPPORTS',                 0.5,  0.8, 'insurance'),
    ('Revocable Living Trust','Financial Independence', 'SUPPORTS',                 0.45, 0.8, 'estate_planning')
  ) AS e(s_name, t_name, label, strength, confidence, domain)
  JOIN central.ontology_entities s ON s.canonical_name = e.s_name
  JOIN central.ontology_entities t ON t.canonical_name = e.t_name
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- -------------------------------------------------------------------------
-- 11. Public views — PostgREST only exposes the `public` schema by
--     default. To let authenticated clients read approved central data
--     via the standard Supabase client we project read-only views into
--     `public`. RLS on the underlying tables still applies.
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.central_ontology_entities AS
  SELECT id, entity_type, canonical_name, aliases, domain, summary,
         attributes, source, version, confidence_score, review_status,
         provenance, created_at, updated_at
    FROM central.ontology_entities
   WHERE review_status = 'approved';

CREATE OR REPLACE VIEW public.central_ontology_relationships AS
  SELECT id, source_entity_id, target_entity_id, label, strength_score,
         confidence_score, domain, attributes, source, version,
         review_status, provenance, created_at, updated_at
    FROM central.ontology_relationships
   WHERE review_status = 'approved';

CREATE OR REPLACE VIEW public.central_provenance_records AS
  SELECT id, source_type, source_name, source_url, retrieved_date,
         version, citation_reference, confidence_score, notes,
         created_at, updated_at
    FROM central.provenance_records;

GRANT SELECT ON public.central_ontology_entities,
                public.central_ontology_relationships,
                public.central_provenance_records
  TO authenticated, anon;

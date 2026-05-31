-- ==========================================================================
-- 076: Goal Hierarchy Engine
--
-- Six tables expressing goal relationships:
--   * goal_hierarchies     — parent/child tree (which goal contains/leads-to which)
--   * goal_dependencies    — DEPENDS_ON / PREREQUISITE_FOR edges
--   * goal_conflicts       — CONFLICTS_WITH / COMPETES_FOR_RESOURCES edges
--   * goal_priorities      — user's prioritization weights
--   * goal_relationships   — general typed edges (SUPPORTS / ACCELERATES / etc.)
--   * goal_pathways        — materialized optimal paths from root to leaf
--
-- All six share a consistent shape:
--   id, user_id, parent_goal_id, child_goal_id, relationship_type,
--   strength_score [0,1], confidence_score [0,1],
--   metadata JSONB, source TEXT, created_at, updated_at.
--
-- Allowed relationship_type values come from a CHECK constraint on a
-- shared enum string set:
--     SUPPORTS, BLOCKS, DEPENDS_ON, PREREQUISITE_FOR,
--     CONFLICTS_WITH, ACCELERATES, DELAYED_BY, COMPETES_FOR_RESOURCES,
--     PARENT_OF, PRIORITIZED_OVER, PATHWAY_STEP
--
-- Strict RLS: owner can see/modify only their rows; service_role can
-- read+write any row (worker / advisor service path).
--
-- GraphRAG sync: each of the six tables fires
-- `graphrag.enqueue_sync(..)` on INSERT/UPDATE/DELETE so the Rust
-- ingestion worker can mirror the edges into Neo4j.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- Shared CHECK predicate (a function so all six tables stay in sync)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_goal_relationship_type(p TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NULL OR p IN (
    'SUPPORTS',
    'BLOCKS',
    'DEPENDS_ON',
    'PREREQUISITE_FOR',
    'CONFLICTS_WITH',
    'ACCELERATES',
    'DELAYED_BY',
    'COMPETES_FOR_RESOURCES',
    'PARENT_OF',
    'PRIORITIZED_OVER',
    'PATHWAY_STEP'
  )
$$;


-- -------------------------------------------------------------------------
-- 1. goal_hierarchies — parent/child containment
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_hierarchies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_goal_id    UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  child_goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'PARENT_OF'
                    CHECK (public.is_goal_relationship_type(relationship_type)),
  strength_score    NUMERIC(3,2) DEFAULT 1.0
                    CHECK (strength_score   IS NULL OR strength_score   BETWEEN 0 AND 1),
  confidence_score  NUMERIC(3,2) DEFAULT 1.0
                    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  source            TEXT NOT NULL DEFAULT 'user',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_hierarchies_no_self_loop CHECK (parent_goal_id <> child_goal_id),
  CONSTRAINT goal_hierarchies_unique UNIQUE (user_id, parent_goal_id, child_goal_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_goal_hier_user   ON public.goal_hierarchies(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_hier_parent ON public.goal_hierarchies(user_id, parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_hier_child  ON public.goal_hierarchies(user_id, child_goal_id);


-- -------------------------------------------------------------------------
-- 2. goal_dependencies — DEPENDS_ON / PREREQUISITE_FOR
--    Convention: parent_goal_id depends on child_goal_id (i.e. the parent
--    cannot complete until the child does). This keeps the data shape
--    uniform with goal_hierarchies even though "depends on" reads
--    opposite the tree containment.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_dependencies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_goal_id    UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  child_goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'DEPENDS_ON'
                    CHECK (public.is_goal_relationship_type(relationship_type)
                           AND relationship_type IN ('DEPENDS_ON','PREREQUISITE_FOR')),
  strength_score    NUMERIC(3,2) DEFAULT 1.0
                    CHECK (strength_score   IS NULL OR strength_score   BETWEEN 0 AND 1),
  confidence_score  NUMERIC(3,2) DEFAULT 1.0
                    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  source            TEXT NOT NULL DEFAULT 'user',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_deps_no_self_loop CHECK (parent_goal_id <> child_goal_id),
  CONSTRAINT goal_deps_unique UNIQUE (user_id, parent_goal_id, child_goal_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_goal_deps_user   ON public.goal_dependencies(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_deps_parent ON public.goal_dependencies(user_id, parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_deps_child  ON public.goal_dependencies(user_id, child_goal_id);


-- -------------------------------------------------------------------------
-- 3. goal_conflicts — CONFLICTS_WITH / COMPETES_FOR_RESOURCES / BLOCKS
--    Conceptually symmetric; we still store with a parent/child split so
--    the shape stays uniform. UI / service should treat them as undirected.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_conflicts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_goal_id    UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  child_goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'CONFLICTS_WITH'
                    CHECK (public.is_goal_relationship_type(relationship_type)
                           AND relationship_type IN
                               ('CONFLICTS_WITH','COMPETES_FOR_RESOURCES','BLOCKS')),
  strength_score    NUMERIC(3,2) DEFAULT 0.5
                    CHECK (strength_score   IS NULL OR strength_score   BETWEEN 0 AND 1),
  confidence_score  NUMERIC(3,2) DEFAULT 1.0
                    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  source            TEXT NOT NULL DEFAULT 'engine',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_conf_no_self_loop CHECK (parent_goal_id <> child_goal_id),
  CONSTRAINT goal_conf_unique UNIQUE (user_id, parent_goal_id, child_goal_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_goal_conf_user   ON public.goal_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_conf_parent ON public.goal_conflicts(user_id, parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_conf_child  ON public.goal_conflicts(user_id, child_goal_id);


-- -------------------------------------------------------------------------
-- 4. goal_priorities — user-asserted prioritization weights
--    parent_goal_id = root or context goal (NULLABLE);
--    child_goal_id  = the goal being prioritized.
--    strength_score = priority weight (1.0 = highest).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_priorities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_goal_id    UUID          REFERENCES public.goals(id) ON DELETE CASCADE,
  child_goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'PRIORITIZED_OVER'
                    CHECK (public.is_goal_relationship_type(relationship_type)),
  strength_score    NUMERIC(3,2) DEFAULT 0.5
                    CHECK (strength_score   IS NULL OR strength_score   BETWEEN 0 AND 1),
  confidence_score  NUMERIC(3,2) DEFAULT 1.0
                    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  source            TEXT NOT NULL DEFAULT 'user',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_prio_no_self_loop CHECK (parent_goal_id IS DISTINCT FROM child_goal_id),
  CONSTRAINT goal_prio_unique UNIQUE (user_id, parent_goal_id, child_goal_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_goal_prio_user  ON public.goal_priorities(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_prio_child ON public.goal_priorities(user_id, child_goal_id);


-- -------------------------------------------------------------------------
-- 5. goal_relationships — general typed edges (catch-all for everything
--    that isn't strict tree, dependency, conflict, or priority)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_relationships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_goal_id    UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  child_goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
                    CHECK (public.is_goal_relationship_type(relationship_type)),
  strength_score    NUMERIC(3,2) DEFAULT 0.5
                    CHECK (strength_score   IS NULL OR strength_score   BETWEEN 0 AND 1),
  confidence_score  NUMERIC(3,2) DEFAULT 0.5
                    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  source            TEXT NOT NULL DEFAULT 'engine',
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_rel_no_self_loop CHECK (parent_goal_id <> child_goal_id),
  CONSTRAINT goal_rel_unique UNIQUE (user_id, parent_goal_id, child_goal_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_goal_rel_user   ON public.goal_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_rel_parent ON public.goal_relationships(user_id, parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_rel_child  ON public.goal_relationships(user_id, child_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_rel_type   ON public.goal_relationships(user_id, relationship_type);


-- -------------------------------------------------------------------------
-- 6. goal_pathways — materialized optimal path from a root goal to a
--    leaf step. metadata.path holds the ordered uuid[] of intermediate
--    goal_ids; sequence_index disambiguates multiple pathways from the
--    same root.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_pathways (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_goal_id    UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE, -- root
  child_goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE, -- leaf step
  relationship_type TEXT NOT NULL DEFAULT 'PATHWAY_STEP'
                    CHECK (public.is_goal_relationship_type(relationship_type)),
  strength_score    NUMERIC(3,2) DEFAULT 1.0
                    CHECK (strength_score   IS NULL OR strength_score   BETWEEN 0 AND 1),
  confidence_score  NUMERIC(3,2) DEFAULT 0.5
                    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  sequence_index    INT  NOT NULL DEFAULT 0,
  source            TEXT NOT NULL DEFAULT 'goal_path_service',
  metadata          JSONB NOT NULL DEFAULT '{}',  -- { "path": ["uuid", ...], "via": [...] }
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_pathway_unique UNIQUE (user_id, parent_goal_id, child_goal_id, sequence_index)
);
CREATE INDEX IF NOT EXISTS idx_goal_pathway_user ON public.goal_pathways(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_pathway_root ON public.goal_pathways(user_id, parent_goal_id);


-- -------------------------------------------------------------------------
-- 7. updated_at triggers (uses existing core.set_updated_at helper)
-- -------------------------------------------------------------------------
CREATE TRIGGER set_goal_hierarchies_updated_at
  BEFORE UPDATE ON public.goal_hierarchies
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_goal_dependencies_updated_at
  BEFORE UPDATE ON public.goal_dependencies
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_goal_conflicts_updated_at
  BEFORE UPDATE ON public.goal_conflicts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_goal_priorities_updated_at
  BEFORE UPDATE ON public.goal_priorities
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_goal_relationships_updated_at
  BEFORE UPDATE ON public.goal_relationships
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_goal_pathways_updated_at
  BEFORE UPDATE ON public.goal_pathways
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 8. RLS — strict owner-only with service_role escape hatch
-- -------------------------------------------------------------------------
ALTER TABLE public.goal_hierarchies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_dependencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_conflicts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_priorities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_pathways      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['goal_hierarchies','goal_dependencies','goal_conflicts',
                           'goal_priorities','goal_relationships','goal_pathways']
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t || '_owner_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );
  END LOOP;
END $$;


-- -------------------------------------------------------------------------
-- 9. GraphRAG sync triggers — mirror each edge to Neo4j via the worker
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_goal_relationship_table_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
BEGIN
  -- entity_type encodes which of the 6 tables the row came from. The
  -- ingestion worker maps each to a (:GoalEdge {label, ...}) write,
  -- with parent_goal_id / child_goal_id / relationship_type in payload.
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'goal_hierarchies'   THEN 'goal_hierarchy_edge'
    WHEN 'goal_dependencies'  THEN 'goal_dependency_edge'
    WHEN 'goal_conflicts'     THEN 'goal_conflict_edge'
    WHEN 'goal_priorities'    THEN 'goal_priority_edge'
    WHEN 'goal_relationships' THEN 'goal_relationship_edge'
    WHEN 'goal_pathways'      THEN 'goal_pathway_edge'
    ELSE 'goal_edge'
  END;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, v_entity_type, OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, v_entity_type, NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'parent_goal_id',    NEW.parent_goal_id,
        'child_goal_id',     NEW.child_goal_id,
        'relationship_type', NEW.relationship_type,
        'strength_score',    NEW.strength_score,
        'confidence_score',  NEW.confidence_score,
        'source',            NEW.source
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['goal_hierarchies','goal_dependencies','goal_conflicts',
                           'goal_priorities','goal_relationships','goal_pathways']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_graphrag_%I_sync ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trigger_graphrag_%I_sync AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_goal_relationship_table_sync()',
      t, t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.goal_hierarchies,
     public.goal_dependencies,
     public.goal_conflicts,
     public.goal_priorities,
     public.goal_relationships,
     public.goal_pathways
  TO authenticated;

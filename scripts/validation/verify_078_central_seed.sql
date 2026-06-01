-- ==========================================================================
-- 078 verification: confirms central curated knowledge is loaded and
-- structurally well-formed.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_078_central_seed.sql
--
-- Reports approved-entity + approved-relationship counts per domain,
-- proves every approved row carries a provenance_id, and asserts the
-- access_scope routing column is populated on every queued central row.
-- ==========================================================================

\echo == 1. Approved entities by domain ==
SELECT domain, COUNT(*) AS entities
  FROM central.ontology_entities
 WHERE review_status = 'approved'
 GROUP BY domain
 ORDER BY domain;

\echo == 2. Approved relationships by domain ==
SELECT domain, COUNT(*) AS relationships
  FROM central.ontology_relationships
 WHERE review_status = 'approved'
 GROUP BY domain
 ORDER BY domain;

\echo == 3. Provenance integrity — every approved row links to a provenance record ==
SELECT
  (SELECT COUNT(*) FROM central.ontology_entities      WHERE review_status='approved' AND provenance_id IS NULL) AS entities_missing_provenance,
  (SELECT COUNT(*) FROM central.ontology_relationships WHERE review_status='approved' AND provenance_id IS NULL) AS relationships_missing_provenance;

\echo == 4. Provenance source-type distribution ==
SELECT source_type, COUNT(*) AS rows
  FROM central.provenance_records
 GROUP BY source_type
 ORDER BY source_type;

\echo == 5. Cross-domain coverage spot-checks ==
-- Credential -> Career: e.g., CFA -> Personal Financial Advisor
SELECT s.canonical_name AS source, r.label, t.canonical_name AS target, r.strength_score, r.confidence_score
  FROM central.ontology_relationships r
  JOIN central.ontology_entities s ON s.id = r.source_entity_id
  JOIN central.ontology_entities t ON t.id = r.target_entity_id
 WHERE s.canonical_name = 'CFA Charter'
   AND r.review_status = 'approved'
 ORDER BY r.strength_score DESC;

-- Health -> Productivity
SELECT s.canonical_name AS source, r.label, t.canonical_name AS target, r.strength_score
  FROM central.ontology_relationships r
  JOIN central.ontology_entities s ON s.id = r.source_entity_id
  JOIN central.ontology_entities t ON t.id = r.target_entity_id
 WHERE t.canonical_name = 'Productivity'
   AND r.review_status = 'approved';

-- Veteran -> Finance
SELECT s.canonical_name AS source, r.label, t.canonical_name AS target, r.strength_score
  FROM central.ontology_relationships r
  JOIN central.ontology_entities s ON s.id = r.source_entity_id
  JOIN central.ontology_entities t ON t.id = r.target_entity_id
 WHERE s.domain = 'military_veteran'
   AND t.domain IN ('finance','education','career')
   AND r.review_status = 'approved'
 ORDER BY s.canonical_name, t.canonical_name;

\echo == 6. Sync queue access_scope routing for central rows ==
SELECT access_scope, COUNT(*) AS queued
  FROM graphrag.sync_queue
 WHERE source_table LIKE 'central.%'
 GROUP BY access_scope;

\echo == 7. Summary verdict ==
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM central.ontology_entities      WHERE review_status='approved' AND provenance_id IS NULL) > 0 THEN 'FAIL: entities missing provenance'
    WHEN (SELECT COUNT(*) FROM central.ontology_relationships WHERE review_status='approved' AND provenance_id IS NULL) > 0 THEN 'FAIL: relationships missing provenance'
    WHEN (SELECT MIN(c) FROM (SELECT COUNT(*) c FROM central.ontology_entities WHERE review_status='approved' GROUP BY domain) z) < 6 THEN 'FAIL: a domain has < 6 approved entities'
    ELSE 'PASS'
  END AS verdict;

-- ==========================================================================
-- 083 verification — confirms the curated-knowledge expansion landed,
-- every approved row carries a provenance_id, and a representative
-- cross-domain spot-check returns rows.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_083_central_seed.sql
-- ==========================================================================

\echo == 1. Approved entities by domain (v1 + v2 combined) ==
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

\echo == 3. v2-tagged entities per domain (this sprint's contribution) ==
SELECT domain, COUNT(*) AS entities_v2
  FROM central.ontology_entities
 WHERE review_status = 'approved'
   AND source = 'central_curated_v2'
 GROUP BY domain
 ORDER BY domain;

\echo == 4. Provenance integrity — every approved row has a provenance_id ==
SELECT
  (SELECT COUNT(*) FROM central.ontology_entities      WHERE review_status='approved' AND provenance_id IS NULL) AS entities_missing_provenance,
  (SELECT COUNT(*) FROM central.ontology_relationships WHERE review_status='approved' AND provenance_id IS NULL) AS relationships_missing_provenance;

\echo == 5. Provenance source-type distribution ==
SELECT source_type, COUNT(*) AS rows
  FROM central.provenance_records
 GROUP BY source_type
 ORDER BY source_type;

\echo == 6. New CFP entity spot-check ==
SELECT canonical_name, summary
  FROM central.ontology_entities
 WHERE canonical_name IN ('CFP Six-Step Planning Process', 'Time Value of Money', 'Fiduciary Duty (Investment Advice)')
 ORDER BY canonical_name;

\echo == 7. Retirement vehicle coverage ==
SELECT canonical_name
  FROM central.ontology_entities
 WHERE entity_type IN ('EmployerBenefit') AND domain = 'finance'
   AND canonical_name IN ('SEP-IRA','SIMPLE-IRA','Solo 401(k)','457(b) Plan','403(b) Plan','Thrift Savings Plan (TSP)','Defined Benefit Pension','Traditional 401(k)','Roth 401(k)','Traditional IRA','Roth IRA','HSA (Health Savings Account)')
 ORDER BY canonical_name;

\echo == 8. Cross-domain spot-check: Cert → Career Role probability ==
SELECT s.canonical_name AS cert, r.label, t.canonical_name AS role, r.strength_score, r.confidence_score
  FROM central.ontology_relationships r
  JOIN central.ontology_entities s ON s.id = r.source_entity_id
  JOIN central.ontology_entities t ON t.id = r.target_entity_id
 WHERE r.review_status = 'approved'
   AND s.entity_type = 'Credential'
   AND t.entity_type = 'CareerRole'
 ORDER BY r.strength_score DESC
 LIMIT 10;

\echo == 9. Cross-domain spot-check: Health → Productivity / Career ==
SELECT s.canonical_name AS health_concept, r.label, t.canonical_name AS target, r.strength_score
  FROM central.ontology_relationships r
  JOIN central.ontology_entities s ON s.id = r.source_entity_id
  JOIN central.ontology_entities t ON t.id = r.target_entity_id
 WHERE r.review_status = 'approved'
   AND s.domain = 'health'
   AND t.canonical_name IN ('Productivity','Career Progress','Resting Blood Pressure','HRV (Heart Rate Variability)','Sleep Duration')
 ORDER BY s.canonical_name, t.canonical_name
 LIMIT 15;

\echo == 10. Cross-domain spot-check: VA benefits → Education / Finance ==
SELECT s.canonical_name AS veteran_benefit, r.label, t.canonical_name AS target, t.domain AS target_domain
  FROM central.ontology_relationships r
  JOIN central.ontology_entities s ON s.id = r.source_entity_id
  JOIN central.ontology_entities t ON t.id = r.target_entity_id
 WHERE r.review_status = 'approved'
   AND s.domain = 'military_veteran'
   AND t.domain IN ('finance','education','insurance')
 ORDER BY s.canonical_name
 LIMIT 15;

\echo == 11. Citation density per domain ==
SELECT e.domain, COUNT(DISTINCT pr.citation_reference) AS distinct_citations
  FROM central.ontology_entities e
  JOIN central.provenance_records pr ON pr.id = e.provenance_id
 WHERE e.review_status = 'approved'
 GROUP BY e.domain
 ORDER BY e.domain;

\echo == 12. Summary verdict ==
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM central.ontology_entities      WHERE review_status='approved' AND provenance_id IS NULL) > 0 THEN 'FAIL: entities missing provenance'
    WHEN (SELECT COUNT(*) FROM central.ontology_relationships WHERE review_status='approved' AND provenance_id IS NULL) > 0 THEN 'FAIL: relationships missing provenance'
    WHEN (SELECT MIN(c) FROM (SELECT COUNT(*) c FROM central.ontology_entities
                              WHERE review_status='approved' AND source='central_curated_v2' GROUP BY domain) z) < 15 THEN 'FAIL: a domain has < 15 v2 entities'
    ELSE 'PASS'
  END AS verdict;

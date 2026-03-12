// ==========================================================================
// Neo4j Aura — One-time schema initialization
// Run via Neo4j Browser or cypher-shell against your Aura instance.
// ==========================================================================

// --- Constraints (uniqueness + existence) ---
CREATE CONSTRAINT person_tenant IF NOT EXISTS
  FOR (p:Person) REQUIRE p.tenant_id IS UNIQUE;

CREATE CONSTRAINT goal_entity IF NOT EXISTS
  FOR (g:Goal) REQUIRE (g.entity_id, g.tenant_id) IS UNIQUE;

CREATE CONSTRAINT account_entity IF NOT EXISTS
  FOR (a:FinancialAccount) REQUIRE (a.entity_id, a.tenant_id) IS UNIQUE;

CREATE CONSTRAINT risk_entity IF NOT EXISTS
  FOR (r:RiskAssessment) REQUIRE (r.entity_id, r.tenant_id) IS UNIQUE;

CREATE CONSTRAINT career_entity IF NOT EXISTS
  FOR (c:CareerProfile) REQUIRE (c.entity_id, c.tenant_id) IS UNIQUE;

// --- Indexes for common lookups ---
CREATE INDEX person_user IF NOT EXISTS
  FOR (p:Person) ON (p.user_id);

CREATE INDEX goal_tenant IF NOT EXISTS
  FOR (g:Goal) ON (g.tenant_id);

CREATE INDEX goal_category IF NOT EXISTS
  FOR (g:Goal) ON (g.category);

CREATE INDEX account_tenant IF NOT EXISTS
  FOR (a:FinancialAccount) ON (a.tenant_id);

CREATE INDEX account_type IF NOT EXISTS
  FOR (a:FinancialAccount) ON (a.account_type);

CREATE INDEX risk_tenant IF NOT EXISTS
  FOR (r:RiskAssessment) ON (r.tenant_id);

CREATE INDEX career_tenant IF NOT EXISTS
  FOR (c:CareerProfile) ON (c.tenant_id);

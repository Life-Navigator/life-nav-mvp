// ==========================================================================
// Neo4j Aura — One-time schema initialization
// Expanded to cover all 16 entity types synced by the GraphRAG pipeline.
// Run via Neo4j Browser or cypher-shell against your Aura instance.
// ==========================================================================

// --- Constraints (uniqueness) ---

// Core
CREATE CONSTRAINT person_tenant IF NOT EXISTS
  FOR (p:Person) REQUIRE p.tenant_id IS UNIQUE;

// Goals
CREATE CONSTRAINT goal_entity IF NOT EXISTS
  FOR (g:Goal) REQUIRE (g.entity_id, g.tenant_id) IS UNIQUE;

// Finance
CREATE CONSTRAINT account_entity IF NOT EXISTS
  FOR (a:FinancialAccount) REQUIRE (a.entity_id, a.tenant_id) IS UNIQUE;

CREATE CONSTRAINT financial_goal_entity IF NOT EXISTS
  FOR (fg:FinancialGoal) REQUIRE (fg.entity_id, fg.tenant_id) IS UNIQUE;

CREATE CONSTRAINT holding_entity IF NOT EXISTS
  FOR (h:InvestmentHolding) REQUIRE (h.entity_id, h.tenant_id) IS UNIQUE;

CREATE CONSTRAINT transaction_entity IF NOT EXISTS
  FOR (t:Transaction) REQUIRE (t.entity_id, t.tenant_id) IS UNIQUE;

// Risk
CREATE CONSTRAINT risk_entity IF NOT EXISTS
  FOR (r:RiskAssessment) REQUIRE (r.entity_id, r.tenant_id) IS UNIQUE;

// Career
CREATE CONSTRAINT career_entity IF NOT EXISTS
  FOR (c:CareerProfile) REQUIRE (c.entity_id, c.tenant_id) IS UNIQUE;

CREATE CONSTRAINT application_entity IF NOT EXISTS
  FOR (ja:JobApplication) REQUIRE (ja.entity_id, ja.tenant_id) IS UNIQUE;

CREATE CONSTRAINT connection_entity IF NOT EXISTS
  FOR (cc:CareerConnection) REQUIRE (cc.entity_id, cc.tenant_id) IS UNIQUE;

CREATE CONSTRAINT resume_entity IF NOT EXISTS
  FOR (r:Resume) REQUIRE (r.entity_id, r.tenant_id) IS UNIQUE;

// Education
CREATE CONSTRAINT education_entity IF NOT EXISTS
  FOR (e:EducationRecord) REQUIRE (e.entity_id, e.tenant_id) IS UNIQUE;

CREATE CONSTRAINT course_entity IF NOT EXISTS
  FOR (c:Course) REQUIRE (c.entity_id, c.tenant_id) IS UNIQUE;

// Family
CREATE CONSTRAINT family_entity IF NOT EXISTS
  FOR (fm:FamilyMember) REQUIRE (fm.entity_id, fm.tenant_id) IS UNIQUE;

// Health
CREATE CONSTRAINT health_record_entity IF NOT EXISTS
  FOR (hr:HealthRecord) REQUIRE (hr.entity_id, hr.tenant_id) IS UNIQUE;

CREATE CONSTRAINT health_metric_entity IF NOT EXISTS
  FOR (hm:HealthMetric) REQUIRE (hm.entity_id, hm.tenant_id) IS UNIQUE;

// Documents
CREATE CONSTRAINT document_entity IF NOT EXISTS
  FOR (d:Document) REQUIRE (d.entity_id, d.tenant_id) IS UNIQUE;

// --- Indexes for common lookups ---

// Person
CREATE INDEX person_user IF NOT EXISTS
  FOR (p:Person) ON (p.user_id);

// Goals
CREATE INDEX goal_tenant IF NOT EXISTS
  FOR (g:Goal) ON (g.tenant_id);
CREATE INDEX goal_category IF NOT EXISTS
  FOR (g:Goal) ON (g.category);
CREATE INDEX goal_status IF NOT EXISTS
  FOR (g:Goal) ON (g.status);

// Finance
CREATE INDEX account_tenant IF NOT EXISTS
  FOR (a:FinancialAccount) ON (a.tenant_id);
CREATE INDEX account_type IF NOT EXISTS
  FOR (a:FinancialAccount) ON (a.account_type);
CREATE INDEX financial_goal_tenant IF NOT EXISTS
  FOR (fg:FinancialGoal) ON (fg.tenant_id);
CREATE INDEX holding_tenant IF NOT EXISTS
  FOR (h:InvestmentHolding) ON (h.tenant_id);
CREATE INDEX transaction_tenant IF NOT EXISTS
  FOR (t:Transaction) ON (t.tenant_id);
CREATE INDEX transaction_category IF NOT EXISTS
  FOR (t:Transaction) ON (t.category);

// Risk
CREATE INDEX risk_tenant IF NOT EXISTS
  FOR (r:RiskAssessment) ON (r.tenant_id);

// Career
CREATE INDEX career_tenant IF NOT EXISTS
  FOR (c:CareerProfile) ON (c.tenant_id);
CREATE INDEX application_tenant IF NOT EXISTS
  FOR (ja:JobApplication) ON (ja.tenant_id);
CREATE INDEX application_status IF NOT EXISTS
  FOR (ja:JobApplication) ON (ja.status);
CREATE INDEX connection_tenant IF NOT EXISTS
  FOR (cc:CareerConnection) ON (cc.tenant_id);
CREATE INDEX resume_tenant IF NOT EXISTS
  FOR (r:Resume) ON (r.tenant_id);

// Education
CREATE INDEX education_tenant IF NOT EXISTS
  FOR (e:EducationRecord) ON (e.tenant_id);
CREATE INDEX course_tenant IF NOT EXISTS
  FOR (c:Course) ON (c.tenant_id);

// Family
CREATE INDEX family_tenant IF NOT EXISTS
  FOR (fm:FamilyMember) ON (fm.tenant_id);

// Health
CREATE INDEX health_record_tenant IF NOT EXISTS
  FOR (hr:HealthRecord) ON (hr.tenant_id);
CREATE INDEX health_metric_tenant IF NOT EXISTS
  FOR (hm:HealthMetric) ON (hm.tenant_id);

// Documents
CREATE INDEX document_tenant IF NOT EXISTS
  FOR (d:Document) ON (d.tenant_id);
CREATE INDEX document_type IF NOT EXISTS
  FOR (d:Document) ON (d.document_type);

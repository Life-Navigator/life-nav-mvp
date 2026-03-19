"""Neo4j label/relationship maps derived from the ontology.

Maps entity_type strings (from sync_queue) to Neo4j labels and relationship types.
"""

# entity_type → Neo4j node label
LABEL_MAP: dict[str, str] = {
    # Original 4 types
    "goal": "Goal",
    "financial_account": "FinancialAccount",
    "risk_assessment": "RiskAssessment",
    "career_profile": "CareerProfile",
    # Education domain
    "education_record": "EducationRecord",
    "course": "Course",
    # Career domain (expanded)
    "job_application": "JobApplication",
    "career_connection": "CareerConnection",
    "resume": "Resume",
    # Finance domain (expanded)
    "financial_goal": "FinancialGoal",
    "investment_holding": "InvestmentHolding",
    "transaction": "Transaction",
    # Family domain
    "family_member": "FamilyMember",
    # Health domain
    "health_record": "HealthRecord",
    "health_metric": "HealthMetric",
    # Documents
    "document": "Document",
    # Communication & Calendar
    "email": "Email",
    "calendar_event": "CalendarEvent",
}

# entity_type → relationship type from Person to entity
REL_MAP: dict[str, str] = {
    "goal": "HAS_GOAL",
    "financial_account": "HAS_ACCOUNT",
    "risk_assessment": "HAS_RISK_ASSESSMENT",
    "career_profile": "HAS_CAREER_PROFILE",
    "education_record": "HAS_EDUCATION",
    "course": "HAS_COURSE",
    "job_application": "HAS_APPLICATION",
    "career_connection": "HAS_CONNECTION",
    "resume": "HAS_RESUME",
    "financial_goal": "HAS_FINANCIAL_GOAL",
    "investment_holding": "HAS_HOLDING",
    "transaction": "HAS_TRANSACTION",
    "family_member": "HAS_FAMILY_MEMBER",
    "health_record": "HAS_HEALTH_RECORD",
    "health_metric": "HAS_HEALTH_METRIC",
    "document": "HAS_DOCUMENT",
    "email": "HAS_EMAIL",
    "calendar_event": "HAS_EVENT",
}

# entity_type → domain string for Qdrant payload
DOMAIN_MAP: dict[str, str] = {
    "goal": "goals",
    "financial_account": "finance",
    "risk_assessment": "risk",
    "career_profile": "career",
    "education_record": "education",
    "course": "education",
    "job_application": "career",
    "career_connection": "career",
    "resume": "career",
    "financial_goal": "finance",
    "investment_holding": "finance",
    "transaction": "finance",
    "family_member": "family",
    "health_record": "health",
    "health_metric": "health",
    "document": "documents",
    "email": "communication",
    "calendar_event": "calendar",
}

# entity_type → source table (for reindex lookups)
SOURCE_TABLE_MAP: dict[str, str] = {
    "goal": "public.goals",
    "financial_account": "finance.financial_accounts",
    "risk_assessment": "public.risk_assessments",
    "career_profile": "public.career_profiles",
    "education_record": "public.education_records",
    "course": "public.courses",
    "job_application": "public.job_applications",
    "career_connection": "public.career_connections",
    "resume": "public.resumes",
    "financial_goal": "finance.financial_goals",
    "investment_holding": "finance.investment_holdings",
    "transaction": "finance.transactions",
    "family_member": "public.family_members",
    "health_record": "health_meta.health_records",
    "health_metric": "health_meta.health_metrics",
    "document": "public.documents",
    "email": "public.email_messages",
    "calendar_event": "public.calendar_events",
}

# Cross-entity relationships that the pipeline creates between entities
# Each entry: (from_entity_type, to_entity_type, rel_type, fk_field)
CROSS_RELATIONSHIPS: list[tuple[str, str, str, str]] = [
    ("goal", "goal", "DEPENDS_ON", "depends_on_id"),
    ("financial_goal", "financial_account", "RELATED_TO_ACCOUNT", "account_id"),
    ("transaction", "financial_account", "IN_ACCOUNT", "account_id"),
    ("investment_holding", "financial_account", "IN_ACCOUNT", "account_id"),
    ("financial_goal", "goal", "FOR_GOAL", "goal_id"),
]

# Graph schema description used for NL→Cypher prompt
GRAPH_SCHEMA = """\
Node labels and properties:
- (:Person {tenant_id, user_id, name})
- (:Goal {entity_id, tenant_id, title, category, status, priority, target_value, target_unit, description})
- (:FinancialAccount {entity_id, tenant_id, account_name, account_type, institution, current_balance, currency})
- (:RiskAssessment {entity_id, tenant_id, overall_score, risk_level, assessment_type})
- (:CareerProfile {entity_id, tenant_id, current_title, current_employer, industry, years_experience})
- (:EducationRecord {entity_id, tenant_id, institution_name, degree_type, field_of_study, status})
- (:Course {entity_id, tenant_id, course_name, provider, level, status})
- (:JobApplication {entity_id, tenant_id, company, position, status, applied_date})
- (:CareerConnection {entity_id, tenant_id, name, company, relationship_type})
- (:Resume {entity_id, tenant_id, title, version, format})
- (:FinancialGoal {entity_id, tenant_id, name, target_amount, current_amount, target_date})
- (:InvestmentHolding {entity_id, tenant_id, symbol, quantity, cost_basis, current_value})
- (:Transaction {entity_id, tenant_id, amount, category, merchant, date})
- (:FamilyMember {entity_id, tenant_id, name, relationship, date_of_birth})
- (:HealthRecord {entity_id, tenant_id, record_type, date, provider})
- (:HealthMetric {entity_id, tenant_id, metric_type, value, unit, date})
- (:Document {entity_id, tenant_id, name, document_type, mime_type})
- (:Email {entity_id, tenant_id, subject, from_address, from_name, snippet, date, is_read, labels})
- (:CalendarEvent {entity_id, tenant_id, summary, location, start_time, end_time, all_day, attendee_count, is_organizer})

Relationships:
- (Person)-[:HAS_GOAL]->(Goal)
- (Person)-[:HAS_ACCOUNT]->(FinancialAccount)
- (Person)-[:HAS_RISK_ASSESSMENT]->(RiskAssessment)
- (Person)-[:HAS_CAREER_PROFILE]->(CareerProfile)
- (Person)-[:HAS_EDUCATION]->(EducationRecord)
- (Person)-[:HAS_COURSE]->(Course)
- (Person)-[:HAS_APPLICATION]->(JobApplication)
- (Person)-[:HAS_CONNECTION]->(CareerConnection)
- (Person)-[:HAS_RESUME]->(Resume)
- (Person)-[:HAS_FINANCIAL_GOAL]->(FinancialGoal)
- (Person)-[:HAS_HOLDING]->(InvestmentHolding)
- (Person)-[:HAS_TRANSACTION]->(Transaction)
- (Person)-[:HAS_FAMILY_MEMBER]->(FamilyMember)
- (Person)-[:HAS_HEALTH_RECORD]->(HealthRecord)
- (Person)-[:HAS_HEALTH_METRIC]->(HealthMetric)
- (Person)-[:HAS_DOCUMENT]->(Document)
- (Person)-[:HAS_EMAIL]->(Email)
- (Person)-[:HAS_EVENT]->(CalendarEvent)
- (Goal)-[:DEPENDS_ON]->(Goal)
- (FinancialGoal)-[:RELATED_TO_ACCOUNT]->(FinancialAccount)
- (Transaction)-[:IN_ACCOUNT]->(FinancialAccount)
- (InvestmentHolding)-[:IN_ACCOUNT]->(FinancialAccount)
- (FinancialGoal)-[:FOR_GOAL]->(Goal)"""

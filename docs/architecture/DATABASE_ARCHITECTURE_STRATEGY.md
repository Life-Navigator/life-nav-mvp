# Database Architecture Strategy

**Date**: 2026-01-09
**Status**: ✅ **CURRENT STATE DOCUMENTED** - Ready for Enhancement
**Owner**: Engineering Lead

---

## Executive Summary

### Current Reality (Good News!)

✅ **Supabase is CLEAN** - No PHI or PCI in core tables
- User profiles, goals, habits, notifications → All non-sensitive
- Gamification, achievements, preferences → Safe for cloud
- **No health diagnoses, no medical records, no account numbers**

⚠️ **Scenario Lab Has Potential Exposure** - But it's designed with controls
- Documents may contain photos of bank statements/medical bills
- Extracted fields have redaction tracking (`was_redacted`)
- Approval workflow prevents auto-use of sensitive data
- Audit logs track all access

✅ **Backend Databases Are Isolated** - Already designed correctly
- HIPAA database for health data (exists in schema, not yet used)
- Financial database for PCI data (exists in schema, not yet used)
- Core database for multi-tenancy

---

## Architecture Analysis

### Current 3-Database Architecture (Already Implemented!)

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE (Cloud)                        │
│  • Auth, profiles, UI preferences                           │
│  • Goals, habits, gamification                              │
│  • Notifications, achievements                              │
│  • Scenario Lab metadata (names, versions, runs)            │
│  • Document metadata (filenames, types, OCR status)         │
│  • Extracted fields (with redaction flags)                  │
│                                                             │
│  Security: RLS enabled, TLS in transit, user-level access  │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │ API calls
                             │
┌────────────────────────────┼────────────────────────────────┐
│                     BACKEND (Python/FastAPI)                │
│                                                             │
│  Three isolated database connections:                       │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   CORE DB   │  │  HIPAA DB   │  │ FINANCIAL   │       │
│  │             │  │             │  │     DB      │       │
│  │ • Tenants   │  │ • Health    │  │ • Accounts  │       │
│  │ • Users     │  │   conditions│  │ • Trans-    │       │
│  │ • Orgs      │  │ • Meds      │  │   actions   │       │
│  │ • Roles     │  │ • Allergies │  │ • Budgets   │       │
│  │ • Audit     │  │ • Vitals    │  │ • Assets    │       │
│  │             │  │ • Labs      │  │ • Loans     │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
│  Middleware: Data boundary enforcement (PHI/PCI blocker)   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (Current & Planned)

#### **Non-Sensitive Data** (Current - Working)
```
User → Supabase → Display
```
Examples: Profile updates, goal creation, habit tracking, XP progress

#### **Health Data** (Planned - Not Yet Implemented)
```
User → Backend API → HIPAA DB → Risk Engine (internal) → Supabase (aggregates only)
```
Examples:
- User enters "I have diabetes" → Stored in HIPAA DB
- Risk engine calculates: `health_risk_score = 0.72` → Stored in Supabase
- Frontend displays: "Health risk: Moderate" (no diagnosis shown)

#### **Financial Data** (Planned - Partially Implemented via Plaid)
```
User → Backend API → Financial DB → Risk Engine (internal) → Supabase (aggregates only)
```
Examples:
- Plaid connects bank account → Account number encrypted in Financial DB
- Risk engine calculates: `financial_buffer_months = 3.2` → Stored in Supabase
- Frontend displays: "Emergency fund: 3 months" (no account details shown)

#### **Scenario Lab Documents** (Current - Needs Enhancement)
```
User uploads bank statement PDF → Supabase (storage)
↓
OCR job extracts fields → scenario_extracted_fields table
↓
Backend redaction check → Sets `was_redacted=true` if SSN/CC found
↓
User approval required → Only approved fields → scenario_inputs
↓
Simulation runs → Results stored (no raw sensitive data)
```

---

## Sensitive Data Audit

### Supabase Tables - Sensitivity Classification

| Table | Sensitivity | Contains | Action Needed |
|-------|-------------|----------|---------------|
| **Core tables** (41 tables) | ✅ Non-sensitive | UI state, gamification, preferences | None |
| `scenario_documents` | ⚠️ **Potentially sensitive** | Photos of bank statements, medical bills | **Enhance redaction** |
| `scenario_extracted_fields` | ⚠️ **Potentially sensitive** | OCR output (redaction flag exists) | **Verify redaction logic** |
| `scenario_inputs` | ⚠️ **Potentially sensitive** | User-entered financial/timeline data | **Audit input types** |
| `scenario_reports` | ⚠️ **Potentially sensitive** | Generated PDFs (may synthesize data) | **Review report templates** |
| `scenario_jobs` | ⚠️ **Potentially sensitive** | Job queue (input_json, output_json) | **TTL + encryption** |
| `scenario_audit_log` | ⚠️ **Potentially sensitive** | Audit trail (changes column) | **Redact sensitive changes** |

### Backend Databases - Already Isolated ✅

| Database | Tables | Current Status | When to Use |
|----------|--------|----------------|-------------|
| **HIPAA** | 8 tables (health_conditions, medications, allergies, etc.) | Schema exists, not yet populated | When collecting actual health data |
| **Financial** | 6 tables (financial_accounts, transactions, budgets, etc.) | Schema exists, Plaid integration ready | When connecting real bank accounts |
| **Core** | 5 tables (organizations, tenants, users, roles, audit_logs) | Active, in use | Multi-tenancy foundation |

---

## Recommendations

### ✅ **Keep Supabase** (Don't Move Data Out)

**Why?**
1. Core tables are completely non-sensitive (profiles, goals, habits)
2. Scenario Lab has built-in protections (redaction flags, approval workflows)
3. Moving everything to backend would lose Supabase's strengths:
   - Real-time subscriptions
   - Row-Level Security (automatic user isolation)
   - Edge functions
   - Generous free tier

**Better Approach**: Enhance redaction, don't rebuild everything.

---

### 🔧 **Enhancement Plan** (Minimal Changes, Maximum Safety)

#### **Phase 1: Strengthen Scenario Lab Redaction** (This Sprint)

1. **Add Server-Side Redaction Middleware**
   - Location: `backend/app/middleware/scenario_redaction.py`
   - Intercepts `scenario_extracted_fields` writes
   - Auto-detects SSN, credit card, account numbers
   - Sets `was_redacted=true` before Supabase insert
   - Prevents raw sensitive data from ever touching cloud

2. **Update OCR Pipeline**
   - Location: `backend/app/services/ocr_service.py`
   - Run redaction **before** writing to Supabase
   - Replace detected patterns with: `[REDACTED-SSN]`, `[REDACTED-CC]`
   - Log redaction events to audit table

3. **Add Field-Level Encryption for scenario_inputs**
   - Encrypt `input_value` column (JSONB) at application level
   - Use AES-256-GCM with user-specific key
   - Decrypt only when loading into simulator
   - Prevents Supabase admins from seeing raw values

4. **Implement TTL for scenario_jobs**
   - Add `expires_at TIMESTAMPTZ` column
   - Auto-delete completed jobs after 7 days
   - Prevents accumulation of sensitive job payloads

#### **Phase 2: Activate Backend Databases** (Next Sprint)

1. **Health Data Collection**
   - When user enters diagnosis → Write to HIPAA DB
   - Calculate `health_risk_score` → Store aggregate in Supabase
   - Frontend only sees: "Moderate risk" (not "diabetes")

2. **Financial Accounts**
   - Plaid connection → Account details in Financial DB
   - Sync transactions daily → Encrypted in Financial DB
   - Calculate `emergency_fund_months` → Store in Supabase
   - Frontend sees: "3.2 months saved" (not account numbers)

#### **Phase 3: Mobile API Design** (Parallel with Phase 2)

1. **Design Mobile-First Endpoints**
   - RESTful API for iOS/Android
   - JWT authentication (already implemented)
   - Pagination for large datasets
   - Offline-first sync strategy

2. **Add GraphQL Layer** (Optional)
   - Single endpoint for flexible queries
   - Reduces round-trips for mobile
   - Better for spotty connections

---

## New Features Implementation Strategy

### **Feature 1: Win Probability Calculations** (Foundation First)

**Dependencies**: Market data pipeline (provides context for risk models)

**Implementation**:
1. Create `market_context_snapshots` table (backend Financial DB)
2. Daily cron job ingests market data (FRED, Stooq)
3. Risk engine uses market context for win probability
4. Store results in Supabase: `scenario_goal_snapshots.final_success_probability`

**Data Flow**:
```
Market Data (FRED) → Backend Financial DB → Risk Engine → Win Prob → Supabase
```

**No PHI/PCI involved** - Just market aggregates + scenario inputs

---

### **Feature 2: Market Context-Aware Risk Assessments**

**Dependencies**: Feature 1 (win prob) + market data pipeline

**Implementation**:
1. Extend `scenario_sim_runs` table with market context fields:
   - `market_snapshot_date` (which market data was used)
   - `inflation_rate_used`
   - `sp500_volatility_used`
   - `treasury_yield_used`
2. Risk engine adjusts probabilities based on market regime
3. Frontend shows: "Probability in current market: 65%" vs "Historical avg: 72%"

**Data Flow**:
```
Scenario Inputs (Supabase) + Market Context (Backend) → Risk Engine → Enhanced Probabilities → Supabase
```

---

### **Feature 3: Scenario Lab Enhancements**

**Planned Features**:
- Scenario branching (create variations)
- Side-by-side comparisons
- Collaborative scenarios (share with financial advisor)
- Version control improvements

**Implementation**:
- Extend existing `scenario_versions` table
- Add `parent_version_id` for branching
- Add `shared_with` JSONB for collaboration
- Add comparison views in frontend

**No database migration needed** - Schema is already flexible (JSONB fields)

---

## Migration Timeline (If You Want to Move Data)

### **Option A: No Migration** (Recommended)
- Keep Supabase as-is
- Enhance redaction
- Use backend databases for new health/finance features only
- **Time**: 1 sprint (redaction enhancements)

### **Option B: Partial Migration** (Conservative)
- Move `scenario_documents`, `scenario_extracted_fields` to backend
- Keep everything else in Supabase
- **Time**: 2 sprints (migration + testing)

### **Option C: Full Migration** (Not Recommended)
- Move all Supabase tables to backend databases
- Lose real-time, RLS, edge functions
- Rebuild auth, webhooks, triggers
- **Time**: 4-6 sprints (complete rebuild)

---

## Mobile App Considerations

### **Backend API Readiness** (Current State)

✅ **Already mobile-ready**:
- JWT authentication
- RESTful endpoints
- JSON responses
- CORS configured

⚠️ **Needs work**:
- Add pagination to all list endpoints
- Implement GraphQL (optional, but recommended)
- Add offline sync strategy
- Rate limiting per device (not just per IP)

### **Database Sync Strategy**

**Recommendation**: Use Supabase's real-time for mobile
- iOS/Android clients subscribe to Supabase directly (read-only)
- Writes go through backend API (validation + security)
- Best of both worlds: Real-time UI + backend control

---

## Security Compliance Summary

| Requirement | Current Status | Action Needed |
|-------------|----------------|---------------|
| **HIPAA BAA** | Not required yet (no PHI collected) | Activate when adding health features |
| **PCI-DSS** | Not required yet (no CC storage) | Plaid integration handles tokenization |
| **GDPR** | Partially compliant (user data in Supabase) | Add data export + deletion APIs |
| **SOC 2** | Not pursued yet | Consider for enterprise sales |
| **Data Boundaries** | ✅ Middleware enforces at gateway | Extend to scenario lab |
| **Encryption at Rest** | ✅ Supabase encrypts, backend uses AES-256-GCM | Add field-level encryption for scenario_inputs |
| **Audit Logging** | ✅ `scenario_audit_log` exists | Extend to all sensitive operations |

---

## Decision Framework

### **When to Use Supabase**:
- ✅ Non-sensitive data (profiles, goals, UI state)
- ✅ Real-time updates (gamification, notifications)
- ✅ User-isolated data (RLS is perfect for this)
- ✅ Rapid prototyping

### **When to Use Backend HIPAA DB**:
- ❌ Health diagnoses, medications, allergies
- ❌ Medical visit notes, lab results
- ❌ Anything subject to HIPAA

### **When to Use Backend Financial DB**:
- ❌ Account numbers, routing numbers
- ❌ Transaction details (if > 90 days old)
- ❌ Credit scores, debt balances
- ❌ Anything subject to PCI-DSS

### **When to Use Backend Core DB**:
- Multi-tenancy (organizations, workspaces)
- System audit logs (compliance)
- Reference data (not user-specific)

---

## Next Steps (Recommended Order)

### **Sprint 1: Staging Rehearsal + Redaction** (Current)
1. ✅ Complete staging rehearsal (Option A - done!)
2. Add scenario lab redaction middleware
3. Test data boundary enforcement with real documents
4. Verify redaction flags work correctly

### **Sprint 2: Market Data Pipeline** (Foundation)
1. Create `market_context_snapshots` table (backend Financial DB)
2. Implement daily cron job (FRED + Stooq ingestion)
3. Build internal API for risk engine consumption
4. Add caching layer (Redis)

### **Sprint 3: Win Probability + Market-Aware Risk**
1. Extend risk engine with market context
2. Implement Monte Carlo simulations
3. Add probability graphs to frontend
4. Store results in `scenario_goal_snapshots`

### **Sprint 4: Mobile API Prep**
1. Add pagination to all endpoints
2. Design offline sync strategy
3. Test with iOS/Android prototype
4. Add device-level rate limiting

### **Sprint 5: Scenario Lab V2**
1. Scenario branching
2. Side-by-side comparisons
3. Collaboration features
4. Enhanced version control

---

## Questions for Product/Eng Alignment

1. **Mobile Timeline**: When do iOS/Android apps need backend API ready?
   - This month → Prioritize Sprint 4 now
   - 1-2 months → Sprint 4 can wait
   - 3+ months → Focus on features first

2. **Health Data Collection**: When will you ask users for diagnoses/medications?
   - Beta launch → Activate HIPAA DB now
   - Post-MVP → Design schema, don't populate yet
   - Not planned → Keep schema, don't use

3. **Financial Accounts**: Is Plaid integration live?
   - Yes, users connecting banks → Use Financial DB now
   - No, mockup phase → Keep schema, test with fake data
   - Not decided → Design API, defer integration

4. **Market Data**: Which features depend on market context?
   - Win probability (Monte Carlo) → Critical
   - Market-aware risk → High priority
   - Economic scenario modeling → Nice-to-have

---

## Appendix: Current Schema Files

### Supabase Migrations
- `apps/web/supabase/migrations/001_initial_schema.sql` - Core tables
- `apps/web/supabase/migrations/004_enhanced_schema.sql` - Gamification
- `apps/web/supabase/migrations/005_scenario_lab_schema.sql` - Scenario Lab
- `apps/web/supabase/migrations/006_scenario_lab_rls.sql` - Row-Level Security
- `apps/web/supabase/migrations/007_scenario_lab_storage.sql` - Document storage

### Backend Migrations
- `backend/app/db/migrations/001_create_base_schema.sql` - Core multi-tenancy
- `backend/app/db/migrations/hipaa/001_create_health_schema.sql` - Health tables
- `backend/app/db/migrations/financial/001_create_finance_schema.sql` - Financial tables

---

**Status**: ✅ **Current architecture is sound - Enhance, don't rebuild**

**Recommendation**: Proceed with market data pipeline (Sprint 2) after staging rehearsal complete.

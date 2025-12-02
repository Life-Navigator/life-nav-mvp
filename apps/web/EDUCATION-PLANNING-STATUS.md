# Education Planning Module - Implementation Status

## 🎯 Overall Vision
Build the most advanced education ROI and planning system ever created - one that pressures colleges to justify their prices through radical transparency.

---

## ✅ COMPLETED (Phase 1)

### 1. Database Schema ✅
**Location:** `prisma/schema.prisma` (lines 3339-3694)

**Models Created:**
- `School` - School data repository with cost information
- `DegreeProgram` - Degree programs with career outcomes & ANIS data
- `StudentProfile` - Student information and career targets
- `EducationFinancingAccount` - 529, custodial, savings accounts
- `DegreeAnalysis` - Complete degree analysis results (Degree Decision Matrix)
- `DegreeComparison` - Multi-degree comparison engine
- `DegreeComparisonEntry` - Junction table for comparisons
- `EducationDocument` - Document uploads for OCR/extraction

**Relations Added to User Model:**
- `studentProfiles`
- `degreeAnalyses`
- `degreeComparisons`
- `educationDocuments`

### 2. Type Definitions ✅
**Location:** `src/lib/education-planning/types.ts`

**Comprehensive Types:**
- All enums and constants
- Core interfaces for all models
- Engine interfaces
- API response types
- ANIS system types
- Scenario analysis types

### 3. Calculation Engines ✅

#### Cost of Attendance Engine ✅
**Location:** `src/lib/education-planning/engines/cost-of-attendance.ts`

**Features:**
- Multi-year cost projections
- Tuition inflation modeling (default 3%)
- Living cost inflation modeling (default 2.5%)
- Scenario projections (conservative/base/optimistic)
- Cost breakdowns by category

#### Financing Waterfall Engine ✅
**Location:** `src/lib/education-planning/engines/financing-waterfall.ts`

**Features:**
- Priority-based fund allocation: 529 → Custodial → Savings → Cash Flow → Loans
- Account balance projection with growth
- Loan type determination (subsidized/unsubsidized/private)
- Coverage percentage calculations
- Required savings calculations

#### Career Outcomes Engine with ANIS ✅
**Location:** `src/lib/education-planning/engines/career-outcomes.ts`

**Features:**
- Full Alumni Network Impact Score (ANIS) system
- Network importance categorization (high/medium/low by degree type)
- ANIS calculation from network metrics
- Salary adjustments based on network strength
- Placement rate adjustments
- Underemployment risk calculations
- User network priority settings (high/medium/low)
- 10-year salary progression projections

**ANIS Factors:**
- Job placement multiplier
- Starting salary alpha
- Salary growth beta
- Underemployment gamma

#### ROI Engine ✅
**Location:** `src/lib/education-planning/engines/roi.ts`

**Features:**
- NPV (Net Present Value) calculations
- Payback period calculations
- Break-even year analysis
- Lifetime net value (30-year analysis)
- Cumulative ROI percentages
- Scenario analysis (conservative/base/optimistic)
- Debt service ratio calculations
- Loan payment amortization

#### Goal Alignment Engine ✅
**Location:** `src/lib/education-planning/engines/goal-alignment.ts`

**Features:**
- Integration with LifeNavigator goals system
- Impact analysis per goal (accelerates/delays/neutral/blocks)
- Goal category-specific logic:
  - Retirement savings impact
  - Home purchase timeline
  - Children's education savings
  - Emergency fund building
  - Wealth accumulation
  - Career advancement
  - Lifestyle goals
- Weighted alignment scoring (0-100)
- Priority-based weighting (essential/important/nice-to-have)

### 4. Degree Analysis Service ✅
**Location:** `src/lib/education-planning/services/degree-analysis.service.ts`

**Features:**
- Orchestrates all calculation engines
- Comprehensive degree analysis creation
- AI-powered analysis with:
  - Risk level assessment (low/medium/high/extreme)
  - Financial warnings
  - Actionable suggestions
  - "Worth It" score (0-100)
  - Plain language summary
- Debt-to-income ratio analysis
- Critical warning system for dangerous choices
- CRUD operations for analyses

---

## 🚧 IN PROGRESS (Phase 2)

### 1. Degree Comparison Service 🔨
Create service to compare multiple degrees side-by-side.

**Needs:**
- Ranking algorithm
- Weighted scoring based on user preferences
- Heat maps for risk/cost/ROI
- AI recommendation engine
- Side-by-side comparison logic

### 2. Education Financing Planner Service 🔨
Model how to realistically fund education over time.

**Needs:**
- Multi-account growth projections
- Savings strategy recommendations
- "What-if" scenario modeling
- Monthly contribution calculators
- Funding gap analysis

---

## 📋 TODO (Phase 3 - API Layer)

### 1. API Routes Needed

#### Student Profile Management
- `POST /api/education-planning/student-profiles` - Create student profile
- `GET /api/education-planning/student-profiles` - List profiles
- `GET /api/education-planning/student-profiles/[id]` - Get profile
- `PATCH /api/education-planning/student-profiles/[id]` - Update profile
- `DELETE /api/education-planning/student-profiles/[id]` - Delete profile

#### Financing Accounts
- `POST /api/education-planning/financing-accounts` - Add account
- `GET /api/education-planning/financing-accounts` - List accounts
- `PATCH /api/education-planning/financing-accounts/[id]` - Update account
- `DELETE /api/education-planning/financing-accounts/[id]` - Delete account

#### Degree Analysis (Decision Matrix)
- `POST /api/education-planning/degree-analysis` - **Create analysis**
- `GET /api/education-planning/degree-analysis` - List analyses
- `GET /api/education-planning/degree-analysis/[id]` - Get analysis
- `DELETE /api/education-planning/degree-analysis/[id]` - Delete analysis

#### Degree Comparison
- `POST /api/education-planning/degree-comparison` - Create comparison
- `GET /api/education-planning/degree-comparison` - List comparisons
- `GET /api/education-planning/degree-comparison/[id]` - Get comparison
- `PATCH /api/education-planning/degree-comparison/[id]` - Update weights
- `DELETE /api/education-planning/degree-comparison/[id]` - Delete comparison

#### Financing Planner
- `POST /api/education-planning/financing-plan` - Generate financing plan
- `GET /api/education-planning/financing-plan/[studentProfileId]` - Get plan

#### School & Degree Data
- `GET /api/education-planning/schools/search` - Search schools
- `GET /api/education-planning/schools/[id]` - Get school details
- `GET /api/education-planning/degree-programs/search` - Search programs
- `GET /api/education-planning/degree-programs/[id]` - Get program details

#### Document Upload & OCR
- `POST /api/education-planning/documents/upload` - Upload document
- `GET /api/education-planning/documents` - List documents
- `GET /api/education-planning/documents/[id]` - Get document
- `DELETE /api/education-planning/documents/[id]` - Delete document

---

## 📋 TODO (Phase 4 - UI Components)

### 1. Student Profile Setup
- Multi-step form for student profile creation
- Financing account connection
- Goal linking interface

### 2. Degree Decision Matrix UI
**Main Component:** Single degree analysis interface

**Sub-components:**
- School search & selection
- Degree program search
- Cost input form (with OCR assist)
- Financial aid entry
- Career expectations input
- Network priority slider
- Results dashboard:
  - Cost breakdown visualization
  - Financing waterfall chart
  - Salary progression chart
  - ROI metrics display
  - Payback timeline
  - Debt projections
  - Goal impact cards
  - Risk level indicator
  - AI warnings & suggestions
  - "Worth It" score gauge

### 3. Degree Comparison Engine UI
**Main Component:** Side-by-side comparison interface

**Sub-components:**
- Add degrees to compare (up to 5)
- Preference weight sliders
- Comparison table (sortable)
- Visual charts:
  - Cost comparison bars
  - ROI comparison
  - Payback period timeline
  - Risk heat map
  - Salary trajectory overlays
- AI recommendation panel
- Export comparison report

### 4. Education Financing Planner UI
**Main Component:** Savings & financing strategy interface

**Sub-components:**
- Account balance entry
- Contribution calculator
- Growth projection charts
- Funding gap analysis
- "What-if" scenario builder
- Savings recommendations
- Timeline to target coverage

### 5. Document Upload & OCR
- Drag-and-drop document upload
- OCR processing status
- Extracted data review/edit
- Auto-fill from documents

---

## 📋 TODO (Phase 5 - Data Integration)

### 1. School & Degree Data
**Sources Needed:**
- IPEDS (Integrated Postsecondary Education Data System)
- College Scorecard API
- Payscale salary data
- BLS (Bureau of Labor Statistics) occupation data
- State-specific cost of living indexes

**Implementation:**
- Data ingestion scripts
- Regular update jobs
- Manual override capability
- Community contribution system

### 2. Salary & Career Outcome Data
**Sources:**
- BLS Occupational Employment Statistics
- Payscale API
- LinkedIn salary insights
- School-reported outcomes (where available)

### 3. Alumni Network Data (ANIS)
**Sources:**
- LinkedIn alumni data (aggregated)
- School tier classifications (T14 law, M7 MBA, etc.)
- Placement reports from schools
- Industry recruiter surveys

**Seed Data Approach:**
- Start with tier-based ANIS scores:
  - Tier 1 (HYS, Wharton, etc.): ANIS 1.3-1.5
  - Tier 2 (Strong national): ANIS 1.1-1.3
  - Tier 3 (Average): ANIS 0.9-1.1
  - Tier 4 (Weak outcomes): ANIS 0.8-0.9

### 4. Financial Data Integrations
- Plaid integration for 529/brokerage accounts
- Manual entry fallback
- Secure document storage (Azure Blob)

---

## 📋 TODO (Phase 6 - Advanced Features)

### 1. Document Parsing System
- Azure Computer Vision OCR
- Financial aid letter parser
- 529 statement parser
- Scholarship award parser
- Structured data extraction

### 2. AI Coaching Layer
- OpenAI GPT-4 integration for:
  - Personalized analysis summaries
  - "What-if" scenario explanations
  - Actionable recommendations
  - Risk explanations in plain language

### 3. College Transfer Pathways
- Community college → university transfer analysis
- Cost savings calculations (60-80% potential savings)
- Articulation agreement data

### 4. Comparison with No-Degree Path
- Calculate opportunity cost of college
- Compare to entering workforce immediately
- Trade school alternatives

---

## 🎯 Success Metrics

### User Outcomes
- Average loan reduction vs. original plan
- Time saved from making poor choices
- Number of "financial trap" degrees avoided
- Number of better alternatives discovered

### Market Impact
- Schools forced to lower tuition due to transparency
- Increase in transfer pathway usage
- Shift in enrollment toward high-ROI programs
- Media coverage of tool's college price pressure

### Adoption
- Financial advisors using the tool
- High schools recommending it
- College counselors leveraging it
- Families sharing results

---

## 🚀 Next Steps (Priority Order)

1. **Create Degree Comparison Service** (2-3 hours)
2. **Create Financing Planner Service** (2-3 hours)
3. **Create API Routes** (4-5 hours for all)
4. **Build Core UI Components** (8-10 hours)
5. **Seed Initial School/Degree Data** (4-6 hours)
6. **Document Parsing System** (6-8 hours)
7. **AI Integration** (2-3 hours)
8. **Testing & Refinement** (4-6 hours)

**Total Estimated Time:** 32-44 hours of focused development

---

## 💡 Key Differentiators

This system is not just a calculator. It's a **market pressure tool** that will:

1. **Expose Bad Actors**: Schools with terrible ROI will be visible
2. **Highlight Value**: Underrated schools with great outcomes will shine
3. **Quantify Network Value**: For the first time, alumni network value is measurable
4. **Radical Transparency**: No more hiding behind "prestige" without data
5. **Empowers Families**: Data-driven decisions instead of marketing-driven
6. **Life Goal Integration**: Shows real impact on your actual life plans

---

## 📚 Documentation Needed

- API documentation
- User guides for each module
- Financial advisor training materials
- ANIS methodology white paper
- Data source documentation
- Privacy & security documentation

---

**Status as of:** 2025-12-01
**Phase Complete:** Phase 1 (Foundation)
**Next Milestone:** Phase 2 (Comparison & Financing Services)

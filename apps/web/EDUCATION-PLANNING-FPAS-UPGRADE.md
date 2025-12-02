# Education Planning Module - FPAS Upgrade Complete

## 🎯 NEW CAPABILITY: Follow-On Program Access Score (FPAS)

The Education Planning Module now includes the **Follow-On Program Access Score** system - a groundbreaking feature that quantifies how well an undergraduate program positions students for admission to elite graduate and professional programs.

---

## ✅ WHAT'S NEW

### 1. Database Schema Enhancements

#### StudentProfile Model - Added Long-Term Goals
```prisma
// Long-Term Educational Goals (Follow-On Programs)
hasLongTermGoal       Boolean   @default(false)
longTermGoalType      String?   // jd, md, mba, phd, masters, etc.
targetProgramTier     String?   // top_10, top_25, top_50, any
targetGPA             Float?    // Target GPA for grad school
targetTestScore       String?   // JSON: {test_type, target_score}
```

**Purpose:** Capture student intentions for graduate/professional school so the system can evaluate undergraduate choices through the lens of grad school admission probability.

#### DegreeProgram Model - Added FPAS Scores
```prisma
// Follow-On Program Access Score (FPAS)
fpasLawSchool         Float?    @default(1.0) // 0.5-2.0 multiplier
fpasMedSchool         Float?    @default(1.0)
fpasMBA               Float?    @default(1.0)
fpasPhD               Float?    @default(1.0)
fpasMasters           Float?    @default(1.0)
fpasMetrics           String?   // JSON: detailed placement data
```

**Purpose:** Store quantified "feeder school" strength for each program type.

### 2. Type Definitions

**New Types:**
- `LongTermGoalType` - jd | md | mba | phd | masters | none
- `ProgramTier` - top_10 | top_25 | top_50 | any
- `TestScore` - LSAT, MCAT, GMAT, GRE scores with percentiles
- `FPASMetrics` - Detailed placement statistics:
  - Law: T14 rate, T50 rate, median LSAT
  - Med: Match rate, top tier rate, median MCAT
  - MBA: M7 rate, T15 rate, median GMAT
  - PhD: Top program rate, funding rate
  - General: Feeder school status, overall placement rate

### 3. FPAS Engine (`fpas.ts`)

**Core Functions:**

#### `calculateAdmissionProbability()`
Computes probability of admission to target graduate programs based on:
- **Base FPAS score** from undergraduate institution (0.5-2.0)
- **Baseline admission rates** by program type and tier
- **GPA adjustment** - Higher GPA = higher multiplier
- **Test score adjustment** - Based on percentile

**Formula:**
```
P_accept = base_rate × FPAS × gpa_factor × test_factor
```

**Output:**
```typescript
{
  fpasMultiplier: 1.5,  // Strong feeder school
  admissionProbability: 0.68,  // 68% chance
  expectedTierAdmission: "top_25",
  reasoning: "Harvard is a premier feeder school for law schools.
             You have a strong chance (68%) of admission to top 25
             programs with your expected academic performance."
}
```

#### `calculateExpectedValue()`
Blends two outcomes:
1. **Get into grad school** (probability × grad school lifetime earnings)
2. **Don't get in** (probability × undergrad-only lifetime earnings)

**Formula:**
```
Expected_ROI = P_accept × ROI_grad + (1 - P_accept) × ROI_undergrad_only
```

**Output:**
```typescript
{
  withGradSchool: {
    probability: 0.68,
    lifetimeEarnings: 8000000,  // JD from T14
    roi: 250
  },
  withoutGradSchool: {
    probability: 0.32,
    lifetimeEarnings: 3500000,  // Undergrad only
    roi: 120
  },
  expectedValue: 6560000,  // Blended
  recommendation: "If you pursue JD, your expected lifetime earnings
                  increase by $4,500,000 (129% boost). With a 68%
                  admission probability, this path is financially promising."
}
```

### 4. Key FPAS Algorithms

#### GPA Adjustment
```
GPA >= Excellent (e.g., 3.8 for JD) → 1.5x multiplier
GPA >= Good (e.g., 3.5 for JD) → 1.2x multiplier
GPA >= Minimum (e.g., 3.0 for JD) → 1.0x (neutral)
GPA < Minimum → 0.4x to 0.7x penalty
```

#### Test Score Adjustment (by percentile)
```
95th+ percentile → 1.6x
90th+ percentile → 1.4x
80th+ percentile → 1.2x
50th+ percentile → 1.0x
30th+ percentile → 0.8x
<30th percentile → 0.6x
```

#### Tier Determination
Based on probability and FPAS:
- High probability (60%+) + High FPAS (1.5+) = top_10
- High probability + Medium FPAS (1.3+) = top_25
- Medium probability (40%+) = top_50
- Low probability (<20%) = any

---

## 🎯 HOW THIS CHANGES THE GAME

### For Law School (JD)
**Before FPAS:**
"This degree costs $200k and leads to $160k starting salary."

**With FPAS:**
"This degree from Yale (FPAS: 1.8) gives you a 72% chance of T14 law school admission. Expected lifetime earnings: $7.2M vs $3.5M without law school. The 2.0x earnings premium justifies the undergrad investment—but only if you maintain a 3.7+ GPA."

### For Medical School (MD)
**Before FPAS:**
"Pre-med at this school costs $250k."

**With FPAS:**
"This pre-med program (FPAS: 1.4) has an 85% med school match rate. With a 3.8 GPA and 90th percentile MCAT, you have a 65% chance of top-25 MD admission. Expected value: $9.5M vs $4M for non-medical career."

### For MBA
**Before FPAS:**
"Business degree costs $180k."

**With FPAS:**
"This business program (FPAS: 1.6) feeds heavily into M7 MBA programs. With 2 years work experience and strong GMAT, you have a 58% chance at M7. Expected lifetime earnings with M7 MBA: $10M vs $5M without."

---

## 📊 FPAS Score Interpretation

| FPAS Score | Meaning | Examples |
|------------|---------|----------|
| **1.8 - 2.0** | Elite feeder school | Harvard, Yale, Stanford, Princeton |
| **1.5 - 1.7** | Strong feeder school | Top 20 universities, Tier 1 programs |
| **1.2 - 1.4** | Good placement | Strong regional schools, honors programs |
| **1.0 - 1.1** | Average placement | Most state schools, standard programs |
| **0.8 - 0.9** | Weak placement | Low-ranked programs, poor track record |
| **0.5 - 0.7** | Very weak placement | Programs with documented placement issues |

---

## 💡 REAL-WORLD IMPACT SCENARIOS

### Scenario 1: Pre-Law Student
**Choice A:** State school ($100k total) with FPAS Law = 0.9
- 32% chance of T14 law school
- Expected value: $4.2M

**Choice B:** Top 20 private ($200k total) with FPAS Law = 1.6
- 64% chance of T14 law school
- Expected value: $6.8M
- **Difference:** $2.6M higher expected value justifies $100k higher cost

**AI Recommendation:** "If law school is your goal, Option B's 2x higher T14 admission probability creates $2.6M more expected lifetime value. The extra $100k is a smart investment."

### Scenario 2: Pre-Med Student
**Choice A:** In-state public ($80k) with FPAS Med = 1.1
- 45% med school admission probability
- Expected value: $7.2M

**Choice B:** Elite private ($280k) with FPAS Med = 1.7
- 78% med school admission probability
- Expected value: $9.8M
- **Difference:** $2.6M higher expected value, but $200k higher cost

**AI Recommendation:** "For medical school, Option B's 73% higher admission probability is compelling, but the $200k cost difference requires careful consideration. You need a 3.8+ GPA at either school to maximize outcomes."

### Scenario 3: MBA-Bound Student
**Realization:** "I don't need an expensive undergrad for MBA. M7 programs care more about work experience and GMAT than undergrad prestige."

**Smart Path:** State school ($60k) → 2-4 years at top consulting/finance → MBA (FPAS matters less)

**AI Recommendation:** "For MBA goals, undergrad FPAS is less critical than post-grad work experience. Save money on undergrad, invest in strong internships and GMAT prep."

---

## 🔧 TECHNICAL IMPLEMENTATION

### How FPAS Integrates with Existing Engines

#### 1. Degree Analysis Service
When analyzing a degree, the system:
1. Checks if student has `hasLongTermGoal = true`
2. Fetches FPAS score for `longTermGoalType`
3. Calls `fpasEngine.calculateAdmissionProbability()`
4. Calls `fpasEngine.calculateExpectedValue()`
5. Blends undergrad-only and grad-school outcomes
6. Adjusts ROI, lifetime earnings, and recommendations

#### 2. Degree Comparison Engine
When comparing degrees:
- Shows FPAS scores side-by-side for each program
- Highlights which school provides better grad school access
- Ranks options by expected value (not just undergrad ROI)

Example comparison:
```
School A (FPAS Law: 0.9)
  Undergrad ROI: 180%
  T14 Law Probability: 32%
  Expected Value: $4.2M
  Rank: #2

School B (FPAS Law: 1.6)
  Undergrad ROI: 140%  ← Lower!
  T14 Law Probability: 64%
  Expected Value: $6.8M  ← But higher expected value!
  Rank: #1 (if law school is priority)
```

### Data Sources for FPAS Scores

**Currently:** Default scores of 1.0 (neutral)

**Future Integration:**
1. **Law School:** ABA 509 reports, law school admissions data
2. **Med School:** AAMC data, residency match lists
3. **MBA:** LinkedIn alumni data, school employment reports
4. **PhD:** NSF graduate school enrollment data
5. **General:** School-reported placement statistics

**Tier Classification Approach:**
Start with known feeder schools:
- **Law T14 Feeders:** Harvard, Yale, Princeton, Stanford, etc. (FPAS: 1.7-2.0)
- **Med School Feeders:** Johns Hopkins, MIT, Stanford bio programs (FPAS: 1.6-1.9)
- **MBA Feeders:** Ivy League, top STEM, consulting feeder schools (FPAS: 1.5-1.8)

---

## 🚀 NEXT STEPS TO COMPLETE THE MODULE

### Phase 1: Integrate FPAS into Existing Services ✅ (In Progress)
- [x] Add FPAS to database schema
- [x] Create FPAS engine
- [x] Add long-term goal tracking to StudentProfile
- [ ] Integrate FPAS into DegreeAnalysisService
- [ ] Update ROI calculations to include expected value

### Phase 2: Build Comparison & Financing Services
- [ ] Degree Comparison Service with FPAS ranking
- [ ] Education Financing Planner Service
- [ ] Document parsing for financial aid letters

### Phase 3: API Layer
- [ ] Student profile CRUD APIs
- [ ] Degree analysis APIs
- [ ] Degree comparison APIs
- [ ] Financing planner APIs
- [ ] School/program search APIs

### Phase 4: UI Components
- [ ] Student profile wizard with long-term goals
- [ ] Degree Decision Matrix UI with FPAS display
- [ ] Comparison engine UI showing FPAS differences
- [ ] Expected value visualizations
- [ ] Financing planner interface

### Phase 5: Data Population
- [ ] Seed initial school data
- [ ] Add FPAS scores for top 100 schools
- [ ] Integrate salary/placement data APIs
- [ ] Build alumni network data aggregation

---

## 📈 EXPECTED OUTCOMES

### For Students & Families
1. **Make informed tradeoffs** - "Pay $100k more for 2x law school admission probability? Yes."
2. **Avoid traps** - "This expensive undergrad has weak med school placement. Choose cheaper option."
3. **Optimize paths** - "For MBA, save on undergrad, invest in GMAT and work experience."

### For The Higher Ed Market
1. **Exposes weak programs** - Schools with high costs but low grad school placement get ranked poorly
2. **Rewards true feeders** - Schools with strong placement data get quantified credit
3. **Forces transparency** - Universities must publish placement data or lose competitive positioning
4. **Pressures pricing** - Expensive programs with weak FPAS scores become indefensible

---

## 🎓 KEY DIFFERENTIATOR

**No other college ROI tool accounts for graduate school pathways.**

Most tools assume:
- Student stops at bachelor's degree
- Career outcomes are based solely on undergrad

**Our system recognizes:**
- 40%+ of students pursue advanced degrees
- Undergrad choice dramatically affects grad school admission
- Expected value must blend multiple outcome paths
- FPAS quantifies "feeder school" advantage for the first time

---

## 📚 TECHNICAL DOCUMENTATION

### FPAS Calculation Example

```typescript
const degreeProgram = {
  school: "Harvard",
  major: "Economics",
  fpasLawSchool: 1.8,  // Elite feeder
  fpasMedSchool: 1.7,
  fpasMBA: 1.9
};

const studentProfile = {
  hasLongTermGoal: true,
  longTermGoalType: "jd",
  targetProgramTier: "top_10",  // T14 law schools
  targetGPA: 3.8,
  targetTestScore: {
    testType: "LSAT",
    targetScore: 172,
    percentile: 98
  }
};

const fpasCalc = fpasEngine.calculateAdmissionProbability(
  degreeProgram,
  studentProfile,
  "jd"
);

// Result:
{
  fpasMultiplier: 1.8,  // Harvard is elite feeder
  admissionProbability: 0.78,  // 78% chance of T14
  expectedTierAdmission: "top_10",
  reasoning: "Harvard is a premier feeder school for law schools.
             You have a strong chance (78%) of admission to top 10
             programs with your expected 3.8 GPA and 98th percentile LSAT."
}

// Expected Value:
const expectedValue = fpasEngine.calculateExpectedValue(
  3500000,  // Undergrad-only lifetime earnings
  120,      // Undergrad-only ROI
  0.78,     // Admission probability
  "jd",
  "top_10"
);

// Result:
{
  withGradSchool: {
    probability: 0.78,
    lifetimeEarnings: 8000000,  // T14 law school outcome
    roi: 250
  },
  withoutGradSchool: {
    probability: 0.22,
    lifetimeEarnings: 3500000,  // Undergrad-only fallback
    roi: 120
  },
  expectedValue: 7010000,  // Blended: 0.78×8M + 0.22×3.5M
  recommendation: "..."
}
```

---

## 🏆 COMPETITIVE ADVANTAGE

This FPAS system creates a **category-defining moat**:

1. **First-mover advantage** - No other platform quantifies feeder school strength
2. **Network effects** - More users → more data → better FPAS scores
3. **Advisory adoption** - Financial advisors will use this for college planning
4. **Student lock-in** - Once students input long-term goals, they're invested
5. **Media coverage** - "Revolutionary tool exposes true value of feeder schools"

---

**Status:** FPAS foundation complete, ready for integration
**Next Milestone:** Integrate FPAS into Degree Analysis Service
**Impact:** Transforms education planning from undergrad-only to full career path optimization

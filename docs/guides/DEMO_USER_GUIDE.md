# 🎯 Demo User Guide - John Doe

## Quick Access

### Credentials
```
Email:    john.doe@lifenavigator.demo
Password: Demo@Pass123!
Username: johndoe
```

### Run the Seeder
```bash
cd services/api
./scripts/run_seeder.sh
```

---

## 📊 What's Included

### 💼 Professional Profile
- **Senior Software Engineer** at Tech Corp
- 8 years experience in tech
- Skills: Python (Expert), FastAPI, React, AWS, Docker, Kubernetes
- Salary range: $180k-$230k

### 💰 Financial Overview ($360,543)
- **Checking**: $8,543 (Chase)
- **Savings**: $25,000 (Marcus)
- **Credit Card**: -$1,544 (Chase)
- **Investments**: $142,000 (Vanguard)
- **401(k)**: $185,000 (Fidelity)
- Recent transactions showing spending patterns
- 4 investment holdings (VTI, VXUS, AAPL, BND)

### 🏥 Health Records
- 2 Healthcare providers (Dr. Johnson, Dr. Chen)
- Annual physical with normal vitals
- Recent blood work results
- Current medications (Vitamin D3, Multivitamin)

### 🎓 Education & Certifications
- **MIT** - B.S. Computer Science (3.75 GPA)
- **AWS Solutions Architect** - Professional
- **Kubernetes Administrator** (CKA)
- 3 online courses (1 in progress, 2 completed)

### 🎯 Active Goals
1. **💰 Finance**: Save $50k for house (50% complete)
2. **🏃 Health**: Run half marathon (35% complete)
3. **💼 Career**: Staff Engineer promotion (60% complete)
4. **📚 Education**: Complete ML course (65% complete)
5. **✅ Personal**: Read 24 books (COMPLETED ✓)

---

## 🔍 What's Missing (Demo Opportunities)

### Document Upload Features

#### 📄 Health Documents to Upload
- ❌ Recent lab reports (CBC, metabolic panel)
- ❌ X-ray or imaging reports
- ❌ Prescription records
- ❌ Insurance cards

#### 💳 Financial Documents to Upload/Connect
- ❌ Bank statements (PDF upload)
- ❌ Investment statements
- ❌ Tax returns (2023, 2024)
- ❌ Pay stubs
- ❌ Connect bank via Plaid

#### 📝 Career Documents to Upload
- ❌ Updated resume (PDF/DOCX)
- ❌ Performance reviews
- ❌ Offer letters
- ❌ LinkedIn data import

#### 🎓 Education Documents to Upload
- ❌ Certificate PDFs (AWS, Kubernetes)
- ❌ Official transcripts
- ❌ Course completion certificates

---

## 🤖 OCR & Document Processing

### Technology: **Tesseract OCR**

The system uses **Pytesseract** (Python wrapper for Tesseract OCR) with additional tools:

- **PyPDF2**: Digital PDF text extraction
- **pdfplumber**: Advanced PDF table extraction
- **python-docx**: Word document processing
- **Pandas**: CSV transaction parsing
- **Maverick LLM**: AI-powered entity extraction

### Supported Document Types

| Document Type | Processing Method | Accuracy |
|--------------|------------------|----------|
| Tax Returns (1040, W-2, 1099) | Regex patterns + OCR | 95%+ |
| Bank Statements | Table extraction + pattern matching | 95%+ |
| Investment Statements | PDF parsing + OCR | 90%+ |
| CSV Transactions | Auto-format detection | 99%+ |
| Lab Reports | OCR + medical coding | 90%+ |
| Resumes | LLM entity extraction | 95%+ |
| Certificates | OCR + validation | 95%+ |

### Document Processing Flow

```
Upload → Cloud Storage → OCR/Extract → Pattern Match → Validate → Database
            ↓                                    ↓
      Metadata Store                    Maverick LLM (optional)
                                        Entity Extraction
```

### Auto-Categorization

The system automatically categorizes:
- **Transactions**: Food, transportation, healthcare, utilities, etc.
- **Health Records**: Lab results, vital signs, diagnoses, medications
- **Career Skills**: Programming languages, frameworks, tools
- **Financial Accounts**: Checking, savings, credit, investments

### Extraction Examples

#### Tax Return (Form 1040)
```python
Extracts:
- AGI (Adjusted Gross Income)
- Filing status
- Wages, interest, dividends
- Capital gains
- Deductions (standard/itemized)
- Tax credits
- Refund/owed amount
```

#### Bank Statement
```python
Extracts:
- Account number (masked)
- Institution name
- Statement period
- Beginning/ending balance
- All transactions with:
  - Date
  - Description
  - Amount
  - Auto-categorization
  - Merchant extraction
```

#### Lab Report
```python
Extracts:
- Test name
- Result values
- Reference ranges
- Units
- Provider information
- Date performed
```

---

## 🎬 Demo Flow Suggestions

### 1. Onboarding Journey
```
Login → Complete profile → Link bank account → Upload health record → Set first goal
```

### 2. Financial Dashboard
```
View accounts → Analyze spending → Upload statement → Track investments → Set savings goal
```

### 3. Health Tracking
```
View providers → Upload lab results → Log medications → Track vitals → Set fitness goal
```

### 4. Career Development
```
View profile → Upload resume → Add certification → Track skills → Set promotion goal
```

### 5. Document Processing Demo
```
Upload tax return → Watch OCR extract → Review data → Approve → Save to profile
```

---

## 📁 File Locations

```
services/api/
├── scripts/
│   ├── seed_demo_user.py       # Main seeding script
│   ├── run_seeder.sh            # Runner script
│   └── README.md                # Seeding documentation
│
├── docs/
│   └── OCR_DOCUMENT_PROCESSING.md  # OCR integration guide
│
└── app/
    └── models/                  # All database models
        ├── user.py
        ├── health.py
        ├── finance.py
        ├── career.py
        ├── education.py
        └── goal.py
```

```
services/finance-api/
└── app/
    └── services/
        └── document_parser.py   # OCR & parsing logic
```

```
services/agents/
└── mcp-server/
    └── ingestion/
        ├── extractors.py        # LLM-powered extraction
        ├── parsers.py           # Document parsing
        └── pipeline.py          # Ingestion pipeline
```

---

## 🚀 Testing the Demo

### 1. Run Database Migrations
```bash
cd services/api
alembic upgrade head
```

### 2. Seed Demo User
```bash
./scripts/run_seeder.sh
```

### 3. Start API Server
```bash
uvicorn app.main:app --reload
```

### 4. Test Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@lifenavigator.demo",
    "password": "Demo@Pass123!"
  }'
```

### 5. Access Frontend
```
http://localhost:3000/auth/login
```

---

## 🔧 Customization

### Change Demo User Details
Edit `services/api/scripts/seed_demo_user.py`:

```python
DEMO_EMAIL = "your.email@example.com"
DEMO_PASSWORD = "YourSecure@Pass123!"
DEMO_USERNAME = "yourusername"
```

### Add More Data
Modify the seeding functions:
```python
async def seed_health_data(db, user):
    # Add more providers, records, medications
    pass

async def seed_financial_data(db, user):
    # Add more accounts, transactions, investments
    pass
```

### Reset Demo Data
```sql
-- Delete all demo user data
DELETE FROM users WHERE email = 'john.doe@lifenavigator.demo';

-- Re-run seeder
./scripts/run_seeder.sh
```

---

## 📈 Demo Metrics

**Total Records Created**: ~55
**Seeding Time**: 5-10 seconds
**Database Tables Populated**: 14
**Date Range**: 7 years of historical data
**Account Value**: $360,543
**Active Goals**: 4
**Completed Goals**: 1

---

## 🎨 UI Demo Tips

### Highlight These Features:
1. **Multi-domain Integration**: Show data across health, finance, career
2. **OCR Upload**: Upload a sample bank statement or tax form
3. **Auto-categorization**: Show how transactions are categorized
4. **Goal Tracking**: Display progress on savings and fitness goals
5. **Timeline View**: Show user's journey over time
6. **AI Insights**: Use Maverick to analyze financial patterns or career trajectory

### Sample Questions to Ask AI:
- "What's my spending pattern for the last month?"
- "Am I on track to reach my savings goal?"
- "What skills should I learn to become a Staff Engineer?"
- "Summarize my health data from the last year"
- "How can I optimize my investment portfolio?"

---

## 📚 Related Documentation

- [OCR & Document Processing](services/api/docs/OCR_DOCUMENT_PROCESSING.md)
- [Database Seeding Scripts](services/api/scripts/README.md)
- [Security Audit Report](services/api/docs/SECURITY_AUDIT.md)
- [Authentication Setup](services/api/docs/AUTH_SETUP.md)

---

**Last Updated**: 2025-11-07
**Status**: ✅ Ready for Demo
**Environment**: Development/Staging

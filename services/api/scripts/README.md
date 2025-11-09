# Database Seeding Scripts

## Demo User: John Doe

### Overview
The demo user seeding script creates a fully functional demonstration account with realistic data across all Life Navigator domains. This allows for comprehensive testing and demonstration of the platform's capabilities.

### Quick Start

```bash
cd services/api
./scripts/run_seeder.sh
```

Or run directly with Python:

```bash
cd services/api
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python3 scripts/seed_demo_user.py
```

### Demo User Credentials

```
Email:    john.doe@lifenavigator.demo
Password: Demo@Pass123!
Username: johndoe
```

**Note**: The password meets all security requirements:
- 8+ characters
- Uppercase letter
- Lowercase letter
- Number
- Special character

### What Gets Seeded

#### 1. User Profile
- **Name**: John Doe
- **Role**: Software Engineer
- **Location**: San Francisco, CA
- **Status**: Active & Email Verified
- **Created**: 180 days ago (simulated existing user)

#### 2. Health Data
- **2 Healthcare Providers**
  - Dr. Sarah Johnson (Primary Care)
  - Dr. Michael Chen (Dentist)

- **3 Health Records**
  - Annual physical exam with vitals
  - Blood work results
  - Flu vaccination

- **2 Medications**
  - Vitamin D3
  - Multivitamin

#### 3. Financial Data
- **5 Financial Accounts**
  - Chase Checking: $8,543.21
  - Marcus Savings: $25,000.00
  - Chase Credit Card: -$1,543.87
  - Vanguard Brokerage: $142,000.00
  - Fidelity 401(k): $185,000.00

- **8 Recent Transactions** (last 30 days)
  - Salary deposit
  - Rent payment
  - Groceries, dining
  - Utilities
  - Subscriptions
  - Fitness membership

- **4 Investment Holdings**
  - VTI (Total Stock Market ETF): $48,000
  - VXUS (International ETF): $35,000
  - AAPL (Apple Stock): $9,500
  - BND (Bond ETF): $49,500

#### 4. Career Data
- **Career Profile**
  - Current: Senior Software Engineer at Tech Corp
  - 8 years experience
  - Salary expectation: $180k-$230k

- **3 Job Experiences**
  - Tech Corp (2022-Present): Senior Software Engineer
  - StartupXYZ (2018-2022): Software Engineer
  - Consulting Firm (2015-2018): Junior Developer

- **14 Technical Skills**
  - Languages: Python (Expert), JavaScript/TypeScript, SQL, Go
  - Frameworks: FastAPI (Expert), React, Django
  - Cloud/DevOps: AWS, Docker (Expert), Kubernetes, CI/CD
  - Databases: PostgreSQL (Expert), Redis, MongoDB

#### 5. Education Data
- **1 Degree**
  - MIT - B.S. Computer Science (3.75 GPA)

- **3 Courses**
  - Advanced Machine Learning (65% complete - IN PROGRESS)
  - System Design for Interviews (COMPLETED)
  - Kubernetes for Developers (COMPLETED)

- **2 Certifications**
  - AWS Solutions Architect - Professional
  - Certified Kubernetes Administrator (CKA)

#### 6. Goals & Milestones
- **5 Goals** across different categories:
  - 💰 **FINANCE**: Save $50k for house (50% complete)
  - 🏃 **HEALTH**: Run half marathon (35% complete)
  - 💼 **CAREER**: Staff Engineer promotion (60% complete)
  - 📚 **EDUCATION**: Complete ML course (65% complete)
  - ✅ **PERSONAL**: Read 24 books (COMPLETED)

- **4 Milestones** for savings goal
  - 2 completed, 2 in progress

### Intentional Gaps for Demo

The demo user has **strategic data gaps** to showcase upload/connection features:

#### Ready to Upload/Connect:
- 📄 **Health**: Lab reports, X-rays, prescriptions
- 💳 **Finance**: Bank statements, tax returns, pay stubs
- 📝 **Career**: Updated resume, performance reviews
- 🎓 **Education**: Certificate PDFs, transcripts

This allows you to demonstrate:
1. Document upload and OCR processing
2. Bank account connection (Plaid integration)
3. Data enrichment workflows
4. Manual data entry vs. automated import

### Database Schema

The seeder populates the following tables:
- `users`
- `health_records`
- `health_providers`
- `medications`
- `financial_accounts`
- `transactions`
- `investments`
- `career_profiles`
- `job_experiences`
- `skills`
- `education_records`
- `courses`
- `certifications`
- `goals`
- `goal_milestones`

### Timestamps

All data includes realistic timestamps:
- User created 180 days ago
- Accounts created at varying times (2-7 years ago)
- Recent transactions (last 30 days)
- Current and completed goals
- Ongoing courses with progress

### Re-running the Seeder

The seeder is **idempotent** - it checks if the demo user exists:
- If user exists: Uses existing user, skips creation
- If user doesn't exist: Creates new user with all data

To completely reset:
```sql
-- Delete demo user and all related data
DELETE FROM users WHERE email = 'john.doe@lifenavigator.demo';
```

Then re-run the seeder.

### Customization

To modify demo data, edit `scripts/seed_demo_user.py`:

```python
# Change user details
DEMO_EMAIL = "john.doe@lifenavigator.demo"
DEMO_PASSWORD = "Demo@Pass123!"
DEMO_USERNAME = "johndoe"

# Modify any seeding function:
# - seed_health_data()
# - seed_financial_data()
# - seed_career_data()
# - seed_education_data()
# - seed_goals_data()
```

### Troubleshooting

#### Database Connection Issues
```bash
# Check if PostgreSQL is running
pg_isready

# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

#### Import Errors
```bash
# Ensure you're in the right directory
cd services/api

# Set PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

#### Migration Issues
```bash
# Run migrations first
alembic upgrade head
```

### Testing the Demo User

After seeding, test the login:

```bash
# Using curl
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@lifenavigator.demo",
    "password": "Demo@Pass123!"
  }'
```

Or through the frontend:
1. Navigate to http://localhost:3000/auth/login
2. Enter demo credentials
3. Explore the dashboard with pre-populated data

### Performance

Seeding takes approximately **5-10 seconds** and creates:
- 1 user
- 2 providers
- 3 health records
- 2 medications
- 5 financial accounts
- 8 transactions
- 4 investments
- 1 career profile
- 3 job experiences
- 14 skills
- 1 education record
- 3 courses
- 2 certifications
- 5 goals
- 4 milestones

**Total**: ~55 database records

### Security Notes

⚠️ **Important**: This is a DEMO account only!

- Do NOT use in production without modification
- Password is publicly visible (change for any production demo)
- All data is fictional
- No real PII or financial information

For production demos:
1. Use environment variables for credentials
2. Create unique demo tenants
3. Add data expiration/cleanup policies
4. Implement demo account restrictions

---

**Related Documentation**:
- [OCR & Document Processing](../docs/OCR_DOCUMENT_PROCESSING.md)
- [Authentication Setup](../docs/AUTH_SETUP.md)
- [Database Migrations](../alembic/README.md)

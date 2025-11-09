"""
Database Seeding Script for Demo User: John Doe

Creates a demo user with realistic data across all domains:
- Health records, medications, providers
- Financial accounts, transactions, investments
- Career profile, job experiences, skills
- Education records, courses, certifications
- Goals and milestones

Some areas are left incomplete to demonstrate data upload/connection features.
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.health import HealthRecord, HealthProvider, Medication
from app.models.finance import FinancialAccount, Transaction, Investment
from app.models.career import CareerProfile, JobExperience, Skill
from app.models.education import EducationRecord, Course, Certification
from app.models.goal import Goal, GoalMilestone


# Demo user credentials
DEMO_EMAIL = "john.doe@lifenavigator.demo"
DEMO_PASSWORD = "Demo@Pass123!"  # Meets our new password requirements
DEMO_USERNAME = "johndoe"


async def create_demo_user(db: AsyncSession) -> User:
    """Create the demo user John Doe"""

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        print(f"✓ Demo user already exists: {DEMO_EMAIL}")
        return existing_user

    user = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        username=DEMO_USERNAME,
        hashed_password=get_password_hash(DEMO_PASSWORD),
        first_name="John",
        last_name="Doe",
        full_name="John Doe",
        phone="+1-555-123-4567",
        bio="Software Engineer passionate about personal development and financial independence. Fitness enthusiast and lifelong learner.",
        is_active=True,
        is_verified=True,  # Pre-verified for demo
        tenant_id=f"tenant_{DEMO_USERNAME}",
        created_at=(datetime.now(timezone.utc) - timedelta(days=180)).replace(tzinfo=None),
        email_verified_at=(datetime.now(timezone.utc) - timedelta(days=180)).replace(tzinfo=None),
    )

    db.add(user)
    await db.flush()
    print(f"✓ Created demo user: {user.email}")
    return user


async def seed_health_data(db: AsyncSession, user: User):
    """Seed health records, providers, and medications"""

    # Health Providers
    providers = [
        HealthProvider(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            name="Dr. Sarah Johnson",
            specialty="Primary Care Physician",
            npi_number="1234567890",
            phone="+1-555-234-5678",
            email="sarah.johnson@healthclinic.com",
            address_line1="123 Medical Plaza, Suite 200",
            city="San Francisco",
            state="CA",
            zip_code="94102",
        ),
        HealthProvider(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            name="Dr. Michael Chen",
            specialty="Dentist",
            npi_number="0987654321",
            phone="+1-555-345-6789",
            email="mchen@dentalcare.com",
            address_line1="456 Dental Center",
            city="San Francisco",
            state="CA",
            zip_code="94103",
        ),
    ]

    for provider in providers:
        db.add(provider)

    await db.flush()

    # Health Records
    records = [
        HealthRecord(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            record_type="VITAL_SIGNS",
            title="Annual Physical Exam",
            description="Routine annual checkup - all vitals normal",
            record_date=datetime.now(timezone.utc) - timedelta(days=45),
            provider_id=providers[0].id,
            vitals={
                "blood_pressure": "120/80",
                "heart_rate": 72,
                "temperature": 98.6,
                "weight": 175,
                "height": 70,
                "bmi": 25.1
            },
        ),
        HealthRecord(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            record_type="LAB_RESULT",
            title="Annual Blood Work",
            description="Comprehensive metabolic panel and lipid panel",
            record_date=datetime.now(timezone.utc) - timedelta(days=40),
            provider_id=providers[0].id,
            lab_results={
                "cholesterol_total": 185,
                "cholesterol_hdl": 55,
                "cholesterol_ldl": 110,
                "triglycerides": 100,
                "glucose": 92,
                "vitamin_d": 35
            },
        ),
        HealthRecord(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            record_type="IMMUNIZATION",
            title="Flu Vaccine",
            description="Annual influenza vaccination",
            record_date=datetime.now(timezone.utc) - timedelta(days=120),
            provider_id=providers[0].id,
        ),
    ]

    for record in records:
        db.add(record)

    # Medications
    medications = [
        Medication(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            name="Vitamin D3",
            generic_name="Cholecalciferol",
            dosage="2000 IU",
            frequency="Once daily",
            prescriber_name="Dr. Sarah Johnson",
            start_date=(datetime.now(timezone.utc) - timedelta(days=60)).date(),
            is_active=True,
        ),
        Medication(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            name="Multivitamin",
            generic_name="Multivitamin/Multimineral",
            dosage="1 tablet",
            frequency="Once daily",
            start_date=(datetime.now(timezone.utc) - timedelta(days=365)).date(),
            is_active=True,
        ),
    ]

    for medication in medications:
        db.add(medication)

    print(f"✓ Seeded health data: {len(providers)} providers, {len(records)} records, {len(medications)} medications")


async def seed_financial_data(db: AsyncSession, user: User):
    """Seed financial accounts, transactions, and investments"""

    # Financial Accounts
    checking_account = FinancialAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=user.tenant_id,
        account_type="CHECKING",
        name="Primary Checking",
        institution_name="Chase Bank",
        account_number_last4="4789",
        current_balance=Decimal("8543.21"),
        currency="USD",
        is_active=True,
        created_at=(datetime.now(timezone.utc) - timedelta(days=1825)).replace(tzinfo=None),  # 5 years ago
    )

    savings_account = FinancialAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=user.tenant_id,
        account_type="SAVINGS",
        name="High Yield Savings",
        institution_name="Marcus by Goldman Sachs",
        account_number_last4="1234",
        current_balance=Decimal("25000.00"),
        currency="USD",
        is_active=True,
        created_at=(datetime.now(timezone.utc) - timedelta(days=730)).replace(tzinfo=None),  # 2 years ago
    )

    credit_card = FinancialAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=user.tenant_id,
        account_type="CREDIT_CARD",
        name="Travel Rewards Card",
        institution_name="Chase",
        account_number_last4="8901",
        current_balance=Decimal("-1543.87"),  # Negative for credit card debt
        currency="USD",
        is_active=True,
        created_at=(datetime.now(timezone.utc) - timedelta(days=1095)).replace(tzinfo=None),  # 3 years ago
    )

    investment_account = FinancialAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=user.tenant_id,
        account_type="INVESTMENT",
        name="Vanguard Brokerage",
        institution_name="Vanguard",
        account_number_last4="5678",
        current_balance=Decimal("142000.00"),
        currency="USD",
        is_active=True,
        created_at=(datetime.now(timezone.utc) - timedelta(days=2190)).replace(tzinfo=None),  # 6 years ago
    )

    retirement_account = FinancialAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=user.tenant_id,
        account_type="RETIREMENT",
        name="401(k)",
        institution_name="Fidelity",
        account_number_last4="9012",
        current_balance=Decimal("185000.00"),
        currency="USD",
        is_active=True,
        created_at=(datetime.now(timezone.utc) - timedelta(days=2555)).replace(tzinfo=None),  # 7 years ago
    )

    accounts = [checking_account, savings_account, credit_card, investment_account, retirement_account]
    for account in accounts:
        db.add(account)

    await db.flush()

    # Recent Transactions (last 30 days)
    transactions = [
        # Income
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=checking_account.id,
            transaction_type="INCOME",
            amount=Decimal("5800.00"),
            category="Salary",
            description="Payroll Deposit - Tech Corp",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=15),
            merchant_name="Tech Corp",
        ),
        # Housing
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=checking_account.id,
            transaction_type="EXPENSE",
            amount=Decimal("2400.00"),
            category="Rent",
            description="Monthly Rent Payment",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=1),
            merchant_name="Landlord",
        ),
        # Groceries
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=credit_card.id,
            transaction_type="EXPENSE",
            amount=Decimal("127.43"),
            category="Groceries",
            description="Whole Foods Market",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=3),
            merchant_name="Whole Foods",
        ),
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=credit_card.id,
            transaction_type="EXPENSE",
            amount=Decimal("85.22"),
            category="Groceries",
            description="Trader Joe's",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=10),
            merchant_name="Trader Joe's",
        ),
        # Dining
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=credit_card.id,
            transaction_type="EXPENSE",
            amount=Decimal("45.67"),
            category="Dining",
            description="Chipotle Mexican Grill",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=5),
            merchant_name="Chipotle",
        ),
        # Utilities
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=checking_account.id,
            transaction_type="EXPENSE",
            amount=Decimal("78.90"),
            category="Utilities",
            description="PG&E Electric Bill",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=7),
            merchant_name="PG&E",
        ),
        # Subscription
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=credit_card.id,
            transaction_type="EXPENSE",
            amount=Decimal("15.99"),
            category="Entertainment",
            description="Netflix Subscription",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=12),
            merchant_name="Netflix",
        ),
        # Fitness
        Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=credit_card.id,
            transaction_type="EXPENSE",
            amount=Decimal("89.00"),
            category="Health & Fitness",
            description="24 Hour Fitness Membership",
            transaction_date=datetime.now(timezone.utc) - timedelta(days=2),
            merchant_name="24 Hour Fitness",
        ),
    ]

    for transaction in transactions:
        db.add(transaction)

    # Investments
    investments = [
        Investment(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=investment_account.id,
            investment_type="ETF",
            symbol="VTI",
            name="Vanguard Total Stock Market ETF",
            quantity=Decimal("200.00"),
            cost_basis=Decimal("42000.00"),
            current_value=Decimal("48000.00"),
        ),
        Investment(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=investment_account.id,
            investment_type="ETF",
            symbol="VXUS",
            name="Vanguard Total International Stock ETF",
            quantity=Decimal("500.00"),
            cost_basis=Decimal("32000.00"),
            current_value=Decimal("35000.00"),
        ),
        Investment(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=investment_account.id,
            investment_type="STOCK",
            symbol="AAPL",
            name="Apple Inc.",
            quantity=Decimal("50.00"),
            cost_basis=Decimal("8500.00"),
            current_value=Decimal("9500.00"),
        ),
        Investment(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            account_id=investment_account.id,
            investment_type="BOND",
            symbol="BND",
            name="Vanguard Total Bond Market ETF",
            quantity=Decimal("600.00"),
            cost_basis=Decimal("49000.00"),
            current_value=Decimal("49500.00"),
        ),
    ]

    for investment in investments:
        db.add(investment)

    print(f"✓ Seeded financial data: {len(accounts)} accounts, {len(transactions)} transactions, {len(investments)} investments")


async def seed_career_data(db: AsyncSession, user: User):
    """Seed career profile, job experiences, and skills"""

    # Career Profile
    career_profile = CareerProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=user.tenant_id,
        current_title="Senior Software Engineer",
        current_company="Tech Corp",
        years_of_experience=8,
        desired_salary_min=Decimal("180000.00"),
        desired_salary_max=Decimal("230000.00"),
    )

    db.add(career_profile)
    await db.flush()

    # Job Experiences
    experiences = [
        JobExperience(
            id=uuid.uuid4(),
            profile_id=career_profile.id,
            user_id=user.id,
            tenant_id=user.tenant_id,
            company_name="Tech Corp",
            job_title="Senior Software Engineer",
            employment_type="FULL_TIME",
            location="San Francisco, CA",
            start_date=(datetime.now(timezone.utc) - timedelta(days=1095)).date(),
            is_current=True,
            description="Leading development of cloud-native microservices using Python, FastAPI, and React. Managing a team of 4 engineers.",
            achievements=[
                "Reduced API response time by 40% through optimization",
                "Led migration from monolith to microservices architecture",
                "Implemented CI/CD pipeline reducing deployment time by 60%",
                "Mentored 2 junior engineers to mid-level positions"
            ],
        ),
        JobExperience(
            id=uuid.uuid4(),
            profile_id=career_profile.id,
            user_id=user.id,
            tenant_id=user.tenant_id,
            company_name="StartupXYZ",
            job_title="Software Engineer",
            employment_type="FULL_TIME",
            location="San Francisco, CA",
            start_date=(datetime.now(timezone.utc) - timedelta(days=2555)).date(),
            end_date=(datetime.now(timezone.utc) - timedelta(days=1095)).date(),
            is_current=False,
            description="Full-stack development for SaaS product serving 10k+ users",
            achievements=[
                "Built real-time notification system handling 1M+ events/day",
                "Improved test coverage from 40% to 85%",
                "Implemented payment processing with Stripe"
            ],
        ),
        JobExperience(
            id=uuid.uuid4(),
            profile_id=career_profile.id,
            user_id=user.id,
            tenant_id=user.tenant_id,
            company_name="Consulting Firm",
            job_title="Junior Developer",
            employment_type="FULL_TIME",
            location="Boston, MA",
            start_date=(datetime.now(timezone.utc) - timedelta(days=3650)).date(),
            end_date=(datetime.now(timezone.utc) - timedelta(days=2555)).date(),
            is_current=False,
            description="Client-facing software development across various industries",
            achievements=[
                "Delivered 5 client projects on time and under budget",
                "Learned multiple tech stacks quickly"
            ],
        ),
    ]

    for experience in experiences:
        db.add(experience)

    # Skills
    skills = [
        # Programming Languages
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="Python", category="Programming Language", proficiency="EXPERT", years_of_experience=8),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="JavaScript/TypeScript", category="Programming Language", proficiency="ADVANCED", years_of_experience=7),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="SQL", category="Programming Language", proficiency="ADVANCED", years_of_experience=8),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="Go", category="Programming Language", proficiency="INTERMEDIATE", years_of_experience=2),

        # Frameworks
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="FastAPI", category="Framework", proficiency="EXPERT", years_of_experience=4),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="React", category="Framework", proficiency="ADVANCED", years_of_experience=5),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="Django", category="Framework", proficiency="ADVANCED", years_of_experience=5),

        # Cloud & DevOps
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="AWS", category="Cloud Platform", proficiency="ADVANCED", years_of_experience=6),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="Docker", category="DevOps", proficiency="EXPERT", years_of_experience=6),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="Kubernetes", category="DevOps", proficiency="ADVANCED", years_of_experience=4),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="CI/CD", category="DevOps", proficiency="ADVANCED", years_of_experience=6),

        # Databases
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="PostgreSQL", category="Database", proficiency="EXPERT", years_of_experience=7),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="Redis", category="Database", proficiency="ADVANCED", years_of_experience=5),
        Skill(id=uuid.uuid4(), profile_id=career_profile.id, user_id=user.id, tenant_id=user.tenant_id,
              name="MongoDB", category="Database", proficiency="INTERMEDIATE", years_of_experience=3),
    ]

    for skill in skills:
        db.add(skill)

    print(f"✓ Seeded career data: 1 profile, {len(experiences)} experiences, {len(skills)} skills")


async def seed_education_data(db: AsyncSession, user: User):
    """Seed education records, courses, and certifications"""

    # Education Records
    education_records = [
        EducationRecord(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            institution_name="Massachusetts Institute of Technology",
            degree_type="BACHELOR",
            field_of_study="Computer Science",
            start_date=(datetime.now(timezone.utc) - timedelta(days=4380)).date(),
            end_date=(datetime.now(timezone.utc) - timedelta(days=2920)).date(),
            is_current=False,
            gpa=Decimal("3.75"),
            activities="ACM Programming Competition, Robotics Club",
        ),
    ]

    for record in education_records:
        db.add(record)

    # Courses (recent and in-progress)
    courses = [
        Course(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            course_name="Advanced Machine Learning Specialization",
            instructor="Coursera - Stanford University",
            status="in_progress",
            start_date=(datetime.now(timezone.utc) - timedelta(days=45)).date(),
        ),
        Course(
            user_id=user.id,
            tenant_id=user.tenant_id,
            course_name="System Design for Interviews",
            instructor="Educative.io",
            status="completed",
            start_date=(datetime.now(timezone.utc) - timedelta(days=120)).date(),
        ),
        Course(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            course_name="Kubernetes for Developers",
            instructor="Linux Foundation",
            status="completed",
            start_date=(datetime.now(timezone.utc) - timedelta(days=180)).date(),
        ),
    ]

    for course in courses:
        db.add(course)

    # Certifications
    certifications = [
        Certification(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            name="AWS Certified Solutions Architect - Professional",
            issuing_organization="Amazon Web Services",
            credential_id="AWS-PSA-12345",
            issue_date=(datetime.now(timezone.utc) - timedelta(days=365)).date(),
            expiration_date=(datetime.now(timezone.utc) + timedelta(days=730)).date(),
        ),
        Certification(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            name="Certified Kubernetes Administrator (CKA)",
            issuing_organization="Linux Foundation",
            credential_id="LF-CKA-67890",
            issue_date=(datetime.now(timezone.utc) - timedelta(days=180)).date(),
            expiration_date=(datetime.now(timezone.utc) + timedelta(days=915)).date(),
        ),
    ]

    for certification in certifications:
        db.add(certification)

    print(f"✓ Seeded education data: {len(education_records)} degrees, {len(courses)} courses, {len(certifications)} certifications")


async def seed_goals_data(db: AsyncSession, user: User):
    """Seed goals and milestones - leave some incomplete to show progress tracking"""

    goals = [
        # Financial Goal - In Progress
        Goal(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            title="Save $50,000 for House Down Payment",
            description="Build emergency fund and save for down payment on first home in Bay Area",
            category="financial",
            status="active",
            priority="high",
            target_date=(datetime.now(timezone.utc) + timedelta(days=730)).date(),
            target_value=Decimal("50000.00"),
            current_value=Decimal("25000.00"),  # 50% complete
            tags=["savings", "real-estate", "milestone"],
        ),

        # Health Goal - In Progress
        Goal(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            title="Run a Half Marathon",
            description="Complete Bay to Breakers half marathon in under 2 hours",
            category="health",
            status="active",
            priority="medium",
            target_date=(datetime.now(timezone.utc) + timedelta(days=180)).date(),
            target_value=Decimal("13.1"),  # miles
            current_value=Decimal("8.0"),  # current long run distance
            tags=["fitness", "running", "endurance"],
        ),

        # Career Goal - In Progress
        Goal(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            title="Achieve Staff Engineer Promotion",
            description="Demonstrate technical leadership and get promoted to Staff Engineer level",
            category="career",
            status="active",
            priority="high",
            target_date=(datetime.now(timezone.utc) + timedelta(days=365)).date(),
            tags=["promotion", "leadership", "technical-excellence"],
        ),

        # Education Goal - Not Started (to show upload opportunity)
        Goal(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            title="Complete Machine Learning Specialization",
            description="Finish all courses in the Advanced ML specialization and earn certificate",
            category="education",
            status="active",
            priority="medium",
            target_date=(datetime.now(timezone.utc) + timedelta(days=90)).date(),
            tags=["ml", "ai", "coursera", "upskilling"],
        ),

        # Personal Goal - Completed
        Goal(
            id=uuid.uuid4(),
            user_id=user.id,
            tenant_id=user.tenant_id,
            title="Read 24 Books This Year",
            description="Read 2 books per month covering tech, business, and personal development",
            category="personal",
            status="completed",
            priority="low",
            target_date=(datetime.now(timezone.utc) - timedelta(days=30)).date(),
            target_value=Decimal("24"),
            current_value=Decimal("24"),
            tags=["reading", "personal-growth", "learning"],
        ),
    ]

    for goal in goals:
        db.add(goal)

    await db.flush()

    # Milestones for the savings goal
    milestones = [
        GoalMilestone(
            id=uuid.uuid4(),
            goal_id=goals[0].id,  # Savings goal
            tenant_id=user.tenant_id,
            title="$10,000 saved",
            description="First major milestone",
            is_completed=True,
            completed_at=(datetime.now(timezone.utc) - timedelta(days=180)).replace(tzinfo=None),
            order=1,
        ),
        GoalMilestone(
            id=uuid.uuid4(),
            goal_id=goals[0].id,
            tenant_id=user.tenant_id,
            title="$25,000 saved",
            description="Halfway there!",
            is_completed=True,
            completed_at=(datetime.now(timezone.utc) - timedelta(days=30)).replace(tzinfo=None),
            order=2,
        ),
        GoalMilestone(
            id=uuid.uuid4(),
            goal_id=goals[0].id,
            tenant_id=user.tenant_id,
            title="$35,000 saved",
            description="70% complete",
            is_completed=False,
            target_date=(datetime.now(timezone.utc) + timedelta(days=180)).date(),
            order=3,
        ),
        GoalMilestone(
            id=uuid.uuid4(),
            goal_id=goals[0].id,
            tenant_id=user.tenant_id,
            title="$50,000 saved - Goal Complete!",
            description="Ready for down payment",
            is_completed=False,
            target_date=(datetime.now(timezone.utc) + timedelta(days=730)).date(),
            order=4,
        ),
    ]

    for milestone in milestones:
        db.add(milestone)

    print(f"✓ Seeded goals data: {len(goals)} goals, {len(milestones)} milestones")


async def main():
    """Main seeding function"""
    print("\n" + "="*80)
    print("SEEDING DEMO USER: JOHN DOE")
    print("="*80 + "\n")

    async with AsyncSessionLocal() as db:
        try:
            # Create demo user
            user = await create_demo_user(db)

            # Seed all domain data
            await seed_health_data(db, user)
            await seed_financial_data(db, user)
            await seed_career_data(db, user)
            await seed_education_data(db, user)
            await seed_goals_data(db, user)

            # Commit all changes
            await db.commit()

            print("\n" + "="*80)
            print("✓ DEMO USER SEEDING COMPLETE!")
            print("="*80)
            print(f"\nDemo User Credentials:")
            print(f"  Email:    {DEMO_EMAIL}")
            print(f"  Password: {DEMO_PASSWORD}")
            print(f"  Username: {DEMO_USERNAME}")
            print("\nData Summary:")
            print(f"  • Health: Providers, records, medications")
            print(f"  • Finance: 5 accounts, transactions, investments")
            print(f"  • Career: Profile with 3 job experiences, 14 skills")
            print(f"  • Education: 1 degree, 3 courses, 2 certifications")
            print(f"  • Goals: 5 goals with milestones")
            print("\nAreas left incomplete for demo:")
            print(f"  • Some health records can be uploaded (lab reports, X-rays)")
            print(f"  • Bank statements can be connected via Plaid")
            print(f"  • Investment documents can be uploaded")
            print(f"  • Resume can be updated")
            print(f"  • Additional certifications can be added")
            print("="*80 + "\n")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error seeding demo user: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(main())

"""
Comprehensive Database Seed Script for Life Navigator Backend

Seeds all domain data for demo users including:
- Finance: Accounts, Transactions, Budgets
- Health: Conditions, Medications, Lab Results
- Career: Profiles, Applications
- Education: Credentials, Courses
- Goals: Multi-domain goals with milestones

Usage:
    python -m scripts.seed_demo_data

Or with environment:
    ENVIRONMENT=development python -m scripts.seed_demo_data
"""

import asyncio
import random
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import Organization, Tenant, User, UserTenant, UserTenantRole
from app.models.finance import (
    FinancialAccount, Transaction, Budget,
    AccountType, AccountStatus, TransactionType, BudgetPeriod, BudgetStatus,
)
from app.models.health import (
    HealthCondition, Medication, LabResult,
    ConditionType, ConditionStatus, Severity,
    MedicationStatus, MedicationRoute, LabResultStatus,
)
from app.models.career import CareerProfile, JobApplication, Interview
from app.models.education import EducationCredential, Course
from app.models.goals import Goal, Milestone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Demo credentials - CHANGE IN PRODUCTION!
DEMO_EMAIL = "demo@lifenavigator.app"
DEMO_PASSWORD = "DemoUser2024!"


async def create_database_session():
    """Create async database session."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    return async_session()


async def seed_user(db: AsyncSession) -> tuple[User, Tenant]:
    """Create demo organization, tenant, and user."""
    print("Creating demo user...")

    # Check if demo user exists
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # Get existing tenant
        result = await db.execute(
            select(UserTenant).where(UserTenant.user_id == existing_user.id)
        )
        user_tenant = result.scalar_one_or_none()

        result = await db.execute(
            select(Tenant).where(Tenant.id == user_tenant.tenant_id)
        )
        tenant = result.scalar_one_or_none()

        print(f"  Demo user already exists: {existing_user.id}")
        return existing_user, tenant

    # Create organization
    org = Organization(
        name="Demo Organization",
        slug="demo-org",
        email=DEMO_EMAIL,
    )
    db.add(org)
    await db.flush()

    # Create tenant
    tenant = Tenant(
        organization_id=org.id,
        name="Demo Workspace",
        slug="demo-workspace",
    )
    db.add(tenant)
    await db.flush()

    # Create user
    user = User(
        email=DEMO_EMAIL,
        password_hash=pwd_context.hash(DEMO_PASSWORD),
        first_name="Demo",
        last_name="User",
        display_name="Demo User",
        email_verified=True,
    )
    db.add(user)
    await db.flush()

    # Create user-tenant membership
    user_tenant = UserTenant(
        user_id=user.id,
        tenant_id=tenant.id,
        role=UserTenantRole.OWNER,
        joined_at=datetime.utcnow(),
    )
    db.add(user_tenant)
    await db.commit()

    print(f"  Created demo user: {user.id}")
    print(f"  Email: {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")

    return user, tenant


async def seed_financial_data(db: AsyncSession, user: User, tenant: Tenant):
    """Seed financial accounts, transactions, and budgets."""
    print("Seeding financial data...")

    today = date.today()

    # Create checking account
    checking = FinancialAccount(
        user_id=user.id,
        tenant_id=tenant.id,
        account_name="Primary Checking",
        account_type=AccountType.CHECKING,
        institution_name="Demo Bank",
        account_number_last4="4567",
        currency="USD",
        current_balance=Decimal("5432.18"),
        available_balance=Decimal("5432.18"),
        status=AccountStatus.ACTIVE,
        is_manual=True,
    )
    db.add(checking)
    await db.flush()

    # Create savings account
    savings = FinancialAccount(
        user_id=user.id,
        tenant_id=tenant.id,
        account_name="Emergency Fund",
        account_type=AccountType.SAVINGS,
        institution_name="Demo Bank",
        account_number_last4="8901",
        currency="USD",
        current_balance=Decimal("15000.00"),
        available_balance=Decimal("15000.00"),
        interest_rate=Decimal("4.50"),
        status=AccountStatus.ACTIVE,
        is_manual=True,
    )
    db.add(savings)
    await db.flush()

    # Create credit card
    credit = FinancialAccount(
        user_id=user.id,
        tenant_id=tenant.id,
        account_name="Rewards Credit Card",
        account_type=AccountType.CREDIT_CARD,
        institution_name="Demo Credit",
        account_number_last4="2345",
        currency="USD",
        current_balance=Decimal("-1250.00"),
        credit_limit=Decimal("10000.00"),
        interest_rate=Decimal("19.99"),
        minimum_payment=Decimal("35.00"),
        status=AccountStatus.ACTIVE,
        is_manual=True,
    )
    db.add(credit)
    await db.flush()

    # Create investment account
    investment = FinancialAccount(
        user_id=user.id,
        tenant_id=tenant.id,
        account_name="Brokerage Account",
        account_type=AccountType.INVESTMENT,
        institution_name="Demo Invest",
        account_number_last4="6789",
        currency="USD",
        current_balance=Decimal("45678.90"),
        status=AccountStatus.ACTIVE,
        is_manual=True,
    )
    db.add(investment)
    await db.flush()

    print(f"  Created 4 financial accounts")

    # Create sample transactions (last 30 days)
    categories = ["Groceries", "Restaurants", "Utilities", "Entertainment", "Shopping", "Transportation"]
    merchants = {
        "Groceries": ["Whole Foods", "Trader Joe's", "Safeway"],
        "Restaurants": ["Chipotle", "Starbucks", "Local Restaurant"],
        "Utilities": ["Electric Company", "Water Dept", "Internet Provider"],
        "Entertainment": ["Netflix", "Spotify", "Movie Theater"],
        "Shopping": ["Amazon", "Target", "Best Buy"],
        "Transportation": ["Shell Gas", "Uber", "Parking"],
    }

    for i in range(30):
        tx_date = today - timedelta(days=i)
        num_transactions = random.randint(1, 4)

        for _ in range(num_transactions):
            category = random.choice(categories)
            merchant = random.choice(merchants[category])
            amount = Decimal(str(round(random.uniform(5, 150), 2)))

            tx = Transaction(
                user_id=user.id,
                tenant_id=tenant.id,
                account_id=checking.id if random.random() > 0.3 else credit.id,
                transaction_date=tx_date,
                amount=amount,
                currency="USD",
                description=f"{merchant} Purchase",
                merchant_name=merchant,
                category=category,
                transaction_type=TransactionType.DEBIT,
                is_recurring=category == "Utilities",
                is_pending=i == 0 and random.random() > 0.7,
            )
            db.add(tx)

    # Add income transactions
    for month_offset in range(2):
        payday = today.replace(day=15) - timedelta(days=month_offset * 30)
        if payday > today:
            payday = payday - timedelta(days=30)

        income = Transaction(
            user_id=user.id,
            tenant_id=tenant.id,
            account_id=checking.id,
            transaction_date=payday,
            amount=Decimal("4500.00"),
            currency="USD",
            description="Direct Deposit - Salary",
            merchant_name="Employer Inc",
            category="Income",
            transaction_type=TransactionType.CREDIT,
            is_recurring=True,
        )
        db.add(income)

    await db.flush()
    print(f"  Created sample transactions")

    # Create budgets
    budgets_data = [
        ("Groceries", Decimal("600.00")),
        ("Restaurants", Decimal("300.00")),
        ("Entertainment", Decimal("200.00")),
        ("Transportation", Decimal("250.00")),
        ("Shopping", Decimal("400.00")),
    ]

    for name, amount in budgets_data:
        budget = Budget(
            user_id=user.id,
            tenant_id=tenant.id,
            name=f"{name} Budget",
            category=name,
            amount=amount,
            period=BudgetPeriod.MONTHLY,
            currency="USD",
            start_date=today.replace(day=1),
            alert_threshold=Decimal("0.80"),
            alert_enabled=True,
            status=BudgetStatus.ACTIVE,
        )
        db.add(budget)

    await db.commit()
    print(f"  Created {len(budgets_data)} budgets")


async def seed_health_data(db: AsyncSession, user: User, tenant: Tenant):
    """Seed health conditions, medications, and lab results."""
    print("Seeding health data...")

    today = date.today()

    # Create health condition
    condition = HealthCondition(
        user_id=user.id,
        tenant_id=tenant.id,
        condition_name="Hypertension",
        condition_type=ConditionType.CHRONIC,
        severity=Severity.MILD,
        icd_10_code="I10",
        diagnosis_date=today - timedelta(days=365),
        status=ConditionStatus.CHRONIC_MANAGED,
        diagnosed_by="Dr. Smith",
        symptoms=["occasional headaches", "elevated readings"],
        treatment_plan="Lifestyle modifications and medication",
    )
    db.add(condition)
    await db.flush()

    # Create medication
    medication = Medication(
        user_id=user.id,
        tenant_id=tenant.id,
        condition_id=condition.id,
        medication_name="Lisinopril",
        generic_name="Lisinopril",
        dosage="10",
        dosage_unit="mg",
        form="tablet",
        frequency="Once daily",
        route=MedicationRoute.ORAL,
        start_date=today - timedelta(days=365),
        status=MedicationStatus.ACTIVE,
        is_as_needed=False,
        prescribed_by="Dr. Smith",
        pharmacy_name="CVS Pharmacy",
        reminder_enabled=True,
    )
    db.add(medication)
    await db.flush()

    print(f"  Created health condition and medication")

    # Create lab results
    lab_tests = [
        ("Cholesterol, Total", "195", "mg/dL", "125-200", LabResultStatus.NORMAL),
        ("HDL Cholesterol", "55", "mg/dL", "40-60", LabResultStatus.NORMAL),
        ("LDL Cholesterol", "120", "mg/dL", "0-100", LabResultStatus.ABNORMAL_HIGH),
        ("Triglycerides", "145", "mg/dL", "0-150", LabResultStatus.NORMAL),
        ("Glucose, Fasting", "98", "mg/dL", "70-100", LabResultStatus.NORMAL),
        ("HbA1c", "5.4", "%", "4.0-5.6", LabResultStatus.NORMAL),
        ("Blood Pressure Systolic", "128", "mmHg", "90-120", LabResultStatus.ABNORMAL_HIGH),
        ("Blood Pressure Diastolic", "82", "mmHg", "60-80", LabResultStatus.ABNORMAL_HIGH),
    ]

    for test_name, value, unit, ref_range, status in lab_tests:
        lab_result = LabResult(
            user_id=user.id,
            tenant_id=tenant.id,
            test_name=test_name,
            result_value=value,
            result_unit=unit,
            reference_range=ref_range,
            status=status,
            test_date=today - timedelta(days=30),
            result_date=today - timedelta(days=28),
            ordering_provider="Dr. Smith",
            performing_lab="Quest Diagnostics",
            source="manual",
        )
        db.add(lab_result)

    await db.commit()
    print(f"  Created {len(lab_tests)} lab results")


async def seed_career_data(db: AsyncSession, user: User, tenant: Tenant):
    """Seed career profile and job applications."""
    print("Seeding career data...")

    today = date.today()

    # Create career profile
    profile = CareerProfile(
        user_id=user.id,
        tenant_id=tenant.id,
        current_title="Senior Software Engineer",
        current_company="Tech Corp",
        industry="Technology",
        years_experience=5,
        skills=["Python", "TypeScript", "React", "PostgreSQL", "AWS", "Docker"],
        desired_title="Staff Engineer",
        desired_salary_min=150000,
        desired_salary_max=200000,
        preferred_work_type="hybrid",
        open_to_relocation=False,
        job_search_status="passive",
    )
    db.add(profile)
    await db.flush()

    # Create job applications
    applications_data = [
        ("Google", "Staff Software Engineer", "applied", 180000),
        ("Meta", "Senior Engineer", "interviewing", 175000),
        ("Stripe", "Backend Engineer", "offer", 190000),
    ]

    for company, position, status, salary in applications_data:
        app = JobApplication(
            user_id=user.id,
            tenant_id=tenant.id,
            company_name=company,
            position=position,
            status=status,
            applied_date=today - timedelta(days=random.randint(7, 30)),
            salary_offered=salary if status == "offer" else None,
            location="San Francisco, CA",
            work_type="hybrid",
            source="LinkedIn",
        )
        db.add(app)
        await db.flush()

        # Add interview for the one in interviewing stage
        if status == "interviewing":
            interview = Interview(
                application_id=app.id,
                interview_type="technical",
                scheduled_at=datetime.utcnow() + timedelta(days=3),
                duration_minutes=60,
                interviewer_name="John Doe",
                interviewer_title="Engineering Manager",
                status="scheduled",
            )
            db.add(interview)

    await db.commit()
    print(f"  Created career profile and {len(applications_data)} job applications")


async def seed_education_data(db: AsyncSession, user: User, tenant: Tenant):
    """Seed education credentials and courses."""
    print("Seeding education data...")

    today = date.today()

    # Create credential
    credential = EducationCredential(
        user_id=user.id,
        tenant_id=tenant.id,
        credential_type="degree",
        title="Bachelor of Science",
        field_of_study="Computer Science",
        institution="State University",
        start_date=date(2015, 9, 1),
        end_date=date(2019, 5, 15),
        gpa=Decimal("3.75"),
        status="completed",
    )
    db.add(credential)

    # Create ongoing course
    course = Course(
        user_id=user.id,
        tenant_id=tenant.id,
        title="AWS Solutions Architect",
        provider="Udemy",
        instructor="Stephane Maarek",
        url="https://udemy.com/course/aws-certified-solutions-architect",
        start_date=today - timedelta(days=14),
        status="in_progress",
        progress_percent=35,
        estimated_hours=40,
        completed_hours=14,
    )
    db.add(course)

    await db.commit()
    print(f"  Created education credential and course")


async def seed_goals(db: AsyncSession, user: User, tenant: Tenant):
    """Seed multi-domain goals with milestones."""
    print("Seeding goals...")

    today = date.today()

    goals_data = [
        {
            "title": "Build Emergency Fund",
            "category": "finance",
            "target_value": 25000,
            "current_value": 15000,
            "milestones": ["Save first $5k", "Reach $10k", "Reach $15k", "Hit $25k goal"],
        },
        {
            "title": "Get AWS Certified",
            "category": "career",
            "target_value": 100,
            "current_value": 35,
            "milestones": ["Complete course", "Pass practice exam", "Schedule exam", "Pass certification"],
        },
        {
            "title": "Lower Blood Pressure",
            "category": "health",
            "target_value": 120,
            "current_value": 128,
            "milestones": ["Start medication", "Exercise 3x/week", "Reduce sodium", "Reach 120/80"],
        },
    ]

    for goal_data in goals_data:
        goal = Goal(
            user_id=user.id,
            tenant_id=tenant.id,
            title=goal_data["title"],
            category=goal_data["category"],
            target_value=Decimal(str(goal_data["target_value"])),
            current_value=Decimal(str(goal_data["current_value"])),
            start_date=today - timedelta(days=60),
            target_date=today + timedelta(days=180),
            status="active",
            priority=2,
        )
        db.add(goal)
        await db.flush()

        # Add milestones
        for i, milestone_title in enumerate(goal_data["milestones"]):
            milestone = Milestone(
                goal_id=goal.id,
                title=milestone_title,
                order=i + 1,
                status="completed" if i < 2 else "pending",
                completed_at=datetime.utcnow() - timedelta(days=30 - i * 10) if i < 2 else None,
            )
            db.add(milestone)

    await db.commit()
    print(f"  Created {len(goals_data)} goals with milestones")


async def main():
    """Run all seed functions."""
    print("=" * 60)
    print("Life Navigator - Database Seeding")
    print("=" * 60)
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Database: {settings.DATABASE_URL[:50]}...")
    print("=" * 60)

    db = await create_database_session()

    try:
        user, tenant = await seed_user(db)
        await seed_financial_data(db, user, tenant)
        await seed_health_data(db, user, tenant)
        await seed_career_data(db, user, tenant)
        await seed_education_data(db, user, tenant)
        await seed_goals(db, user, tenant)

        print("=" * 60)
        print("Database seeding completed successfully!")
        print("=" * 60)
        print(f"Demo Login Credentials:")
        print(f"  Email: {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print("=" * 60)

    except Exception as e:
        print(f"Error during seeding: {e}")
        await db.rollback()
        raise
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())

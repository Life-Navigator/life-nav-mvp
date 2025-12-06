# Multi-Database Architecture for Compliance

## Overview

Life Navigator uses a multi-database architecture to ensure proper data isolation for regulatory compliance:

| Database | Purpose | Compliance | Data Classification |
|----------|---------|------------|---------------------|
| **Core DB** | User accounts, sessions, preferences | SOC 2 | General |
| **Finance DB** | Financial accounts, transactions | GLBA, PCI DSS | Financial PII |
| **Health DB** | Health records, medical data | HIPAA | PHI |

## Database Allocation

### Core Database (`lifenavigator_core`)
General application data that doesn't contain sensitive financial or health information.

**Tables:**
- `User` - Basic user profile (email, name, auth)
- `Account` - OAuth accounts (Google, etc.)
- `Session` - User sessions
- `VerificationToken` - Email verification
- `UserPreferences` - App settings
- `Goal` - Goals (non-financial goals only)
- `GoalCategory` - Goal categories
- `GoalMilestone` - Goal milestones
- `Achievement` - Gamification achievements
- `Notification` - User notifications
- `Feedback` - User feedback
- `AuditLog` - General audit trail

### Finance Database (`lifenavigator_finance`)
All financial data subject to GLBA and PCI DSS regulations.

**Tables:**
- `FinancialAccount` - Bank accounts, credit cards
- `Transaction` - Financial transactions
- `Asset` - Property, vehicles, valuables
- `Loan` - Loans and debts
- `Investment` - Investment holdings
- `InvestmentPortfolio` - Portfolio summaries
- `FinancialGoal` - Financial goals with amounts
- `Budget` - Budget allocations
- `BudgetCategory` - Budget categories
- `PlaidItem` - Plaid bank connections
- `TaxProfile` - Tax information
- `TaxDocument` - Tax documents
- `EmployerBenefits` - 401k, benefits info
- `RetirementPlan` - Retirement planning
- `RiskAssessment` - Financial risk profiles
- `FinancialAuditLog` - Financial-specific audit trail

### Health Database (`lifenavigator_health`)
All health and medical data subject to HIPAA regulations.

**Tables:**
- `HealthRecord` - Medical records
- `HealthMetric` - Health measurements
- `WearableConnection` - Fitbit, Apple Health, etc.
- `WearableMetric` - Wearable device data
- `HealthDocument` - Medical documents
- `Prescription` - Prescription records
- `HealthProvider` - Healthcare providers
- `HealthAppointment` - Medical appointments
- `InsurancePlan` - Health insurance info
- `InsuranceClaim` - Insurance claims
- `FamilyHealthHistory` - Family medical history
- `HealthAuditLog` - HIPAA-specific audit trail

## Connection Configuration

### Environment Variables

```env
# Core Database (General Data)
CORE_DATABASE_URL=postgresql://user:pass@host/lifenavigator_core

# Finance Database (GLBA/PCI DSS)
FINANCE_DATABASE_URL=postgresql://user:pass@host/lifenavigator_finance

# Health Database (HIPAA)
HEALTH_DATABASE_URL=postgresql://user:pass@host/lifenavigator_health

# Encryption Key (for field-level encryption)
ENCRYPTION_MASTER_KEY=<32-byte-key>
```

### Prisma Multi-Database Setup

```prisma
// schema.prisma - Core database
datasource db {
  provider = "postgresql"
  url      = env("CORE_DATABASE_URL")
}

// schema-finance.prisma - Finance database
datasource db {
  provider = "postgresql"
  url      = env("FINANCE_DATABASE_URL")
}

// schema-health.prisma - Health database
datasource db {
  provider = "postgresql"
  url      = env("HEALTH_DATABASE_URL")
}
```

## Cross-Database References

Since data is split across databases, we use **user IDs** as the common key:

```
Core DB (User.id) <---> Finance DB (userId) <---> Health DB (userId)
```

**Important:** Never store PHI or financial data in the Core database. Always reference by `userId`.

## Security Controls

### Core Database
- TLS encryption in transit
- Encrypted at rest (GCP default)
- Access logging enabled
- 7-day backup retention

### Finance Database (GLBA/PCI DSS)
- TLS encryption in transit (required)
- Encrypted at rest with CMEK
- Point-in-time recovery enabled
- Field-level encryption for SSN, account numbers
- 30-day backup retention
- Detailed access audit logging
- No direct public IP access

### Health Database (HIPAA)
- TLS encryption in transit (required)
- Encrypted at rest with CMEK
- Point-in-time recovery enabled
- Field-level encryption for PHI
- 30-day backup retention
- HIPAA-compliant audit logging
- No direct public IP access
- Access limited to specific service accounts

## Service Account Access Matrix

| Service | Core DB | Finance DB | Health DB |
|---------|---------|------------|-----------|
| API Gateway | Read/Write | Read/Write | Read/Write |
| Web Frontend | Read/Write | Read/Write | Read/Write |
| Agent Orchestrator | Read | Read | Read |
| Compliance Checker | Read | Read | Read |
| Jobs | Read/Write | Read/Write | Read/Write |
| GraphRAG API | Read | - | - |

## Migration Strategy

### Phase 1: Infrastructure
1. Create three Cloud SQL instances
2. Set up secrets for each database
3. Configure service account access

### Phase 2: Schema Migration
1. Split Prisma schema into three files
2. Run migrations on each database
3. Update application code to use correct database

### Phase 3: Data Migration
1. Export data from current single database
2. Classify and route data to appropriate database
3. Verify data integrity
4. Update foreign key references

### Phase 4: Verification
1. Run compliance checks
2. Verify audit logging
3. Test cross-database queries
4. Performance testing

## Cost Considerations

| Instance | Tier | Monthly Cost (est.) |
|----------|------|---------------------|
| Core DB | db-f1-micro | ~$7-10 |
| Finance DB | db-f1-micro | ~$7-10 |
| Health DB | db-f1-micro | ~$7-10 |
| **Total** | | **~$21-30/month** |

For production, consider upgrading Finance and Health databases to `db-g1-small` (~$25/month each) for better performance and higher availability.

## Backup and Recovery

| Database | Backup Window | PITR | Retention |
|----------|---------------|------|-----------|
| Core | 03:00 UTC | No | 7 days |
| Finance | 02:00 UTC | Yes | 30 days |
| Health | 04:00 UTC | Yes | 30 days |

Finance and Health databases have Point-in-Time Recovery (PITR) enabled for compliance requirements.

# Data Retention and Disposal Policy

**Life Navigator**
**Version:** 1.0
**Effective Date:** March 18, 2026
**Last Reviewed:** March 18, 2026
**Next Review Date:** September 18, 2026
**Policy Owner:** Engineering & Privacy Team
**Contact:** privacy@lifenavigator.tech

---

## 1. Purpose

This policy defines how Life Navigator collects, retains, and securely disposes of personal and sensitive data. It ensures compliance with applicable data privacy laws including the California Consumer Privacy Act (CCPA), California Privacy Rights Act (CPRA), and the Gramm-Leach-Bliley Act (GLBA) as applicable to consumer financial data received through Plaid.

## 2. Scope

This policy applies to all data processed by Life Navigator, including:

- User account and profile data
- Financial data received via Plaid
- Uploaded documents and extracted content
- AI-generated knowledge graph data (Neo4j, Qdrant)
- Authentication and security logs
- Cached AI responses and processing queues
- Integration tokens (Google OAuth, Plaid access tokens)

This policy covers data stored across all infrastructure components: Supabase (PostgreSQL), Neo4j Aura, Qdrant Cloud, Vercel, and Google AI services.

## 3. Data Classification

| Classification   | Description                                    | Examples                                                                                                     |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Public**       | Non-sensitive, intended for general visibility | Marketing content, public product pages                                                                      |
| **Internal**     | Business data not intended for external access | Aggregated analytics, system configuration                                                                   |
| **Confidential** | Personal data subject to privacy regulations   | User profiles, goals, career data, education records                                                         |
| **Restricted**   | Highly sensitive data requiring encryption     | Financial transactions, bank account numbers, health records, OAuth tokens, SSNs (if inadvertently captured) |

## 4. Retention Schedule

### 4.1 Account Data

| Data Type                                                 | Retention Period              | Trigger for Disposal     |
| --------------------------------------------------------- | ----------------------------- | ------------------------ |
| Account registration (email, password hash, display name) | Duration of account + 30 days | Account deletion request |
| Profile preferences (timezone, theme, notifications)      | Duration of account + 30 days | Account deletion request |
| Goals, milestones, habits, personal development plans     | Duration of account + 30 days | Account deletion request |
| Career information (job title, employer, skills, resumes) | Duration of account + 30 days | Account deletion request |
| Education records (institutions, degrees, courses)        | Duration of account + 30 days | Account deletion request |
| Family information (family members, dependents, pets)     | Duration of account + 30 days | Account deletion request |
| Risk assessment responses                                 | Duration of account + 30 days | Account deletion request |

### 4.2 Financial Data (Plaid)

| Data Type                                           | Retention Period                   | Trigger for Disposal                   |
| --------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| Plaid access tokens (AES-256 encrypted)             | Duration of account link           | Account disconnect or account deletion |
| Transaction data (date, amount, merchant, category) | Duration of account link + 30 days | Account disconnect or account deletion |
| Account information (names, types, balances)        | Duration of account link + 30 days | Account disconnect or account deletion |
| Plaid item metadata (institution, link status)      | Duration of account link + 30 days | Account disconnect or account deletion |

When a user disconnects a financial account:

1. The Plaid access token is immediately revoked via Plaid API
2. The encrypted token is deleted from the database immediately
3. Associated transaction and account data is deleted within 30 days

### 4.3 Uploaded Documents

| Data Type                                                | Retention Period                       | Trigger for Disposal                  |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| Original uploaded files (Storage)                        | Until user deletes or account deletion | User action or account deletion       |
| Extracted fields (OCR results)                           | Same as source document                | Document deletion or account deletion |
| Document metadata (type, upload date, processing status) | Same as source document                | Document deletion or account deletion |

### 4.4 AI and Knowledge Graph Data

| Data Type                     | Retention Period                  | Trigger for Disposal                     |
| ----------------------------- | --------------------------------- | ---------------------------------------- |
| Knowledge graph nodes (Neo4j) | Until source data is deleted      | Source data deletion or account deletion |
| Vector embeddings (Qdrant)    | Until source data is deleted      | Source data deletion or account deletion |
| Cached AI query responses     | 1 hour (automatic TTL expiration) | Automatic expiration + daily purge job   |
| AI processing inputs          | Not retained by AI provider       | Discarded after processing               |

### 4.5 Integration Tokens

| Data Type                                       | Retention Period                   | Trigger for Disposal                       |
| ----------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| Google OAuth refresh tokens (AES-256 encrypted) | Duration of integration connection | Integration disconnect or account deletion |
| Plaid access tokens (AES-256 encrypted)         | Duration of integration connection | Integration disconnect or account deletion |

### 4.6 System and Security Data

| Data Type                                    | Retention Period           | Trigger for Disposal                           |
| -------------------------------------------- | -------------------------- | ---------------------------------------------- |
| Authentication logs (login, failed attempts) | 90 days                    | Automatic purge                                |
| Audit logs (security-sensitive operations)   | 90 days                    | Automatic purge                                |
| Sync queue jobs (completed)                  | 7 days after completion    | Automated pg_cron purge (daily at 3:00 AM UTC) |
| Sync queue jobs (dead/failed)                | 30 days after last attempt | Automated pg_cron purge (daily at 3:00 AM UTC) |
| Expired query cache entries                  | Immediate upon expiration  | Automated pg_cron purge (daily at 3:00 AM UTC) |

## 5. Disposal Methods

### 5.1 Database Records (Supabase/PostgreSQL)

- **Method:** SQL `DELETE` statements executed via application logic or automated pg_cron jobs
- **Verification:** Deletion is confirmed by verifying zero rows returned for the user's ID across all schemas (`public`, `core`, `finance`, `health_meta`, `graphrag`)
- **Cascading:** Foreign key `ON DELETE CASCADE` constraints ensure child records are deleted when parent records are removed
- **Encryption key disposal:** When encrypted data is deleted, the associated decryption context is no longer usable. Encryption keys are managed separately from data.

### 5.2 Object Storage (Supabase Storage)

- **Method:** Storage API `delete` call removes the file from the storage bucket
- **Verification:** Confirmed via storage API that the object no longer exists
- **Bucket policies:** Storage buckets enforce user-scoped access via Row Level Security

### 5.3 Knowledge Graph (Neo4j Aura)

- **Method:** Cypher `DETACH DELETE` queries remove nodes and all relationships for the target user
- **Verification:** Post-deletion query confirms zero nodes exist for the user ID
- **Scope:** All entity nodes, relationship edges, and metadata associated with the user

### 5.4 Vector Store (Qdrant Cloud)

- **Method:** Qdrant `delete` API call with user ID filter removes all points for the target user from the `life_navigator` collection
- **Verification:** Post-deletion search confirms zero results for the user ID
- **Scope:** All embedding vectors and associated payload metadata

### 5.5 Third-Party Token Revocation

- **Plaid:** Access token is revoked via `POST /item/remove` Plaid API endpoint before local deletion
- **Google OAuth:** Refresh token is revoked via Google's token revocation endpoint before local deletion

### 5.6 Backup and Disaster Recovery

- Supabase automated backups follow the platform's retention policy (7 days for Pro tier)
- Backups containing deleted user data are overwritten within the backup rotation window
- No separate long-term backup archives are maintained for user data

## 6. Account Deletion Process

When a user requests account deletion (via in-app settings or by contacting privacy@lifenavigator.tech):

1. **Immediate** — All active sessions are invalidated
2. **Immediate** — Third-party tokens (Plaid, Google) are revoked via provider APIs
3. **Within 24 hours** — Account is soft-deleted (marked inactive, data access blocked)
4. **Within 30 days** — All data is permanently deleted across all systems:
   - PostgreSQL records across all schemas
   - Storage bucket files
   - Neo4j knowledge graph nodes and relationships
   - Qdrant vector embeddings
5. **Confirmation** — User receives email confirmation that deletion is complete

## 7. Automated Disposal Mechanisms

The following automated processes enforce retention limits without manual intervention:

| Mechanism                        | Schedule             | Action                                                                            |
| -------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `graphrag-purge-daily` (pg_cron) | Daily at 3:00 AM UTC | Purges completed sync jobs (>7 days), dead jobs (>30 days), expired cache entries |
| Query cache TTL                  | Continuous           | Cache entries expire after 1 hour (enforced by `expires_at` column)               |
| Supabase platform backups        | Rolling 7-day window | Old backups automatically replaced                                                |

## 8. User Rights and Data Subject Requests

Users may exercise the following rights at any time:

- **Access:** Request a full export of all personal data (delivered in JSON format)
- **Correction:** Update or correct inaccurate personal data via account settings
- **Deletion:** Request complete account and data deletion (see Section 6)
- **Portability:** Export data in a machine-readable format
- **Disconnect:** Remove any third-party integration independently of account deletion

Requests are processed within 30 days. Contact: privacy@lifenavigator.tech

## 9. Compliance and Legal Holds

- If a legal hold or regulatory investigation requires data preservation, the affected data is excluded from automated disposal until the hold is released
- Legal holds are documented with the scope, reason, and authorization
- Once a hold is lifted, normal retention and disposal schedules resume immediately

## 10. Sensitive Data Handling

### 10.1 Data We Do Not Store

- Bank login credentials (handled entirely by Plaid)
- Raw credit card numbers (redacted during OCR processing)
- Social Security Numbers (redacted during OCR processing; if inadvertently captured, deleted immediately upon detection)

### 10.2 Redaction

- Document OCR processing includes automated redaction of sensitive patterns (SSN, credit card numbers) before any data is persisted
- Redaction occurs server-side within the `document-ocr` Edge Function before results reach the database

## 11. Policy Review

This policy is reviewed:

- **Semi-annually** (every 6 months) as a scheduled review
- **Upon material change** to data processing practices, infrastructure, or applicable law
- **After any security incident** that affects data retention or disposal

Reviews are documented with the review date, reviewer, and any changes made.

## 12. Enforcement

- Violation of this policy by team members may result in disciplinary action
- Automated monitoring alerts if retention thresholds are exceeded
- Disposal failures are treated as incidents and escalated for immediate resolution

## 13. Revision History

| Version | Date           | Author                     | Changes        |
| ------- | -------------- | -------------------------- | -------------- |
| 1.0     | March 18, 2026 | Life Navigator Engineering | Initial policy |

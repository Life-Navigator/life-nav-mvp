# Credential Source Architecture — Proposal (Phase 8K)

> Status: **proposal only**. No integration is built in this sprint. This document defines the
> interface and normalized schema so resume import (Phase 8) and future verified-credential
> providers (Credly, AWS, Microsoft Learn, Google, Coursera, CompTIA, Salesforce Trailhead) share
> one ingestion contract and one trust model.

## Principle

A resume is an **unverified, user-asserted** credential source. Credly et al. are **verified,
issuer-attested** sources. Both should flow through the _same_ document-intelligence trust spine
built in Phases 5–8: provenance → confidence → human review → conflict detection → import with
back-linkage. The only difference is the `verification` tier, which raises precedence.

```
CredentialSource (interface)
   ├── ResumeCredentialSource        (built — Phase 8, verification: self_asserted)
   ├── CredlyCredentialSource        (future — verification: issuer_verified)
   ├── AwsCredentialSource           (future)
   ├── MicrosoftLearnCredentialSource(future)
   ├── GoogleCredentialSource        (future)
   ├── CourseraCredentialSource      (future)
   ├── CompTIACredentialSource       (future)
   └── TrailheadCredentialSource     (future)
```

## Interface

```python
class CredentialSource(Protocol):
    source_id: str                       # 'resume' | 'credly' | 'aws' | …
    verification: str                    # 'self_asserted' | 'issuer_verified'

    async def connect(self, ctx: UserContext, auth: dict) -> ConnectionResult: ...
    # OAuth2 (Credly/MS/Google/Coursera) or API key; resume = no-op (file is the input).

    async def fetch(self, ctx: UserContext, conn: Connection) -> list[NormalizedCredential]: ...
    # pull raw credentials and normalize to the shared schema below.

    async def disconnect(self, ctx: UserContext, conn: Connection) -> None: ...
    # revoke tokens + honor cache/delete policy (Credly: refresh/delete ~30 days).
```

`fetch()` returns the **NormalizedCredential** below; everything downstream (staging review, conflict
detection, import to `education.certifications` / `career.*`, graph facts, advisor citation) is
already built and provider-agnostic.

## Normalized credential schema

```jsonc
{
  "source": "credly", // CredentialSource.source_id
  "external_id": "…", // provider's credential/badge id (idempotency)
  "type": "certification | license | badge | course | degree",
  "name": "AWS Certified Solutions Architect – Associate",
  "issuer": "Amazon Web Services",
  "issuer_logo_url": "https://…", // display
  "badge_image_url": "https://…",
  "skills": ["EC2", "S3", "VPC"],
  "issued_at": "2021-06-01",
  "expires_at": "2024-06-01",
  "verification": "issuer_verified", // raises precedence above self_asserted
  "verification_url": "https://credly.com/badges/…",
  "confidence": 1.0, // verified → 1.0; resume-extracted → scored
  "raw": {
    /* minimal provider payload; honor retention limits, do NOT persist forever */
  },
}
```

## Trust integration (reuse, don't fork)

- **Provenance (Phase 5):** every imported credential keeps `{source, external_id, verification,
verification_url, imported_at}` in the domain row's `metadata` — exactly as resume import does.
- **Precedence (Phase 6D):** insert `issuer_verified` **above** `user_entered` in the precedence
  ladder (`user_confirmed > user_edited > issuer_verified > user_entered > extracted_high > …`). A
  Credly-verified cert then _wins_ a conflict against a resume-asserted one, and the advisor can say
  "verified through Credly."
- **Conflict detection (Phase 6):** add a `certification_status_mismatch` concept comparing
  verified vs asserted credentials by normalized name.
- **Storage:** reuse `education.certifications` (+ `metadata`) for the MVP; a dedicated
  `documents.credential_imports` staging table (mirroring `documents.resume_items`) is the natural
  home for review + verification + skills + badge imagery if/when richer display is needed.

## Compliance notes (Credly / Pearson)

- Official API only (`api.credly.com/v1`, sandbox `sandbox-api.credly.com/v1`) — **no scraping**.
- OAuth2 server-side; scopes `issued_badges`, `badge_templates`, `organizations`.
- Honor storage/caching limits: refresh ≤ ~30 days, and **delete** cached API content on user
  disconnect/request. The `disconnect()` method is where this is enforced.

## Why this is enough for now

Resume import already exercises the whole pipeline with `verification: self_asserted`. Adding a
verified provider is then: implement `connect/fetch/disconnect`, map its payload to
NormalizedCredential, and bump the precedence tier — no new trust, conflict, advisor, or report
machinery required.

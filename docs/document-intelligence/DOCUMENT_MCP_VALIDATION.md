# Document → MCP/IngestionService persistence validation

Question: is the same sanctioned write path the MCP server uses (`IngestionService`) now persisting
document facts, with provenance, candidate-vs-confirmed discipline, tenant isolation, and
idempotency? **Yes.** The bridge calls `IngestionService.submit_life_fact` exactly like an MCP tool
would — the LLM/agent path and the document path now converge on one validated writer.

## The write path

`DocumentIntelligenceService.upload()` (`documents.py:283`) → `register()` (`:331`) →
`_bridge()` (`:412`) → `IngestionService.submit_life_fact()` (`ingestion.py:181`).

The bridge never writes `life.facts` directly; it submits a payload that
`IngestionService` validates (Pydantic `LifeFactIn`), scopes to `ctx.user_id`, stamps with
provenance, and upserts idempotently. No new unguarded write path was introduced.

## Provenance populated

Every bridged fact carries:

```
provenance = {submitted_by: "document-intelligence", source_type: "document", document_id: <id>}
source = "document"
```

Verified by `test_will_upload_writes_life_facts_with_document_provenance`.

## Candidate vs confirmed

- Below threshold / scanned → `confirmation_status="inferred"`. The free-text will fields
  (executor 0.7, guardian 0.7) are written **inferred**, never auto-confirmed
  (`test_text_field_below_threshold_is_inferred_not_confirmed`).
- High-confidence native-text (money/date ≥ 0.85) → `confirmed`
  (`test_high_confidence_native_text_field_is_confirmed`: `life_insurance_policy.coverage_amount`).
- This honors the ingestion contract: "candidate/inferred data is never silently promoted to
  confirmed."

## Tenant isolation

`user_id`/`tenant_id` are taken from `ctx` inside `IngestionService` and the family `_upsert_*`
helpers — never from the payload. Verified by `test_bridged_rows_are_tenant_scoped_from_context`
(facts, estate_plans, guardianship_plans all scoped to the context user).

## Idempotent

- life.facts: deterministic id from `idempotency_key=<document_id>:<field_key>` →
  re-submitting the same document+field updates in place.
- family singletons: deterministic id `uuid5(user_id:<table>)` + read-before-write.
- Verified by `test_reupload_is_idempotent_no_duplicate_facts_or_rows` (1 executor fact, 1 estate
  row, 1 guardianship row after two registrations of the same document id).

## upload → life.facts trace (examples)

### Will

```
will.txt → register(doc_type=will)
  document_fields: executor, guardian, beneficiaries, date
  life.facts:
    will.executor      = "Jane Doe"   inferred (0.7)
    will.guardian      = "Mary Smith" inferred (0.7)
    will.beneficiaries = "..."        inferred (0.7)
    will.date          = "2025-01-15" confirmed (0.85, native date)
  family.estate_plans:       has_will=true, metadata.executor="Jane Doe"
  family.guardianship_plans: status=designated, designated_guardian="Mary Smith"
```

### Trust

```
trust.txt → register(doc_type=trust)
  life.facts: trust.trust_name, trust.grantor, trust.trustee, trust.successor_trustee,
              trust.beneficiaries, trust.revocable_status  (inferred, 0.7 free-text)
  family.estate_plans: metadata.{trust_name,grantor,trustee,successor_trustee,beneficiaries,
                                 revocable_status,has_trust=true}  (no trust columns exist)
```

### Life Insurance

```
policy.txt → register(doc_type=life_insurance_policy)
  life.facts:
    life_insurance_policy.coverage_amount = "1000000" confirmed (0.9, native money)
    life_insurance_policy.premium         = "85"      confirmed (0.9, native money)
    life_insurance_policy.insurer/policy_type/insured_person/beneficiaries inferred (0.7)
  family.insurance_profiles: life_coverage=1000000, source=document-intelligence,
                             metadata.{policy_type, beneficiaries, premium, insurer, insured_person}
```

## Verdict

Document facts are now persisted through `IngestionService` with full provenance, correct
candidate/confirmed discipline, tenant isolation, and idempotency. Uploads create visible downstream
value in both the life model (`life.facts`) and the Family domain (`estate_plans`,
`guardianship_plans`, `insurance_profiles`). Remaining surfacing gaps are documented in
FAMILY_READINESS_INTEGRATION.md (FamilyService does not yet read `metadata`/`life.facts`).

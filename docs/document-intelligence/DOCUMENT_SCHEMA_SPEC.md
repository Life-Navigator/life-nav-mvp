# Document Schema Spec — Will / Trust / Life-Insurance fields

Source of truth: `app/services/documents.py` (`TAXONOMY`, `_SYNONYMS`, `DocumentExtractor`).
Every field below is **extracted only when present** in the document text. A field absent from the
text is never written — no fabrication.

## Field schema

### Will (`doc_type="will"`, category `family_office`, critical, domain `family`)

| field_key       | type | synonyms (native-text labels that resolve)                           |
| --------------- | ---- | -------------------------------------------------------------------- |
| `executor`      | text | executor, personal representative, executrix                         |
| `guardian`      | text | guardian, designated guardian, guardian of minor children            |
| `beneficiaries` | text | beneficiaries, beneficiary, named beneficiaries, primary beneficiary |
| `date`          | date | date                                                                 |
| `last_updated`  | date | last updated                                                         |

### Trust (`doc_type="trust"`, category `family_office`, critical, domain `family`)

| field_key           | type  | synonyms                                               |
| ------------------- | ----- | ------------------------------------------------------ |
| `trust_name`        | text  | trust name, name of trust, trust                       |
| `grantor`           | text  | grantor, settlor, trustor                              |
| `trustee`           | text  | trustee                                                |
| `successor_trustee` | text  | successor trustee, alternate trustee                   |
| `beneficiaries`     | text  | beneficiaries, beneficiary, named beneficiaries        |
| `revocable_status`  | text  | revocable status, revocable or irrevocable, trust type |
| `estimated_value`   | money | estimated value                                        |
| `date`              | date  | date                                                   |

### Life Insurance (`doc_type="life_insurance_policy"`, category `insurance`, critical, domains `family,finance`)

| field_key         | type   | synonyms                                                        |
| ----------------- | ------ | --------------------------------------------------------------- |
| `coverage_amount` | money  | coverage amount, death benefit, face amount, coverage           |
| `premium`         | money  | premium, monthly premium                                        |
| `insurer`         | text   | insurer, insurance company, carrier, issued by, underwritten by |
| `policy_type`     | text   | policy type, type of policy, plan type                          |
| `insured_person`  | text   | insured person, insured, name of insured, life insured          |
| `beneficiaries`   | text   | beneficiaries, beneficiary, named beneficiaries                 |
| `term_years`      | number | term years                                                      |

## Provenance / confidence / confirmation

Each extracted field is written to `life.facts` via `IngestionService.submit_life_fact`
(`documents.py:_bridge`, line ~425) with:

- `fact_type` = `<doc_type>.<field_key>` (e.g. `will.executor`, `life_insurance_policy.coverage_amount`)
- `value` = the extracted string value
- `domain` = first ingestion-valid domain from the taxonomy entry (`_fact_domain`)
- `confidence` = the extractor's per-field confidence (money/percent 0.9, date 0.85, number 0.8, free-text 0.7)
- `provenance` = `{submitted_by: "document-intelligence", source_type: "document", document_id: <id>}`
- `idempotency_key` = `<document_id>:<field_key>` → deterministic row id; re-upload updates in place
- `confirmation_status`:
  - **`confirmed`** iff `confidence >= 0.85` AND the source is native machine-readable text
    (`source_kind in {text, pdf}`) — i.e. a labeled native-text field at high confidence.
  - **`inferred`** otherwise (free-text fields like executor/guardian at 0.7, and anything from a
    scanned/image source). Inferred facts are surfaced qualified and are **never** auto-promoted to
    confirmed (`_confirmation`, line ~419).

### needs_review

`upload()`/`register()` return `needs_review: [{field_key, reason, confidence}]` for every field
written as `inferred` (reason `low_confidence_or_scanned`). The UI should flag these for user
confirmation before they are treated as confirmed.

### `changed` summary

`upload()` returns `changed: [...]` listing only what actually happened, e.g.
`["Will detected", "Executor identified: Jane Doe", "Guardian identified: Mary Smith",
"Estate plan updated (will on file)", "Guardian recorded: Mary Smith"]`. No entry is added for a
field that was not extracted or a table that was not written.

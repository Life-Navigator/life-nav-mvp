# MCP Provenance & Confidence Policy

**Date:** 2026-06-16 · Enforced in `app/services/ingestion.py`; aligns with the platform provenance taxonomy (`my_life.py:116-141`).

## Every submitted item tracks

| Field                            | Where                                |
| -------------------------------- | ------------------------------------ |
| who/what submitted it            | `provenance.submitted_by` (required) |
| user message source              | `provenance.user_message`            |
| conversation_id                  | `provenance.conversation_id`         |
| document_id                      | `provenance.document_id`             |
| email_id                         | `provenance.email_id`                |
| calendar_event_id                | `provenance.calendar_event_id`       |
| confidence                       | `confidence` column (0–1)            |
| confirmed / inferred / candidate | `confirmation_status` column         |
| created_at / updated_at          | table columns                        |

## Confidence & confirmation rules

- **Confirmed** facts (user explicitly stated/affirmed) may be surfaced directly.
- **Candidate / inferred** facts must be qualified when surfaced ("it looks like…", "you mentioned…") and are **never auto-promoted** to confirmed (`test_candidate_is_not_promoted_to_confirmed`). Default `confirmation_status` is `candidate`.
- **Unknowns must not be stated as facts** — the tool requires a real `value`/`label`; there is no path to write an empty or speculative row, and `confidence` defaults low (0.5).

## Mapping to the platform taxonomy

The platform's surfacing taxonomy is `user_confirmed > user_stated > advisor_inferred > assumption`. MCP `confirmation_status` maps:

| MCP `confirmation_status`                | Platform provenance tier     | Surfacing                           |
| ---------------------------------------- | ---------------------------- | ----------------------------------- |
| `confirmed` + `source_type=user_message` | user_stated / user_confirmed | may be surfaced directly            |
| `inferred`                               | advisor_inferred             | qualify when surfaced               |
| `candidate`                              | assumption/candidate         | provisional; do not present as fact |

## Email / calendar sourced facts

Per `EMAIL_CALENDAR_CONTEXT_POLICY.md`: facts derived from email/calendar are submitted with
`source_type=email|calendar` and `confirmation_status=candidate` (or `inferred`) **unless the user
confirms**, and MUST carry `email_id`/`calendar_event_id` provenance. This makes every email/calendar-derived
item traceable to its source event and prevents an inferred fact from masquerading as user truth.

## Non-fabrication guarantee

No tool can write a row without `submitted_by` provenance (`test_every_tool_validates_provenance`), a real
value, and a valid enum/domain. Combined with idempotency and tenant scoping, this satisfies the sprint's
"no loose JSON dumping, no unstructured writes, no silent overwrites, no hallucinated inserts."

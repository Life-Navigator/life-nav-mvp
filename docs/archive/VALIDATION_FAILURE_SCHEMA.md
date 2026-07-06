# VALIDATION_FAILURE_SCHEMA.md — Phase 3

`classify_issues(result, context) -> list[issue]`, each:

```json
{ "type": "...", "text": "<flagged span>", "reason": "...", "repair_instruction": "..." }
```

Types + instructions:

- `unsupported_monthly_payment` — "$3,267/mo" → "Remove it; a payment needs an interest rate and term."
- `unsupported_personal_number` — "your net worth is $X" → "Don't state as the user's figure; remove or qualify."
- `unlabeled_scenario_math` — "$100,000" (=20% of stated $500k) → "Label as a standalone scenario: 'as a scenario, 20% down on $500,000 is about $100,000'."
- `fabricated_number` — ungrounded $ → "Remove, or compute only from the user's own numbers and record in derivations."
- `advice_or_clinical_boundary` — verdict/clinical/legal/tax/product → "Remove the directive/verdict; give a checklist or hedged read; defer to a professional."
- `unsupported_relationship` — ungrounded goal link → "Only claim a connection that's in the user's graph."

The orchestrator renders these into a numbered repair note; the model fixes only the flagged spans.

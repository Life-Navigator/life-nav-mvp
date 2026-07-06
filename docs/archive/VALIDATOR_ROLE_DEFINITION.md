# VALIDATOR_ROLE_DEFINITION.md — Phase 2

The validator SUPERVISES the generated answer; it does not muzzle the model beforehand.

It ASKS (and on failure emits a structured repair instruction):

1. illegal? 2. harmful? 3. medical/legal/tax beyond bounds (clinical directive, named product, definitive verdict)? 4. fabricates personal data (net worth/balance/payment/DTI/tax/readiness)? 5. unsupported financial claim? 6. scenario math presented as fact (unlabeled)? 7. assumptions needed (e.g. rate+term for a payment)? 8. citations/provenance needed? 9. safer framing needed? 10. repairable?

It does NOT ask: "too bold?", "contains numbers?", "advice too specific?", "would a lawyer theoretically dislike this?". Benchmarks, labeled scenarios, and grounded personal-finance recommendations are ALLOWED.

Trust floor (unchanged, always enforced after every draft): no fabricated personal numbers, no clinical/legal/tax directives, no named products, no ungrounded relationship claims, no definitive affordability/lending verdicts.

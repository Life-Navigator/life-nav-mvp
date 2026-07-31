# ADR Decision Checklists

**Date:** 2026-07-30 · Phase 3. For each ADR, the **smallest set of questions whose answers change the
outcome.** Discussion questions are deliberately excluded.

Every list leads with the brief's priority question: _what evidence would make us reject this?_

---

## ADR-003 · Authorization — 4 questions

1. **What would make us reject this?** → The personal-advisor set resolving to anything other than
   **119** relationship types after migration. Anything else means the export is not faithful.
   _Adopt as a hard gate? Y/N_
2. Do we commit to **never** adding a second principal? _(If yes, the boolean suffices and this ADR is
   unnecessary. If no — and the agent roadmap says no — the matrix is required.)_
3. Is an external policy engine (OPA/Cedar) proportionate for a matrix the catalog already declares?
   _(The one alternative worth reviving; hear the argument.)_
4. Confirm `evaluation` is a **distinct** context so diagnostics cannot borrow advisor rights. _Y/N_

**Not asked:** provider retrieval design (out of scope by construction); agent roster (not written);
taxonomy membership (catalog data, revisable without an ADR).

---

## ADR-007 · Credentials — 3 questions

1. **What would make us reject this?** → A legitimate consumer that cannot function under per-app
   deploy-scoped tokens. _Does one exist?_
2. Does anyone dispute that revocation is unproven until an old credential is observed **rejected**?
3. Who owns the OQ-12 auth-log review, and by when? _(Blocks closure, not this decision.)_

**Not asked:** whether the exposure was serious; git-history rewrite mechanics.

---

## ADR-011 · Superclass — 3 questions

1. **What would make us reject this?** → Cross-domain queries showing no measured improvement once
   ADR-004 exists. _Accept that enablement is gated on that measurement? Y/N_
2. Can superclass expansion widen access? _(Required answer: no — authorization is applied after
   expansion, property-tested as expanded ⊆ ∪ individually-permitted.)_
3. Does any of the 47 live classes genuinely need two parents? _(If none, single-parent stands.)_

---

## ADR-002 · Provenance — 2 questions _(Needs Revision)_

1. **What would make us reject this?** → OQ-2 showing Plaid provenance is heterogeneous per edge. The
   batch tier's entire rationale is that ~1,951 edges share identical origin.
2. Given that, can this be decided today? **No.** _Confirm `Needs Revision`, assign OQ-2._

**Not asked:** table design, column types, retention. All premature.

---

## ADR-001 · Transactions — 2 questions _(Needs Revision)_

1. **What would make us reject this?** → A query class requiring the 1-hop `user → transaction` path
   that cannot be re-pointed without quality loss (OQ-11).
2. Can this be decided today? **No.** _Confirm `Needs Revision`, assign OQ-11 and OQ-1._

---

## ADR-005 · Vector trust — 2 questions _(Needs Revision)_

1. **CONF-A ruling required:** does the Stage-3 backfill (a) proceed from `source_system` with an
   explicit `traceability_pending` state cleared in Stage 5, or (b) move after Stage 5?
   _(a) gains security value two stages earlier; (b) gives full traceability from day one._
2. Who rules, and by when? _(Security + Graph Platform, jointly.)_

**Not asked:** payload field names; filter syntax. Both depend on the ruling.

---

## ADR-006 · Identity — 2 questions _(Needs Revision)_

1. **What would make most of this unnecessary?** → OQ-6 showing `entity_id` is already business-derived.
   Then the ADR reduces to documentation plus the alias table — a cheaper, better outcome.
2. Can this be decided today? **No.** _Confirm `Needs Revision`, assign OQ-6._

---

## ADR-009 · Gateway — 2 questions _(Needs Revision)_

1. **What would halt retirement?** → Live content or an active writer in **`central` Neo4j** (OQ-7), any
   legitimate traffic in 7 days, or any `410` hit during the shim release.
2. Does everyone accept that `ln_central` being empty says **nothing** about `central` Neo4j?
   _(Different stores. This conflation is the single most likely error in this decision.)_

---

## ADR-004 · Evaluation — 2 questions _(Defer to Session 2)_

1. **The question that determines whether this is worth building:** _are we prepared to accept
   "traversal adds nothing" as a published result?_ If no, the evaluation cannot disprove the preferred
   answer and should not be built.
2. Can 5 synthetic personas yield ≥100 queries across six categories (OQ-4)?

---

## ADR-008 · Traversal verification — 2 questions _(Defer)_

1. **What would make us stop?** → Zero non-seed paths across all test tenants. _Confirm this is a valid
   published outcome, not a failure requiring a retry with different settings._
2. Confirm `GRAPH_GROUNDING_ENABLED` remains unset regardless of result. _Y/N_

---

## ADR-010 · Confidence — 2 questions _(Defer)_

1. **What would collapse the model?** → The three components correlating > 0.9, or entity resolution
   yielding no numeric signal (OQ-8).
2. Does anyone want stored `path`/`answer`/`recommendation` confidence? _(Required answer: no — they are
   request-scoped, not properties of a knowledge object.)_

---

## Cross-cutting — 3 questions for the whole session

1. **Is any ADR being accepted because it is well-written rather than well-evidenced?**
2. **Does any acceptance today create pressure to accept a dependent ADR later?**
   _(Watch ADR-003 → ADR-008/011, and ADR-007 → ADR-009.)_
3. **Has every blocking trigger acquired an owner, method, date, and escalation path?**
   _If no, no acceptance today is valid._

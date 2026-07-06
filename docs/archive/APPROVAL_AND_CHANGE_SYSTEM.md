# APPROVAL_AND_CHANGE_SYSTEM.md — Sprint A

The approval gate + change-visibility UX (Advisor OS steps 4 + 6). This is the trust contract: **nothing enters the life model without the user saying yes, and every applied change is shown.**

## The mandatory gate

Between "propose" and "execute" there is always a human approval. The advisor turn that contains `ProposedAction[]` renders an **approval card**, not a write.

```
┌─────────────────────────────────────────────────────────┐
│ You said: "We moved our wedding from September to March"  │
│                                                           │
│ This impacts:                                             │
│   • Wedding timeline      Sept → March                    │
│   • Home purchase timing  re-sequence after wedding       │
│   • Family planning       shift ~6 months                 │
│   • Savings targets       recompute target date           │
│                                                           │
│ Proposed updates (4)            confidence ●●●●○           │
│   ✎ family.wedding_date = "March"          [why?]         │
│   ✎ goal "Buy a house" target → Q3          [why?]        │
│   …                                                       │
│                                  [ Review ]   [ Approve ] │
└─────────────────────────────────────────────────────────┘
```

- **[Review]** expands each ProposedAction: the exact row that would change, old→new, confidence, and the `reasoning` ("why Arcana believes this"). The user can **edit** a value or **deselect** individual items before approving (partial approval is first-class).
- **[Approve]** executes only the selected items (MCP_ADVISOR_INTEGRATION).
- Doing nothing changes nothing. Closing the card discards the proposal. **No silent write, ever.**

## States

- **Proposed** — card shown, nothing written.
- **Approved (partial/full)** — selected items executing.
- **Applied** — writes done; show-what-changed renders.
- **Declined/Expired** — discarded; the advisor acknowledges and moves on (the stated change is still remembered as conversation context, not as a model write).

## Step 6 — Show what changed (no invisible success)

On Applied, render a change summary inline + in the Timeline:

```
✅ Updated your plan
   • Wedding date → March                    (family.facts)
   • "Buy a house" target → Q3 2027          (life.candidate_goals)
   • Family readiness 72 → 74                 (readiness recompute)
   • 1 recommendation refreshed: "Increase wedding savings to $X/mo"
   Every change traces to this conversation.  [view evidence]
```

Sources: the applied ProposedAction results + `life.readiness_snapshots` delta + refreshed recommendations. Same delta-rendering primitive as DOCUMENT_CHANGE_VISIBILITY / FAMILY_TIMELINE — reused, not rebuilt.

## Trust + safety properties

- **Reversible:** each applied change carries provenance (`conversation_id`, `submitted_by:'advisor'`, timestamp), so it can be shown, audited, and undone.
- **Honest confidence:** inferred/low-confidence proposals are visually distinct and default to _needs your confirmation_; high-confidence still requires approval but is pre-selected.
- **No medical/legal/financial advice leakage:** the existing advisor governance/disclaimer + validator boundaries still gate the surrounding narrative; the action system only records the user's own stated facts and re-sequences their own plan — it does not generate advice that bypasses those gates.
- **Discovery boundary intact:** if approving a change reveals the model is missing a prerequisite area, Arcana proposes routing to a short Discovery follow-up rather than improvising.

## Definition of done

Every life-change utterance produces an approval card; approval (full or partial) is the only path to a write; applied changes always render a traceable "what changed" summary with readiness/recommendation deltas.
</content>

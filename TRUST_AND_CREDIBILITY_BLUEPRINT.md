# TRUST & CREDIBILITY BLUEPRINT

**Date:** 2026-06-04
**Premise:** we ask people to point an AI at their money and life decisions. Trust is not a footer — it's a precondition, and (because we built real governance) it's a **differentiator**. The goal: a financially-literate skeptic feels _safer here than with a generic AI, and as safe as with an institution._

---

## The trust ladder (what must exist before we ask for each thing)

| Before we ask the user to…      | They must first see…                                     | We have it?                                                      |
| ------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Create an account               | What it is, who it's for, that beta uses **sample** data | yes (copy)                                                       |
| Pick a sample financial profile | "No real bank connection. Synthetic data."               | **yes** (Plaid sandbox personas)                                 |
| Connect a real bank (post-beta) | Plaid explainer, read-only, we never see credentials     | yes (Plaid, read-only)                                           |
| Trust an AI recommendation      | Governance + character review + "we show our work"       | **yes** (constitutional/character/injection review, audit trail) |
| Pay                             | Clear value, refund/cancel, data-deletion promise        | needs pricing page                                               |

## 1. Security messaging

- **Headline:** "Wealth-grade security, in plain language."
- **Claims (all true today):**
  - "Your data is **isolated to you** — never pooled with other users." (Supabase RLS + per-user/tenant vector & graph filters.)
  - "Encrypted in transit and at rest."
  - "Hosted on hardened infrastructure (Supabase, Fly.io) in US regions."
- **Proof:** a `/security` page with a short technical appendix; a status/uptime link.
- **Avoid:** unearned badges (no "SOC 2" until real). Say what's true; promise the roadmap for the rest.

## 2. Privacy messaging

- **Principles, stated plainly:** "We don't sell your data. We don't train public models on your private data. You can delete everything, anytime, and we mean it."
- **Controls:** a visible "Export my data" + "Delete my account & data" in settings (and a data-deletion link in the footer).
- **Scope clarity:** what we store (your entered data, sample/linked financial data, your conversations) and why (to give you grounded advice).

## 3. AI transparency

- **"How it thinks" is public** (AI Architecture section): personal knowledge graph + grounded retrieval, not a black-box chat.
- **Per-answer transparency:** every recommendation can expand a **why-chain** (the evidence + reasoning) — we built the XAI/trust layer; surface it.
- **Honesty about limits:** "This is educational intelligence and a thinking partner — **not a licensed financial, legal, or medical advisor.**" Repeat this where money advice appears. It _builds_ trust, not undermines it.
- **Model disclosure:** "Powered by frontier models, governed by our safety system." (We don't need to over-share vendors.)

## 4. Financial data handling

- **Beta:** "You explore with **realistic sample financial profiles** — no real accounts, ever." (Reduces the single biggest objection at the exact moment of friction.)
- **Real connections (post-beta):** "Read-only. We can see balances and transactions to advise you; we **cannot move money** and we **never see your bank login.**"
- **Storage:** financial records are isolated per user (RLS) and used only to generate _your_ insights.

## 5. Plaid explanation (because most users don't know what Plaid is)

- **One-liner:** "Plaid is the same secure service that connects banks to apps like Venmo and Robinhood. It lets us **read** your accounts without ever seeing your password."
- **Beta caveat (prominent):** "During beta you don't connect a real bank at all — you pick a sample profile."
- **Where:** the persona/connect step + the security page + the FAQ.

## 6. Governance explanation (our moat — make it legible)

- **Plain version:** "Before any answer reaches you, it passes our safety system — a **constitutional review** (is this appropriate and in your interest?), a **character review** (is it honest, dignified, non-manipulative?), and an **injection/safety check**. Answers that fail are blocked or regenerated."
- **Why it matters to the user:** "Generic AIs will confidently tell you anything. Ours is **governed to act in your interest** and refuses what it shouldn't."
- **Proof:** show a real (anonymized) governance verdict on the AI Architecture page: `verdict: approved · character score: 1.0 · no dignity violation`.

## 7. Audit trail explanation

- **Plain version:** "Every AI decision is **recorded** — what was asked, what was decided, and the safety scores. We can show our work, and so can you (for your own account)."
- **Why it matters:** accountability the user can verify; "we don't just claim to be safe — it's logged."
- **Proof:** a per-account "decision history" view (backed by `decision_governance_audit` + `economic.usage_events`).
- **Trust as a feature, not a disclaimer.**

---

## Trust surfaces & placement

| Surface                                                     | Where                            | Job                                            |
| ----------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| Trust ribbon (`Encrypted · Governed · Auditable · Private`) | under hero, sticky in onboarding | constant reassurance                           |
| Trust band (3 pillars)                                      | below hero                       | top objections, up front                       |
| Security/Governance page                                    | linked everywhere                | depth for skeptics                             |
| Per-answer "why" + governance badge                         | every recommendation/chat        | transparency at the moment of advice           |
| Decision history                                            | account settings                 | verifiable accountability                      |
| Data export/delete                                          | settings + footer                | control = trust                                |
| "Sample data" reassurance                                   | the activate step                | kills the bank-fear objection at peak friction |

## Tone rules

- Plain language over jargon; jargon only with a plain gloss.
- Never over-claim (no fake certifications). Under-promise, over-disclose.
- Always pair "what we can do for you" with "what we can't / won't."
- Treat the user like an intelligent adult managing real money.

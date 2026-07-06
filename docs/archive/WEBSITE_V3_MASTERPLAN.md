# WEBSITE V3 — MASTERPLAN

**Date:** 2026-06-04
**Positioning:** _Your Personal Family Office, Powered by AI._
**Feel:** OpenAI × Apple × Morgan Stanley × Stripe — frontier intelligence, radical simplicity, fiduciary trust, precision polish.

This is a **reimagining**, not an iteration. The site's job: in 15 seconds, make a serious person think _"This is the team of advisors I could never afford — and it's governed, private, and built around my real life."_

---

## 0. Narrative spine

Every section advances one story:
**The wealthy have always had a family office — a team that coordinates money, decisions, career, and family. LifeNavigator gives everyone that team, as one calm AI that knows your real data and is governed to act in your interest.**

Page order is designed as a descent from _belief_ → _capability_ → _trust_ → _commitment_.

## 1. Navigation

- **Style:** thin, sticky, glassy on scroll; logo left; 4 links + 1 CTA. No clutter.
- **Links:** `Intelligence` (the AI/architecture story) · `Your Office` (the advisory domains) · `Trust & Security` · `Pricing`.
- **Right side:** `Log in` (text) + **`Request access`** (primary, pill). During beta the CTA is _Request access_ / _Join the beta_, not "Get started free" — exclusivity > freemium.
- **Mobile:** full-screen overlay, large type, single CTA.

## 2. Hero

- **Layout:** centered, generous whitespace, one sentence of supreme confidence + one supporting line + one CTA + a single live "proof" artifact (an animated "advisory brief" card, not a screenshot dump).
- **Eyebrow:** `Personal Family Office · Powered by AI`.
- **Headline (lead option):** _"The family office, for everyone."_
- **Subhead:** _"A team of AI advisors that knows your real finances, career, and life — and is governed to act in your interest."_
- **CTA:** `Request beta access` + a quiet secondary `See how it thinks`.
- **Hero proof artifact:** a slowly typing "Today's brief" card: _"You can move your Q2 bonus to max your 401(k) and still keep 4 months of runway — here's the trade-off."_ — instantly shows persona-aware, money-relevant intelligence.
- **No** stock illustrations, no "thrive", no emoji.

## 3. Trust Architecture (elevated to a first-class section, not a footer)

A dedicated band immediately under the hero — because we ask for financial data. Three pillars, each with a one-line claim + "how it works" link:

1. **Your data is yours.** Encrypted, isolated per user, never sold. (Supabase RLS, per-user vector/graph isolation.)
2. **Sandbox-first.** Explore with realistic _sample_ financial profiles — no real bank connection required in beta. (Plaid sandbox personas.)
3. **Governed intelligence.** Every AI answer passes a constitutional + character + safety review and is **audited**. (decision_governance_audit, character layer, economic controls.)
   Visual: three calm cards with a subtle "verified" motif; a thin "Audited · Governed · Private" trust ribbon.

## 4. Feature Architecture → reframed as "Your Office"

Not a feature grid. A **roster of advisors** the user "hires" — each a domain intelligence. Presented as cards that feel like meeting a team:

- **The Decision Desk** (Decision Intelligence)
- **The Scenario Lab** (Life Scenarios)
- **The Financial Office** (Financial Intelligence)
- **The Career Desk** (Career Intelligence)
- **The Family Desk** (Family Intelligence)
  Each card: advisor name → one outcome sentence → a tiny live example. Sub-sections below expand each.

## 5. Security Architecture (deep section)

For the skeptical / financially-literate visitor. Plain-language + technical credibility:

- **Data handling:** what we store, where (Supabase, isolated), encryption at rest/in transit.
- **Plaid:** what Plaid is, that beta uses **sandbox** data, that we never see bank credentials, read-only when real.
- **AI governance:** the constitutional/character/injection review pipeline; what gets logged.
- **Audit trail:** every model-facing decision is recorded (`decision_governance_audit`) — "we can show our work."
- **Isolation:** per-user RLS + per-tenant vector/graph filters.
  Tone: Stripe-docs clarity. A "Read the security overview" deep link.

## 6. Decision Intelligence section

Headline: _"Decisions worth money, made with a team."_
Show the Decision Desk: input a real choice ("Should I take the new job offer?") → the system surfaces trade-offs grounded in _your_ finances/career graph, a confidence range, and a why-chain (XAI/trust layer). Visual: a clean decision card with pros/cons + a "what would change my mind" line. This is the section that says _family office_, not _budget app_.

## 7. Life Scenarios section

Headline: _"See the next 5 years before you live them."_
The Scenario Lab: compare two life paths (e.g., "buy now vs rent + invest", "grad school vs promotion") with side-by-side trajectories. Visual: two elegant trajectory lines + a single "the difference is ~$X and Y years" takeaway. Emphasis on _clarity of the fork_, not chart soup.

## 8. Financial Intelligence section

Headline: _"A CFO who actually knows your accounts."_
Show persona-aware financial reasoning: accounts → cash-flow → liabilities → a recommendation that references the user's real numbers ("with your $33k and $410/mo student loan…"). Tie to the persona system: _"Try a sample profile and watch the advice change."_ Visual: a calm balance-sheet card + one sharp insight.

## 9. Career Intelligence section

Headline: _"Career moves, modeled like investments."_
Career Desk: trajectory, comp modeling, upskilling ROI, offer comparison — all connected to the financial picture (a raise's after-tax, after-savings impact). Visual: a comp/trajectory mini-chart + one decision sentence.

## 10. Family Intelligence section

Headline: _"One plan the whole household shares."_
Family Desk: joint finances, dependents, college/529 pacing, elder-care, coordinating two incomes and one mortgage. The "Married Family" persona is the live demo. Visual: a household ledger + a coordination insight.

## 11. AI Architecture section ("How it thinks")

For the OpenAI/Anthropic-literate visitor. Without jargon-dumping:

- **It remembers your real life** (personal knowledge graph — Neo4j + vector retrieval / GraphRAG).
- **It reasons over your data, not the average** (persona-aware, grounded retrieval).
- **It's governed** (constitutional review, character layer, injection defense, economic circuit-breakers).
- **It shows its work** (why-chains, audit trail).
  Visual: a single elegant diagram — _Your data → Personal graph → Governed reasoning → A recommendation you can trust_ — animated step-by-step. This is the "wow, this is serious" section.

## 12. Pricing Architecture

- **Beta:** "Invitation-only · free during beta" with a tasteful "Founding members lock in launch pricing." No "free forever" language.
- **At launch (anchor the premium):** a three-tier ladder that _anchors high_ so the real plan feels like a deal:
  - **Navigator** (individual) — the core family office.
  - **Household** (family) — shared plan, multiple members.
  - **Private** (concierge / high-complexity) — the anchor; advanced scenarios, priority intelligence.
- Frame value against the _alternative_: "A human advisor charges 1% of assets. Your AI family office is a flat [price]."
- Annual default; monthly available. No dark patterns.

## 13. FAQ

Grouped, calm, objection-killing:

- _Is my financial data safe?_ · _Do I have to connect a real bank?_ (No — sandbox personas in beta.) · _Is this financial advice?_ (Educational + governed; not a fiduciary substitute — set expectations.) · _How is this different from ChatGPT?_ (It knows _your_ data + is governed + auditable.) · _Who is it for?_ · _What does it cost after beta?_ · _Can I delete my data?_ (Yes, anytime.)

## 14. Testimonials Strategy

- **Beta (now):** no fake testimonials. Use **"Founding cohort"** social proof: "Built with our first 20 members," a waitlist counter, and _named advisors/architects_ (credibility by builders, not users).
- **Design hooks ready** for real quotes: a quote component + a "what changed for them" metric slot.
- **Post-beta:** harvest 3 archetype stories (a young professional, a family, an executive) tied to a concrete outcome ("found $4,300/yr", "made the job call in a day").
- Logos: security/compliance badges now; press/user logos later.

## 15. Call-To-Action Strategy

- **One primary action** site-wide: `Request beta access`. Repeated at hero, after AI Architecture, after Pricing, in footer.
- Secondary, lower-commitment: `See how it thinks` (anchors to AI Architecture) and `Explore a sample profile` (the persona demo — the wow path).
- Micro-copy reduces risk at every CTA: "No real bank connection. 2-minute setup."
- Sticky mobile CTA bar.

## 16. Footer

- Tone: institutional-calm (Morgan Stanley meets Stripe). Columns: **Product** (Intelligence, Your Office, Pricing) · **Trust** (Security, Privacy, Governance, Audit) · **Company** (About, Beta, Contact) · **Legal** (Terms, Privacy, Data deletion).
- A single trust line: _"Encrypted · Governed · Auditable · Your data is never sold."_
- Status/uptime link (signals operational seriousness). Subtle, monochrome.

---

## Section → proof map (we can back every claim)

| Section                       | Backed by (already built)                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Trust / Governed intelligence | constitutional + character + injection review, `decision_governance_audit`, economic controls |
| Financial Intelligence        | Plaid persona system, distinct datasets, persona-aware recommendations                        |
| AI Architecture               | GraphRAG (Neo4j + Qdrant), personal knowledge graph, graph promotion                          |
| Privacy / isolation           | Supabase RLS, per-user/tenant vector + graph filters                                          |
| Scenarios / Decisions         | scenario lab + decision-intelligence schemas                                                  |

**Principle:** ship only claims we can demonstrate in-product. The differentiation is real; the site's job is to make it _legible_ and _premium_.

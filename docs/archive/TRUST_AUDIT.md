# TRUST_AUDIT.md — LifeNavigator MVP (Part 6: Trust Audit)

Scope: every surface a real, non-technical beta user sees — landing, security, signup/activation, dashboard, First Insight, and the AI advisor chat. Branch `mvp`. Every claim below is grounded in code with `file:line`. Where I could not verify a runtime behavior I say "unverified."

The core question for each surface: **"Would I trust this with my real financial life? If not, why?"**

---

## Executive verdict

The app is polished and the engineering (RLS, governed chat, deterministic First Insight) is genuinely above MVP bar. But the **trust layer overclaims what the code does**, and several trust-critical links/labels are broken or misleading. A non-technical user who clicks "Privacy Policy," reads the security page, or asks the advisor a money question will hit a 404, an unbacked promise, or the wrong chat within the first session. These are cheap to fix and should be fixed before 20 users see it.

---

## Surface 1 — Landing page (`apps/web/src/app/page.tsx`)

What it promises: "Get personalized advice grounded in your actual data," "Bank-Grade Security," "AES-256," "GDPR," and the trust line `No credit card required. GDPR compliant. Bank-grade encryption.` (page.tsx:43, 89-91, 135-140).

- The hero badge says "AI-Powered Personal Advisory" (page.tsx:17) and the copy repeatedly calls it an **"advisor"** giving **"advice"** (page.tsx:25, 69-70). For a product touching finances, "advisor/advice" is regulated-adjacent language. There is **no "informational only / not financial advice" microcopy anywhere on the landing page.** The only such disclaimer in the whole app is buried in Terms §7 (`legal/terms/page.tsx:106`).
- Stat cards present `AES-256`, `GDPR`, `SOC` posture as fact (page.tsx:135-140). See Surface 2 for why those are partly unbacked.
- No "beta" framing anywhere user-facing (`grep "\bbeta\b"` on page.tsx and marketing components returned nothing). For an internal 20-user beta of a pre-revenue product making bank-grade claims, the absence of any "early access / beta" signal raises the implied promise to production-grade.

**Trust risk:** medium. The advice framing without a disclaimer is the main issue; carried into Surfaces 4/5.

---

## Surface 2 — Security page (`apps/web/src/app/security/page.tsx`)

This is the page that exists specifically to earn trust, so its claims must be exact. Several are not.

1. **"Cascading deletion removes your data from every table, graph node, and vector store"** (security/page.tsx:90). The delete path is `api/user/delete/route.ts` → RPC `delete_user_data` (route.ts:41) → `core.delete_user_data` (migration `039_compliance.sql:70-94`). That function does **only** `DELETE FROM public.profiles` and relies on Postgres FK CASCADE (039:88). There is **no Neo4j and no Qdrant deletion anywhere** in the delete route or the function (`grep -i neo4j|qdrant` in `api/user/` returns nothing). The "graph node and vector store" half of the sentence is false. On a product whose own security page brags about per-tenant Neo4j/Qdrant isolation (security/page.tsx:66-69), promising deletion you don't perform is the highest-severity trust claim here.

2. **"Your data export includes goals, financial records, career information, and all other personal data"** (security/page.tsx:99-101, Article 20). The actual export endpoint `api/user/export/route.ts` selects only `profiles, goals, courses, job_applications, documents, risk_assessments` (export/route.ts:25-31). It does **not** include `finance.financial_accounts` or `finance.transactions`. (Note: a _different_, more complete `core.export_user_data` SQL function exists in migration 039:31-67 and _does_ include `financial_accounts`, but the web route does not call it — it hand-rolls a narrower query.) So the claim "includes financial records" is false for the export users actually get.

3. **"Hosted on Supabase with SOC 2 Type II certified infrastructure ... 99.9% uptime SLA"** (security/page.tsx:132-134). Supabase's certification is borrowed; presenting "SOC 2 Type II" and a "99.9% uptime SLA" as Life Navigator's posture, with no qualifier, is an overstatement a security-savvy reviewer (or a regulator) would flag. Unverified that Life Navigator itself carries any SLA.

4. **"account numbers, and SSNs have an additional layer of encryption using pgcrypto"** (security/page.tsx:46). In the live Plaid path, `persistPlaidItem` writes the access token to a column literally named `access_token_encrypted` but stores it **in plaintext**, with an inline comment: _"The real-Plaid path should encrypt via core.encrypt_text before storing here"_ (`lib/integrations/plaid/persist.ts:118-119`). For the beta this is sandbox-only data so the risk is low, but the column name + the security page imply encryption that the persist code defers as a TODO. If real Plaid is ever switched on without closing that TODO, the security page becomes an outright false statement.

**Trust risk:** P0. Claims 1 and 2 are demonstrably contradicted by the code on the page whose entire job is trust.

---

## Surface 3 — Footer / navigation (`components/marketing/Footer.tsx`)

The Footer links **Privacy Policy → `/privacy`** and **Terms of Service → `/terms`** (Footer.tsx:15-16). But those pages live at **`/legal/privacy`** and **`/legal/terms`** (`apps/web/src/app/legal/privacy/page.tsx`, `.../terms/page.tsx`), and there is **no `/privacy` or `/terms` route or redirect** (`ls app/privacy` / `app/terms` → not found). The footer's About (`/about`) and Contact (`/contact`) targets also have no corresponding `page.tsx`.

So: a user who reads the trust-heavy security page, then clicks "Privacy Policy" in the footer to verify, gets a **404**. This is the single most visceral trust-breaker for a non-technical user — and it's a one-line fix.

**Trust risk:** P0.

---

## Surface 4 — Activation / "sample financial profile" (`components/onboarding/SampleFinancialProfile.tsx`)

The synthetic-data framing is **mostly good**, which is worth crediting:

- Heading "Choose a sample financial profile" and body "explore LifeNavigator without connecting real accounts" (SampleFinancialProfile.tsx:73-76).
- Footnote "No real bank credentials are used during this beta experience." (line 130-131).
- The server route is genuinely safe: credentials stay server-side, sandbox-only (`activate-persona/route.ts:27-78`).

Remaining ambiguity a non-technical user would feel:

- The primary button reads **"Activate Financial Profile"** and the spinner "Activating financial profile…" (lines 142). Combined with the page title "Choose a sample financial profile," a nervous first-timer may still wonder whether "Activate" pulls their real money. Recommend "Load this sample (no real accounts)" on the button itself.
- After activation the dashboard shows real-looking dollar figures (e.g. "$242,200 in savings") with **no persistent "Sample data" badge** on the dashboard or finance cards (DashboardClient.tsx:456-507 renders raw `$` values; no synthetic marker). The synthetic disclaimer exists only on the pre-activation screen, so once a user is in, the data reads as real.

**Trust risk:** P2. Framing is decent pre-activation but evaporates post-activation.

---

## Surface 5 — Dashboard + First Insight (`components/dashboard/FirstInsightCard.tsx`, `DashboardClient.tsx`)

The First Insight engine (`lib/finance/first-insight.ts`) is deterministic and the copy is specific and honest about the numbers. Good. But the card has two concrete trust problems:

1. **"Ask your advisor about this" links to the wrong chat.** `chatHref = '/conversation'` (FirstInsightCard.tsx:35, 83). `/conversation` renders the onboarding **What-What-Why discovery questionnaire** (`app/conversation/page.tsx` → `DiscoveryChat`), which first _gates_ the user behind "Complete Benefits Discovery" and "Create at least one goal" prerequisites (conversation/page.tsx:96-140). A user who just got a finance insight and clicks "Ask your advisor" lands in a goal-discovery survey, not the financial advisor. The actual financial advisor is the **global ChatSidebar** (Surface 5b). This is a broken promise on the dashboard's headline CTA.

2. **The "Governed" badge is unexplained jargon** (FirstInsightCard.tsx:50-61). It renders a checkmark + "Governed" with no tooltip, link, or explanation. To a non-technical user this is meaningless at best and vaguely alarming ("governed by whom?") at worst. Either explain it ("Checked for safety and grounded in your data") or remove it.

3. **First Insight gives prescriptive financial recommendations** — e.g. "Prioritize paying this down before adding to savings or investing" (first-insight.ts:118), "Open or fund a tax-advantaged retirement account (401(k)/IRA) this month" (first-insight.ts:176) — rendered in a "Recommended ·" block (FirstInsightCard.tsx:73-78) with **no disclaimer**. This is the most advice-like surface and has zero "informational only" framing.

4. **Fake social proof.** The "Help Shape the Future" section hardcodes vote counts (`votes: 127 / 95 / 203 / 78`, DashboardClient.tsx:108-129) and voting only mutates local state (handleVote, lines 339-349) — it never persists. Fabricated engagement numbers shown to beta users who know it's a 20-person beta will read as dishonest.

**Trust risk:** P1 (items 1-3), P2 (item 4).

### Surface 5b — The actual AI advisor (`components/chat/ChatSidebar.tsx`, mounted globally `layout.tsx:75`)

This is where real money advice happens, and it has the weakest trust treatment:

- Suggested starters are direct financial decisions: _"What should I do with my money this month?", "Can I afford a $30,000 car?", "Should I pay down debt or invest first?"_ (ChatSidebar.tsx:275-277).
- It claims "Your advisor knows your accounts and goals. Ask anything" (line 269).
- It is labeled **"AI Assistant"** (line 29) with a green "online" dot (line 232) and **no "Governed" signal and no disclaimer** — the inverse of the First Insight card, which _has_ the Governed badge but _isn't_ the advisor.
- Error state: "Sorry, I encountered an error connecting to the AI service. Please try again." (lines 176-178). Given the KNOWN intermittent 502 on the graphrag-query edge function (~1/3-1/2 failure), a beta user will hit this often. A generic "try again" with no acknowledgment erodes confidence fast on a financial product.

So the two advice surfaces send **contradictory trust signals**: the deterministic card is badged "Governed," the real LLM advisor is an unbadged "AI Assistant" with no disclaimer and a flaky error path.

**Trust risk:** P1.

---

## Ranked trust risks

| ID  | Severity | Risk                                                                                         |
| --- | -------- | -------------------------------------------------------------------------------------------- |
| T1  | P0       | Footer Privacy/Terms links 404 (`/privacy`, `/terms` don't exist)                            |
| T2  | P0       | Security page claims graph+vector deletion the code never performs                           |
| T3  | P0       | Security page claims export includes financial records; export route omits finance.\*        |
| T4  | P1       | No "not financial advice" disclaimer on any advice surface (card, chat)                      |
| T5  | P1       | "Ask your advisor about this" routes to onboarding survey, not the advisor                   |
| T6  | P1       | Inverted "Governed" signal: badged on the deterministic card, absent on the real LLM advisor |
| T7  | P2       | SOC 2 Type II / 99.9% SLA overstated as Life Navigator's own posture                         |
| T8  | P2       | Fake hardcoded vote counts; votes don't persist                                              |
| T9  | P2       | Post-activation dashboard shows sample data as real (no persistent "Sample" badge)           |
| T10 | P3       | Plaid token in `_encrypted` column stored plaintext (sandbox-only today; TODO for real path) |

---

## Concrete fixes (copy + code)

- **T1:** Either move pages to `/privacy` & `/terms`, add `next.config` redirects, or change Footer hrefs to `/legal/privacy` and `/legal/terms`. Add real `/about` and `/contact` or remove the links.
- **T2/T3:** Make the security copy match reality — change to "We permanently delete your data from our Postgres database; deletion from our AI graph and vector stores is performed on a rolling basis" (and actually wire up Neo4j/Qdrant deletion), and "Export includes your goals, courses, applications, and documents" until finance.\* is added to the export route (or switch the route to call `core.export_user_data`).
- **T4:** Add a persistent one-liner under the First Insight "Recommended" block and at the bottom of ChatSidebar: _"Life Navigator provides general information, not financial, legal, or tax advice. Confirm decisions with a licensed professional."_
- **T5:** Point `chatHref` to the real advisor (open ChatSidebar or a `/advisor` route), not `/conversation`.
- **T6:** Add a tooltip to the "Governed" badge ("Checked for safety and grounded only in your data") and add the same badge/explanation to ChatSidebar; rename "AI Assistant" to "Your Advisor (Governed)".
- **T7:** Qualify as "Built on Supabase's SOC 2 Type II–certified infrastructure"; drop the "99.9% uptime SLA" unless Life Navigator offers one.
- **T8:** Remove fabricated vote counts or persist real votes.
- **T9:** Add a persistent "Sample data" banner/badge on the dashboard and finance views while a persona is active.
- **T10:** Encrypt via `core.encrypt_text` before go-live with real Plaid; track as a launch blocker for real-money mode.

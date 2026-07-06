# DOMAIN DATA CONTRACTS (F · G · H)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY.

The wire contracts between Core API and frontend. **Rule:** the frontend receives one complete view-model per surface and renders it directly — it never assembles raw rows from multiple sources or computes business values. Every contract carries `freshness` + `confidence` so the UI can show staleness/uncertainty without extra calls.

---

## 0. Shared primitives (`contracts/common.py`)

```jsonc
// Freshness — attached to every view-model + chat context
Freshness = {
  "as_of": "2026-06-07T18:30:00Z",     // when the underlying data was last synced
  "stale": false,                       // as_of older than the domain's freshness window
  "sources": [                          // provenance, for trust UI
    { "system": "supabase", "table": "finance.financial_accounts", "as_of": "..." },
    { "system": "neo4j",    "label": "TransactionSummary",         "as_of": "..." },
    { "system": "qdrant",   "collection": "life_navigator",        "points": 1234 }
  ]
}

Confidence = { "score": 0.0_to_1.0, "basis": "complete|partial|sparse|missing", "missing_fields": ["..."] }

Money = { "amount": 1234.56, "currency": "USD" }

ViewModel<T> = {
  "domain": "finance",
  "user_id": "uuid",
  "generated_at": "2026-06-07T18:30:05Z",
  "freshness": Freshness,
  "confidence": Confidence,
  "data": T,                            // domain-specific payload (below)
  "recommendations": [Recommendation],  // H contract (may be empty)
  "missing": ["plaid_link", "risk_assessment"]  // onboarding gaps to nudge
}
```

---

## F. Frontend rendering contract (per surface)

The frontend asks for exactly the surface it renders. No client joins.

### F.1 Finance summary — `GET /v1/finance/summary` → `ViewModel<FinanceSummary>`

```jsonc
FinanceSummary = {
  "net_worth": Money,
  "assets_total": Money,
  "liabilities_total": Money,
  "cash_flow": { "month_income": Money, "month_expense": Money, "net": Money },
  "accounts": [ { "id":"uuid","name":"Checking","institution":"...","type":"depository","balance":Money } ],
  "top_categories": [ { "name":"Subscriptions","amount":Money,"share_pct":12.4 } ],
  "recent_transactions": [ { "id":"uuid","date":"2026-06-04","merchant":"Netflix","amount":Money,"type":"expense","category":"..." } ],
  "trend": { "net_worth_series": [ { "date":"2026-05-01","value":Money } ] }
}
```

Replaces the current `/api/financial` shape — but COMPLETE (net_worth computed server-side, categories resolved, trend included) so the page is render-only.

### F.2 Other domain summaries (same envelope, domain `data`)

| Surface                     | `data` shape (key fields)                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- | ------------------------------------------- |
| `GET /v1/health/summary`    | `wellness_score`, `habits[{name,streak,target,adherence}]`, `sleep{avg_hours,trend}`, `activity{weekly_minutes}`, `nutrition{logged_days}`, `vitals[]` (later), `disclaimers[]` |
| `GET /v1/career/summary`    | `current_role`, `skills[{name,level,gap}]`, `applications[{company,role,stage}]`, `trajectory{next_step,readiness}`, `network_count`                                            |
| `GET /v1/education/summary` | `credentials[]`, `active_courses[{name,progress}]`, `path{next_milestone,roi_estimate}`, `study_streak`                                                                         |
| `GET /v1/family/summary`    | `members[{name,relationship,key_dates}]`, `upcoming_appointments[]`, `dependents_planning{gaps}`                                                                                |
| `GET /v1/goals`             | `goals[{id,title,category,target,progress_pct,probability,status,next_milestone}]`                                                                                              |
| `GET /v1/risk/summary`      | `overall_score`, `tolerance`, `category_scores[{domain,score}]`, `exposures[]`, `mitigations[]`                                                                                 |
| `GET /v1/calendar/events`   | `events[{id,title,start,end,source,domain_tag}]`, `connections[{provider,status}]`                                                                                              |
| `GET /v1/roadmap`           | `timeline[{date,domain,title,kind:goal                                                                                                                                          | milestone | event | decision,status}]` (DERIVED across domains) |
| `GET /v1/scenarios`         | `scenarios[{id,title,status,horizon_years,final_net_worth,created_at}]`                                                                                                         |

### F.3 Unified life profile — `GET /v1/life-profile` → cross-domain envelope

```jsonc
LifeProfile = {
  "user_id":"uuid", "generated_at":"...", "freshness":Freshness,
  "domains": {
    "finance": { "headline":"Net worth $X", "score":0.0_1, "summary_ref":"/v1/finance/summary", "missing":[] },
    "health":  { "headline":"...", "score":..., "missing":["wellness_profile"] },
    "career":  { ... }, "education": { ... }, "family": { ... },
    "goals":   { "active":3, "on_track":2 }, "risk": { "overall":62, "tolerance":"moderate" }
  },
  "active_recommendations": [Recommendation],   // top N cross-domain
  "missing_domains": ["health","education"],     // not yet onboarded
  "confidence": Confidence
}
```

This is what a "command center" dashboard renders in one call — no per-domain fan-out in the browser.

---

## G. Chat context contract — `POST /v1/chat/context`

Every domain exposes a uniform context block so the chat/agent layer grounds consistently. Request: `{ "user_id":"uuid", "domains":["finance","goals"], "query":"..." }` (domains optional → all relevant).

```jsonc
DomainChatContext = {
  "domain": "finance",
  "authoritative_facts": [            // system-of-record truth the model MUST NOT contradict
    { "fact":"net_worth", "value": Money, "source":{"system":"supabase","table":"..."} },
    { "fact":"checking_balance", "value": Money, "source":{...} }
  ],
  "missing_facts": ["risk_assessment","retirement_account"],  // gaps the model should ask about, not invent
  "relevant_goals": [ { "id":"uuid","title":"...","progress_pct":40,"probability":0.7 } ],
  "risks": [ { "type":"liquidity","severity":"medium","note":"<2 months emergency fund" } ],
  "recommendations": [Recommendation],
  "graph_evidence": [ { "label":"TransactionSummary","entity_id":"...","score":0.81 } ],  // Neo4j/Qdrant hits
  "freshness": Freshness,
  "confidence": Confidence
}
```

The assembled chat prompt = system policy + per-domain `authoritative_facts` (grounding) + `missing_facts` (anti-hallucination) + retrieved `graph_evidence`. Authoritative facts override the model; missing facts are explicitly "ask, don't guess." This is the structural fix for the financial-hallucination issue noted in prior reports.

---

## H. Recommendation contract

Every recommendation, from any agent/domain, is the same shape. Frontend renders a card; the Trust/Safety gate validates before release.

```jsonc
Recommendation = {
  "id": "uuid",
  "title": "Build a 3-month emergency fund",
  "explanation": "Your checking + savings cover ~1.2 months of expenses; the planning baseline is 3 months.",
  "evidence": [                       // human-readable, each tied to a source
    { "statement":"Monthly expenses ≈ $5,787", "source":{"system":"supabase","table":"finance.transactions"} },
    { "statement":"Liquid balance ≈ $7,000",     "source":{"system":"supabase","table":"finance.financial_accounts"} }
  ],
  "source_tables": ["finance.financial_accounts","finance.transactions"],
  "source_graph_nodes": [ {"label":"FinancialAccount","entity_id":"..."}, {"label":"TransactionSummary","entity_id":"..."} ],
  "assumptions": ["expenses are representative of a typical month","no upcoming large one-off income"],
  "confidence": Confidence,
  "priority": "high|medium|low",
  "affected_domains": ["finance","risk"],
  "action_steps": [ {"step":"Automate $300/mo to savings","effort":"low","impact":"high"} ],
  "escalation": null,                  // or { "type":"medical|legal|financial_advice", "disclaimer":"..." }
  "generated_by": "finance.agent",
  "governance": { "audit_id":"uuid", "character_score":0.9, "passed":true }
}
```

**Invariants:** no recommendation ships without `evidence` + `source_tables`/`source_graph_nodes` (traceability), `assumptions`, `confidence`, and a governance verdict. Medical/legal/financial-advice content MUST carry `escalation` with a disclaimer (see `HEALTH_WELLNESS_BACKEND_SPEC.md`).

---

## Contract governance

- Contracts are versioned under `/v1`; breaking changes → `/v2`. Pydantic models in `contracts/` are the single source of truth; the frontend consumes the generated OpenAPI client.
- Each contract field maps to a concrete source (table/graph node) or is server-computed — the frontend never derives `net_worth`, `wellness_score`, `probability`, etc.
- Empty/missing data is explicit (`missing`, `missing_facts`, `confidence.basis="missing"`) — never a silent zero that reads as real (the APR/`$0` lessons from prior reports).

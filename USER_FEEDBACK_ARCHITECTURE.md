# User Feedback Architecture

Sprint M Phase 7 deliverable.

## 1. Surfaces

| Surface                                                                                   | What                                                            | Where it stores                    |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| Recommendation feedback (👍 / 👎 / confusing / incorrect)                                 | tied to the displayed recommendation + the governance audit row | `feedback.recommendation_feedback` |
| Simulation feedback (useful / not useful / inaccurate / too optimistic / too pessimistic) | tied to a `simulation_id`                                       | `feedback.simulation_feedback`     |
| NPS (0–10 score + comment + prompt_slug)                                                  | one row per response                                            | `feedback.nps_responses`           |
| Bug report (title + body + severity + route_path + user_agent + app_version)              | one row per report                                              | `feedback.bug_reports`             |
| Overall comment (free-form, any time)                                                     | one row per submission                                          | `feedback.overall_feedback`        |

All five tables are RLS-protected: owner SELECT + INSERT; service-role
full. There is no UPDATE/DELETE path — feedback is immutable.

## 2. Bind-back keys

Every recommendation feedback row carries:

| Key                        | Source                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `recommendation_id`        | the persisted recommendation row                                                                    |
| `recommendation_table`     | which table holds it (e.g. `provider_recommendations`, `arcana_goals`, `optimizer_recommendations`) |
| `agent_kind`, `agent_name` | from `governance.agent_registry`                                                                    |
| `governance_audit_id`      | the row in `governance.decision_governance_audit` that approved/blocked the rec                     |

The audit join is the load-bearing one: it lets us correlate feedback
against the constitutional verdict, the iteration count, the violation
set, and the LLM cost (via the audit's `retrieved_rule_count` +
`ops.llm_usage_meter.governance_audit_id`).

## 3. API surface

```
POST /api/feedback/recommendation
POST /api/feedback/simulation
POST /api/feedback/nps
POST /api/feedback/bug
```

Each:

- requires auth (401 otherwise),
- forces `user_id = auth.uid()` server-side,
- validates the payload via the pure validators in `apps/web/src/lib/feedback/service.ts`,
- returns `{ id }` on success or `{ error, errors }` on validation failure.

There is no `/api/feedback/overall` route yet — comments arrive on
recommendation / simulation / bug forms and the table is reserved for
the in-app "feedback widget" when it ships.

## 4. Pure validators

`apps/web/src/lib/feedback/service.ts` exports:

- `validateRecommendationFeedback(input)` — enum + comment length
- `validateSimulationFeedback(input)` — enum + comment length
- `validateNps(input)` — integer in `[0, 10]` + comment length
- `validateBugReport(input)` — title 4-240 chars, body 8-8000 chars, optional severity ∈ {low/medium/high/critical}
- `npsBucket(score)` — `detractor | passive | promoter | invalid`

All five exports are pure and tested.

## 5. Beta workflows

### 5.1 Recommendation thumbs

After a recommendation card is shown, send:

```json
POST /api/feedback/recommendation
{
  "recommendation_id": "...",
  "recommendation_table": "provider_recommendations",
  "agent_kind": "provider",
  "agent_name": "provider.portal",
  "governance_audit_id": "...",
  "feedback_kind": "helpful",
  "comment": "matched my budget"
}
```

### 5.2 NPS prompt cadence

Feature flag `beta.nps_prompt` controls the prompt. Default rollout 10%.
The prompt fires after 7 sessions or 14 days, whichever comes first; the
client tracks session count locally and posts when the prompt is shown.

### 5.3 Bug widget

The in-app bug widget captures `route_path`, `user_agent`, and
`app_version` from the runtime. The user types title + body + severity.
On submit, the route id is included in `metadata` so engineering can
group by feature.

## 6. Aggregations the dashboard reads

### Daily NPS

```sql
SELECT DATE_TRUNC('day', created_at) AS day,
       COUNT(*) AS responses,
       AVG(score) AS avg_score,
       100 * (
         COUNT(*) FILTER (WHERE score >= 9) - COUNT(*) FILTER (WHERE score <= 6)
       )::FLOAT / NULLIF(COUNT(*), 0) AS nps
FROM feedback.nps_responses
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

### Recommendation helpfulness by agent

```sql
SELECT agent_name,
       COUNT(*) FILTER (WHERE feedback_kind = 'helpful') AS helpful,
       COUNT(*) FILTER (WHERE feedback_kind = 'not_helpful') AS not_helpful,
       COUNT(*) FILTER (WHERE feedback_kind = 'incorrect') AS incorrect,
       COUNT(*) AS total
FROM feedback.recommendation_feedback
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY total DESC;
```

### Bug pipeline

```sql
SELECT severity, COUNT(*)
FROM feedback.bug_reports
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY severity;
```

## 7. Privacy + retention

- All feedback bodies are user content; we do **not** auto-classify
  sentiment or run them through any LLM unless the user explicitly
  opts in (no such flag exists yet).
- Bug reports CAN contain PII (a screenshot path or pasted error
  message). The triage UI must NOT display arbitrary html — render as
  plain text.
- Retention: indefinite while the account is active; deleted when the
  user invokes `/api/user/delete`.

## 8. Out-of-scope

- Sentiment scoring of free-text comments.
- Auto-routing to support tickets.
- Embedded screenshots / file attachments (next sprint).

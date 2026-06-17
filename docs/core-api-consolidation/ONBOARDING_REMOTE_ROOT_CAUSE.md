# Onboarding "Consultant" Behavior — Remote Root-Cause (EVIDENCE ONLY)

Branch under examination: `origin/advisor/p0-upgrade-2.3.0` (read via `git show` / `git grep`; nothing
checked out or modified). All file:line citations are on that branch.

Prompt version live on this branch: `ADVISOR_PROMPT_VERSION = "advisor-hybrid-6.0.0"`
(`apps/lifenavigator-core-api/app/services/advisor_llm.py:19`).

---

## 1. The 6-section template ("The tradeoffs:", "What we know:", "My read:", "What would change this:")

### 1a. Where the six JSON fields are MANDATED (the prompt)

`apps/lifenavigator-core-api/app/services/advisor_llm.py`, constant `ADVISOR_SYSTEM` (begins line 34).
The model is ordered to expose six things every turn (lines 46–69):

- L46–48 `1. DECISION FRAME — name the decision being considered, why it matters, and the key drivers …`
- L49–51 `2. TRADEOFFS — the genuine tensions. … give the benefit AND the cost of each option …`
- L52–53 `3. WHAT WE KNOW — the relevant facts the user has already given, in their OWN words and numbers …`
- L54–60 `4. RECOMMENDATION — your grounded read: the direction that fits BEST … Take a clear position … Include ONE non-obvious … INSIGHT …`
- L61–63 `5. WHAT WOULD CHANGE THIS — the 1-3 highest-value missing inputs …`
- L64–65 `6. BEST NEXT QUESTION — exactly ONE question …`

The required JSON shape is declared at L148–171:

```
{
  "decision_frame": "Section 1: the decision being considered …",
  "tradeoffs": [{"option":..., "benefit":..., "cost":...}],
  "what_we_know": ["Section 3: each a relevant fact the user already gave …"],
  "derivations": [...],
  "recommendation": "Section 4: your grounded read …",
  "what_we_still_need": ["Section 5: 1-3 specific inputs …"],
  "next_question": "Section 6: the ONE sharp … question",
  "why_this_question": "one sentence …",
  ...
}
```

L172–174 force-populate: `Always populate decision_frame, tradeoffs (≥2), what_we_know (≥1),
recommendation, what_we_still_need (1-3), next_question, and why_this_question.`

### 1b. Where that JSON is RENDERED into the markdown the user saw (`_compose`)

`apps/lifenavigator-core-api/app/services/advisor_orchestrator.py`, function `_compose(safe)` —
**def at line 87**, returns the joined markdown at line 144. Exact composing lines and the JSON→header map:

| Observed markdown header                             | Source JSON field                                      | Composing code (advisor_orchestrator.py)                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| (lead paragraph, no header)                          | `decision_frame` (or legacy `reflection`)              | L97–99 `frame = … safe.get("decision_frame") or safe.get("reflection") …; if frame: parts.append(frame)`                                 |
| **The tradeoffs:**                                   | `tradeoffs[]` (option/benefit/cost)                    | L101–115; header at **L115** `parts.append("**The tradeoffs:**\n" + "\n".join(rows))`; row fmt L110 `f"- **{opt}** — {ben}; but {cost}"` |
| **What we know:**                                    | `what_we_know[]`                                       | **L117–119** `parts.append("**What we know:**\n" + "\n".join(f"- {k}" for k in know))`                                                   |
| **My read:**                                         | `recommendation`                                       | **L121–123** `rec = str(safe.get("recommendation") …); if rec: parts.append("**My read:** " + rec)`                                      |
| **What would change this:**                          | `what_we_still_need[]`                                 | **L125–127** `need = …; parts.append("**What would change this:**\n" + "\n".join(f"- {n}" for n in need))`                               |
| (summary paragraph, only when complete)              | `summary`                                              | L129–131                                                                                                                                 |
| **{question}** (bold) + _why_ (italic)               | `next_question` + `why_this_question`                  | L133–138 `parts.append(f"**{q}**") … parts.append(f"_{why}_")`                                                                           |
| _general planning guidance … licensed professional._ | (deterministic, appended iff `recommendation` present) | **L140–142** (see §2)                                                                                                                    |

So the user-visible headers are **hard-coded literals in `_compose`**, populated 1:1 from the LLM JSON
fields. "My read" ← `recommendation`; "What would change this" ← `what_we_still_need` (confirmed).
The docstring (L87–92) still calls it the "V3 five-section advisor turn"; the code actually emits the six
P0-upgrade sections plus the disclaimer.

---

## 2. The onboarding disclaimer ("…general planning guidance…not personalized…licensed professional")

Exact string, `apps/lifenavigator-core-api/app/services/advisor_orchestrator.py` **L140–142**, inside `_compose`:

```python
if rec:  # V4: a grounded recommendation carries a light, deterministic scope disclaimer
    parts.append("_This is general planning guidance based on what you've shared, not personalized "
                 "financial, legal, or tax advice — confirm specifics with a licensed professional._")
```

How it's appended: it is the **last** element pushed into `parts` and is gated only on `rec` (a non-empty
`recommendation`). It is therefore appended to EVERY onboarding turn in which the LLM returned a
recommendation — i.e. virtually every turn, since the prompt force-populates `recommendation` (L172–174).
This is a deterministic, code-side append, not produced by the model and not from the per-domain
`disclaimer_text` constants (those live in `app/domains/*` and `app/services/*` for the reports path, not
the advisor turn). It is the source of the exact wording the user saw.

---

## 3. Primary-objective restated as fact ("Your primary objective is 'Reach financial independence'")

This is **LLM-generated prose**, not a hard-coded template on the advisor path. The mechanism:

1. Origin of the value — `apps/lifenavigator-core-api/app/services/relationship_manager.py:274–277`:
   `po = snap.get("primary_objective") or {}` … returns `"primary_objective": po.get("title")` into the
   `context_panel` of the deterministic `converse()` result (`base`).
2. Injected into LLM context as a **confirmed fact** —
   `apps/lifenavigator-core-api/app/services/advisor_context.py`:
   - `_confirmed()` L318–324: `if panel.get("primary_objective"): out.append({"label":"primary_objective",
"value": panel["primary_objective"], "source":"user_message"})`
   - field set on the context L355 `primary_objective=panel.get("primary_objective")`
   - exposed to the model L240–241 in `prompt_dict()`: `"primary_objective": self.primary_objective`,
     and again inside `confirmed_facts` (L242).
   - Also fed to the constraints envelope as `"objective": context.primary_objective`
     (`advisor_orchestrator.py:61`).
3. Where the LLM is told to state it — `ADVISOR_SYSTEM`, section 3 "WHAT WE KNOW"
   (`advisor_llm.py:52–53`): "the relevant facts the user has already given, in their OWN words and numbers
   … This proves you listened." With `primary_objective` supplied as a `confirmed_fact`/`source:user_message`,
   the model surfaces it under "What we know" as an established fact.

**Is confidence dropped? YES.** `_confirmed()` hard-labels it `"source":"user_message"` with **no
confidence field** (advisor_context.py:322–323). The prompt's confirmed-vs-candidate contract
(`prompt_dict` separates `confirmed_facts` from `candidate_facts`, advisor_context.py:242–243; prompt
L52–53 vs the `candidate_facts` schema slot) means anything in `confirmed_facts` is treated as known
truth. So a stored objective with any provenance is presented to the model as a confirmed user fact, with
confidence stripped — which is why it is echoed back declaratively ("Your primary objective is 'Reach
financial independence'") rather than hedged.

Note: a near-identical _literal_ template `f"Your primary objective appears to be **{po.get('title')}**"`
exists at `app/agents/orchestrator.py:297`, but that file is the **agents** orchestrator used by
`routers/chat.py` (confirmed: `git grep` shows `agents/orchestrator` referenced only from
`apps/lifenavigator-core-api/app/routers/chat.py`), NOT by `/discovery/chat`. The onboarding restatement
is the LLM-generated form, not this string.

---

## 4. Advisor-mode wiring (proof the onboarding endpoints run the AdvisorOrchestrator)

### 4a. The endpoints depend on `get_advisor_orchestrator`

`apps/lifenavigator-core-api/app/routers/life.py`:

- `/discovery/chat` (def ~L84):
  `async def discovery_chat(user … , svc=Depends(get_advisor_orchestrator), …): … return await svc.converse(_ctx(user), message, pending_key or None, conversation_id=…, trace=trace_ok)`
  Its own docstring states: **"The advisor IS the onboarding."**
- `/discovery/chat/stream` (def ~L100):
  `async def discovery_chat_stream(user … , svc=Depends(get_advisor_orchestrator), …)` →
  `async for evt in svc.converse_stream(…)`.

By contrast, the _non-chat_ discovery endpoints still use the deterministic conversational
RelationshipManager:

- `/discovery/answer` (life.py ~L77): `svc: RelationshipManager = Depends(get_relationship_manager)` →
  `await svc.answer(...)`.
- `/discovery/state` / `/discovery/next` similarly bind `get_relationship_manager` (same router).

### 4b. What `get_advisor_orchestrator` builds

`apps/lifenavigator-core-api/app/dependencies.py:268–327`:

- L270 `rm: RelationshipManager = Depends(get_relationship_manager)` — the deterministic engine is injected.
- L296 `builder = AdvisorContextBuilder(supabase, coverage=coverage, life=life)`.
- L302/L312 `llm = GeminiAdvisorLLM(gemini)` (default; `VertexClaudeAdvisorLLM` only if `USE_VERTEX_CLAUDE`).
- L327 `return AdvisorOrchestrator(rm, builder, llm, enabled=enabled, supabase=supabase, router=router)`.

So the onboarding turn = `AdvisorOrchestrator` wrapping the RelationshipManager + the advisor LLM.

### 4c. The converse() flow (rm.converse THEN \_enhance via advisor_llm)

`apps/lifenavigator-core-api/app/services/advisor_orchestrator.py`, `converse()` **L306–331**:

1. L320 `base = await self._rm.converse(ctx, message, pending_key)` — deterministic turn
   (persistence + safe fallback text).
2. L322 `self._health_safety_check(...)` — deterministic urgent-care net (pre-LLM).
3. L327 `history = await self._fetch_history(...)` — cross-turn context (P0.1).
4. L329 `primary_llm, fallback_llm = self._route(...)`.
5. L330 `await self._enhance(base, ctx, message, tr, lap, history, primary_llm, fallback_llm)`.

`_enhance()` **L223–304** = "build context → generate → validate → compose":

- L233 `context = await self._ctx.build(...)`; L235 `constraints = build_constraints(base, context)`.
- L236 `out = await active.generate(context, constraints)` (the advisor_llm call; one retry L238–240).
- L255 `ok, safe, reasons = validate(out, context)`; optional single repair L257–273.
- L284 `composed = _compose(safe)`; L291 `base["assistant_message"] = composed`;
  L292 `base["llm_status"] = "enhanced"`.
  `converse_stream()` (L333–367) is identical: deterministic ack first (L356), then the same `_enhance`.

---

## ANSWERS (with evidence)

**Why is onboarding using advisor mode?**
Because the chat onboarding endpoints `/discovery/chat` and `/discovery/chat/stream` are wired in
`routers/life.py` (~L84, ~L100) to `Depends(get_advisor_orchestrator)`, and `get_advisor_orchestrator`
(dependencies.py:268–327) constructs the full `AdvisorOrchestrator` (consultant pipeline: rm.converse →
context build → advisor LLM → validate → `_compose`). The endpoint's own docstring asserts "The advisor IS
the onboarding." There is no onboarding-specific service on this path.

**Why is discovery NOT using the conversational RelationshipManager?**
On this branch the RelationshipManager's _conversational_ surface is still bound only to
`/discovery/answer` (and `/discovery/state` / `/discovery/next`) via `get_relationship_manager`
(life.py ~L77). For `/discovery/chat` the RM is no longer the responder — it is demoted to a sub-dependency
_inside_ the orchestrator (dependencies.py:270; advisor_orchestrator.py:320 `self._rm.converse(...)`),
where it only supplies the deterministic `base` (persistence + fallback text + `context_panel`). The
human-facing message is then overwritten by `_compose(safe)` (advisor_orchestrator.py:291). So `/discovery/chat`
was switched to the orchestrator; the RM's own conversational reply is discarded whenever the LLM enhancement succeeds.

**Is the orchestrator UNAWARE it's in onboarding/discovery context (no discovery-specific prompt branch)?**
There is a coarse `intent` signal — `build_constraints` (advisor_orchestrator.py:56) sets
`intent = "summary" if base.get("complete") else "discovery"`, used only for temperature
(advisor_llm.py:206, "discovery"=0.40) and to permit a closing summary (`may_summarise`,
advisor_orchestrator.py:62). But there is **NO onboarding/discovery MODE BRANCH in the prompt or compose
logic**: `ADVISOR_SYSTEM` is a single static consultant prompt with no onboarding variant; `_compose`
renders the same six consultant sections + disclaimer regardless of stage; and no `onboarding` flag exists
anywhere in `advisor_orchestrator.py` / `advisor_llm.py` (grep finds no "onboarding" identifier in either
file; the only "discovery"/"mode" hits are the temperature key, the `intent` string, doc prose, and
`current_stage` passed as an allowed topic). **Conclusion: the consultant prompt is mode-blind** — it
delivers full decision-frame/tradeoffs/recommendation/disclaimer counsel even during first-touch onboarding,
because nothing tells it the turn is onboarding rather than a mid-relationship advisory consult.

---

## 12-LINE SUMMARY

1. Onboarding chat = `/discovery/chat` + `/discovery/chat/stream` (routers/life.py ~L84/~L100), both bound to `Depends(get_advisor_orchestrator)`.
2. `get_advisor_orchestrator` (dependencies.py:268–327) builds `AdvisorOrchestrator(rm, AdvisorContextBuilder, GeminiAdvisorLLM, …)`.
3. `converse()` (advisor_orchestrator.py:306) runs `rm.converse` (L320) then `_enhance` (L330) = context→generate→validate→compose.
4. The six-section template is mandated by `ADVISOR_SYSTEM` (advisor_llm.py:46–69, JSON schema L148–171, force-populate L172–174).
5. It is rendered to markdown by `_compose` (advisor_orchestrator.py:87): headers are hard-coded literals.
6. Map: "The tradeoffs:"←`tradeoffs` (L115); "What we know:"←`what_we_know` (L119); "My read:"←`recommendation` (L123); "What would change this:"←`what_we_still_need` (L127); bold question←`next_question` (L135).
7. The disclaimer "_…general planning guidance…not personalized…confirm specifics with a licensed professional._" is appended deterministically at advisor_orchestrator.py:140–142 whenever a recommendation exists.
8. The primary-objective restatement is LLM prose: `primary_objective` is injected as a `confirmed_fact` with `source:"user_message"` and **no confidence** (advisor_context.py:322–323), surfaced via prompt section 3 "WHAT WE KNOW" (advisor_llm.py:52).
9. Confidence IS dropped — the stored objective is presented to the model as established truth, so it is echoed declaratively, not hedged.
10. RelationshipManager's conversational reply is no longer used on `/discovery/chat`; the RM is demoted to a sub-dependency that supplies only the deterministic `base`, then overwritten by `_compose` (advisor_orchestrator.py:291). Its conversational surface remains only on `/discovery/answer|state|next`.
11. There is a coarse `intent` (discovery/summary) for temperature only — but NO onboarding/discovery prompt branch and NO "onboarding" flag in advisor_orchestrator.py / advisor_llm.py; the prompt is mode-blind.
12. **Highest-confidence root cause:** `/discovery/chat` was rewired to `get_advisor_orchestrator`, so first-touch onboarding runs the mode-blind consultant pipeline (`ADVISOR_SYSTEM` six-section prompt → `_compose` headers + deterministic disclaimer at advisor_orchestrator.py:140–142), which is why onboarding speaks as a decision-consultant and restates the stored objective as confirmed fact.

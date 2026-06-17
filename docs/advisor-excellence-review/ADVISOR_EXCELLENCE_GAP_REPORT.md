# Advisor Excellence Gap Report — Top 25

> Analysis only — no fixes. The 25 reasons the advisor does not yet feel elite, ranked by impact, each with
> root cause · example (from the real corpus) · evidence · severity. Synthesizes every doc in
> `docs/advisor-excellence-review/`. Grounded in observed behavior; competitor references are estimates.

**Severity:** S1 = blocks "elite" feel · S2 = major drag · S3 = polish. **Root-cause legend:** [P]=prompt
layer · [C]=context/memory layer · [A]=architecture/guardrail · [D]=data/coverage. The legend matters:
**~20 of 25 gaps are [P]/[C] — prompt + context work, cheap and low-risk — not new infrastructure.**

| #   | Gap                                                      | Root cause                                                            | Example (real)                                                                 | Evidence                                           | Sev    |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | ------ |
| 1   | **Discovers but never FRAMES the decision**              | [P] prompt is discovery-only; no "structure the tradeoff" instruction | "What should I prioritize?" → "what would need to be true to feel successful?" | <5% of 100 scenarios framed (DECISION_QUALITY)     | **S1** |
| 2   | **Cross-turn context loss — "starts over"**              | [C] bounded per-turn context doesn't thread session specifics forward | "Can I afford it?" ignored just-stated "buy a house in the next year"          | 0/10 prior-turn numbers reused (CONTEXT_RETENTION) | **S1** |
| 3   | **Generic-vision deflection**                            | [P] defaults to "what's your vision" when context-confidence is low   | "Am I on track?" → "what's your definition of 'on track'?"                     | ~30–35% LOW questions (QUESTION_QUALITY)           | **S1** |
| 4   | **No proactive tradeoff discovery**                      | [A]+[P] citation contract + empty graphs + one-question discipline    | almost never surfaces time-vs-money etc. unprompted                            | mostly "no" on all 5 axes (TRADEOFF)               | **S1** |
| 5   | **Low insight — mirrors, doesn't illuminate**            | [P] reflect-then-ask template; no "name the non-obvious"              | reflections restate the user; rarely a new angle                               | Insight 3/10 (audit §3)                            | **S1** |
| 6   | **Doesn't leave the user with a next step**              | [P] discovery-only; withholds structure as well as advice             | ends on a question, no "here's where this goes"                                | Actionability 4/10                                 | **S1** |
| 7   | **Imitates a coach's form without the edge**             | [P] has the one-question shape, not the powerful-question craft       | vision-deflection = the low-grade twin of a coaching question                  | EXEC_COACH doc                                     | **S1** |
| 8   | **CFP-grade tools unused in the conversation**           | [C]+[P] deterministic finance tools not surfaced into the dialogue    | doesn't lead with the user's real numbers/projection                           | VS_CFP doc                                         | **S1** |
| 9   | **Formulaic openings**                                   | [P] no variation guidance                                             | 12+/40 opened "You're exploring the significant decision of…"                  | audit §2                                           | S2     |
| 10  | **Hedging / uncertainty overuse**                        | [P] caution expressed as tentativeness                                | hedge-heavy phrasing throughout                                                | EXEC_PRESENCE (presence 4/10)                      | S2     |
| 11  | **Passive/reactive personality (no POV)**                | [P] waits + reflects; never leads with a framing                      | a tone, not a personality                                                      | PERSONALITY doc                                    | S2     |
| 12  | **Authority-trust gap (sounds capable, not expert)**     | [P] presence + insight                                                | personas trust it won't lie, not its judgment                                  | TRUST doc                                          | S2     |
| 13  | **Doesn't use the user's own numbers cross-turn**        | [C] same as #2, numeric specifics                                     | "$60k/$450k" used same-message only                                            | 0/10 (CONTEXT_RETENTION)                           | S2     |
| 14  | **Emotional tone-deafness on hard moments**              | [P] same discovery template on divorce/job-loss/medical               | divorce "what should I prioritize?" → generic vision Q                         | audit §4                                           | S2     |
| 15  | **Doesn't connect domains**                              | [A]+[D] cross-domain needs cited edges; graph empty                   | rarely links finance↔family etc.                                               | TRADEOFF/RELATIONSHIP                              | S2     |
| 16  | **Restates the question back**                           | [P] reflection sometimes = echo                                       | "When you ask 'Am I on track?…'"                                               | audit §2                                           | S2     |
| 17  | **One-question rigidity on complex asks**                | [P]/[A] always exactly one question even when 2 framing beats 1       | complex decisions get a single narrow Q                                        | QUESTION_QUALITY                                   | S2     |
| 18  | **No explicit "what I know vs need" summary**            | [P] calibration is internal, not shown as a crisp frame               | doesn't say "here's what decides this"                                         | DECISION_QUALITY                                   | S2     |
| 19  | **Malformed-quote artifacts**                            | [P]/compose quoting                                                   | "'Am I on track? Understanding…"                                               | 3/40 (audit §2)                                    | S3     |
| 20  | **Repetition artifacts**                                 | [P]/compose                                                           | restated reflection inside the question                                        | 2/40                                               | S3     |
| 21  | **Sameness across users (low personalization)**          | [P] formulaic + thin context                                          | feels templated                                                                | Personalization 4/10                               | S3     |
| 22  | **No memory of prior decisions/preferences in dialogue** | [C]                                                                   | doesn't reference earlier choices conversationally                             | CONTEXT_RETENTION                                  | S3     |
| 23  | **Doesn't acknowledge progress/continuity**              | [C]                                                                   | each turn feels fresh                                                          | CONTEXT_RETENTION                                  | S3     |
| 24  | **Over-deflects on simple asks**                         | [P] vision-deflection even when a direct reflection would do          | "what should I be thinking about?" → vision Q                                  | QUESTION_QUALITY                                   | S3     |
| 25  | **Tools/recommendations not woven into the voice**       | [P] the rec engine's evidence isn't narrated as advisor insight       | grounded recs exist but the conversation doesn't show them                     | VS_CFP                                             | S3     |

## The pattern in the gaps

1. **The top 8 (all S1) cluster into three root themes:** _framing_ (#1,#6,#7,#8,#18), _context/continuity_
   (#2,#13), and _question craft_ (#3,#5,#24). Fix those three themes and the felt experience moves from B to A.
2. **~20 of 25 are [P]/[C]** — prompt and context-layer work. The advisor's weakness is overwhelmingly in
   _how it talks and what it carries forward_, not in its infrastructure (which is CFP-grade) or its safety
   (solved). **This is cheap to fix and does not require LIOS multi-agent.**
3. **The few [A] gaps** (#4, #15, #17 — tradeoffs/cross-domain/one-question) are the genuinely harder ones,
   bounded by the citation contract + empty graphs; they are where multi-agent/LIOS could eventually help —
   but they are not the top-impact items.

## Bottom line

The advisor is not weak because it's too safe or under-built. It's weak because **it discovers instead of
framing, forgets the specifics between turns, and asks generic questions in a formulaic voice** — three
prompt/context problems sitting on top of CFP-grade, fully-trustworthy infrastructure. The roadmap targets
exactly those.

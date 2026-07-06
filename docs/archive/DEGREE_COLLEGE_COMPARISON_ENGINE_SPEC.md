# DEGREE & COLLEGE COMPARISON DECISION ENGINE — SPEC

The flagship Education tool. Compares colleges/degrees/majors/certificates/bootcamps/grad
programs/law/MBA/online/trade options and ranks them **against the user's life goals**. Every
output is explainable and evidence-backed. Design only. (Consolidates the two prompts'
"comparison engine" / "decision engine" asks.)

## Inputs

**User context:** goals, target career, current income, expected future income, existing
education/credentials, current debt, budget ceiling, time horizon, family constraints,
geography, remote/in-person preference, risk tolerance, learning preferences.
**Per option (program/school):** tuition, fees, scholarships, grants, expected net debt,
duration, opportunity cost, graduation rate, employment outcomes, salary outcomes,
accreditation, licensure relevance, bar/pass/licensing outcomes (if applicable), prestige/
network value, flexibility, risk level.

## Pipeline

```
1. Resolve options      (user-entered programs + matched catalog rows; cite each fact)
2. Cost model           net cost = tuition+fees − scholarships−grants; + opportunity cost
3. Income model         Compensation Engine: before/during/after lift (cited bands)
4. ROI + scenarios      see EDUCATION_ROI_DECISION_MODEL (worst/most-likely/best)
5. Six-axis fit scores  Financial/Career/Goal/Risk/Lifestyle/Time + Confidence (explainable)
6. Rank + label         best-overall / best-ROI / lowest-risk / fastest / career / family-fit
7. Evidence graph       each ranking -> :Evidence/:Assumption/:Tradeoff/:AdviceBoundary
8. Report               structured data -> PDF (EDUCATION_PDF_REPORT_SPEC)
```

## Outputs

- **Ranked recommendation** + named winners: **best overall · best ROI · lowest risk · fastest
  path · best for career advancement · best for family/lifestyle**.
- **Not-recommended** options (with the reason).
- **Why each option ranked where it did** (the contributing evidence + scores).
- **What assumptions matter most** (top sensitivity drivers).
- **What data is missing** (missing-data prompts, never fake-filled).
- **Confidence score** per option + overall.
- **Sensitivity analysis** (how the ranking flips if salary/comp/aid assumptions move).

## Questions the tool answers

Which degree/program is best for my goals? · Is this school worth the debt? · Is law school
worth it for me? · Is an MBA worth it? · Certification vs degree? · Online vs in-person? ·
Public vs private? · Elite-expensive vs lower-cost alternative? · What happens to retirement if
I choose this? · What happens to cash flow during school? · What if salary outcomes are lower
than expected? (Each answered from the ROI model + the live Finance/Career graphs, with cited
evidence and a stated confidence — never a generic opinion.)

## Explainability contract

No black-box winner. The recommended choice carries: the six fit scores (each decomposed into
the evidence that produced it), the assumptions (with confidence + `user_confirmed`), the
tradeoffs vs the runner-up, and the AdviceBoundary (`education_guidance`, escalate to a
financial/admissions/legal professional where the stakes warrant — e.g. law-school debt).

## Governance

`boundary_type: "education_guidance"` — decision support, not admissions/financial/legal advice;
escalation to `financial_advisor`/`admissions_counselor` for high-debt or licensure-gated paths.
Outcomes/comp must cite sources; missing → prompt, never guess.

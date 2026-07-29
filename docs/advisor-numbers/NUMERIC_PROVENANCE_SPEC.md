# Numeric Provenance — replacing the number gate with declared figures

**Status:** design, not built · **Date:** 2026-07-28 · **Supersedes:** the `_BENCHMARK_MARK` /
`_MONEY_CUE` / `_SECOND_PERSON` heuristic stack in `advisor_validator.py`

## Why

The advisor's number gate is inverted. The trusted sources already exist — `advisor_context.py` builds
`allowed_numbers` from the user's own messages, `domain_facts` (Plaid/DB), and `FinanceScenarioEngine` — but
they're used as an _exemption list_ checked against a _denylist of phrasings_. The model emits free-text
digits; the validator regex-scans the prose and guesses, from words near each digit, whether it's a
fabrication.

That guess is defeatable by construction, and it was defeated. PR #72 (WS-B/F2) added four verbs
(`runs|charges|fees|priced`) to `_BENCHMARK_MARK` on the assumption that the possessive `you` + money-cue
check would still catch personal claims. It doesn't — `_MONEY_CUE` has no entry for _payment_, _fee_, _cost_,
or _charge_ — so these all flipped from blocked to allowed and shipped to prod:

| Sentence                            | Before #72 | After #72 |
| ----------------------------------- | ---------- | --------- |
| `Your monthly payment runs $3,200.` | BLOCKED    | allowed   |
| `Your closing costs run $9,500.`    | BLOCKED    | allowed   |
| `You'll pay $18,200 in fees.`       | BLOCKED    | allowed   |

All 847 tests stayed green, because you cannot enumerate phrasings. Worse, the same three sentences are
_still_ allowed with a hedge instead of a price verb — `Your monthly payment will be about $3,200` — and
always were, long before #72. The price verbs were the narrow door; the hedge was the wide one, and the
common one, since a hedge is what a model reaches for by default.

The stopgap fix treats the actual cause: `_MONEY_CUE` enumerated money the user _holds_ (net worth, savings,
mortgage) but not money they _pay_ (payment, cost, fee, premium, rent, tuition), so `personal_holding` was
False for every sentence of this shape. Closing that gap re-arms the possessive check #72 relied on, which
in turn lets the price verbs stay a plain benchmark cue. This closes both doors for these nouns. It does not
close the class — the next missing noun reopens it silently, exactly as this one did.

One known false positive remains: `attorneys charge $1,500` is over-blocked when second person appears
within the 70-character window, because `charge` is simultaneously a market price verb and a personal money
noun, and a character window cannot tell which subject it attaches to. Over-blocking is the safe direction,
and it is the pre-#72 behaviour — but it is a direct instance of the argument below.

The second cost is quality. The model knows an ungrounded number can get the _entire_ six-section answer
discarded, so it self-censors and goes vague — the measured cause of roughly half the gap against ChatGPT in
the 3-way benchmark, and the reason PR #73 had to add redact-don't-nuke salvage. The gate is simultaneously
too weak (fabrications pass) and too strong (the advisor won't commit to anything).

## The rule

> **Would this number be different if a different user asked the same question?**

- **No** → **market**. A fact about the world. A home inspection costs what it costs.
- **Yes** → **personal**. A fact about _this person's life_. Must be sourced.

Second test for the middle ground — _does the sentence assert the number applies to them?_
"Attorneys charge $12,000" is a claim about the world. "Your attorney will cost $12,000" is a claim about
their life: it asserts they'll hire one, at that price.

This rule is what goes in the prompt and what the test matrix is built from. The current gate has no
definition at all, which is why the regression was invisible.

## Three kinds, not two

The most valuable sentences are hybrids:

> "Closing costs run 2–5%, so on your $500,000 place that's roughly $10,000–25,000."

| Figure           | Kind     | Source                        |
| ---------------- | -------- | ----------------------------- |
| `2–5%`           | market   | fact about the world          |
| `$500,000`       | personal | slot (user-stated)            |
| `$10,000–25,000` | derived  | market factor × personal slot |

`derived` already has real machinery: `advisor_math.verify_derivations` recomputes the model's claimed
expression and accepts only values traceable to user numbers plus unit constants (12/52/365/100), and
`_APPROVED_PCT` bounds which market factors may touch personal money (20% down, 2–5% closing, 3–6mo
reserves). Under this spec that stops being one path among several and becomes the _only_ path for hybrids.

## The asymmetry

A market number's _value_ is unverifiable — there is no source of truth in the system for what an inspection
costs. So stop trying to verify it, and enforce something else instead.

|                  | Personal          | Market                                  |
| ---------------- | ----------------- | --------------------------------------- |
| Verified against | slot value, exact | nothing — unverifiable by definition    |
| What is enforced | **provenance**    | **the claim's subject**                 |
| On failure       | ask for the input | render in a distinct lane               |
| Form             | exact point value | range or hedged — never false precision |

The form row is load-bearing for the _user_, not just the validator: "runs $400–600" carries its own status,
while "is $3,200" reads as arithmetic. Market kind must be a range or explicitly hedged.

## The contract

The model declares figures in structure and never writes a digit into prose.

```json
"figures": [
  {"ref": "f1", "kind": "market",   "subject": "home inspection fee", "value": "400-600",
   "basis": "typical US range"},
  {"ref": "f2", "kind": "personal", "slot": "net_worth"},
  {"ref": "f3", "kind": "derived",  "expr": "500000 * 0.05", "basis": "closing costs 2-5%"}
]
```

Prose carries only refs: `"…that puts closing costs around [[f3]] on top of your [[f2]]."`

The slot packet is today's `allowed_numbers` promoted from a bare set of strings to provenanced records:

```json
{
  "id": "net_worth",
  "value": 250000,
  "display": "$250,000",
  "source": "plaid",
  "as_of": "2026-07-20",
  "cite": "finance.accounts#…"
}
```

`source` ∈ `user_stated | plaid | scenario_engine | derived`.

### Why the possessive check becomes reliable

Validation of `kind: "market"` runs against `subject` — a three-word field the model wrote specifically to
name what the number is about — instead of a 70-character sliding window over free prose.
`"home inspection fee"` vs `"your monthly payment"` is a trivial discrimination — and `"attorney fee"` vs
`"your attorney fee"` resolves the false positive above, because the subject is stated rather than inferred
from what happens to sit within 70 characters.

`_MONEY_CUE` and `_TIGHT_WINDOW = 44` exist only because the validator is reconstructing, from character
distance, information the model already had and never wrote down. This has it write it down.

### Resolution

- `personal` → must resolve to a slot. Unresolvable ⇒ the model is instructed to ask for the input. This is
  what the existing `unsupported_monthly_payment` repair instruction already says in words ("a monthly
  payment needs an interest RATE and TERM the user didn't give").
- `derived` → server recomputes via `verify_derivations`; on success it **mints a new slot**. The model
  proposes math; the server owns the arithmetic and the digits.
- `market` → no slot needed; `subject` must be free of second-person possessives; renders in the market lane.

### Rendering is the trust mechanism

Personal figures render with their provenance link — click through to the Plaid account or the user's own
words. Market figures render in a visually distinct lane labelled as a typical range, not the user's data.

This is where the differentiation becomes real, and it converts a guardrail into the product's
differentiator: a number the user can trace to its source is something a general chatbot structurally cannot
produce.

### The residual risk

A model that correctly labels a market figure but writes prose implying it's the user's. Contained by: the
renderer owning the framing regardless of surrounding prose; subject-field validation; and graceful failure
(a rejected figure drops to a targeted question, never a nuked answer — which removes the incentive that
produced redact-don't-nuke). Rare, loggable, reviewable — a failure _rate_, not a hole.

## Market numbers get honest treatment

Market figures come from model weights: stale, region-blind, confidently wrong at the edges. A $400
inspection is not $400 in every metro or every year. So they must be coarse by construction, carry a
`basis`, and never claim precision.

The recurring ones — closing costs, agent commission, probate fees, tuition bands — are worth promoting into
a **curated, versioned benchmarks table**, at which point they become slots like everything else and stop
being unverifiable. That's the migration path: market starts declared-and-quarantined and hardens into
sourced as the table grows. Not a permanent unverified lane.

## Build order

1. **Slot packet** — promote `allowed_numbers` to provenanced records in `AdvisorContext`; keep the flat set
   alongside it so the current gate keeps working.
2. **`figures` + refs** in the LLM output schema (`advisor_llm.py`), behind a flag, validated but not yet
   rendered. Compare declared kinds against the existing gate's verdicts on live traffic — this is the
   cheapest way to measure the model's labelling accuracy before trusting it.
3. **Renderer** — substitution + the two lanes + provenance links in `_compose` and the web UI.
4. **Flip the invariant** — no numeral in rendered output unless produced by a slot substitution.
5. **Delete** `_BENCHMARK_MARK`, `_PRICE_VERB`, `_MONEY_CUE`, `_TIGHT_WINDOW`, and most of
   `_fabricated_personal_numbers`.

Step 4 is where the fiddly work is: distinguishing financial numerals from innocent ones — dates, ages,
"3–6 months", "the 2 options", "401k". Needs a real allowlist and its own test matrix, or it will block
ordinary prose.

## Test matrix

Built from the counterfactual-user rule, not from phrasings. Every case is stated as: _would this number
differ for another user?_ → expected kind → expected behaviour when the slot is present and absent. The
regression rows added to `test_number_gate_matrix.py` alongside the stopgap are the seed.

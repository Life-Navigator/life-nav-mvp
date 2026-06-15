"""Advisor LLM layer (Hybrid Advisor sprint).

The LLM IS the advisor. It drives the conversation — discovery, empathy, prioritisation, follow-up
questions, clarification, summarisation, explaining why information matters — reasoning WITHIN the
deterministic guardrails supplied as context (constraints, classified facts, discovery scores, domain
priorities, safety boundaries, allowed numbers, persistence permissions).

The rules are guardrails, not a script. This layer never decides the question for the model and never
writes to the DB. Isolated behind the AdvisorLLM interface so it can later route through the model router
(onboarding_advisor → Claude Sonnet on Vertex) without changing callers. For beta it uses the existing
Gemini backend client. Any failure returns None → the orchestrator falls back to the rule-based response.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional, Protocol

# Prompt version — logged with each turn (model-router audit compatible).
ADVISOR_PROMPT_VERSION = "advisor-hybrid-2.2.0"

# Per-task temperature. Advisor work is grounded, not creative — low temperatures throughout, and 0 for
# anything structured. The orchestrator passes an `intent` and we pick the matching temperature.
TEMPERATURE = {
    "discovery": 0.40,
    "summary": 0.30,
    "clarify": 0.30,
    "goal_extraction": 0.10,
    "structured": 0.00,
    "explanation": 0.20,
}
_DEFAULT_TEMPERATURE = TEMPERATURE["discovery"]

ADVISOR_SYSTEM = """You are LifeNavigator's advisor. You combine the judgment of an elite financial advisor,
a family-office consultant, an executive coach, and an estate planner. You are not a chatbot, a wizard, or
a questionnaire. You lead a real discovery conversation and the user should come away feeling "this
understands my situation," never "this collected my information."

YOU drive the conversation. The supplied context is your set of GUARDRAILS — constraints, classified facts,
discovery scores, domain priorities, safety boundaries, and the numbers you are allowed to reference. You
reason inside those guardrails; you are not following a script.

YOUR DECISION LOOP for every turn:
1. Read the context: confirmed facts, candidate facts, assumptions, missing data, discovery scores.
2. Separate what you KNOW from what you DON'T. Never merge confirmed facts, candidate facts, assumptions,
   and missing data — they are different categories.
3. Find the single highest-value missing piece of information — the one that would most improve future
   recommendations. Use discovery_scores_by_domain and domain_priorities to choose.
4. Ask exactly ONE strong question, then briefly explain WHY that question matters.
5. Do not interrogate, do not stack multiple unrelated questions, do not rush to recommendations.

USE WHAT THE USER ALREADY TOLD YOU — this is the difference between an advisor and a form:
- Before asking anything, look at user_message, confirmed_facts, and numbers_you_may_reference. If the user
  has stated figures or facts, REFLECT THEM BACK SPECIFICALLY in your reflection (e.g. "With $60k saved
  against a $450k home…") — the numbers in numbers_you_may_reference are theirs and safe to repeat.
- Repeat ONLY the user's own numbers, exactly as given. Do NOT compute new ones (no percentages, sums,
  down-payment math, or projections) — a derived number you invent will be rejected. Reflect, don't calculate.
- NEVER ask for something the user just gave you. NEVER deflect a concrete decision question ("can I afford
  this?", "how much should I put down?", "should I take the promotion?") into a generic "what's your
  vision / what does success look like" question. That feels evasive and breaks trust.
- For a decision question, name (in why_this_question or the reflection) the few inputs needed to reason
  about THAT specific decision, acknowledge which ones the user already supplied, then ask for the single
  most decisive MISSING one. You still never give the answer or a recommendation — you make the next step
  concrete and grounded in their numbers.

QUESTION QUALITY — your question must uncover priorities, tradeoffs, constraints, values, timelines, fears,
or motivations, not just a raw fact. Reference how the user's goals relate to each other when it helps.
  Weak:   "What is your income?"  /  "What are your goals?"  /  "Do you own a home?"
  Weak:   (user said $60k saved, $450k home) "What does buying a home mean to you?"  ← evasive, ignores data
  Strong: "You mentioned retiring early while also helping your children with college — if resources got
           tight, which of those would you protect first?"
  Strong: "With $60k saved toward a $450k home, how much of that $60k would you want to keep as a cushion
           rather than put toward the purchase?"  ← uses only the user's own numbers, no math

RELATIONSHIPS — reason from the user's REAL graph, never an imagined one:
- You are given relationship_edges and graph_connections drawn from the user's persisted life graph, plus
  a relationships_available flag. These are the ONLY relationships that exist.
- You MAY point out how two goals/objectives connect (e.g. "your retirement goal is connected to your
  education-funding goal") ONLY when that pair appears in graph_connections or relationship_edges. Using a
  real connection to frame a sharper tradeoff question is exactly the kind of reasoning we want.
- If relationships_available is false (both lists empty), do NOT mention any connection, link, or tradeoff
  between goals — there is no graph to support it. Stay with single-goal discovery.
- Whenever your message references a relationship, you MUST cite the exact pair(s) you relied on in
  relationships_referenced, using the labels from the graph. No citation = do not make the claim.

HARD RULES:
- Use ONLY the supplied context. If something is not in it, you do not know it — ask, or mark it missing.
- NEVER invent goals, facts, numbers, OR relationships. Reference a number only if it appears in the
  context, and a relationship only if it appears in relationship_edges / graph_connections.
- NEVER give final financial, legal, medical, or tax advice. For "how much / what should I do" questions,
  identify the missing inputs and gather them — do not answer with a recommendation.
- You may PROPOSE candidate facts and candidate goals, but you never save anything. Persistence is decided
  later by a deterministic validator, only after confirmation. Always set should_persist to false.
- Ask at most ONE question.

Respond with a SINGLE JSON object only (no prose, no markdown fences) matching exactly:
{
  "reflection": "short, human reflection that mirrors the user's real situation in their words (1-2 sentences)",
  "next_question": "the one strong question you choose to ask",
  "why_this_question": "one sentence on why this question matters most right now",
  "summary": "specific situation summary, only when discovery is essentially complete, else empty string",
  "confirmed_facts": [{"label":"","value":"","source":"user_message"}],
  "candidate_facts": [{"label":"","value":"","source":"user_message","confidence":0.0}],
  "assumptions": [{"label":"","value":"","why":""}],
  "candidate_goals": [{"title":"","domain":"","reason":"","confidence":0.0}],
  "missing_data": [{"field":"","why_it_matters":""}],
  "relationships_referenced": [{"from":"","to":"","rel":""}],
  "warnings": [],
  "should_persist": false
}"""


class AdvisorLLM(Protocol):
    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]: ...


class NullAdvisorLLM:
    """Deterministic-only mode: always returns None so the orchestrator uses the rule-based response."""

    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]:  # noqa: ARG002
        return None


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def parse_advisor_json(raw: str) -> Optional[dict[str, Any]]:
    """Tolerant parse: strip code fences, grab the first {...} object."""
    if not raw:
        return None
    s = _FENCE.sub("", raw).strip()
    try:
        return json.loads(s)
    except Exception:  # noqa: BLE001
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if not m:
            return None
        try:
            return json.loads(m.group(0))
        except Exception:  # noqa: BLE001
            return None


def _temperature_for(plan: dict[str, Any]) -> float:
    return TEMPERATURE.get(str(plan.get("intent") or "discovery"), _DEFAULT_TEMPERATURE)


class GeminiAdvisorLLM:
    """Beta implementation using the existing Gemini backend client (AI Studio). Never raises."""

    prompt_version = ADVISOR_PROMPT_VERSION

    def __init__(self, gemini: Any) -> None:
        self._g = gemini
        # Per-request telemetry the orchestrator reads after generate() (fresh instance per request via DI).
        self.last_usage: dict[str, int] = {}
        self.last_raw: str = ""

    @property
    def available(self) -> bool:
        return self._g is not None and bool(getattr(self._g, "configured", False))

    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]:
        self.last_usage, self.last_raw = {}, ""
        if not self.available:
            return None
        user = json.dumps({"guardrails": context.prompt_dict(), "constraints": plan}, ensure_ascii=False, default=str)
        prompt = f"GUARDRAILS_AND_CONSTRAINTS:\n{user}\n\nReason within these guardrails and return the JSON object now."
        try:
            raw, usage = await self._g.generate_with_usage(ADVISOR_SYSTEM, prompt, temperature=_temperature_for(plan))
            self.last_usage, self.last_raw = usage, raw or ""
            return parse_advisor_json(raw)
        except AttributeError:
            # Older Gemini client without generate_with_usage — degrade gracefully (no token telemetry).
            try:
                raw = await self._g.generate(ADVISOR_SYSTEM, prompt, temperature=_temperature_for(plan))
                self.last_raw = raw or ""
                return parse_advisor_json(raw)
            except Exception:  # noqa: BLE001
                return None
        except Exception:  # noqa: BLE001 — the user never sees an LLM error; orchestrator falls back
            return None

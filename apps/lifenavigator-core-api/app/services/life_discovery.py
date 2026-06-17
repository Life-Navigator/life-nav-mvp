"""Life Discovery Engine (Elite Sprint 33) — the moat foundation.

Onboarding doesn't collect data; it discovers the *need behind the need*. A surface goal ("buy a
house") plus the user's why-chain is resolved to a ROOT life objective ("build family stability"),
and that objective is decomposed into its cross-domain dependencies (home, income, life insurance,
emergency fund, schools, support network, health coverage), risks, and opportunities — each a
first-class object in the Personal Life Graph. These feed readiness, the Recommendation OS, and the
roadmap *before any document is uploaded*. Nothing is fabricated: dependencies are a known
decomposition of the objective, and we mark them unknown until evidence confirms them.
"""
from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext

LIFE = "life"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


# ── The dependency knowledge map: root objective -> cross-domain dependencies / risks / opportunities ──
ROOT_OBJECTIVES: dict[str, dict[str, Any]] = {
    "family_stability": {
        "label": "Build family stability",
        "dependencies": [("A family-ready home", "family"), ("Stable income", "career"),
                         ("Life insurance to protect dependents", "family"), ("6-month emergency fund", "finance"),
                         ("Good schools / childcare", "family"), ("A family support network", "family"),
                         ("Health coverage for the family", "health")],
        "risks": [("Income loss while dependents rely on you", "finance"), ("No estate plan for guardianship", "family")],
        "opportunities": [("Employer dependent-care FSA + family benefits", "finance")],
    },
    "homeownership": {
        "label": "Own a home",
        "dependencies": [("Down payment saved", "finance"), ("Stable income to qualify", "career"),
                         ("Healthy credit", "finance"), ("Affordable target location", "finance")],
        "risks": [("Overextending on the mortgage", "finance")],
        "opportunities": [("First-time buyer programs", "finance")],
    },
    "financial_independence": {
        "label": "Reach financial independence",
        "dependencies": [("High savings rate", "finance"), ("Invested retirement assets", "finance"),
                         ("Debt paid down", "finance"), ("Healthcare plan for retirement", "health"),
                         ("A withdrawal plan", "finance")],
        "risks": [("Outliving your assets", "finance"), ("Sequence-of-returns risk", "finance")],
        "opportunities": [("Full employer 401(k) match", "finance"), ("Tax-advantaged accounts", "finance")],
    },
    "career_growth": {
        "label": "Advance your career",
        "dependencies": [("In-demand skills / credentials", "education"), ("A professional network", "career"),
                         ("Compensation benchmarking", "career"), ("Geographic / role flexibility", "career")],
        "risks": [("Skill obsolescence", "career")],
        "opportunities": [("Internal promotion path", "career"), ("Higher-paying market move", "career")],
    },
    "education_advancement": {
        "label": "Advance through education",
        "dependencies": [("Program funding / aid", "finance"), ("Time to study", "education"),
                         ("Manageable opportunity cost", "finance"), ("A clear post-degree ROI", "career")],
        "risks": [("Debt without a payoff", "finance")],
        "opportunities": [("Employer tuition assistance", "career"), ("GI Bill / scholarships", "education")],
    },
    "health_longevity": {
        "label": "Optimize health & longevity",
        "dependencies": [("Consistent fitness routine", "health"), ("Sound nutrition", "health"),
                         ("Quality sleep", "health"), ("Preventive care / screenings", "health"), ("Stress management", "health")],
        "risks": [("Undetected chronic risk factors", "health")],
        "opportunities": [("Employer wellness + HSA", "health")],
    },
    "legacy": {
        "label": "Build a lasting legacy",
        "dependencies": [("A will & estate documents", "family"), ("Aligned beneficiaries", "family"),
                         ("Adequate life insurance", "family"), ("A wealth-transfer plan", "finance")],
        "risks": [("The state decides without a plan", "family")],
        "opportunities": [("Trust structures", "family")],
    },
}

# Generic, archetype-level risk/opportunity labels attached to ROOT_OBJECTIVES. These are concept
# TEMPLATES for an objective, NOT grounded in a user's real data. The dashboard must never surface them as
# personalized risks/opportunities unless a real engine/evidence grounds them (gated in my_life). The Life
# Graph still renders them as relationship nodes — this set only gates DASHBOARD display.
def _generic_risk_opp_labels() -> frozenset:
    out: set[str] = set()
    for spec in ROOT_OBJECTIVES.values():
        for coll in ("risks", "opportunities"):
            for label, _domain in spec.get(coll, []):
                out.add(str(label).strip().lower())
    return frozenset(out)


GENERIC_RISK_OPP_LABELS = _generic_risk_opp_labels()


def _generic_dependency_labels() -> frozenset:
    # Archetype dependency labels (e.g. "Healthcare plan for retirement", "A withdrawal plan"). New
    # objectives no longer create these; this set gates DISPLAY of any legacy rows still persisted for
    # existing users until the cleanup migration removes them.
    out: set[str] = set()
    for spec in ROOT_OBJECTIVES.values():
        for label, _domain in spec.get("dependencies", []):
            out.add(str(label).strip().lower())
    return frozenset(out)


GENERIC_DEPENDENCY_LABELS = _generic_dependency_labels()


# ── Life Theme layer (Sprint 34): statements -> weighted themes -> objectives (not keyword routing) ──
THEMES: dict[str, list[str]] = {
    "freedom": ["freedom", "free", "depend on anyone", "don't want to depend", "not depend", "independent", "independence", "on my own", "not rely", "autonomy", "self-sufficient", "self sufficient"],
    "security": ["security", "secure", "stable", "stability", "safe", "peace of mind", "certainty", "protected", "fallback"],
    "family": ["family", "children", "child", "kids", "kid", "baby", "pregnant", "wife", "husband", "spouse", "raise", "dependents", "newborn", "expecting"],
    "wealth_creation": ["wealth", "rich", "rental income", "passive income", "net worth", "build equity", "investment", "returns", "appreciate"],
    "health": ["health", "healthy", "weight", "fitness", "fit", "energy", "longevity", "strlength", "stronger", "sleep", "wellness", "lose weight"],
    "career_fulfillment": ["career", "promotion", "leadership", "fulfillment", "challenged", "valued", "burnout", "burning me out", "burned out", "change careers", "career change", "new job", "boss", "compensation", "paid more", "salary", "business", "entrepreneur", "start a business", "founder"],
    "achievement": ["achieve", "succeed", "success", "ambition", "advance", "prove", "accomplish"],
    "legacy": ["legacy", "estate", "inherit", "leave behind", "generational", "wealth transfer", "pass on", "heirs"],
    "belonging": ["closer to family", "near family", "community", "belong", "connection", "support network", "support system"],
    "purpose": ["purpose", "meaning", "impact", "service", "give back", "mission", "fulfilling"],
    "adventure": ["adventure", "travel", "explore", "new city", "feel stuck", "stuck", "change of scenery"],
}
THEME_OBJECTIVE: dict[str, str] = {
    "freedom": "financial_independence", "wealth_creation": "financial_independence",
    "security": "family_stability", "family": "family_stability", "belonging": "family_stability",
    "health": "health_longevity", "career_fulfillment": "career_growth",
    # Rule 1: "adventure"/"achievement" do NOT imply career — travel rewards / wanting to achieve are not
    # employment goals. They map to freedom, not career (career requires explicit job/role/promotion evidence).
    "achievement": "financial_independence",
    "legacy": "legacy", "purpose": "legacy", "adventure": "financial_independence",
}
# P0.3 — every candidate goal carries a real life DOMAIN (not "core"), so domain coverage reflects what the
# user actually said. Checked in priority order; the FIRST domain whose keywords appear wins. Education/Health
# are most specific (checked first); explicit money terms map to finance before the ambiguous "house" → family.
_DOMAIN_KW: list[tuple[str, tuple[str, ...]]] = [
    ("education", ("school", "college", "university", "degree", "mba", "study", "studies", "classes",
                   "certification", "go back to school", "education", "phd", "master")),
    ("health", ("fitness", "shape", "gym", "workout", "exercise", "lose weight", "weight", "healthy",
                "health", "wellness", "energy", "sleep", "stronger", "in better shape", "get fit")),
    ("finance", ("credit card", "revolving", "debt", "loan", "pay off", "pay down", "payoff", "paying down",
                 "down payment", "mortgage", "savings", "saving", "emergency fund", "invest", "retire",
                 "retirement", "401", "income", "wealth", "rewards", "budget", "financ", "money")),
    ("family", ("family", "fiance", "fiancé", "fiancée", "wedding", "marriage", "marry", "married", "kids",
                "children", "child", "baby", "spouse", "wife", "husband", "partner", "raise", "dependents",
                "house", "home", "household")),
    ("career", ("career", "promotion", "my job", "new job", "boss", "salary", "professional", "employer",
                "business", "founder", "startup")),
]


def _goal_domain(text: str) -> str:
    """Classify a goal clause to a life domain by evidence. Never invents career (needs explicit job terms)."""
    t = (text or "").lower()
    for domain, kws in _DOMAIN_KW:
        if any(kw in t for kw in kws):
            return domain
    return "core"


# P0.5 — a goal framed as later ("a few years out") is a future_goal, never dropped.
_FUTURE_MARKERS = ("few years", "down the road", "later", "someday", "eventually", "in the future",
                   "years away", "years from now", "one day", "not right now", "not yet", "down the line")


def _is_future(text: str) -> bool:
    return any(m in (text or "").lower() for m in _FUTURE_MARKERS)


# Meta/system statements that mention a domain word but are NOT goals (the user talking about the app /
# correcting us). Kept out of the goal list so the confirmation never shows "you already have…" as a goal.
_META_RE = re.compile(
    r"\b(you already have|you have my|through plaid|that confirmation|is blank|you made up|"
    r"i didn'?t say|i never said|you'?re wrong|that'?s wrong)\b",
    re.IGNORECASE,
)


# TERMINAL goals: the goal's own domain IS the objective (the why is motivation, not the objective).
# (surface signal -> objective, base confidence). Checked before instrumental routing.
_TERMINAL: list[tuple[tuple[str, ...], str, float]] = [
    (("lose weight", "weight", "fitness", "get fit", "get healthy", "health", "sleep better", "more energy"), "health_longevity", 0.86),
    (("life insurance", "insurance", "protect my family", "coverage"), "family_stability", 0.82),
    (("retire", "retirement"), "financial_independence", 0.85),
    (("new job", "change jobs", "quit my job", "promotion", "leave my job", "hate my boss", "burned out", "burning me out"), "career_growth", 0.84),
]
# INSTRUMENTAL signals: a means to a deeper end — the why-chain decides the objective.
_INSTRUMENTAL = ("house", "home", "buy", "mortgage", "property", "move", "relocat", "save", "money", "invest", "mba", "degree", "school", "certification")
_CONF_THRESHOLD = 0.6  # below this, probe instead of concluding


# ── Discovery Intelligence: weighted objective ranking ─────────────────────────────────────────────
# Confidence is ONE signal, not THE signal. We rank by what the PERSON is actually trying to do:
# explicit priority > horizon urgency > life-significance > recency > dependency impact > confidence.
# Significance: terminal LIFE goals (family, home, health, a wedding) are what people want; finance is
# usually a MEANS, so it does not outrank a stated life goal unless the user says it should.
_ROOT_SIGNIFICANCE: dict[str, float] = {
    "family_stability": 1.0, "homeownership": 0.95, "health_longevity": 0.90, "legacy": 0.70,
    "career_growth": 0.65, "education_advancement": 0.60, "financial_independence": 0.45,
}
_URGENCY_MARKERS: tuple[tuple[str, float], ...] = (
    ("month", 1.0), ("12 month", 1.0), ("this year", 0.9), ("next year", 0.8), ("wedding", 0.9),
    ("weeks", 1.0), ("soon", 0.8), ("year", 0.5),
)
# Score weights (documented in DISCOVERY_PRIORITY_ENGINE.md). Tunable; confidence deliberately lowest.
_W_PRIORITY, _W_URGENCY, _W_SIGNIF, _W_RECENCY, _W_DEPS, _W_CONF = 3.0, 1.5, 1.2, 1.0, 0.8, 0.6
_UNCONFIRMED_PENALTY = 0.15  # a candidate (persona-seeded, unconfirmed) can never outrank a confirmed goal


def _horizon_urgency(o: dict[str, Any]) -> float:
    text = (str(o.get("surface_goal") or "") + " " +
            " ".join(str(w.get("a", "")) for w in (o.get("why_chain") or []) if isinstance(w, dict))).lower()
    return max((w for kw, w in _URGENCY_MARKERS if kw in text), default=0.0)


def score_objective(o: dict[str, Any], *, priority_root: Optional[str] = None, recency: float = 0.0) -> float:
    """Weighted life-priority score for one objective. `recency` is a 0..1 normalized freshness rank.
    Unconfirmed (persona-seeded) objectives are heavily penalized so they cannot become primary."""
    root = o.get("root_objective_key") or ""
    conf = float(o.get("confidence") or 0)
    sig = _ROOT_SIGNIFICANCE.get(root, 0.5)
    urg = _horizon_urgency(o)
    dep_impact = min(1.0, len(ROOT_OBJECTIVES.get(root, {}).get("dependencies", [])) / 7.0)
    prio = 1.0 if (priority_root and root == priority_root) else 0.0
    score = (_W_PRIORITY * prio + _W_URGENCY * urg + _W_SIGNIF * sig +
             _W_RECENCY * recency + _W_DEPS * dep_impact + _W_CONF * conf)
    if not o.get("confirmed", True):
        score *= _UNCONFIRMED_PENALTY
    return round(score, 4)


def rank_objectives(objectives: list[dict[str, Any]], *, priority_root: Optional[str] = None) -> list[dict[str, Any]]:
    """Return objectives sorted by life-priority score (desc). Recency derived from updated_at ordering."""
    if not objectives:
        return []
    # Recency from ACTUAL timestamps: ties get the SAME value (no position artifact); newer = higher.
    def _ts(o: dict[str, Any]) -> str:
        return str(o.get("updated_at") or o.get("created_at") or "")
    distinct = sorted({_ts(o) for o in objectives})
    rank_of = {ts: (i / (len(distinct) - 1) if len(distinct) > 1 else 0.5) for i, ts in enumerate(distinct)}
    return sorted(objectives, key=lambda o: score_objective(o, priority_root=priority_root, recency=rank_of[_ts(o)]),
                  reverse=True)


# ── Narrative-first discovery: the LIFE STORY, derived from the whole goal set (not one objective) ──
def emotional_signals(text: str) -> dict[str, bool]:
    """Lightweight, deterministic emotional/situational signals from the user's own words. Drives the
    dominant narrative (e.g. distress+money → stabilize first; burnout → balance). Not sentiment AI —
    a curated keyword layer appropriate for LLM-free discovery."""
    t = (text or "").lower()
    def has(*kws: str) -> bool:
        return any(k in t for k in kws)
    return {
        "distress": has("overwhelmed", "worried", "scared", "afraid", "drowning", "panic", "barely", "can't keep up", "stressed", "under stress"),
        "money_stress": has("debt", "barely making", "losing my apartment", "lose my apartment", "no savings", "behind on", "paycheck to paycheck", "can't afford"),
        "burnout": has("constantly working", "always working", "missing important years", "not sure pushing harder", "exhausted", "burned out", "burnt out", "travel frequently", "traveling constantly", "no time for"),
        "money_fine": has("financially i am doing fine", "financially i'm fine", "financially fine", "doing fine financially", "compensation is good", "comp is good", "money is fine", "financially secure"),
        "ambition": has("director", "extremely hard", "top ai lab", "get promoted", "promotion", "founder", "start a startup", "a startup", "mba", "become a"),
        "family": has("wedding", "married", "marry", "fianc", "kids", "children", "baby", "start a family", "raising", "family"),
        "legacy": has("legacy", "build something meaningful", "things that matter", "change how people", "change the world", "building a company", "build a company", "multiple businesses", "my businesses", "venture capital", "raise venture"),
        "family_deprioritized": has("don't have children", "do not have children", "no children", "without children", "prioritizing my career", "comfortable prioritizing", "not planning kids"),
        "urgency": has("in a year", "12 month", "this year", "next year", " soon", "right now", "immediately", "weeks"),
    }


# Life stories (NOT objectives). Each is a way of life the person is building.
NARRATIVE_THEMES: dict[str, str] = {
    "financial_stabilization": "Financial stabilization",
    "health_life_balance": "Health & life balance",
    "legacy_entrepreneurship": "Legacy & entrepreneurship",
    "career_acceleration": "Career acceleration",
    "family_foundation": "Building a family foundation",
    "exploring": "Still taking shape",
}


def dominant_narrative(candidate_goals: list[dict[str, Any]], narrative_text: str = "") -> dict[str, Any]:
    """Determine WHAT LIFE this person is building, from the whole stated goal set + emotional signals.
    Returns a life STORY (key/label/summary/domains/signals/confidence) — never a single objective.
    Order matters: stabilize-before-optimize (distress) and balance (burnout) precede ambition/family."""
    goals_text = " ".join(str(g.get("goal_text") or g.get("goal") or "") for g in candidate_goals)
    sig = emotional_signals((narrative_text or "") + " " + goals_text)
    doms = Counter(_goal_domain(str(g.get("goal_text") or g.get("goal") or "")) for g in candidate_goals)
    doms.pop("core", None)
    present = set(doms)
    if sig["family_deprioritized"]:
        present.discard("family")

    def out(key: str, summary: str, conf: float) -> dict[str, Any]:
        return {"key": key, "label": NARRATIVE_THEMES[key], "summary": summary,
                "domains": dict(doms), "signals": [k for k, v in sig.items() if v], "confidence": conf}

    # 1) Distress + money trouble → stabilize before optimizing. BOTH are required: merely having a
    #    "pay off my credit card" goal is not a crisis — distress (overwhelmed/worried/losing housing) is.
    if sig["money_stress"] and sig["distress"]:
        return out("financial_stabilization",
                   "Getting back to stable ground — reducing debt and securing the essentials before anything else.", 0.9)
    # 2) Burnout / overwork (and money is not the worry) → reclaim health, time, family.
    if (sig["burnout"] or (sig["money_fine"] and "health" in present)) and not sig["money_stress"]:
        return out("health_life_balance",
                   "Reclaiming health, time, and presence with family after a stretch of overwork.", 0.85)
    # 3) Legacy / entrepreneurship — building meaningful companies + a lasting legacy (career & finance
    #    are means, not ends). Checked before career/family so a founder isn't mislabeled.
    if sig["legacy"]:
        return out("legacy_entrepreneurship",
                   "Building meaningful companies and a lasting legacy for your family — with career and "
                   "finances as the means, not the destination.", 0.85)
    # 4) Career/education focus with family deprioritized → career acceleration.
    if (("career" in present) or ("education" in present)) and "family" not in present and sig["ambition"]:
        return out("career_acceleration",
                   "Pushing hard on career advancement and the moves and skills that accelerate it.", 0.85)
    # 4) Family-building present → a family foundation, balancing the rest.
    if "family" in present:
        others = [d for d in ("career", "education", "finance", "health") if d in present]
        extra = (" while balancing " + ", ".join(others)) if others else ""
        return out("family_foundation",
                   f"Building a family foundation{extra} over the next year or two.", 0.85)
    # 5) Fallbacks by the strongest present domain.
    if "career" in present or "education" in present:
        return out("career_acceleration", "Advancing career and capability.", 0.6)
    if "health" in present:
        return out("health_life_balance", "Prioritizing health and wellbeing.", 0.6)
    if "finance" in present:
        return out("financial_stabilization", "Getting finances onto stable footing.", 0.6)
    return out("exploring", "Still taking shape — exploring what matters most.", 0.3)


class LifeDiscoveryService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    @staticmethod
    def _score_themes(text: str) -> dict[str, float]:
        scores = {t: sum(1 for sig in sigs if sig in text) for t, sigs in THEMES.items()}
        scores = {t: c for t, c in scores.items() if c > 0}
        total = sum(scores.values()) or 1
        return {t: round(c / total, 2) for t, c in scores.items()}

    @staticmethod
    def _detect_constraints(text: str) -> list[dict[str, Any]]:
        """Recognize conflicting / unrealistic goals — trust over optimism."""
        out: list[dict[str, Any]] = []
        broke = any(p in text for p in ("no savings", "haven't saved", "no retirement", "nothing saved", "broke", "in debt", "lot of debt", "no money"))
        early_retire = ("retire" in text and any(a in text for a in ("45", "40", "early", "50", "by 4", "by 5")))
        if early_retire and broke:
            out.append({"label": "Retirement timeline appears inconsistent with current savings", "kind": "savings",
                        "detail": "An early-retirement goal with little/no savings needs a higher savings rate or a later timeline — not impossible, but it requires explicit action.", "severity": "high"})
        if any(p in text for p in ("$2m", "$2 m", "2 million", "expensive house", "dream house")) and broke:
            out.append({"label": "Home budget may exceed current capacity", "kind": "affordability",
                        "detail": "The target home value looks high relative to stated savings/income — review affordability before committing.", "severity": "medium"})
        return out

    def analyze(self, *, surface_goal: str, why_chain: Optional[list] = None, vision: str = "") -> dict[str, Any]:
        """Reason from statement → themes → objective with confidence, alternatives, and (if
        uncertain) a follow-up question. Terminal goals (lose weight, new job) take their own domain;
        instrumental goals (house, save, move) are resolved by the why-chain."""
        why_text = " ".join(str(w.get("a", "")) if isinstance(w, dict) else str(w) for w in (why_chain or [])).lower()
        surface = (surface_goal or "").lower()
        # The immediate discovery signal is the goal + why-chain. The broad life vision is captured
        # separately and used only as a weak tie-breaker — it must not dilute goal-specific signal.
        text = f"{surface} {why_text}".strip()
        themes = self._score_themes(text)
        if not themes and vision:
            themes = self._score_themes(vision.lower())
        ranked = sorted(themes.items(), key=lambda kv: kv[1], reverse=True)
        constraints = self._detect_constraints(text)

        # 1) Terminal goal? Its domain is the objective; the why is motivation.
        for sigs, obj, conf in _TERMINAL:
            if any(s in surface for s in sigs):
                alts = [{"objective": THEME_OBJECTIVE[t], "weight": w} for t, w in ranked[:3]
                        if THEME_OBJECTIVE.get(t) and THEME_OBJECTIVE[t] != obj][:2]
                return {"primary_objective": obj, "confidence": conf, "themes": themes, "alternatives": alts,
                        "reasoning": f"'{surface_goal}' is a goal whose own domain defines the objective ({ROOT_OBJECTIVES[obj]['label']}); your stated reasons are treated as motivation, not the objective.",
                        "needs_followup": False, "constraints": constraints}

        # 2) Instrumental goal with no why-chain → PROBE, never invent.
        instrumental = any(s in surface for s in _INSTRUMENTAL)
        if instrumental and not why_text.strip():
            return {"primary_objective": None, "confidence": 0.3, "themes": {}, "alternatives": [],
                    "reasoning": f"'{surface_goal}' can serve very different life objectives — we shouldn't guess.",
                    "needs_followup": True,
                    "followup_question": f"Why is '{surface_goal}' important to you right now?",
                    "followup_options": ["Family", "Investment / wealth", "Stability / security", "Freedom / independence", "Relocation / change", "Something else"],
                    "constraints": constraints}

        # 3) Resolve from themes (instrumental-with-why, or unmapped).
        if not ranked:
            return {"primary_objective": None, "confidence": 0.3, "themes": {}, "alternatives": [],
                    "reasoning": "Not enough signal to infer your underlying objective.", "needs_followup": True,
                    "followup_question": f"What would achieving '{surface_goal}' really give you?",
                    "followup_options": ["Security", "Freedom", "Family", "Growth", "Health", "Legacy"], "constraints": constraints}
        top_theme, top_w = ranked[0]
        second_w = ranked[1][1] if len(ranked) > 1 else 0.0
        # Rule 1: NEVER default to career. If the top theme has no objective mapping, probe — don't invent.
        primary = THEME_OBJECTIVE.get(top_theme)
        if not primary:
            return {"primary_objective": None, "confidence": 0.3, "themes": themes, "alternatives": [],
                    "reasoning": f"'{surface_goal}' doesn't map confidently to one objective yet.", "needs_followup": True,
                    "followup_question": f"What would achieving '{surface_goal}' really give you?",
                    "followup_options": ["Security", "Freedom", "Family", "Growth", "Health", "Legacy"], "constraints": constraints}
        margin = top_w - second_w
        confidence = round(min(0.92, 0.55 + margin + (0.1 if len(ranked) == 1 else 0)), 2)
        alts = [{"objective": THEME_OBJECTIVE[t], "weight": w} for t, w in ranked[1:4]
                if THEME_OBJECTIVE.get(t) and THEME_OBJECTIVE[t] != primary][:2]
        result = {"primary_objective": primary, "confidence": confidence, "themes": themes, "alternatives": alts,
                  "reasoning": f"Your reasons point most to '{top_theme}' (weight {top_w}), which maps to {ROOT_OBJECTIVES[primary]['label']}.",
                  "needs_followup": confidence < _CONF_THRESHOLD, "constraints": constraints}
        if result["needs_followup"]:
            result["followup_question"] = f"Is '{surface_goal}' more about {top_theme}, or something else?"
            result["followup_options"] = [t for t, _ in ranked[:3]] + ["Something else"]
        return result

    # Conversation-derived dependencies (V3 Sprint 8): keyed off the user's OWN words, not a generic
    # per-objective template. Each tuple = (signal words in the statement) → (dependencies they imply).
    _DEP_SIGNALS: list[tuple[tuple[str, ...], list[str]]] = [
        (("italy", "travel", "trip", "vacation", "honeymoon", "europe"), ["Vacation fund"]),
        (("business", "company", "startup", "llc", "my own"), ["Business cash flow", "Owner replacement plan"]),
        (("security", "secure", "protect", "stability", "stable"), ["Emergency reserve", "Life insurance"]),
        (("family", "wife", "husband", "kids", "children", "spouse", "partner"), ["Survivor income plan"]),
        (("income", "earn", "raise", "salary", "make more"), ["Income growth plan"]),
        (("house", "home", "mortgage", "property", "bigger place"), ["Down payment", "Mortgage capacity"]),
        (("retire", "retirement", "independence", "passive", "step back"), ["Passive income", "Investment assets"]),
        (("health", "fitness", "weight", "get fit", "energy"), ["Sustainable health routine"]),
        (("debt", "loan", "payoff", "pay off", "pay down", "paying down", "credit card", "revolving"), ["Debt reduction plan"]),
        (("college", "school", "education", "degree", "tuition"), ["Education funding"]),
    ]

    def _derive_deps(self, text: str) -> list[str]:
        out: list[str] = []
        for sigs, deps in self._DEP_SIGNALS:
            if any(s in text for s in sigs):
                out += deps
        return list(dict.fromkeys(out))[:4]

    # Leading filler/subject phrases stripped from each clause (the VERB is kept, so "paying down cards" stays).
    _CLAUSE_PREFIXES = (
        "i am currently ", "i'm currently ", "currently ", "i am ", "i'm ", "i need to ", "we need to ",
        "i'm hoping to ", "we're hoping to ", "i will ", "we will ", "my fiancée and ", "my fiancee and ",
        "my partner and ", "my wife and ", "my husband and ", "the current one will be ",
        "the current one is ", "to ",
    )

    @classmethod
    def _clean_clause(cls, c: str) -> str:
        c = (c or "").strip().strip(".").strip()
        low = c.lower()
        for pre in cls._CLAUSE_PREFIXES:
            if low.startswith(pre):
                c = c[len(pre):].strip()
                low = c.lower()
        if len(c.split()) < 2:  # drop pure-filler fragments ("for emergencies", "i", etc.)
            return ""
        return c[0].upper() + c[1:]

    def analyze_statement(self, statement: str) -> list[dict[str, Any]]:
        """V3 Sprint 2: a single answer can contain SEVERAL goals. Split it into clauses, reason about
        each, and return candidate_goals[] — never collapsed to one. Dependencies are derived from the
        user's own words (Sprint 8)."""
        text = (statement or "").strip()
        if not text:
            return []
        # P0.4: split on sentence boundaries + connectives/subordinators so a run-on answer becomes
        # clean goal units (periods, ; , and, then, once, after, so that, in order to, because, plus).
        parts = re.split(
            r"\. |;|,|\band\b|\bthen\b|\bonce\b|\bafter\b|\bso that\b|\bin order to\b|\bbecause\b|&|\bplus\b|"
            r"\bas well as\b|\bi want to\b|\bi'd like to\b|\bi would like to\b|\bwe want to\b|\bwe'd like to\b",
            text,
            flags=re.IGNORECASE,
        )
        clauses = [c for c in (self._clean_clause(p) for p in parts) if c]
        if not clauses:
            clauses = [text]
        candidates: list[dict[str, Any]] = []
        seen: set[str] = set()
        for clause in clauses:
            a = self.analyze(surface_goal=clause)
            obj_key = a.get("primary_objective")
            label = ROOT_OBJECTIVES.get(obj_key, {}).get("label") if obj_key else None
            deps = self._derive_deps(clause.lower())
            clause_domain = _goal_domain(clause)
            # A domain-only clause (a clear life signal but no canonical objective/deps) is kept ONLY if it
            # reads like a goal: ≥3 words and not a meta/system statement ("you already have…through plaid").
            domain_only = (not label and not deps) and clause_domain != "core"
            looks_like_goal = len(clause.split()) >= 3 and not _META_RE.search(clause)
            if (not label and not deps and clause_domain == "core") or (domain_only and not looks_like_goal):
                # P0.5: a dropped pure-qualifier clause ("a few years in the future") still carries timing —
                # propagate it onto the goal it qualifies so the goal isn't silently de-scoped.
                if _is_future(clause) and candidates:
                    candidates[-1]["status"] = "future_goal"
                continue  # pure connector / fragment / meta statement — no real goal
            # P0.5: a clause with a clear life-domain signal ("getting in better shape" → health) is a real
            # goal even when it maps to no canonical objective yet — keep it, don't silently discard.
            # P0.5: the goal text is the user's OWN words; the label is secondary.
            key = clause.lower()
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "goal": clause,
                "objective": label or clause,
                "objective_key": obj_key,
                "confidence": round(a.get("confidence") or 0.5, 2),
                "status": "future_goal" if _is_future(clause) else "active",
                # P0.6: every goal carries its supporting quote (evidence) — no quote, no goal.
                "supporting_quotes": [clause],
                "supporting_statements": [clause],
                "dependencies": deps,
                # P0.3: domain from the user's own words (evidence) so coverage is never falsely 0%.
                "domain": clause_domain,
            })
        return candidates

    @staticmethod
    def infer_root(surface_goal: str, why_chain: Optional[list] = None) -> str:
        """Back-compat thin wrapper — returns the primary objective (or career_growth if probing)."""
        r = LifeDiscoveryService(None).analyze(surface_goal=surface_goal, why_chain=why_chain)
        return r.get("primary_objective") or "career_growth"

    async def save_vision(self, ctx: UserContext, *, vision_text: str, prompts: Optional[dict] = None) -> dict[str, Any]:
        await self._sb.upsert("life_vision", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                              "vision_text": vision_text, "prompts": prompts or {}, "updated_at": _now()}, schema=LIFE)
        return {"saved": True, "vision_text": vision_text}

    async def _edge(self, ctx: UserContext, src: str, tgt: str, etype: str, domain: str = "", conf: float = 0.7) -> None:
        eid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:{src}->{tgt}:{etype}"))
        await self._sb.upsert("life_graph_edges", {"edge_id": eid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                   "source_node": src, "target_node": tgt, "edge_type": etype,
                                                   "domain": domain or None, "confidence": conf, "status": "active", "updated_at": _now()}, schema=LIFE)

    async def discover_goal(self, ctx: UserContext, *, surface_goal: str, why_chain: Optional[list] = None,
                            root_override: Optional[str] = None, confirmed: bool = True,
                            origin: str = "user") -> dict[str, Any]:
        """Discover the objective: reason about it; PROBE if uncertain; else decompose + persist the
        graph with confidence/themes/alternatives/constraints + supersede stale objectives.

        `confirmed`/`origin` (Discovery Intelligence): a user-stated goal is confirmed (origin='user');
        a persona/bridge-seeded goal is a CANDIDATE (confirmed=False, origin='persona_bridge') and can
        never become the primary objective until the user confirms it. A persona seed never DOWNGRADES an
        objective the user already confirmed."""
        vis = await self._rows("life_vision", ctx)
        vision_text = vis[0].get("vision_text", "") if vis else ""
        a = self.analyze(surface_goal=surface_goal, why_chain=why_chain, vision=vision_text)
        root = root_override if root_override in ROOT_OBJECTIVES else a.get("primary_objective")

        # Adaptive: if uncertain (and not overridden), ask a follow-up — never invent an objective.
        if not root_override and (a.get("needs_followup") or not root):
            return {"needs_followup": True, "surface_goal": surface_goal,
                    "followup_question": a.get("followup_question"), "followup_options": a.get("followup_options", []),
                    "confidence": a.get("confidence"), "reasoning": a.get("reasoning"),
                    "themes": a.get("themes", {}), "constraints": a.get("constraints", [])}

        assert root is not None  # guaranteed by the probe guard above
        spec = ROOT_OBJECTIVES[root]
        obj_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:{root}"))
        existing = next((o for o in await self._rows("life_objectives", ctx) if o.get("id") == obj_id), None)
        # Candidate protection: a persona/bridge seed must NEVER downgrade an objective the user already
        # confirmed. If the user owns this root, leave it confirmed/user-origin untouched.
        eff_confirmed, eff_origin = confirmed, origin
        if existing and (existing.get("origin") == "user" or existing.get("confirmed") is True):
            if origin == "persona_bridge":
                eff_confirmed, eff_origin = bool(existing.get("confirmed", True)), existing.get("origin") or "user"
        # Lifecycle: supersede any active objective for this SAME surface goal with a different root.
        for o in await self._rows("life_objectives", ctx):
            if (o.get("surface_goal", "").strip().lower() == surface_goal.strip().lower()
                    and o.get("root_objective_key") != root and o.get("status", "active") == "active"):
                await self._sb.update("life_objectives", {"status": "superseded", "updated_at": _now()},
                                      filters={"id": f"eq.{o['id']}"}, schema=LIFE)

        await self._sb.upsert("life_objectives", {
            "id": obj_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "title": spec["label"],
            "root_objective_key": root, "surface_goal": surface_goal, "why_chain": why_chain or [],
            "domain": "cross_domain", "importance": "high", "status": "active",
            "confidence": a.get("confidence"), "themes": list(a.get("themes", {}).keys()),
            "alternatives": a.get("alternatives", []), "reasoning": a.get("reasoning"), "updated_at": _now(),
            "confirmed": eff_confirmed, "origin": eff_origin,
        }, schema=LIFE)
        goal_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:surface"))
        await self._sb.upsert("goals", {"id": goal_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                        "objective_id": obj_id, "title": surface_goal, "domain": "cross_domain", "status": "open"}, schema=LIFE)
        await self._edge(ctx, goal_id, obj_id, "advances", "cross_domain", a.get("confidence", 0.7))
        # TRUST RULE (data → evidence → risks): an objective MUST NOT auto-create RISKS or OPPORTUNITIES from
        # the ROOT_OBJECTIVES archetype — those are generic claims, not grounded in the user's real data
        # ("Outliving your assets", "Sequence-of-returns risk", "Full employer 401(k) match", …). Risks and
        # opportunities now come ONLY from evidence (Recommendation OS, real domain data, user statements).
        # Dependencies are KEPT: they are honest open requirements/unknowns ("Confirm or upload evidence for
        # X"), used by the decision brain's missing-information view + document-upload roadmap — NOT claims.
        # They are gated OUT of the dashboard's "priorities" (my_life) so they never read as established facts.
        deps = []
        for label, domain in spec["dependencies"]:
            did = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:dep:{label}"))
            await self._sb.upsert("dependencies", {"id": did, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                   "objective_id": obj_id, "label": label, "domain": domain,
                                                   "satisfied": None, "prompt": f"Confirm or upload evidence for: {label}"}, schema=LIFE)
            await self._edge(ctx, obj_id, did, "requires", domain)
            deps.append({"label": label, "domain": domain})
        # Constraint intelligence — these come from the USER's own statement (analyze()), not the archetype,
        # so they are grounded ("explicitly provided by the user").
        constraints = a.get("constraints", [])
        for c in constraints:
            cid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:con:{c['label']}"))
            await self._sb.upsert("constraints", {"id": cid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                  "objective_id": obj_id, "label": c["label"], "kind": c.get("kind"),
                                                  "detail": c.get("detail"), "severity": c.get("severity", "medium")}, schema=LIFE)
            await self._edge(ctx, obj_id, cid, "conflicts_with", c.get("kind", ""), 0.8)
        return {"objective_id": obj_id, "root_objective": root, "root_label": spec["label"],
                "surface_goal": surface_goal, "the_need_behind_the_need": spec["label"],
                "confidence": a.get("confidence"), "themes": a.get("themes", {}), "reasoning": a.get("reasoning"),
                "alternatives": a.get("alternatives", []), "needs_followup": False,
                # No archetype-derived risks/opportunities/dependencies — these are not grounded in user data.
                "dependencies": deps, "risks": [], "opportunities": [],
                "constraints": [{"label": c["label"], "detail": c.get("detail")} for c in constraints]}

    async def _rows(self, table: str, ctx: UserContext) -> list[dict]:
        return await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=LIFE)

    @staticmethod
    def _active(objectives: list[dict]) -> list[dict]:
        return [o for o in objectives if o.get("status", "active") == "active"]

    async def snapshot(self, ctx: UserContext) -> dict[str, Any]:
        vision = await self._rows("life_vision", ctx)
        objectives = self._active(await self._rows("life_objectives", ctx))
        active_ids = {o["id"] for o in objectives}
        deps = [d for d in await self._rows("dependencies", ctx) if d.get("objective_id") in active_ids]
        risks = [r for r in await self._rows("risks", ctx) if r.get("objective_id") in active_ids]
        opps = [o for o in await self._rows("opportunities", ctx) if o.get("objective_id") in active_ids]
        cons = [c for c in await self._rows("constraints", ctx) if c.get("objective_id") in active_ids]
        v0 = vision[0] if vision else None
        prompts = (v0.get("prompts") or {}) if v0 else {}
        vsource = str(prompts.get("source") or "")
        # Discovery Intelligence: rank by life-priority, and CANDIDATE-PROTECT — only a user-CONFIRMED
        # objective can be primary. Persona-seeded candidates are surfaced separately as "possible goals".
        confirmed = [o for o in objectives if o.get("confirmed", True)]
        candidates = [o for o in objectives if not o.get("confirmed", True)]
        priority_root = prompts.get("user_priority_root") or None
        ranked = rank_objectives(confirmed, priority_root=priority_root)
        primary = ranked[0] if ranked else None
        # Narrative-first: the dominant LIFE STORY from the user's WHOLE goal set (not a single objective).
        cand_goals = await self._rows("candidate_goals", ctx)
        narrative_text = prompts.get("narrative") or ""
        narrative = dominant_narrative(cand_goals, narrative_text) if (cand_goals or narrative_text) else None
        # Goal portfolio: every stated goal kept (confirmed/candidate/inferred), never reduced to one.
        portfolio = [{"goal": g.get("goal_text") or g.get("goal"), "domain": g.get("domain"),
                      "confidence": g.get("confidence"), "status": g.get("status") or "candidate"}
                     for g in cand_goals]
        return {
            "dominant_narrative": narrative,   # the life story; the surfaced "theme" (not an objective)
            "goal_portfolio": portfolio,       # all stated goals, coexisting
            "emotional_signals": narrative.get("signals") if narrative else [],
            "life_vision": v0.get("vision_text") if v0 else None,
            # Authored = the user actually stated it (via the advisor). persona_bridge visions are
            # synthesized from onboarding and must NOT be presented as a confirmed north star.
            "vision_source": vsource or None,
            "vision_authored": bool(v0 and v0.get("vision_text") and vsource != "persona_bridge"),
            # The user's own narrative, kept separate from the ontology objectives (never collapsed to one).
            "narrative": prompts.get("narrative") or None,
            "user_priority": prompts.get("user_priority") or None,
            "primary_objective": ({"title": primary["title"], "confidence": primary.get("confidence"),
                                   "reasoning": primary.get("reasoning"), "alternatives": primary.get("alternatives"),
                                   "themes": primary.get("themes"), "updated_at": primary.get("updated_at"),
                                   "confirmed": True} if primary else None),
            # Possible (unconfirmed) goals — shown as candidates, NEVER as the confirmed primary.
            "candidate_objectives": [{"title": o["title"], "root": o.get("root_objective_key"),
                                      "surface_goal": o.get("surface_goal"), "origin": o.get("origin"),
                                      "confirmed": False} for o in candidates],
            "objectives": [{"id": o["id"], "title": o["title"], "root": o.get("root_objective_key"),
                            "surface_goal": o.get("surface_goal"), "confidence": o.get("confidence"),
                            "confirmed": o.get("confirmed", True), "origin": o.get("origin"),
                            "themes": o.get("themes"), "why_chain": o.get("why_chain")} for o in rank_objectives(objectives, priority_root=priority_root)],
            "top_themes": list(primary.get("themes") or [])[:5] if primary else [],
            "top_risks": [r["label"] for r in risks[:5]],
            "top_opportunities": [o["label"] for o in opps[:5]],
            "active_constraints": [{"label": c["label"], "detail": c.get("detail")} for c in cons[:5]],
            "open_dependencies": [{"label": d["label"], "domain": d["domain"]} for d in deps if not d.get("satisfied")][:8],
            "discovery_status": "in_progress" if not objectives else "active",
            "note": "Your objectives drive recommendations + roadmap before you upload anything.",
        }

    async def life_context(self, ctx: UserContext) -> dict[str, Any]:
        """Compact retrieval context for GraphRAG / advisor memory — what we know about the user."""
        snap = await self.snapshot(ctx)
        return {
            "has_discovery": bool(snap["objectives"]),
            "life_vision": snap["life_vision"],
            "primary_objective": snap["primary_objective"],
            "objectives": [o["title"] for o in snap["objectives"]],
            "themes": snap["top_themes"], "risks": snap["top_risks"], "opportunities": snap["top_opportunities"],
            "constraints": [c["label"] for c in snap["active_constraints"]],
            "open_dependencies": [d["label"] for d in snap["open_dependencies"]],
        }

    # Cross-objective conflicts (symmetric) — competing objectives + the tradeoff to make explicit.
    _CONFLICTS: dict[frozenset, tuple[str, str]] = {
        frozenset({"financial_independence", "education_advancement"}): ("timeline", "An education investment delays earning + saving — it competes with an early-financial-independence timeline."),
        frozenset({"financial_independence", "family_stability"}): ("money", "Both draw on the same savings; pursuing them at full speed simultaneously slows each."),
        frozenset({"financial_independence", "homeownership"}): ("money", "A down payment + mortgage reduces the savings rate financial independence needs."),
        frozenset({"career_growth", "family_stability"}): ("time", "Career advancement often means more hours or relocation, which can compete with family stability."),
        frozenset({"education_advancement", "family_stability"}): ("time", "School time + cost competes with family time + stability."),
        frozenset({"career_growth", "health_longevity"}): ("time", "Career intensity can crowd out the consistency health requires."),
    }

    def classify_priority(self, text: str) -> Optional[str]:
        """Map a free-text "what matters most" answer to a ROOT objective key (for user-priority capture)."""
        if not (text or "").strip():
            return None
        a = self.analyze(surface_goal=text)
        root = a.get("primary_objective")
        return root if root in ROOT_OBJECTIVES else None

    async def objectives_plan(self, ctx: UserContext) -> dict[str, Any]:
        """Multi-objective planning (D8/D9): rank active objectives + detect conflicts/tradeoffs."""
        objs = self._active(await self._rows("life_objectives", ctx))
        vision = await self._rows("life_vision", ctx)
        priority_root = ((vision[0].get("prompts") or {}).get("user_priority_root") if vision else None) or None
        # Discovery Intelligence: rank by life-priority (not confidence-only); confirmed goals lead.
        ranked = rank_objectives(objs, priority_root=priority_root)
        plan = [{"objective_id": o["id"], "title": o["title"], "root": o.get("root_objective_key"),
                 "confidence": o.get("confidence"), "confirmed": o.get("confirmed", True),
                 "priority_rank": i + 1} for i, o in enumerate(ranked)]
        roots = {o.get("root_objective_key"): o for o in ranked}
        conflicts = []
        keys = [o.get("root_objective_key") for o in ranked]
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                pair = frozenset({keys[i], keys[j]})
                if pair in self._CONFLICTS:
                    kind, reason = self._CONFLICTS[pair]
                    a, b = roots[keys[i]], roots[keys[j]]
                    focus = a if float(a.get("confidence") or 0) >= float(b.get("confidence") or 0) else b
                    conflicts.append({"between": [a["title"], b["title"]], "type": kind, "reason": reason,
                                      "tradeoff": "You likely can't fully fund/pursue both at once.",
                                      "suggested_focus": focus["title"],
                                      "suggested_sequence": [focus["title"], (b if focus is a else a)["title"]]})
        return {"objectives": plan, "primary": plan[0] if plan else None, "conflicts": conflicts,
                "note": "Multiple objectives are ranked by confidence; conflicts show where they compete."}

    async def discovery_health(self, ctx: UserContext) -> dict[str, Any]:
        """Discovery health monitoring (D10): coverage, confidence, gaps + prompts to improve."""
        objs = self._active(await self._rows("life_objectives", ctx))
        roots_present = {o.get("root_objective_key") for o in objs}
        confidences = [float(o.get("confidence") or 0) for o in objs]
        avg_conf = round(sum(confidences) / len(confidences), 2) if confidences else 0.0
        # key life areas we'd like a defined objective for
        key_areas = {"financial_independence": "retirement / financial independence", "family_stability": "family",
                     "career_growth": "career", "health_longevity": "health"}
        missing = {label for root, label in key_areas.items() if root not in roots_present}
        weak = [o["title"] for o in objs if float(o.get("confidence") or 0) < 0.6]
        coverage = round(len(roots_present & set(key_areas)) / len(key_areas), 2)
        prompts = []
        for label in sorted(missing):
            prompts.append(f"Your {label} goals are not defined yet — completing {label} discovery would improve recommendation quality.")
        for t in weak:
            prompts.append(f"'{t}' is low-confidence — a quick follow-up would sharpen it.")
        return {"objective_count": len(objs), "average_confidence": avg_conf, "coverage": coverage,
                "covered_areas": sorted(key_areas[r] for r in roots_present if r in key_areas), "missing_areas": sorted(missing),
                "weak_objectives": weak, "model_quality": round(coverage * 0.5 + avg_conf * 0.5, 2),
                "prompts": prompts[:4]}

    async def personal_graph(self, ctx: UserContext) -> dict[str, Any]:
        """The Personal Life Graph from PERSISTED nodes + edges (active objectives only)."""
        vision = await self._rows("life_vision", ctx)
        objectives = self._active(await self._rows("life_objectives", ctx))
        active_ids = {o["id"] for o in objectives}
        deps = [d for d in await self._rows("dependencies", ctx) if d.get("objective_id") in active_ids]
        goals = [g for g in await self._rows("goals", ctx) if g.get("objective_id") in active_ids]
        risks = [r for r in await self._rows("risks", ctx) if r.get("objective_id") in active_ids]
        opps = [o for o in await self._rows("opportunities", ctx) if o.get("objective_id") in active_ids]
        cons = [c for c in await self._rows("constraints", ctx) if c.get("objective_id") in active_ids]
        stored_edges = [e for e in await self._rows("life_graph_edges", ctx) if e.get("status", "active") == "active"]
        nodes: list[dict[str, Any]] = []
        if vision and vision[0].get("vision_text"):
            nodes.append({"id": "vision", "type": "Life Vision", "label": vision[0]["vision_text"][:60], "color": "purple"})
        for o in objectives:
            nodes.append({"id": o["id"], "type": "Life Objective", "label": o["title"], "color": "indigo", "confidence": o.get("confidence")})
        for coll, typ, color in ((goals, "Goal", "blue"), (deps, "Dependency", "amber"),
                                 (risks, "Risk", "red"), (opps, "Opportunity", "green"), (cons, "Constraint", "rose")):
            for r in coll:
                nodes.append({"id": r["id"], "type": typ, "label": r.get("label") or r.get("title"), "color": color, "domain": r.get("domain")})
        # ── Domain population: real domain CRUD data becomes graph nodes (Family/Career/Education/Health) ──
        # Each entry: (domain, schema, hub_color, objective_root, [(table, node_type, label_field), ...]).
        # Only DISCRETE entity tables (not time-series logs) so the graph doesn't flood.
        domain_sources = [
            ("family", "family", "amber", "family_stability", [
                ("dependents", "Dependent", "relationship"), ("beneficiaries", "Beneficiary", "name"),
                ("emergency_contacts", "Emergency Contact", "name"), ("trusted_advisors", "Trusted Advisor", "name")]),
            ("career", "career", "blue", "career_growth", [
                ("experience_records", "Role", "title"), ("skills", "Skill", "name"),
                ("certifications", "Certification", "name"), ("career_goals", "Professional Goal", "title")]),
            ("education", "education", "purple", None, [
                ("programs", "Program", "name"), ("schools", "School", "name"),
                ("certifications", "Certification", "name"), ("education_goals", "Learning Goal", "title")]),
            ("health", "health", "red", "health_longevity", [
                ("health_goals", "Health Goal", "title"), ("supplement_logs", "Supplement", "name")]),
        ]
        dom_nodes: list[dict[str, Any]] = []
        dom_edges: list[dict[str, Any]] = []
        dom_counts: dict[str, int] = {}
        for domain, schema, color, obj_root, tables in domain_sources:
            hub_id = f"{domain}_hub"
            total = 0
            for table, typ, labelfield in tables:
                try:
                    rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema=schema)
                except Exception:  # noqa: BLE001
                    rows = []
                for r in rows[:30]:
                    total += 1
                    nid = f"{domain}:{table}:{r['id']}"
                    dom_nodes.append({"id": nid, "type": typ, "label": str(r.get(labelfield) or r.get("name") or r.get("title") or typ),
                                      "color": color, "domain": domain, "source": "manual_entry",
                                      "table": f"{schema}.{table}", "record_id": r.get("id"), "updated_at": r.get("updated_at")})
                    dom_edges.append({"from": nid, "to": hub_id, "rel": "part_of", "confidence": 1.0})
            dom_counts[domain] = total
            if total:
                dom_nodes.append({"id": hub_id, "type": domain.capitalize(), "label": domain.capitalize(), "color": color, "domain": domain})
                if obj_root:
                    for o in objectives:
                        if o.get("root_objective_key") == obj_root:
                            dom_edges.append({"from": hub_id, "to": o["id"], "rel": "supports", "confidence": 0.8})
        nodes.extend(dom_nodes)

        node_ids = {n["id"] for n in nodes}
        edges = [{"from": e["source_node"], "to": e["target_node"], "rel": e["edge_type"], "confidence": e.get("confidence")}
                 for e in stored_edges if e["source_node"] in node_ids and e["target_node"] in node_ids]
        edges.extend([e for e in dom_edges if e["from"] in node_ids and e["to"] in node_ids])
        integrity = await self._graph_integrity(ctx, objective_count=len(objectives), domain_counts=dom_counts)
        return {"nodes": nodes, "edges": edges, "objective_count": len(objectives), "edge_count": len(edges),
                "graph_integrity": integrity,
                "legend": {"purple": "Life Vision", "indigo": "Life Objective", "blue": "Goal", "amber": "Dependency/Family",
                           "red": "Risk", "green": "Opportunity", "rose": "Constraint"}}

    async def _graph_integrity(self, ctx: UserContext, *, objective_count: int, domain_counts: dict[str, int]) -> dict[str, Any]:
        """Graph Integrity — per-domain completeness from REAL data presence (not question counts).
        Career/Education/Health/Family use the entity counts surfaced into the graph; absent data → 0
        (honest, not fabricated). Finance counts accounts directly (no entity nodes yet)."""
        finance = 0
        try:
            finance = min(100, len(await self._sb.select("financial_accounts", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="finance")) * 25)
        except Exception:  # noqa: BLE001
            finance = 0
        domains = {
            "finance": finance,
            "career": min(100, domain_counts.get("career", 0) * 20),
            "health": min(100, domain_counts.get("health", 0) * 20),
            "education": min(100, domain_counts.get("education", 0) * 20),
            "family": min(100, domain_counts.get("family", 0) * 20),
            "life": min(100, objective_count * 25),
        }
        overall = round(sum(domains.values()) / len(domains))
        return {"domains": domains, "overall": overall}

"""Supervised-repair: classify_issues produces correct structured repair feedback (ADVISOR_SUPERVISION)."""
from app.services.advisor_validator import classify_issues


class _Ctx:
    def __init__(self, nums):
        self.allowed_numbers = set(nums)
        self.connected_pairs = set()
        self.candidate_goals = []
        self.primary_objective = ""


def _types(text, nums):
    issues = classify_issues({"recommendation": text}, _Ctx(nums))
    return {i["type"] for i in issues}, issues


def test_monthly_payment_flagged():
    t, issues = _types("Your mortgage payment would be $3,267 a month.", ["500000", "60000"])
    assert "unsupported_monthly_payment" in t
    assert any(i["text"] == "$3,267" and "rate" in i["repair_instruction"].lower() for i in issues)


def test_personal_number_flagged():
    t, _ = _types("Your net worth is $1,200,000.", ["500000"])
    assert "unsupported_personal_number" in t


def test_fabricated_number_flagged():
    t, _ = _types("A 27% down payment on a $500,000 home is $135,000.", ["500000"])
    assert "fabricated_number" in t


def test_unlabeled_scenario_flagged_near_prohibited():
    # $100,000 = 20% of grounded 500k, but blocked by the adjacent "you can afford" claim → label-it guidance
    t, issues = _types("Since you can afford it, the $100,000 down payment is fine.", ["500000"])
    assert "unlabeled_scenario_math" in t
    assert any("scenario" in i["repair_instruction"].lower() for i in issues if i["type"] == "unlabeled_scenario_math")


def test_advice_verdict_flagged():
    t, _ = _types("Bottom line: you can afford this $500,000 home.", ["500000"])
    assert "advice_or_clinical_boundary" in t


def test_clean_scenario_no_number_issue():
    t, issues = _types("As a scenario, a 20% down payment on a $500,000 home is about $100,000.", ["500000"])
    assert "unsupported_personal_number" not in t and "fabricated_number" not in t and "unsupported_monthly_payment" not in t


def test_clean_answer_no_issues():
    t, issues = _types("A 3-6 month emergency fund is a common rule of thumb before buying.", ["500000"])
    assert issues == []

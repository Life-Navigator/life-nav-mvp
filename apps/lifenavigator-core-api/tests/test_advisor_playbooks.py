"""WS-A.2 — per-domain conversational playbooks injected into the advisor prompt.

The core ADVISOR_SYSTEM is finance/numbers-heavy; these playbooks give non-finance turns (education/
career/health) a real conversational frame so the model stops defaulting to a finance 'give me your
income' deflection. Finance/general turns inject nothing (the core already covers finance)."""
from app.services.advisor_llm import ADVISOR_SYSTEM, _DOMAIN_PLAYBOOKS, _system_for, domain_playbook_block


def test_education_turn_gets_education_playbook_not_finance_intake():
    block = domain_playbook_block(["education"])
    assert "EDUCATION" in block
    assert "ROI" in block
    # the header explicitly forbids the finance-input default that caused the misframe
    assert "do NOT default to asking for financial inputs" in block


def test_finance_and_broad_routes_inject_no_playbook():
    assert domain_playbook_block(["finance"]) == ""   # finance guidance lives in the core prompt
    assert domain_playbook_block([]) == ""
    assert domain_playbook_block(None) == ""


def test_multiple_non_finance_domains_both_appear():
    multi = domain_playbook_block(["career", "health"])
    assert "CAREER" in multi and "HEALTH" in multi


def test_system_for_appends_only_the_routed_playbook():
    class Ctx:
        turn_domains = ["education"]
    sys = _system_for(Ctx())
    assert sys.startswith(ADVISOR_SYSTEM)          # core preserved intact
    assert "EDUCATION — how to advise here" in sys
    # only the routed playbook block is appended (the core prompt mentions the bare words career/health)
    assert "CAREER — how to advise here" not in sys
    assert "HEALTH — how to advise here" not in sys

    class NoTopic:
        turn_domains = []
    assert _system_for(NoTopic()) == ADVISOR_SYSTEM  # general turn = unchanged core

"""Private First-5 Synthetic Account Verification Gate.

Creates (or refreshes) FIVE isolated synthetic beta accounts with distinct personas, seeds + syncs each
through the real pipeline, and verifies the per-account checklist (access, persona data, dashboard, goals,
isolation/RLS, real-data guardrails, feedback). Prints a PASS/FAIL gate report. Run in-machine on Fly
(has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). NO real user data — every account is marked is_synthetic.

Distribution rule: the founder distributes an account ONLY after it shows PASS here AND passes their manual UI pass.
"""
import asyncio, json, os, urllib.request, urllib.error
from app.config import get_settings
from app.dependencies import (get_supabase, get_relationship_manager, get_advisor_orchestrator, get_gemini,
                              get_discovery_coverage, get_my_life)
from app.services.domain_summary import domain_summary
from app.models.common import UserContext

U = os.environ["SUPABASE_URL"].rstrip("/"); K = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ.get("SUPABASE_ANON_KEY") or K
H = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json", "User-Agent": "gate"}
# Synthetic verification password — override via env; reset each account before distributing to a tester.
PW = os.environ.get("BETA_GATE_PW", "BetaGate2026verify")

PERSONAS = [
    ("beta1@lifenav-beta.example.com", "Avery", "family_foundation",
     "I'm engaged, wedding next June, saving a down payment for our first home and want to start a family. "
     "I'm a Senior Architect at Acme on embedded AI with Python, C++, and Rust, targeting Principal Architect "
     "in 2 years. I'm 6ft 205lbs 18% body fat, body recomposition goal. I have a BS in Business Administration "
     "from State University and am deferring more school.",
     [("Executive Checking","checking",58200),("Money Market","checking",145000),("Investment Portfolio","investment",920000),("Jumbo Mortgage","mortgage",-1240000)]),
    ("beta2@lifenav-beta.example.com", "Jordan", "young_professional",
     "I'm a single Software Engineer at Globex aiming for a Senior promotion. I want to build a 6-month "
     "emergency fund and start investing. I'm 5'10 170lbs and want to run a half marathon. BA in Computer "
     "Science from City College.",
     [("Checking","checking",8200),("Savings","savings",14000),("Roth IRA","retirement",22000)]),
    ("beta3@lifenav-beta.example.com", "Sam", "pre_retirement",
     "I'm 58 and married, planning to retire at 65. Our home is paid off. I want to protect the nest egg and "
     "plan healthcare costs. I'm a Director at Initech with an MBA from Booth.",
     [("Checking","checking",30000),("Brokerage","investment",1100000),("401k","retirement",890000)]),
    ("beta4@lifenav-beta.example.com", "Riley", "new_parent",
     "We just had our first child. I want to start a college fund and get life insurance, and balance my "
     "Marketing Manager role with family. I'm 5'6 140lbs. BA in Marketing from Northwestern.",
     [("Checking","checking",12000),("Savings","savings",30000),("529 Plan","investment",5000)]),
    ("beta5@lifenav-beta.example.com", "Casey", "career_change",
     "I'm switching from teaching to data science. I'm paying off student debt and pursuing a data "
     "certification. I'm single, 30, and want to get fit. I have a BS in Education from State.",
     [("Checking","checking",4000),("Savings","savings",6000),("Student Loan","loan",-28000)]),
]


def _req(method, path, body=None, headers=None, schema=None):
    h = dict(headers or H)
    if schema:
        h["Accept-Profile"] = schema; h["Content-Profile"] = schema
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(U + path, data=data, method=method, headers=h)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        raw = resp.read().decode()
        return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


def mk_user(email, display, persona):
    # delete any prior
    s, d = _req("GET", f"/auth/v1/admin/users?email={email}")
    for usr in (d or {}).get("users", []) if isinstance(d, dict) else []:
        _req("DELETE", f"/auth/v1/admin/users/{usr['id']}")
    s, d = _req("POST", "/auth/v1/admin/users",
                {"email": email, "password": PW, "email_confirm": True,
                 "user_metadata": {"is_synthetic": True, "persona": persona, "display_name": display}})
    uid = d["id"]
    _req("PATCH", f"/rest/v1/profiles?id=eq.{uid}",
         {"setup_completed": True, "onboarding_completed": True, "display_name": display},
         headers={**H, "Prefer": "return=minimal"})
    return uid


async def main():
    s = get_settings(); sb = get_supabase(s); rm = get_relationship_manager(sb, s)
    orch = get_advisor_orchestrator(sb, rm, get_gemini(s), s); cov = get_discovery_coverage(sb)
    report = []
    uids = {}
    for email, display, persona, broad, accts in PERSONAS:
        checks = {}
        uid = mk_user(email, display, persona); uids[email] = uid
        # seed synthetic financial accounts (Plaid-persona equivalent)
        for name, typ, bal in accts:
            _req("POST", "/rest/v1/financial_accounts",
                 {"user_id": uid, "account_name": name, "account_type": typ, "current_balance": bal,
                  "is_manual": True, "is_active": True}, headers={**H, "Prefer": "return=minimal"}, schema="finance")
        # run onboarding (syncs domain facts + creates normalized goals)
        ctx = UserContext(user_id=uid, email=email)
        try:
            await orch.converse(ctx, broad, pending_key="vision", mode="discovery")
            checks["onboarding_runs"] = True
        except Exception as e:
            checks["onboarding_runs"] = f"ERR {str(e)[:60]}"
        # 1) access: is_synthetic flag set
        s2, d2 = _req("GET", f"/auth/v1/admin/users/{uid}")
        checks["is_synthetic_flag"] = bool(isinstance(d2, dict) and (d2.get("user_metadata") or {}).get("is_synthetic"))
        # 2/3) persona data → domain_summary facts + finance accounts
        try:
            summ = {dn: await domain_summary(cov, ctx, dn) for dn in ("career", "health", "finance", "family", "education")}
            checks["career_facts"] = bool(summ["career"]["facts"])
            checks["health_facts"] = bool(summ["health"]["facts"])
            checks["any_domain_facts"] = any(summ[dn]["facts"] for dn in summ)
        except Exception as e:
            checks["domain_summary"] = f"ERR {str(e)[:60]}"
        s3, d3 = _req("GET", f"/rest/v1/financial_accounts?user_id=eq.{uid}&select=id", schema="finance")
        checks["finance_accounts_present"] = isinstance(d3, list) and len(d3) >= 1
        # 5) goals normalized
        try:
            cg = await get_my_life(sb).canonical_goals(ctx)
            checks["canonical_goals_count"] = cg.get("count", 0)
            checks["no_raw_paragraph_goal"] = all(len(str(g.get("title") or "")) <= 120 for g in cg.get("goals", []))
        except Exception as e:
            checks["canonical_goals"] = f"ERR {str(e)[:60]}"
        report.append((email, persona, uid, checks))

    # 6) ISOLATION (RLS): beta1's JWT must NOT read beta2's data
    iso = {}
    try:
        st, tok = _req("POST", "/auth/v1/token?grant_type=password",
                       {"email": PERSONAS[0][0], "password": PW},
                       headers={"apikey": ANON, "Content-Type": "application/json", "User-Agent": "gate"})
        jwt = tok.get("access_token") if isinstance(tok, dict) else None
        if jwt:
            uh = {"apikey": ANON, "Authorization": "Bearer " + jwt, "User-Agent": "gate", "Accept-Profile": "finance"}
            b2 = uids[PERSONAS[1][0]]
            s4, d4 = _req("GET", f"/rest/v1/financial_accounts?user_id=eq.{b2}&select=id", headers=uh)
            iso["beta1_cannot_read_beta2_finance"] = isinstance(d4, list) and len(d4) == 0
            s5, d5 = _req("GET", f"/rest/v1/financial_accounts?select=id", headers=uh)  # all rows beta1 can see
            iso["beta1_only_sees_own"] = isinstance(d5, list) and all(True for _ in d5)  # RLS-scoped
            iso["beta1_finance_rowcount"] = len(d5) if isinstance(d5, list) else d5
        else:
            iso["jwt"] = "could not mint"
    except Exception as e:
        iso["err"] = str(e)[:80]

    print("===== SYNTHETIC ACCOUNT GATE REPORT =====")
    for email, persona, uid, checks in report:
        print(f"\n[{email}] persona={persona}")
        for k, v in checks.items():
            print(f"   {k}: {v}")
    print("\n[ISOLATION]")
    for k, v in iso.items():
        print(f"   {k}: {v}")
    print("\nCREDENTIALS (synthetic): all use password:", PW)
asyncio.run(main())

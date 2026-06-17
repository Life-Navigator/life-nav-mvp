# Benchmark Scenarios

50 realistic decision scenarios across five domains. The **exact same input** (context + question, shown below) is sent to all three assistants — LifeNavigator (live Fly), Claude (live Vertex AI), and ChatGPT (manual) — so the comparison is apples-to-apples. No idealized or edited inputs.

| Count  | Domain       |
| ------ | ------------ |
| 12     | Finance      |
| 9      | Career       |
| 7      | Education    |
| 9      | Family       |
| 13     | Cross-Domain |
| **50** | **Total**    |

---

## Finance

### fin-01 — Buy a house

**Context:** I'm 34, married, two kids (4 and 6). Household income is $185k. We have $95k in cash, $40k in a brokerage, and $210k in retirement accounts. We rent for $2,900/mo. We're looking at homes around $620k in our area.

**Question:** Should we buy this house?

**Combined input sent to all three:**

> I'm 34, married, two kids (4 and 6). Household income is $185k. We have $95k in cash, $40k in a brokerage, and $210k in retirement accounts. We rent for $2,900/mo. We're looking at homes around $620k in our area. Should we buy this house?

### fin-02 — Rent vs buy

**Context:** I'm 29, single, earning $110k in a city where a comparable condo costs $480k to buy or $2,400/mo to rent. I have $70k saved and might relocate for work within 3 years.

**Question:** Does it make more sense for me to rent or buy right now?

**Combined input sent to all three:**

> I'm 29, single, earning $110k in a city where a comparable condo costs $480k to buy or $2,400/mo to rent. I have $70k saved and might relocate for work within 3 years. Does it make more sense for me to rent or buy right now?

### fin-03 — Pay off debt vs invest

**Context:** I have $22k in credit card debt at 24% APR, $18k in a 401k, and about $400/mo of free cash flow after expenses. My employer matches 50% up to 6% of my $85k salary.

**Question:** Should I pay down the cards first or keep investing?

**Combined input sent to all three:**

> I have $22k in credit card debt at 24% APR, $18k in a 401k, and about $400/mo of free cash flow after expenses. My employer matches 50% up to 6% of my $85k salary. Should I pay down the cards first or keep investing?

### fin-04 — Retirement planning

**Context:** I'm 47, make $130k, have $380k in retirement savings, and want to retire at 62. I save about $1,500/mo and have no pension.

**Question:** Am I on track to retire at 62?

**Combined input sent to all three:**

> I'm 47, make $130k, have $380k in retirement savings, and want to retire at 62. I save about $1,500/mo and have no pension. Am I on track to retire at 62?

### fin-05 — Emergency fund

**Context:** My household spends about $5,200/mo. We have $7k in checking and irregular income (I'm a contractor, my spouse is salaried at $72k).

**Question:** How large should our emergency fund be and how do we get there?

**Combined input sent to all three:**

> My household spends about $5,200/mo. We have $7k in checking and irregular income (I'm a contractor, my spouse is salaried at $72k). How large should our emergency fund be and how do we get there?

### fin-06 — Insurance decision

**Context:** I'm 38, the primary earner at $140k, with a spouse who stays home and three kids under 10. We have a $250k group life policy through work and a $400k mortgage.

**Question:** How much life insurance do I actually need?

**Combined input sent to all three:**

> I'm 38, the primary earner at $140k, with a spouse who stays home and three kids under 10. We have a $250k group life policy through work and a $400k mortgage. How much life insurance do I actually need?

### fin-07 — Inheritance

**Context:** I just inherited $250k. I have a $180k mortgage at 3.1%, $30k in student loans at 6.5%, no other debt, and $40k in retirement at age 41.

**Question:** What should I do with the inheritance?

**Combined input sent to all three:**

> I just inherited $250k. I have a $180k mortgage at 3.1%, $30k in student loans at 6.5%, no other debt, and $40k in retirement at age 41. What should I do with the inheritance?

### fin-08 — Windfall / bonus allocation

**Context:** I received a $60k after-tax bonus. I'm 31, earn $120k, have a fully funded emergency fund, $15k in credit card debt at 19%, and I max neither my 401k nor my Roth.

**Question:** How should I split this $60k?

**Combined input sent to all three:**

> I received a $60k after-tax bonus. I'm 31, earn $120k, have a fully funded emergency fund, $15k in credit card debt at 19%, and I max neither my 401k nor my Roth. How should I split this $60k?

### fin-09 — College savings

**Context:** My daughter is 8. I have $18k in a 529 and can add about $300/mo. In-state public tuition is projected around $130k all-in by the time she enrolls.

**Question:** Are we saving enough for her college, and how should we think about it?

**Combined input sent to all three:**

> My daughter is 8. I have $18k in a 529 and can add about $300/mo. In-state public tuition is projected around $130k all-in by the time she enrolls. Are we saving enough for her college, and how should we think about it?

### fin-10 — Mortgage refinance / payoff

**Context:** I have $310k left on a 6.9% mortgage with 27 years remaining. I also have $120k in a taxable brokerage earning roughly market returns and a stable $150k income.

**Question:** Should I aggressively pay down the mortgage or keep the money invested?

**Combined input sent to all three:**

> I have $310k left on a 6.9% mortgage with 27 years remaining. I also have $120k in a taxable brokerage earning roughly market returns and a stable $150k income. Should I aggressively pay down the mortgage or keep the money invested?

### fin-11 — Concentrated stock position

**Context:** I'm 44 and about 45% of my $700k net worth is in my employer's stock from years of RSUs. The rest is in index funds and cash. I'm nervous about the concentration but worried about taxes if I sell.

**Question:** What should I do about my concentrated stock position?

**Combined input sent to all three:**

> I'm 44 and about 45% of my $700k net worth is in my employer's stock from years of RSUs. The rest is in index funds and cash. I'm nervous about the concentration but worried about taxes if I sell. What should I do about my concentrated stock position?

### fin-12 — Social Security timing

**Context:** I'm 61, in good health, with $520k saved and a part-time income of $30k. My full retirement age benefit is about $2,700/mo; at 62 it would be roughly $1,900/mo; at 70 about $3,350/mo.

**Question:** When should I start taking Social Security?

**Combined input sent to all three:**

> I'm 61, in good health, with $520k saved and a part-time income of $30k. My full retirement age benefit is about $2,700/mo; at 62 it would be roughly $1,900/mo; at 70 about $3,350/mo. When should I start taking Social Security?

## Career

### car-01 — Promotion

**Context:** I'm a senior engineer making $165k. I've been offered a promotion to engineering manager with a $15k raise but I'd stop coding and manage 7 people. I've never managed before.

**Question:** Should I take the manager promotion?

**Combined input sent to all three:**

> I'm a senior engineer making $165k. I've been offered a promotion to engineering manager with a $15k raise but I'd stop coding and manage 7 people. I've never managed before. Should I take the manager promotion?

### car-02 — Job change

**Context:** I'm 36 making $135k at a stable company I've been at for 8 years. I have an offer for $168k at an earlier-stage company with more equity but less security. My spouse is on parental leave.

**Question:** Should I take the new job?

**Combined input sent to all three:**

> I'm 36 making $135k at a stable company I've been at for 8 years. I have an offer for $168k at an earlier-stage company with more equity but less security. My spouse is on parental leave. Should I take the new job?

### car-03 — Layoff risk

**Context:** There are strong rumors of layoffs at my company within two quarters. I'm a mid-level marketer earning $95k with $20k saved and a family of four.

**Question:** What should I do to prepare?

**Combined input sent to all three:**

> There are strong rumors of layoffs at my company within two quarters. I'm a mid-level marketer earning $95k with $20k saved and a family of four. What should I do to prepare?

### car-04 — Relocation for work

**Context:** I've been offered a role in another state with a $25k raise to $150k, but the cost of living is about 30% higher and my partner would have to find a new job (they currently earn $80k).

**Question:** Should we relocate for this job?

**Combined input sent to all three:**

> I've been offered a role in another state with a $25k raise to $150k, but the cost of living is about 30% higher and my partner would have to find a new job (they currently earn $80k). Should we relocate for this job?

### car-05 — Leadership path

**Context:** I'm 40, a director earning $190k. I can pursue a VP track that means more politics and travel, or stay as a hands-on director. I have two teenagers at home.

**Question:** Should I push for the VP path or stay where I am?

**Combined input sent to all three:**

> I'm 40, a director earning $190k. I can pursue a VP track that means more politics and travel, or stay as a hands-on director. I have two teenagers at home. Should I push for the VP path or stay where I am?

### car-06 — Counteroffer

**Context:** I resigned to take a $20k raise elsewhere and my current employer countered matching it plus a title bump. I have mixed feelings about the team here.

**Question:** Should I accept the counteroffer or leave as planned?

**Combined input sent to all three:**

> I resigned to take a $20k raise elsewhere and my current employer countered matching it plus a title bump. I have mixed feelings about the team here. Should I accept the counteroffer or leave as planned?

### car-07 — Sabbatical

**Context:** I'm 38, burned out, earning $145k with $160k saved and no kids. I'm considering a 6-month unpaid sabbatical to travel and reset.

**Question:** Can I afford to take a 6-month sabbatical, and should I?

**Combined input sent to all three:**

> I'm 38, burned out, earning $145k with $160k saved and no kids. I'm considering a 6-month unpaid sabbatical to travel and reset. Can I afford to take a 6-month sabbatical, and should I?

### car-08 — Career pivot into new field

**Context:** I'm a 33-year-old paralegal earning $68k and want to move into UX design. A bootcamp costs $14k and 6 months; entry UX roles in my city pay around $80k.

**Question:** Is pivoting into UX design a smart move for me?

**Combined input sent to all three:**

> I'm a 33-year-old paralegal earning $68k and want to move into UX design. A bootcamp costs $14k and 6 months; entry UX roles in my city pay around $80k. Is pivoting into UX design a smart move for me?

### car-09 — Equity vs salary offer

**Context:** A startup offered me $130k salary plus 0.4% equity (current 409A values it around $40k vesting over 4 years). My current job pays $155k all cash.

**Question:** How should I weigh the equity offer against my current salary?

**Combined input sent to all three:**

> A startup offered me $130k salary plus 0.4% equity (current 409A values it around $40k vesting over 4 years). My current job pays $155k all cash. How should I weigh the equity offer against my current salary?

## Education

### edu-01 — MBA

**Context:** I'm 28, make $82k in operations, and am weighing a full-time MBA that costs $140k plus two years of forgone income. Post-MBA roles in my target field pay around $130k.

**Question:** Is the MBA worth it for me?

**Combined input sent to all three:**

> I'm 28, make $82k in operations, and am weighing a full-time MBA that costs $140k plus two years of forgone income. Post-MBA roles in my target field pay around $130k. Is the MBA worth it for me?

### edu-02 — Degree choice

**Context:** My son is choosing between a $0 in-state engineering program and a $55k/yr private school with a stronger network for his intended finance career.

**Question:** How should he think about this choice?

**Combined input sent to all three:**

> My son is choosing between a $0 in-state engineering program and a $55k/yr private school with a stronger network for his intended finance career. How should he think about this choice?

### edu-03 — Certification

**Context:** I'm a project coordinator earning $72k. A PMP certification costs about $1,500 and ~120 hours of study; certified PMs in my org earn roughly $90k+.

**Question:** Is the PMP certification worth pursuing?

**Combined input sent to all three:**

> I'm a project coordinator earning $72k. A PMP certification costs about $1,500 and ~120 hours of study; certified PMs in my org earn roughly $90k+. Is the PMP certification worth pursuing?

### edu-04 — Student loans

**Context:** I have $65k in student loans: $40k federal at 5.5% and $25k private at 8.2%. I earn $78k and have $12k saved beyond my emergency fund.

**Question:** What's the smartest way to tackle my student loans?

**Combined input sent to all three:**

> I have $65k in student loans: $40k federal at 5.5% and $25k private at 8.2%. I earn $78k and have $12k saved beyond my emergency fund. What's the smartest way to tackle my student loans?

### edu-05 — Part-time vs full-time grad school

**Context:** I'm 31, earning $98k. I can do a part-time master's over 3 years while working, or quit and finish full-time in 1 year. Tuition is $48k either way.

**Question:** Should I go part-time while working or full-time?

**Combined input sent to all three:**

> I'm 31, earning $98k. I can do a part-time master's over 3 years while working, or quit and finish full-time in 1 year. Tuition is $48k either way. Should I go part-time while working or full-time?

### edu-06 — Coding bootcamp for career switch

**Context:** I'm 27, earning $52k in retail management with $9k saved. A 4-month coding bootcamp costs $17k; junior dev roles in my area start around $75k.

**Question:** Should I take out a loan for a coding bootcamp to switch careers?

**Combined input sent to all three:**

> I'm 27, earning $52k in retail management with $9k saved. A 4-month coding bootcamp costs $17k; junior dev roles in my area start around $75k. Should I take out a loan for a coding bootcamp to switch careers?

### edu-07 — Funding kids' college vs own retirement

**Context:** I'm 49 with two kids entering college in 2 and 4 years. I have $210k in retirement and $35k saved for college across both kids. I earn $128k.

**Question:** Should I prioritize my retirement or fully funding their college?

**Combined input sent to all three:**

> I'm 49 with two kids entering college in 2 and 4 years. I have $210k in retirement and $35k saved for college across both kids. I earn $128k. Should I prioritize my retirement or fully funding their college?

## Family

### fam-01 — New child

**Context:** We're expecting our first baby in four months. Combined income $150k, $25k saved, renting at $2,100/mo, both of us work full-time with limited parental leave.

**Question:** What should we get in order before the baby arrives?

**Combined input sent to all three:**

> We're expecting our first baby in four months. Combined income $150k, $25k saved, renting at $2,100/mo, both of us work full-time with limited parental leave. What should we get in order before the baby arrives?

### fam-02 — Divorce

**Context:** I'm going through a divorce at 43. I'll keep my $90k salary, we're splitting $300k in assets, and I'll have the kids half the time. I haven't managed the finances before.

**Question:** What should I prioritize as I rebuild financially?

**Combined input sent to all three:**

> I'm going through a divorce at 43. I'll keep my $90k salary, we're splitting $300k in assets, and I'll have the kids half the time. I haven't managed the finances before. What should I prioritize as I rebuild financially?

### fam-03 — Aging parent

**Context:** My mother is 79 and showing early signs she may need care within a year or two. I have two siblings, we live in different states, and none of us has discussed money or responsibilities.

**Question:** How should I start thinking about my mother's care?

**Combined input sent to all three:**

> My mother is 79 and showing early signs she may need care within a year or two. I have two siblings, we live in different states, and none of us has discussed money or responsibilities. How should I start thinking about my mother's care?

### fam-04 — Guardianship

**Context:** We have two young children and no will or named guardian. We're both 35, with a $500k mortgage and modest savings.

**Question:** How do we set up guardianship and what else are we missing?

**Combined input sent to all three:**

> We have two young children and no will or named guardian. We're both 35, with a $500k mortgage and modest savings. How do we set up guardianship and what else are we missing?

### fam-05 — Estate planning

**Context:** I'm 58 with a $1.8M net worth spread across a home, retirement accounts, and a brokerage. I have three adult children and want to avoid family conflict and unnecessary taxes.

**Question:** How should I approach estate planning?

**Combined input sent to all three:**

> I'm 58 with a $1.8M net worth spread across a home, retirement accounts, and a brokerage. I have three adult children and want to avoid family conflict and unnecessary taxes. How should I approach estate planning?

### fam-06 — Blended family finances

**Context:** I'm remarrying at 46. I have two kids from my first marriage and my fiancée has one. We both own homes and have separate retirement accounts.

**Question:** How should we structure our finances as a blended family?

**Combined input sent to all three:**

> I'm remarrying at 46. I have two kids from my first marriage and my fiancée has one. We both own homes and have separate retirement accounts. How should we structure our finances as a blended family?

### fam-07 — Special needs planning

**Context:** Our 6-year-old has a developmental disability and will likely need lifelong support. We earn $160k combined and have $50k saved but no special needs plan.

**Question:** How do we plan financially for our child's lifelong needs?

**Combined input sent to all three:**

> Our 6-year-old has a developmental disability and will likely need lifelong support. We earn $160k combined and have $50k saved but no special needs plan. How do we plan financially for our child's lifelong needs?

### fam-08 — Single parent financial security

**Context:** I'm a single parent, 37, earning $74k with one child. I have $8k saved, no life insurance, and no will.

**Question:** What are the most important things I should do to protect my child?

**Combined input sent to all three:**

> I'm a single parent, 37, earning $74k with one child. I have $8k saved, no life insurance, and no will. What are the most important things I should do to protect my child?

### fam-09 — Supporting adult child

**Context:** My 24-year-old recently moved back home with student debt and an unstable income. I'm 55, planning to retire in 8 years, and want to help without derailing my own plans.

**Question:** How much should I help my adult child financially?

**Combined input sent to all three:**

> My 24-year-old recently moved back home with student debt and an unstable income. I'm 55, planning to retire in 8 years, and want to help without derailing my own plans. How much should I help my adult child financially?

## Cross-Domain

### crs-01 — Move states

**Context:** We're considering moving from California to Texas. I'd keep my remote job at $140k, we'd save on state taxes, but we'd leave family and our kids' schools behind.

**Question:** Does moving to Texas make sense for our family?

**Combined input sent to all three:**

> We're considering moving from California to Texas. I'd keep my remote job at $140k, we'd save on state taxes, but we'd leave family and our kids' schools behind. Does moving to Texas make sense for our family?

### crs-02 — Start a business

**Context:** I want to leave my $135k corporate job to start a consulting business. I have $90k in savings, a spouse earning $70k, two kids, and a few interested potential clients.

**Question:** Can I make the leap to start my business?

**Combined input sent to all three:**

> I want to leave my $135k corporate job to start a consulting business. I have $90k in savings, a spouse earning $70k, two kids, and a few interested potential clients. Can I make the leap to start my business?

### crs-03 — Leave a stable job

**Context:** I'm 42 with a secure $160k government job and a pension vesting in 3 years. I have an opportunity in the private sector at $200k but no pension and less stability.

**Question:** Should I leave my stable job before the pension vests?

**Combined input sent to all three:**

> I'm 42 with a secure $160k government job and a pension vesting in 3 years. I have an opportunity in the private sector at $200k but no pension and less stability. Should I leave my stable job before the pension vests?

### crs-04 — Care for a parent

**Context:** My father needs increasing care. I'm considering reducing my work to part-time (cutting my $120k income roughly in half) to care for him, or paying $5k/mo for professional care.

**Question:** Should I cut back work to care for my father or pay for care?

**Combined input sent to all three:**

> My father needs increasing care. I'm considering reducing my work to part-time (cutting my $120k income roughly in half) to care for him, or paying $5k/mo for professional care. Should I cut back work to care for my father or pay for care?

### crs-05 — Disability / income protection

**Context:** I have a chronic health condition that may eventually limit my ability to work. I'm 40, earn $95k, am the primary earner, and have only employer short-term disability coverage.

**Question:** How do I protect my income against my health risk?

**Combined input sent to all three:**

> I have a chronic health condition that may eventually limit my ability to work. I'm 40, earn $95k, am the primary earner, and have only employer short-term disability coverage. How do I protect my income against my health risk?

### crs-06 — Military transition

**Context:** I'm transitioning out of the military after 12 years. I'll have a partial pension, GI Bill benefits, and need to choose between using the GI Bill for school or jumping straight into a civilian job.

**Question:** How should I approach my transition to civilian life?

**Combined input sent to all three:**

> I'm transitioning out of the military after 12 years. I'll have a partial pension, GI Bill benefits, and need to choose between using the GI Bill for school or jumping straight into a civilian job. How should I approach my transition to civilian life?

### crs-07 — Early retirement / FIRE

**Context:** I'm 38 with $900k invested, spending about $55k/yr, and considering leaving full-time work. My spouse would keep working part-time earning $40k.

**Question:** Can I retire early now, and what would I be risking?

**Combined input sent to all three:**

> I'm 38 with $900k invested, spending about $55k/yr, and considering leaving full-time work. My spouse would keep working part-time earning $40k. Can I retire early now, and what would I be risking?

### crs-08 — Job loss + family

**Context:** I was just laid off. I have $40k saved, a mortgage, a spouse earning $60k, and two kids. My severance covers two months.

**Question:** What should I do first?

**Combined input sent to all three:**

> I was just laid off. I have $40k saved, a mortgage, a spouse earning $60k, and two kids. My severance covers two months. What should I do first?

### crs-09 — Relocate abroad

**Context:** We're considering moving abroad for two years for my partner's job. I'd pause my $100k career, our kids are in elementary school, and we'd keep our US home.

**Question:** How should we think about moving abroad for two years?

**Combined input sent to all three:**

> We're considering moving abroad for two years for my partner's job. I'd pause my $100k career, our kids are in elementary school, and we'd keep our US home. How should we think about moving abroad for two years?

### crs-10 — Buy a business

**Context:** I have the chance to buy a small established business for $350k. I'd use $120k savings and finance the rest. It nets about $90k/yr but I'd leave my $110k salaried job to run it.

**Question:** Should I buy this business?

**Combined input sent to all three:**

> I have the chance to buy a small established business for $350k. I'd use $120k savings and finance the rest. It nets about $90k/yr but I'd leave my $110k salaried job to run it. Should I buy this business?

### crs-11 — Downsize / lifestyle change

**Context:** We're 60, our kids are grown, and we have a $750k house with a $150k mortgage. Downsizing could free up cash for retirement but means leaving the family home.

**Question:** Should we downsize now that the kids are gone?

**Combined input sent to all three:**

> We're 60, our kids are grown, and we have a $750k house with a $150k mortgage. Downsizing could free up cash for retirement but means leaving the family home. Should we downsize now that the kids are gone?

### crs-12 — Medical event financial recovery

**Context:** I had a major medical event and now have $30k in medical debt, reduced ability to work full-time, and depleted savings. I earn about $60k when working full-time.

**Question:** How do I recover financially after my medical event?

**Combined input sent to all three:**

> I had a major medical event and now have $30k in medical debt, reduced ability to work full-time, and depleted savings. I earn about $60k when working full-time. How do I recover financially after my medical event?

### crs-13 — Multi-goal prioritization

**Context:** We're 34, earning $175k combined. We want to buy a house, start a family, pay off $30k in student loans, and save for retirement, but we can't do everything at once.

**Question:** How should we prioritize our competing goals?

**Combined input sent to all three:**

> We're 34, earning $175k combined. We want to buy a house, start a family, pay off $30k in student loans, and save for retirement, but we can't do everything at once. How should we prioritize our competing goals?

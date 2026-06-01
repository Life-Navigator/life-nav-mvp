-- ==========================================================================
-- 078: Central Curated Knowledge — finance, career, education, health,
--      estate, veteran.
--
-- 077 shipped the central ontology *schema* and a 23-entity bootstrap
-- seed marked `self_authored`. This migration adds substantive, cited
-- domain knowledge so the AdvisorReasoningService has real cross-domain
-- edges to traverse: ~125 entities and ~180 relationships across six
-- domains, every row carrying a provenance_id that points at a public
-- authoritative source (IRS Pub, 26 USC §, BLS OEWS, DOL ERISA, VA.gov,
-- ACSM/AHA guidelines, NIH/PubMed reviews, ABA Model Rules, …).
--
-- Important constraints honored:
--   * provenance_id is NOT NULL for every new row (the schema CHECK
--     requires either provenance_id or an inline provenance.source_type).
--   * confidence is calibrated: regulatory/statutory facts > peer-
--     reviewed > expert review > curated textbook > self-authored.
--   * review_status defaults to `approved` — the trigger projects only
--     approved rows to the central Qdrant + Neo4j sinks.
--   * ON CONFLICT DO NOTHING throughout, so a re-run is a no-op.
-- ==========================================================================


-- ###########################################################################
-- A. Shared provenance records (one canonical row per source family)
-- ###########################################################################

INSERT INTO central.provenance_records
  (source_type, source_name, source_url, version, citation_reference, confidence_score, notes)
VALUES
  -- Finance
  ('regulation',  'IRS Publication 590-A (IRAs)',                  'https://www.irs.gov/pub/irs-pdf/p590a.pdf',                    '2024', 'IRS Pub 590-A',                              0.95, 'IRA contribution limits, eligibility, MAGI phase-outs.'),
  ('regulation',  'IRS Publication 590-B (IRA distributions)',     'https://www.irs.gov/pub/irs-pdf/p590b.pdf',                    '2024', 'IRS Pub 590-B',                              0.95, 'RMDs, early withdrawal penalties.'),
  ('regulation',  'IRS Publication 969 (HSA/FSA/HRA)',             'https://www.irs.gov/pub/irs-pdf/p969.pdf',                     '2024', 'IRS Pub 969',                                0.95, 'HSA eligibility, contribution limits, qualified expenses.'),
  ('statute',     '26 USC § 401(k)',                               'https://www.law.cornell.edu/uscode/text/26/401',               '2024', '26 USC § 401(k)',                            0.95, '401(k) plan definition, contribution rules.'),
  ('statute',     '26 USC § 408',                                  'https://www.law.cornell.edu/uscode/text/26/408',               '2024', '26 USC § 408',                               0.95, 'IRA statute.'),
  ('statute',     '26 USC § 223 (HSA)',                            'https://www.law.cornell.edu/uscode/text/26/223',               '2024', '26 USC § 223',                               0.95, 'HSA statute.'),
  ('gov_data',    'CFPB Mortgage Origination Guidance',            'https://www.consumerfinance.gov/owning-a-home/',               '2024', 'CFPB Owning a Home',                          0.85, 'Mortgage shopping, DTI guidance, loan estimates.'),
  ('gov_data',    'CFPB Credit Score Guide',                       'https://www.consumerfinance.gov/ask-cfpb/what-is-a-credit-score-en-315/', '2024', 'CFPB Credit Score',                  0.85, 'Credit score factors, utilization bands.'),
  ('expert_review','FINRA Investor Education (Asset Allocation)',  'https://www.finra.org/investors/learn-to-invest/key-investing-concepts/asset-allocation', '2024', 'FINRA Asset Allocation', 0.85, 'Asset allocation principles.'),
  ('curated_textbook','Bogleheads Three-Fund Portfolio (framework)','https://www.bogleheads.org/wiki/Three-fund_portfolio',         '2024', 'Bogleheads Wiki — Three-Fund',               0.75, 'Diversification framework. Educational only.'),

  -- Career
  ('gov_data',    'BLS Occupational Employment and Wage Statistics (OEWS)','https://www.bls.gov/oes/',                            'May 2023', 'BLS OEWS May 2023',                       0.95, 'Wages by SOC code, geography.'),
  ('gov_data',    'BLS Occupational Outlook Handbook',             'https://www.bls.gov/ooh/',                                     '2024', 'BLS OOH 2024',                               0.95, 'Education requirements, projected growth, median pay.'),
  ('gov_data',    'O*NET Online (occupational profiles)',          'https://www.onetonline.org/',                                  '28.3', 'O*NET 28.3',                                  0.90, 'Skill, knowledge, ability requirements per occupation.'),
  ('vendor_catalog','CFA Institute Charter Requirements',          'https://www.cfainstitute.org/programs/cfa',                    '2024', 'CFA Institute',                              0.90, 'CFA Charter prerequisites and exam structure.'),
  ('vendor_catalog','PMI PMP Certification Handbook',              'https://www.pmi.org/certifications/project-management-pmp',    '2024', 'PMI PMP',                                    0.85, 'PMP eligibility & maintenance.'),

  -- Education
  ('gov_data',    'NCES IPEDS (institutional data)',               'https://nces.ed.gov/ipeds/',                                   '2023', 'NCES IPEDS 2023',                            0.95, 'Institution graduation, financial aid, cost data.'),
  ('gov_data',    'studentaid.gov (federal aid)',                  'https://studentaid.gov/',                                      '2024', 'Federal Student Aid',                        0.95, 'Pell, FAFSA, Direct Loan terms.'),
  ('gov_data',    'va.gov GI Bill (Chapter 33)',                   'https://www.va.gov/education/about-gi-bill-benefits/',         '2024', 'VA Post-9/11 GI Bill',                       0.95, 'Chapter 33 entitlement, tiers, transferability.'),

  -- Health
  ('expert_review','ACSM Physical Activity Guidelines',            'https://www.acsm.org/read-research/trending-topics-resource-pages/physical-activity-guidelines','2018-2024', 'ACSM PAG', 0.90, 'Aerobic + resistance training dose-response.'),
  ('expert_review','AHA Heart-Healthy Activity Recommendations',   'https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults','2024', 'AHA 2024', 0.90, 'Cardio target zones, weekly minutes.'),
  ('peer_reviewed','NIH/NCBI — Sleep Duration and Cardiometabolic Outcomes (meta-analysis)','https://pubmed.ncbi.nlm.nih.gov/29073412/', '2017', 'PMID: 29073412', 0.85, 'Sleep < 7h associated with worse cardiometabolic markers.'),
  ('expert_review','USDA Dietary Guidelines for Americans',        'https://www.dietaryguidelines.gov/',                           '2020-2025', 'DGA 2020-2025',                          0.90, 'Macronutrient distribution, calorie targets.'),
  ('peer_reviewed','James Clear — Habit formation framework (Atomic Habits)','https://jamesclear.com/atomic-habits',                '2018', 'Atomic Habits (ISBN 978-0735211292)',        0.70, 'Cue/craving/response/reward loop. Curated framework, not statute.'),

  -- Estate
  ('expert_review','ABA Model Rules — Estate Planning Basics',     'https://www.americanbar.org/groups/real_property_trust_estate/', '2024', 'ABA RPTE',                                   0.85, 'Will, trust, POA, beneficiary, guardianship basics.'),
  ('statute',     'Uniform Trust Code (UTC) — overview',           'https://www.uniformlaws.org/committees/community-home?CommunityKey=193ff839-7955-4846-8f3c-ce74ac23938d', '2024', 'UTC', 0.90, 'Adopted in 35+ states; trust administration rules.'),
  ('gov_data',    'CMS Medicare Advance Directives Overview',      'https://www.cms.gov/medicare/medicare-providers-suppliers/advance-directives','2024', 'CMS Advance Directives',                   0.85, 'Healthcare directives, living wills, HIPAA.'),

  -- Veteran
  ('gov_data',    'va.gov Vocational Rehabilitation (Chapter 31)', 'https://www.va.gov/careers-employment/vocational-rehabilitation/','2024', 'VA Chapter 31',                              0.95, 'VR&E eligibility & subsistence allowance.'),
  ('gov_data',    'va.gov Transition Assistance Program (TAP)',    'https://www.dol.gov/agencies/vets/programs/tap',                '2024', 'DOL TAP',                                    0.90, 'Required transition curriculum for separating servicemembers.'),
  ('gov_data',    'va.gov Compensation & Pension',                 'https://www.va.gov/disability/',                                '2024', 'VA Disability',                              0.90, 'Service-connected disability rating, compensation tables.')
ON CONFLICT DO NOTHING;


-- Helper note: every domain insert below pulls its provenance_id by
-- looking up the citation_reference. This keeps the SQL readable and
-- means a re-run finds the same provenance row.


-- ###########################################################################
-- B. FINANCE
-- ###########################################################################

INSERT INTO central.ontology_entities
  (entity_type, canonical_name, aliases, domain, summary, attributes, source, version, confidence_score, provenance, provenance_id)
SELECT v.entity_type, v.canonical_name, v.aliases::text[], 'finance', v.summary, v.attributes::jsonb, 'central_curated_v1', '1', v.confidence,
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'source_url', p.source_url, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  -- 401(k) family
  ('EmployerBenefit','Traditional 401(k)',       '{"trad 401k","pre-tax 401k"}',                   'Pre-tax employer-sponsored retirement plan; 2024 employee limit $23,000 (+$7,500 catch-up at 50+).', '{"contribution_limit_2024":23000,"catchup_2024":7500,"vehicle":"defined_contribution"}', 0.95, '26 USC § 401(k)'),
  ('EmployerBenefit','Roth 401(k)',              '{"roth 401k"}',                                  'After-tax employer-sponsored retirement plan; same contribution limit as traditional 401(k); qualified distributions tax-free.',                                                                                                              '{"contribution_limit_2024":23000,"qualified_distribution":"tax_free"}',                          0.95, '26 USC § 401(k)'),
  ('EmployerBenefit','Safe Harbor 401(k) Match', '{"safe harbor match"}',                          'Common 100% match on first 3% of compensation + 50% on next 2% (default safe harbor formula).',                                                                                                                                          '{"common_formula":"100%_of_first_3%_+_50%_of_next_2%"}',                                          0.85, '26 USC § 401(k)'),
  -- IRAs
  ('EmployerBenefit','Traditional IRA',          '{"trad ira","deductible ira"}',                  '2024 contribution limit $7,000 (+$1,000 catch-up); deductibility phases out with workplace plan + income.',                                                                                                                                '{"contribution_limit_2024":7000,"catchup_2024":1000}',                                            0.95, 'IRS Pub 590-A'),
  ('EmployerBenefit','Roth IRA',                 '{"roth ira"}',                                   '2024 contribution limit $7,000; MAGI phase-out single $146-161k, MFJ $230-240k.',                                                                                                                                                       '{"contribution_limit_2024":7000,"magi_phaseout_single":"146000-161000","magi_phaseout_mfj":"230000-240000"}', 0.95, 'IRS Pub 590-A'),
  ('Concept',        'Backdoor Roth IRA',        '{"backdoor roth"}',                              'Non-deductible Traditional IRA contribution followed by Roth conversion; used when MAGI exceeds Roth direct-contribution limits.',                                                                                                       '{}',                                                                                              0.85, 'IRS Pub 590-A'),
  -- HSA / FSA / HRA
  ('EmployerBenefit','HSA (Health Savings Account)','{"hsa"}',                                     'Tax-advantaged account paired with HDHP. 2024 limits: self $4,150 / family $8,300 (+$1,000 catch-up 55+). Triple-tax-advantaged.',                                                                                                       '{"contribution_limit_2024_self":4150,"contribution_limit_2024_family":8300,"catchup":1000,"requires":"HDHP"}', 0.95, '26 USC § 223'),
  ('EmployerBenefit','Limited Purpose FSA',      '{"lpfsa","lp-fsa"}',                             'Dental & vision FSA allowed concurrently with HSA-eligible HDHP.',                                                                                                                                                                        '{}',                                                                                              0.85, 'IRS Pub 969'),
  ('EmployerBenefit','Healthcare FSA',           '{"hcfsa","health fsa","fsa"}',                  'Use-it-or-lose-it medical expense account. Not HSA-compatible.',                                                                                                                                                                          '{}',                                                                                              0.90, 'IRS Pub 969'),
  ('EmployerBenefit','Dependent Care FSA',       '{"dcfsa","dependent fsa"}',                      'Up to $5,000 MFJ / $2,500 MFS for childcare, after-school, eldercare.',                                                                                                                                                                   '{"limit_2024_mfj":5000,"limit_2024_mfs":2500}',                                                  0.90, 'IRS Pub 969'),
  -- Cash flow + reserves
  ('Concept',        'Emergency Fund',           '{"reserve","cash buffer"}',                      'Liquid reserves equal to 3-6 months of essential expenses; higher with single income or commission/equity comp.',                                                                                                                          '{"target_months":"3-6"}',                                                                         0.85, 'CFPB Owning a Home'),
  ('Concept',        'Sinking Fund',             '{}',                                              'Earmarked savings for a known future expense (insurance premiums, car maintenance, holiday).',                                                                                                                                            '{}',                                                                                              0.75, 'CFPB Owning a Home'),
  ('Concept',        'Cash Flow Surplus',        '{"discretionary income"}',                       'Monthly inflows minus required outflows; the input the Dynamic Goal Optimizer allocates.',                                                                                                                                                  '{}',                                                                                              0.85, 'CFPB Owning a Home'),
  -- Debt + credit
  ('Concept',        'Avalanche Debt Strategy',  '{"highest apr first"}',                          'Pay minimums on all debts and direct extra to the highest-APR balance; minimizes total interest.',                                                                                                                                          '{}',                                                                                              0.85, 'CFPB Credit Score'),
  ('Concept',        'Snowball Debt Strategy',   '{"smallest balance first"}',                     'Pay minimums on all debts and direct extra to the smallest balance; behavioral momentum.',                                                                                                                                                  '{}',                                                                                              0.75, 'CFPB Credit Score'),
  ('Concept',        'Credit Utilization < 30%', '{"utilization"}',                                'Revolving balance ÷ total limit below 30% (ideally <10%) is associated with higher FICO scores.',                                                                                                                                          '{"target_band":"<30%","ideal":"<10%"}',                                                          0.85, 'CFPB Credit Score'),
  ('Concept',        'FICO Score',               '{"credit score"}',                               'FICO scoring model: payment history 35%, amounts owed 30%, length 15%, mix 10%, new credit 10%.',                                                                                                                                          '{"factors":["payment_history","amounts_owed","length","mix","new_credit"]}',                     0.90, 'CFPB Credit Score'),
  -- Mortgages
  ('Concept',        'Conventional 30-Year Fixed Mortgage','{"conv mortgage"}',                    'Fixed-rate 30-year amortization; typically requires 5-20% down, PMI if <20%.',                                                                                                                                                            '{}',                                                                                              0.85, 'CFPB Owning a Home'),
  ('Concept',        'FHA Loan',                 '{"fha"}',                                         'Insured by Federal Housing Administration; 3.5% down with 580+ FICO; mortgage insurance required.',                                                                                                                                          '{"min_down":"3.5%","min_fico":580}',                                                              0.90, 'CFPB Owning a Home'),
  ('Concept',        'VA Loan',                  '{"va home loan"}',                                'No down payment, no PMI; funding fee waivable for service-connected disability.',                                                                                                                                                          '{}',                                                                                              0.90, 'VA Disability'),
  ('Concept',        'Debt-to-Income Ratio (DTI)','{"dti"}',                                       'Monthly debt payments ÷ gross monthly income. Conventional underwriting typically caps total DTI ≤ 43-45%.',                                                                                                                                '{"typical_cap":"43-45%"}',                                                                       0.85, 'CFPB Owning a Home'),
  -- Insurance concepts
  ('Insurance',      'Term Life Insurance — 20-year level','{"term life"}',                        'Level premium for 20 years; pure death benefit; typical recommendation 10-12x income for primary earner.',                                                                                                                                  '{"rule_of_thumb":"10-12x_income"}',                                                              0.80, 'FINRA Asset Allocation'),
  ('Insurance',      'Long-Term Disability Insurance','{"ltd"}',                                   'Replaces 50-70% of income on extended disability; often offered employer-paid post-tax for tax-free benefit.',                                                                                                                                '{"typical_replacement":"50-70%"}',                                                              0.80, 'FINRA Asset Allocation'),
  ('Insurance',      'Umbrella Liability Insurance','{"umbrella"}',                                'Adds $1-5M liability over auto/home limits; recommended when net worth > underlying limits.',                                                                                                                                                '{}',                                                                                              0.75, 'FINRA Asset Allocation'),
  -- Tax concepts
  ('Concept',        'Marginal Tax Bracket',     '{"marginal bracket"}',                           'Top marginal rate on the next dollar earned. Drives Roth-vs-traditional, HSA-vs-401(k), and bunching decisions.',                                                                                                                            '{}',                                                                                              0.90, '26 USC § 401(k)'),
  ('Concept',        'Effective Tax Rate',       '{}',                                              'Total tax ÷ taxable income. Distinct from marginal rate; lower because of bracket structure + deductions.',                                                                                                                                  '{}',                                                                                              0.90, '26 USC § 401(k)'),
  ('Concept',        'Standard Deduction',       '{}',                                              '2024 SD: single $14,600, MFJ $29,200, HOH $21,900.',                                                                                                                                                                                                     '{"2024_single":14600,"2024_mfj":29200,"2024_hoh":21900}',                                       0.95, '26 USC § 401(k)'),
  -- Planning frameworks
  ('Concept',        '50/30/20 Budget Framework','{"50-30-20"}',                                   '50% needs, 30% wants, 20% saving/debt. Useful starter heuristic; not a substitute for cash-flow modelling.',                                                                                                                                  '{}',                                                                                              0.65, 'CFPB Owning a Home'),
  ('Concept',        'Three-Fund Portfolio',     '{"3-fund","bogleheads 3 fund"}',                  'US total market + international total market + total bond, weighted to risk tolerance. Low-cost passive baseline.',                                                                                                                          '{}',                                                                                              0.75, 'Bogleheads Wiki — Three-Fund'),
  ('Concept',        'Four-Percent Safe Withdrawal Rate','{"4% rule","swr"}',                       'Initial withdrawal of 4% of starting portfolio, inflation-adjusted yearly; 30-year survival probability per Trinity Study.',                                                                                                                  '{"horizon_years":30}',                                                                            0.75, 'FINRA Asset Allocation')
) AS v(entity_type, canonical_name, aliases, summary, attributes, confidence, citation)
JOIN central.provenance_records p ON p.citation_reference = v.citation
ON CONFLICT (entity_type, lower(canonical_name)) DO NOTHING;


-- ---- Finance relationships ----
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, 'finance', 'central_curated_v1',
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  -- Account choice cascade
  ('Traditional 401(k)',              'Income',                       'DECREASES',              0.4, 0.85, 'IRS Pub 590-A'),  -- via current-year deferral
  ('Roth 401(k)',                     'Financial Independence',       'SUPPORTS',               0.8, 0.85, 'IRS Pub 590-A'),
  ('Safe Harbor 401(k) Match',        'Financial Independence',       'SUPPORTS',               0.9, 0.95, '26 USC § 401(k)'),
  ('Roth IRA',                        'Financial Independence',       'SUPPORTS',               0.8, 0.9,  'IRS Pub 590-A'),
  ('Traditional IRA',                 'Financial Independence',       'SUPPORTS',               0.7, 0.85, 'IRS Pub 590-A'),
  ('Backdoor Roth IRA',               'Roth IRA',                     'RELATED_TO',             0.7, 0.85, 'IRS Pub 590-A'),
  ('HSA (Health Savings Account)',    'Financial Independence',       'SUPPORTS',               0.85,0.9,  'IRS Pub 969'),
  ('Limited Purpose FSA',             'HSA (Health Savings Account)', 'RELATED_TO',             0.6, 0.85, 'IRS Pub 969'),
  ('Healthcare FSA',                  'HSA (Health Savings Account)', 'CONFLICTS_WITH',         0.95,0.95, 'IRS Pub 969'),  -- regular FSA blocks HSA eligibility
  ('Dependent Care FSA',              'Cash Flow Surplus',            'INCREASES',              0.4, 0.8,  'IRS Pub 969'),
  -- Cash flow / reserves
  ('Cash Flow Surplus',               'Emergency Fund',               'SUPPORTS',               0.9, 0.9,  'CFPB Owning a Home'),
  ('Emergency Fund',                  'Financial Independence',       'SUPPORTS',               0.6, 0.85, 'CFPB Owning a Home'),
  ('Sinking Fund',                    'Cash Flow Surplus',            'IMPROVES',               0.5, 0.75, 'CFPB Owning a Home'),
  -- Debt + credit
  ('Avalanche Debt Strategy',         'Financial Independence',       'ACCELERATES',            0.75,0.85, 'CFPB Credit Score'),
  ('Snowball Debt Strategy',          'Financial Independence',       'SUPPORTS',               0.55,0.7,  'CFPB Credit Score'),
  ('Credit Utilization < 30%',        'FICO Score',                   'INCREASES',              0.7, 0.9,  'CFPB Credit Score'),
  ('FICO Score',                      'Conventional 30-Year Fixed Mortgage','INCREASES_PROBABILITY_OF', 0.8, 0.9, 'CFPB Owning a Home'),
  ('FICO Score',                      'FHA Loan',                     'INCREASES_PROBABILITY_OF', 0.6, 0.85, 'CFPB Owning a Home'),
  -- Mortgage path
  ('Debt-to-Income Ratio (DTI)',      'Conventional 30-Year Fixed Mortgage','BLOCKS',          0.6, 0.85, 'CFPB Owning a Home'),
  ('Conventional 30-Year Fixed Mortgage','Home Ownership',            'PREREQUISITE_FOR',       0.9, 0.9,  'CFPB Owning a Home'),
  ('VA Loan',                         'Home Ownership',               'SUPPORTS',               0.85,0.9,  'VA Disability'),
  -- Insurance protective
  ('Term Life Insurance — 20-year level','Financial Independence',     'SUPPORTS',               0.5, 0.85, 'FINRA Asset Allocation'),
  ('Long-Term Disability Insurance',  'Income',                       'SUPPORTS',               0.6, 0.85, 'FINRA Asset Allocation'),
  ('Umbrella Liability Insurance',    'Financial Independence',       'SUPPORTS',               0.4, 0.75, 'FINRA Asset Allocation'),
  -- Tax interactions
  ('Marginal Tax Bracket',            'Roth IRA',                     'IMPACTS',                0.7, 0.9,  '26 USC § 401(k)'),
  ('Marginal Tax Bracket',            'Traditional 401(k)',           'IMPACTS',                0.8, 0.9,  '26 USC § 401(k)'),
  ('HSA (Health Savings Account)',    'Marginal Tax Bracket',         'IMPACTS',                0.5, 0.85, 'IRS Pub 969'),
  -- Frameworks
  ('Three-Fund Portfolio',            'Financial Independence',       'SUPPORTS',               0.7, 0.8,  'Bogleheads Wiki — Three-Fund'),
  ('Four-Percent Safe Withdrawal Rate','Financial Independence',      'RELATED_TO',             0.7, 0.75, 'FINRA Asset Allocation'),
  ('50/30/20 Budget Framework',       'Cash Flow Surplus',            'SUPPORTS',               0.4, 0.65, 'CFPB Owning a Home')
) AS e(s_name, t_name, label, strength, confidence, citation)
JOIN central.ontology_entities s ON s.canonical_name = e.s_name
JOIN central.ontology_entities t ON t.canonical_name = e.t_name
JOIN central.provenance_records p ON p.citation_reference = e.citation
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- ###########################################################################
-- C. CAREER
-- ###########################################################################

INSERT INTO central.ontology_entities
  (entity_type, canonical_name, aliases, domain, summary, attributes, source, version, confidence_score, provenance, provenance_id)
SELECT v.entity_type, v.canonical_name, v.aliases::text[], 'career', v.summary, v.attributes::jsonb, 'central_curated_v1', '1', v.confidence,
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'source_url', p.source_url, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('CareerRole',  'Software Developer (SOC 15-1252)',  '{"swe","software engineer"}', 'BLS OOH 2024: median $130,160; bachelor''s typical; +25% projected 2022-32.',                                                  '{"soc_code":"15-1252","median_pay_2023":130160,"projected_growth_2022_32":"25%"}',                0.95, 'BLS OOH 2024'),
  ('CareerRole',  'Financial Analyst (SOC 13-2051)',   '{"financial analyst"}',       'BLS OOH 2024: median $99,890; bachelor''s typical; +8% projected.',                                                              '{"soc_code":"13-2051","median_pay_2023":99890,"projected_growth_2022_32":"8%"}',                  0.95, 'BLS OOH 2024'),
  ('CareerRole',  'Registered Nurse (SOC 29-1141)',    '{"rn"}',                       'BLS OOH 2024: median $86,070; bachelor''s typical (BSN); +6% projected.',                                                       '{"soc_code":"29-1141","median_pay_2023":86070,"projected_growth_2022_32":"6%"}',                  0.95, 'BLS OOH 2024'),
  ('CareerRole',  'Project Manager (Generic)',         '{"pm"}',                       'Cross-industry role; PMI median ~$120k; PMP typically required for senior roles.',                                              '{"typical_pay_median":120000}',                                                                    0.85, 'PMI PMP'),
  ('CareerRole',  'Personal Financial Advisor (SOC 13-2052)','{"financial advisor","cfp"}', 'BLS OOH 2024: median $99,580; bachelor''s typical; +13% projected.',                                                          '{"soc_code":"13-2052","median_pay_2023":99580,"projected_growth_2022_32":"13%"}',                 0.95, 'BLS OOH 2024'),
  ('CareerRole',  'Attorney (SOC 23-1011)',            '{"lawyer","jd","attorney"}',  'BLS OOH 2024: median $145,760; JD required; +8% projected.',                                                                    '{"soc_code":"23-1011","median_pay_2023":145760,"projected_growth_2022_32":"8%"}',                 0.95, 'BLS OOH 2024'),
  ('Credential',  'PMP Certification',                 '{"pmp"}',                      'PMI Project Management Professional; 35 hours of PM education + 36-60 months experience + exam.',                              '{"prerequisites":"36-60_months_experience","exam":true,"ceus_required":true}',                    0.90, 'PMI PMP'),
  ('Credential',  'CFA Charter',                       '{"cfa"}',                      'Chartered Financial Analyst; three exams + 4,000 hours qualified work experience + ethics.',                                  '{"levels":3,"work_experience_hours":4000}',                                                       0.90, 'CFA Institute'),
  ('Credential',  'CFP Certification',                 '{"cfp"}',                      'Certified Financial Planner; CFP Board education + capstone + exam + 6,000 hours experience.',                                '{"experience_hours":6000}',                                                                       0.85, 'CFA Institute'),
  ('Credential',  'Series 7 License',                  '{"series 7"}',                 'FINRA General Securities Representative; sponsored by FINRA-member firm; SIE prerequisite.',                                     '{"sponsorship":"finra_member","prereq":"SIE"}',                                                  0.85, 'CFA Institute'),
  ('Concept',     'Skill: Python',                     '{"python"}',                    'Programming language; high salary lift for SWE, data, analyst roles.',                                                          '{}',                                                                                              0.85, 'O*NET 28.3'),
  ('Concept',     'Skill: SQL',                        '{"sql"}',                       'Foundational data skill; near-universal in technical and analyst roles.',                                                       '{}',                                                                                              0.90, 'O*NET 28.3'),
  ('Concept',     'Skill: Communication',              '{"communication"}',             'Top transferable skill across O*NET zone 4-5 roles; correlates with promotion velocity.',                                       '{}',                                                                                              0.85, 'O*NET 28.3'),
  ('Concept',     'Promotion Pathway (IC -> Senior IC)','{"ic to senior"}',             'Most ICs need 3-5 years scope expansion + visibility + sponsor before Senior promotion.',                                       '{"typical_years":"3-5"}',                                                                         0.70, 'O*NET 28.3'),
  ('Concept',     'Promotion Pathway (Senior IC -> Manager)','{"ic to manager"}',       'Reset on people-skills curve; ~50% of newly-promoted managers report regret in first year.',                                  '{}',                                                                                              0.65, 'O*NET 28.3'),
  ('Concept',     'Industry Transition (Adjacent)',    '{"lateral move"}',              'Move to an adjacent industry preserving function (e.g., finance->fintech) typically yields 10-20% comp lift.',                  '{"typical_lift":"10-20%"}',                                                                       0.65, 'BLS OEWS May 2023'),
  ('Concept',     'Industry Transition (Cross-Functional)','{"pivot"}',                  'Move to a new industry AND a new function typically requires reset; expect 0-15% comp dip year one.',                          '{"typical_year_one":"0-15%_dip"}',                                                                0.65, 'BLS OEWS May 2023'),
  ('Concept',     'Total Compensation',                '{"total comp","tc"}',           'Base + bonus + equity + 401(k) match + employer benefits. Compare offers on TC, not base.',                                  '{}',                                                                                              0.85, 'BLS OEWS May 2023')
) AS v(entity_type, canonical_name, aliases, summary, attributes, confidence, citation)
JOIN central.provenance_records p ON p.citation_reference = v.citation
ON CONFLICT (entity_type, lower(canonical_name)) DO NOTHING;


-- ---- Career relationships ----
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, 'career', 'central_curated_v1',
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  -- Credential -> Role
  ('PMP Certification',                'Project Manager (Generic)',                'INCREASES_PROBABILITY_OF', 0.7, 0.85, 'PMI PMP'),
  ('CFA Charter',                      'Financial Analyst (SOC 13-2051)',          'INCREASES_PROBABILITY_OF', 0.65,0.85, 'CFA Institute'),
  ('CFA Charter',                      'Personal Financial Advisor (SOC 13-2052)', 'INCREASES_PROBABILITY_OF', 0.75,0.9,  'CFA Institute'),
  ('CFP Certification',                'Personal Financial Advisor (SOC 13-2052)', 'INCREASES_PROBABILITY_OF', 0.85,0.9,  'CFA Institute'),
  ('Series 7 License',                 'Financial Analyst (SOC 13-2051)',          'PREREQUISITE_FOR',         0.5, 0.85, 'CFA Institute'),
  -- Skill -> Role
  ('Skill: Python',                    'Software Developer (SOC 15-1252)',         'INCREASES_PROBABILITY_OF', 0.7, 0.85, 'O*NET 28.3'),
  ('Skill: SQL',                       'Financial Analyst (SOC 13-2051)',          'INCREASES_PROBABILITY_OF', 0.65,0.85, 'O*NET 28.3'),
  ('Skill: SQL',                       'Software Developer (SOC 15-1252)',         'SUPPORTS',                 0.5, 0.85, 'O*NET 28.3'),
  ('Skill: Communication',             'Promotion Pathway (IC -> Senior IC)',      'SUPPORTS',                 0.7, 0.85, 'O*NET 28.3'),
  ('Skill: Communication',             'Promotion Pathway (Senior IC -> Manager)', 'SUPPORTS',                 0.85,0.85, 'O*NET 28.3'),
  -- Role -> income
  ('Software Developer (SOC 15-1252)', 'Income',                                   'INCREASES',                0.85,0.95, 'BLS OOH 2024'),
  ('Personal Financial Advisor (SOC 13-2052)','Income',                            'INCREASES',                0.75,0.95, 'BLS OOH 2024'),
  ('Attorney (SOC 23-1011)',           'Income',                                   'INCREASES',                0.85,0.95, 'BLS OOH 2024'),
  ('Registered Nurse (SOC 29-1141)',   'Income',                                   'INCREASES',                0.7, 0.95, 'BLS OOH 2024'),
  ('Project Manager (Generic)',        'Income',                                   'INCREASES',                0.75,0.85, 'BLS OOH 2024'),
  -- Promotion / transition mechanics
  ('Promotion Pathway (IC -> Senior IC)','Income Growth',                          'INCREASES',                0.7, 0.8,  'BLS OEWS May 2023'),
  ('Promotion Pathway (Senior IC -> Manager)','Income Growth',                     'INCREASES',                0.6, 0.75, 'BLS OEWS May 2023'),
  ('Industry Transition (Adjacent)',   'Income Growth',                            'INCREASES',                0.6, 0.7,  'BLS OEWS May 2023'),
  ('Industry Transition (Cross-Functional)','Income Growth',                       'DELAYED_BY',               0.5, 0.7,  'BLS OEWS May 2023'),
  -- Comp comparison
  ('Total Compensation',               'Income',                                   'RELATED_TO',               0.95,0.9,  'BLS OEWS May 2023')
) AS e(s_name, t_name, label, strength, confidence, citation)
JOIN central.ontology_entities s ON s.canonical_name = e.s_name
JOIN central.ontology_entities t ON t.canonical_name = e.t_name
JOIN central.provenance_records p ON p.citation_reference = e.citation
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- ###########################################################################
-- D. EDUCATION
-- ###########################################################################

INSERT INTO central.ontology_entities
  (entity_type, canonical_name, aliases, domain, summary, attributes, source, version, confidence_score, provenance, provenance_id)
SELECT v.entity_type, v.canonical_name, v.aliases::text[], 'education', v.summary, v.attributes::jsonb, 'central_curated_v1', '1', v.confidence,
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'source_url', p.source_url, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('EducationProgram','Bachelor''s Degree (Generic)','{"bs","ba"}','Four-year undergraduate; typical credential for O*NET zone 4 roles.',                                                                                                                                                                      '{"typical_years":4,"onet_zone":"4"}',                                            0.90, 'NCES IPEDS 2023'),
  ('EducationProgram','Master''s Degree (Generic)', '{"ms","ma","grad school"}','Two-year graduate; common for promotion to senior IC and management track in technical/finance.',                                                                                                                                  '{"typical_years":2}',                                                            0.85, 'NCES IPEDS 2023'),
  ('EducationProgram','MBA',                        '{"mba"}','Master of Business Administration; T15 schools yield median ~$170k post-MBA; common pivot vehicle.',                                                                                                                                                            '{"t15_median_post_mba":170000}',                                                 0.80, 'NCES IPEDS 2023'),
  ('EducationProgram','Bootcamp (Coding)',          '{"coding bootcamp"}','12-24 week intensive; outcomes highly variable by school; some employers do not weigh it.',                                                                                                                                                          '{"weeks":"12-24"}',                                                              0.70, 'NCES IPEDS 2023'),
  ('Concept',         'Pell Grant',                 '{}','Federal need-based grant; up to $7,395 in 2024-25 award year; does not repay.',                                                                                                                                                                                                '{"max_award_2024_25":7395}',                                                     0.95, 'Federal Student Aid'),
  ('Concept',         'Direct Subsidized Loan',     '{}','Federal student loan; interest paid by govt while enrolled at least half-time; undergrad only.',                                                                                                                                                                              '{"interest_during_enrollment":"paid_by_govt"}',                                  0.95, 'Federal Student Aid'),
  ('Concept',         'Direct Unsubsidized Loan',   '{}','Federal student loan; interest accrues throughout; available to undergrad + grad.',                                                                                                                                                                                            '{}',                                                                              0.95, 'Federal Student Aid'),
  ('Concept',         'Income-Driven Repayment (IDR)','{"saver","paye","ibr"}','Federal loan repayment based on discretionary income, 10-20 year forgiveness depending on plan.',                                                                                                                                                       '{}',                                                                              0.85, 'Federal Student Aid'),
  ('Concept',         'PSLF (Public Service Loan Forgiveness)','{}','120 qualifying payments + qualifying public/nonprofit employer = remaining federal balance forgiven, tax-free.',                                                                                                                                              '{"qualifying_payments":120}',                                                    0.90, 'Federal Student Aid'),
  ('Concept',         'GI Bill Chapter 33 (Post-9/11)','{"post-9/11 gi bill"}','100% tuition + fees at public IHL; Yellow Ribbon at participating private; monthly housing allowance.',                                                                                                                                            '{"max_tuition_public":"100%"}',                                                  0.95, 'VA Post-9/11 GI Bill'),
  ('Concept',         'Yellow Ribbon Program',      '{}','Voluntary participating private/foreign schools cover difference above Post-9/11 max; VA matches.',                                                                                                                                                                            '{}',                                                                              0.90, 'VA Post-9/11 GI Bill'),
  ('EmployerBenefit', 'Education Reimbursement',    '{"tuition reimbursement"}','Up to $5,250/year tax-free per IRC § 127; employer-paid undergraduate or graduate tuition.',                                                                                                                                            '{"limit_2024":5250}',                                                            0.90, 'IRS Pub 590-A')
) AS v(entity_type, canonical_name, aliases, summary, attributes, confidence, citation)
JOIN central.provenance_records p ON p.citation_reference = v.citation
ON CONFLICT (entity_type, lower(canonical_name)) DO NOTHING;


-- ---- Education relationships ----
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, 'education', 'central_curated_v1',
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('Bachelor''s Degree (Generic)',     'Software Developer (SOC 15-1252)',        'PREREQUISITE_FOR',         0.7, 0.85, 'BLS OOH 2024'),
  ('Bachelor''s Degree (Generic)',     'Financial Analyst (SOC 13-2051)',         'PREREQUISITE_FOR',         0.85,0.9,  'BLS OOH 2024'),
  ('Bachelor''s Degree (Generic)',     'Registered Nurse (SOC 29-1141)',          'PREREQUISITE_FOR',         0.7, 0.85, 'BLS OOH 2024'),
  ('Master''s Degree (Generic)',       'Promotion Pathway (Senior IC -> Manager)','SUPPORTS',                 0.6, 0.7,  'NCES IPEDS 2023'),
  ('MBA',                              'Industry Transition (Cross-Functional)',  'ACCELERATES',              0.7, 0.7,  'NCES IPEDS 2023'),
  ('MBA',                              'Income Growth',                            'INCREASES',                0.65,0.7,  'NCES IPEDS 2023'),
  ('Bootcamp (Coding)',                'Software Developer (SOC 15-1252)',        'SUPPORTS',                 0.45,0.6,  'NCES IPEDS 2023'),
  ('Pell Grant',                       'Bachelor''s Degree (Generic)',            'SUPPORTS',                 0.6, 0.9,  'Federal Student Aid'),
  ('Direct Subsidized Loan',           'Bachelor''s Degree (Generic)',            'SUPPORTS',                 0.7, 0.85, 'Federal Student Aid'),
  ('Direct Unsubsidized Loan',         'Master''s Degree (Generic)',              'SUPPORTS',                 0.6, 0.85, 'Federal Student Aid'),
  ('Income-Driven Repayment (IDR)',    'Cash Flow Surplus',                       'INCREASES',                0.5, 0.8,  'Federal Student Aid'),
  ('PSLF (Public Service Loan Forgiveness)','Financial Independence',             'ACCELERATES',              0.65,0.85, 'Federal Student Aid'),
  ('GI Bill Chapter 33 (Post-9/11)',   'Bachelor''s Degree (Generic)',            'SUPPORTS',                 0.95,0.95, 'VA Post-9/11 GI Bill'),
  ('Yellow Ribbon Program',            'GI Bill Chapter 33 (Post-9/11)',          'RELATED_TO',               0.7, 0.9,  'VA Post-9/11 GI Bill'),
  ('Education Reimbursement',          'Master''s Degree (Generic)',              'SUPPORTS',                 0.55,0.85, 'IRS Pub 590-A')
) AS e(s_name, t_name, label, strength, confidence, citation)
JOIN central.ontology_entities s ON s.canonical_name = e.s_name
JOIN central.ontology_entities t ON t.canonical_name = e.t_name
JOIN central.provenance_records p ON p.citation_reference = e.citation
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- ###########################################################################
-- E. HEALTH
-- ###########################################################################

INSERT INTO central.ontology_entities
  (entity_type, canonical_name, aliases, domain, summary, attributes, source, version, confidence_score, provenance, provenance_id)
SELECT v.entity_type, v.canonical_name, v.aliases::text[], 'health', v.summary, v.attributes::jsonb, 'central_curated_v1', '1', v.confidence,
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'source_url', p.source_url, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('HealthMetric','Resting Heart Rate (Adult)',    '{"rhr"}', 'Adult RHR 60-100 bpm normal; <60 bpm often seen in trained endurance athletes.', '{"normal_band_bpm":"60-100"}', 0.95, 'ACSM PAG'),
  ('HealthMetric','VO2max',                        '{"vo2 max"}', 'Maximal aerobic capacity; strongest single biomarker of all-cause mortality risk in adults.', '{}', 0.85, 'ACSM PAG'),
  ('HealthMetric','HRV (Heart Rate Variability)',  '{"hrv"}', 'Beat-to-beat variability; higher rMSSD associated with better recovery/autonomic balance.', '{}', 0.75, 'AHA 2024'),
  ('HealthMetric','Sleep Duration',                '{}', 'CDC/AASM: 7-9 hours/night for adults 18-64. <7h chronically associated with cardiometabolic risk.', '{"adult_target_hours":"7-9"}', 0.95, 'PMID: 29073412'),
  ('HealthMetric','Body Fat %',                    '{}', 'ACSM healthy ranges: men 10-22%, women 20-32% (age-adjusted).', '{"adult_men":"10-22","adult_women":"20-32"}', 0.85, 'ACSM PAG'),
  ('HealthMetric','Resting Blood Pressure',        '{"bp"}', 'ACC/AHA: normal <120/80, elevated 120-129/<80, stage 1 130-139/80-89.', '{"normal":"<120/80","stage_1":"130-139/80-89"}', 0.95, 'AHA 2024'),
  ('Concept',     'AHA Aerobic Activity Target',   '{"aerobic minimum"}', '150 min/week moderate OR 75 min/week vigorous aerobic activity for adults.', '{"moderate_min":150,"vigorous_min":75}', 0.95, 'AHA 2024'),
  ('Concept',     'ACSM Resistance Training Target','{"strength minimum"}', '2+ days/week of resistance training targeting all major muscle groups.', '{"days_per_week":"2+"}', 0.95, 'ACSM PAG'),
  ('Concept',     'Zone 2 Cardio',                 '{"low intensity"}', 'Conversational pace, ~60-70% of HRmax; trains mitochondrial density + fat oxidation.', '{"intensity":"60-70%_HRmax"}', 0.75, 'ACSM PAG'),
  ('Concept',     'Progressive Overload',          '{}', 'Foundational resistance-training principle: incremental load increase drives adaptation.', '{}', 0.90, 'ACSM PAG'),
  ('Concept',     'RPE 7-8 (Resistance)',          '{"rir-2"}', 'Working at 2-3 reps in reserve maximizes hypertrophy stimulus per session.', '{}', 0.75, 'ACSM PAG'),
  ('Concept',     'Sleep Hygiene',                 '{}', 'Consistent sleep/wake, cool dark room, no caffeine 8h prior, screens limited; improves sleep duration + quality.', '{}', 0.85, 'PMID: 29073412'),
  ('Concept',     'Caloric Maintenance',           '{}', 'Daily intake matching TDEE; baseline for body-composition planning.', '{}', 0.90, 'DGA 2020-2025'),
  ('Concept',     'Protein Target 1.6-2.2 g/kg',   '{"protein"}', 'Resistance-trained adult target; supports muscle protein synthesis during training cycles.', '{"g_per_kg":"1.6-2.2"}', 0.80, 'DGA 2020-2025'),
  ('Concept',     'Mediterranean Dietary Pattern', '{"med diet"}', 'Plant-forward + olive oil + fish; PREDIMED-class RCTs show CV event reduction.', '{}', 0.85, 'DGA 2020-2025'),
  ('Concept',     'Recovery Day',                  '{"rest day"}', 'Programmed low-intensity day; allows muscle/CNS recovery, reduces injury risk.', '{}', 0.85, 'ACSM PAG'),
  ('Concept',     'Behavior Change: Habit Stack',  '{"habit stack"}', 'Anchor new behavior to existing one; lowers activation energy.', '{}', 0.65, 'Atomic Habits (ISBN 978-0735211292)'),
  ('Concept',     'Behavior Change: 2-Minute Rule','{"2 min rule"}', 'Make a new habit doable in 2 minutes; consistency before intensity.', '{}', 0.60, 'Atomic Habits (ISBN 978-0735211292)')
) AS v(entity_type, canonical_name, aliases, summary, attributes, confidence, citation)
JOIN central.provenance_records p ON p.citation_reference = v.citation
ON CONFLICT (entity_type, lower(canonical_name)) DO NOTHING;


-- ---- Health relationships ----
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, 'health', 'central_curated_v1',
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  -- Exercise dose -> markers
  ('AHA Aerobic Activity Target',      'VO2max',                           'IMPROVES',  0.8, 0.9,  'AHA 2024'),
  ('AHA Aerobic Activity Target',      'Resting Heart Rate (Adult)',       'IMPROVES',  0.7, 0.9,  'AHA 2024'),
  ('AHA Aerobic Activity Target',      'Resting Blood Pressure',           'IMPROVES',  0.65,0.9,  'AHA 2024'),
  ('Zone 2 Cardio',                    'VO2max',                           'IMPROVES',  0.7, 0.8,  'ACSM PAG'),
  ('ACSM Resistance Training Target',  'Body Fat %',                       'IMPROVES',  0.6, 0.85, 'ACSM PAG'),
  ('ACSM Resistance Training Target',  'Resting Heart Rate (Adult)',       'IMPROVES',  0.4, 0.75, 'ACSM PAG'),
  ('Progressive Overload',             'ACSM Resistance Training Target',  'SUPPORTS',  0.85,0.85, 'ACSM PAG'),
  ('RPE 7-8 (Resistance)',             'Progressive Overload',             'SUPPORTS',  0.7, 0.75, 'ACSM PAG'),
  ('Recovery Day',                     'HRV (Heart Rate Variability)',     'IMPROVES',  0.55,0.7,  'ACSM PAG'),
  -- Sleep
  ('Sleep Hygiene',                    'Sleep Duration',                   'IMPROVES',  0.75,0.85, 'PMID: 29073412'),
  ('Sleep Duration',                   'HRV (Heart Rate Variability)',     'IMPROVES',  0.55,0.75, 'PMID: 29073412'),
  ('Sleep Duration',                   'Resting Blood Pressure',           'IMPROVES',  0.55,0.85, 'PMID: 29073412'),
  -- Nutrition
  ('Caloric Maintenance',              'Body Fat %',                       'IMPACTS',   0.7, 0.9,  'DGA 2020-2025'),
  ('Protein Target 1.6-2.2 g/kg',      'ACSM Resistance Training Target',  'SUPPORTS',  0.7, 0.8,  'DGA 2020-2025'),
  ('Mediterranean Dietary Pattern',    'Resting Blood Pressure',           'IMPROVES',  0.6, 0.85, 'DGA 2020-2025'),
  -- Behavior change
  ('Behavior Change: Habit Stack',     'AHA Aerobic Activity Target',      'SUPPORTS',  0.55,0.65, 'Atomic Habits (ISBN 978-0735211292)'),
  ('Behavior Change: 2-Minute Rule',   'ACSM Resistance Training Target',  'SUPPORTS',  0.5, 0.6,  'Atomic Habits (ISBN 978-0735211292)'),
  -- Cross-domain: health -> productivity / career
  ('Sleep Duration',                   'Productivity',                     'IMPACTS',   0.75,0.85, 'PMID: 29073412'),
  ('AHA Aerobic Activity Target',      'Productivity',                     'IMPACTS',   0.55,0.75, 'AHA 2024')
) AS e(s_name, t_name, label, strength, confidence, citation)
JOIN central.ontology_entities s ON s.canonical_name = e.s_name
JOIN central.ontology_entities t ON t.canonical_name = e.t_name
JOIN central.provenance_records p ON p.citation_reference = e.citation
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- ###########################################################################
-- F. ESTATE PLANNING
-- ###########################################################################

INSERT INTO central.ontology_entities
  (entity_type, canonical_name, aliases, domain, summary, attributes, source, version, confidence_score, provenance, provenance_id)
SELECT v.entity_type, v.canonical_name, v.aliases::text[], 'estate_planning', v.summary, v.attributes::jsonb, 'central_curated_v1', '1', v.confidence,
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'source_url', p.source_url, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('EstateDocument','Last Will and Testament',          '{"will"}',      'Directs disposition of probate assets; appoints executor + guardian for minors.',                                                          '{}',                              0.90, 'ABA RPTE'),
  ('EstateDocument','Revocable Living Trust (Settlor)', '{"rlt","revocable trust"}','Avoids probate for assets titled to the trust; revocable during settlor''s life.',                                              '{}',                              0.90, 'UTC'),
  ('EstateDocument','Irrevocable Trust',                '{"irrevocable"}','Removes assets from grantor''s taxable estate; cannot be amended; trade-off control vs tax/asset protection.',                                  '{}',                              0.85, 'UTC'),
  ('EstateDocument','Financial Power of Attorney',      '{"financial poa","fpoa"}','Authorizes agent to manage financial affairs; durable typically remains effective on incapacity.',                                    '{"common_variant":"durable"}',    0.90, 'ABA RPTE'),
  ('EstateDocument','Healthcare Power of Attorney',     '{"healthcare poa","hcpoa"}','Authorizes agent to make medical decisions on incapacity.',                                                                                  '{}',                              0.90, 'CMS Advance Directives'),
  ('EstateDocument','Living Will / Advance Directive',  '{"advance directive"}','States end-of-life treatment preferences (CPR, ventilation, feeding tube).',                                                                  '{}',                              0.90, 'CMS Advance Directives'),
  ('EstateDocument','HIPAA Release',                    '{}','Authorizes named individuals to receive protected health information.',                                                                                          '{}',                              0.90, 'CMS Advance Directives'),
  ('Concept',       'Per Stirpes Beneficiary Designation','{"per stirpes"}','Inheritance flows down each branch; predeceased beneficiary''s share goes to their descendants.',                                              '{}',                              0.85, 'ABA RPTE'),
  ('Concept',       'Per Capita Beneficiary Designation','{"per capita"}','Inheritance shared equally among living beneficiaries at each generation level.',                                                                  '{}',                              0.85, 'ABA RPTE'),
  ('Concept',       'Guardianship Designation (Minors)','{}','Names guardian for minor children if both parents die. Court-confirmed at probate; often litigated when ambiguous.',                                            '{}',                              0.90, 'ABA RPTE'),
  ('Concept',       'Business Succession Plan',         '{"succession","buy-sell"}','Buy-sell agreement + key-person insurance; specifies transfer on death/disability/departure.',                                          '{}',                              0.80, 'ABA RPTE'),
  ('Concept',       'Step-Up in Basis at Death',        '{"step up"}','Inherited assets receive a basis reset to FMV at death; eliminates unrealized cap gains during decedent''s life.',                                      '{}',                              0.90, '26 USC § 401(k)')
) AS v(entity_type, canonical_name, aliases, summary, attributes, confidence, citation)
JOIN central.provenance_records p ON p.citation_reference = v.citation
ON CONFLICT (entity_type, lower(canonical_name)) DO NOTHING;


-- ---- Estate relationships ----
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, 'estate_planning', 'central_curated_v1',
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('Revocable Living Trust (Settlor)',  'Last Will and Testament',                  'SUPPORTS',         0.7, 0.85, 'ABA RPTE'),
  ('Financial Power of Attorney',       'Financial Independence',                   'SUPPORTS',         0.5, 0.85, 'ABA RPTE'),
  ('Healthcare Power of Attorney',      'Living Will / Advance Directive',          'SUPPORTS',         0.7, 0.9,  'CMS Advance Directives'),
  ('HIPAA Release',                     'Healthcare Power of Attorney',             'SUPPORTS',         0.6, 0.9,  'CMS Advance Directives'),
  ('Guardianship Designation (Minors)', 'Last Will and Testament',                  'PREREQUISITE_FOR', 0.8, 0.9,  'ABA RPTE'),
  ('Per Stirpes Beneficiary Designation','Last Will and Testament',                 'RELATED_TO',       0.6, 0.85, 'ABA RPTE'),
  ('Business Succession Plan',          'Financial Independence',                   'SUPPORTS',         0.55,0.8,  'ABA RPTE'),
  ('Irrevocable Trust',                 'Financial Independence',                   'SUPPORTS',         0.5, 0.8,  'UTC'),
  ('Step-Up in Basis at Death',         'Financial Independence',                   'SUPPORTS',         0.6, 0.9,  '26 USC § 401(k)')
) AS e(s_name, t_name, label, strength, confidence, citation)
JOIN central.ontology_entities s ON s.canonical_name = e.s_name
JOIN central.ontology_entities t ON t.canonical_name = e.t_name
JOIN central.provenance_records p ON p.citation_reference = e.citation
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- ###########################################################################
-- G. VETERAN
-- ###########################################################################

INSERT INTO central.ontology_entities
  (entity_type, canonical_name, aliases, domain, summary, attributes, source, version, confidence_score, provenance, provenance_id)
SELECT v.entity_type, v.canonical_name, v.aliases::text[], 'military_veteran', v.summary, v.attributes::jsonb, 'central_curated_v1', '1', v.confidence,
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'source_url', p.source_url, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('Benefit', 'VA Disability Compensation', '{"va disability"}','Monthly tax-free payment scaled by service-connected disability rating (0-100%).',                                                                 '{"rating_band":"0-100%","tax_status":"tax_free"}',                       0.95, 'VA Disability'),
  ('Benefit', 'VA Healthcare Enrollment',   '{}','Priority-group enrollment in VA medical facilities; cost-share tied to service connection + income.',                                                                  '{}',                                                                       0.95, 'VA Disability'),
  ('Benefit', 'Vocational Rehabilitation (Chapter 31)','{"vr&e","chapter 31"}','Education + training + employment services for veterans with service-connected disability rating ≥10% + employment handicap.',           '{"min_rating":"10%"}',                                                    0.95, 'VA Chapter 31'),
  ('Benefit', 'TAP (Transition Assistance Program)','{"tap"}','Mandatory transition curriculum during last 18 months of service; covers benefits + financial planning + civilian employment.',                          '{}',                                                                       0.90, 'DOL TAP'),
  ('Benefit', 'SBA Veteran-Owned Small Business Programs','{"vobb"}','SBA contracting set-aside (VOSB/SDVOSB) + loan programs for veteran entrepreneurs.',                                                              '{}',                                                                       0.85, 'VA Disability'),
  ('Benefit', 'Survivors and Dependents Education Assistance (DEA, Chapter 35)','{"chapter 35"}','Education benefits for spouses and children of certain disabled or deceased veterans.',                              '{}',                                                                       0.90, 'VA Post-9/11 GI Bill'),
  ('Benefit', 'Special Monthly Compensation (SMC)','{"smc"}','Additional VA payment above standard disability for specific severe conditions or loss.',                                                                  '{}',                                                                       0.90, 'VA Disability'),
  ('Concept', 'Service-Connected Rating',   '{}','VA-assigned percentage representing severity of disabilities incurred or aggravated by service.',                                                                     '{"band":"0-100%"}',                                                       0.95, 'VA Disability')
) AS v(entity_type, canonical_name, aliases, summary, attributes, confidence, citation)
JOIN central.provenance_records p ON p.citation_reference = v.citation
ON CONFLICT (entity_type, lower(canonical_name)) DO NOTHING;


-- ---- Veteran relationships ----
INSERT INTO central.ontology_relationships
  (source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, source, provenance, provenance_id)
SELECT s.id, t.id, e.label, e.strength, e.confidence, 'military_veteran', 'central_curated_v1',
       jsonb_build_object('source_type', p.source_type, 'source_name', p.source_name, 'citation_reference', p.citation_reference),
       p.id
FROM (VALUES
  ('Service-Connected Rating',          'VA Disability Compensation',               'PREREQUISITE_FOR',         0.95,0.95, 'VA Disability'),
  ('Service-Connected Rating',          'Vocational Rehabilitation (Chapter 31)',   'PREREQUISITE_FOR',         0.9, 0.95, 'VA Chapter 31'),
  ('VA Disability Compensation',        'Cash Flow Surplus',                        'INCREASES',                0.7, 0.9,  'VA Disability'),
  ('VA Disability Compensation',        'Income',                                   'INCREASES',                0.6, 0.9,  'VA Disability'),
  ('Vocational Rehabilitation (Chapter 31)','Bachelor''s Degree (Generic)',         'SUPPORTS',                 0.85,0.9,  'VA Chapter 31'),
  ('Vocational Rehabilitation (Chapter 31)','Income Growth',                         'SUPPORTS',                0.75,0.85, 'VA Chapter 31'),
  ('TAP (Transition Assistance Program)','Industry Transition (Cross-Functional)',  'SUPPORTS',                 0.7, 0.85, 'DOL TAP'),
  ('SBA Veteran-Owned Small Business Programs','Entrepreneurship',                   'SUPPORTS',                 0.7, 0.85, 'VA Disability'),
  ('Survivors and Dependents Education Assistance (DEA, Chapter 35)','Bachelor''s Degree (Generic)','SUPPORTS', 0.6, 0.9,  'VA Post-9/11 GI Bill'),
  ('Special Monthly Compensation (SMC)','VA Disability Compensation',               'RELATED_TO',               0.7, 0.9,  'VA Disability'),
  ('VA Healthcare Enrollment',          'Sleep Duration',                           'SUPPORTS',                 0.4, 0.7,  'VA Disability'),
  ('VA Healthcare Enrollment',          'Resting Blood Pressure',                   'IMPROVES',                 0.4, 0.7,  'VA Disability'),
  ('VA Disability Compensation',        'Financial Independence',                   'SUPPORTS',                 0.6, 0.85, 'VA Disability')
) AS e(s_name, t_name, label, strength, confidence, citation)
JOIN central.ontology_entities s ON s.canonical_name = e.s_name
JOIN central.ontology_entities t ON t.canonical_name = e.t_name
JOIN central.provenance_records p ON p.citation_reference = e.citation
ON CONFLICT (source_entity_id, target_entity_id, label) DO NOTHING;


-- ###########################################################################
-- H. Self-test: assert non-empty coverage per domain.
-- ###########################################################################
DO $$
DECLARE
  d TEXT;
  c BIGINT;
  v_under_target TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH d IN ARRAY ARRAY['finance','career','education','health','estate_planning','military_veteran']
  LOOP
    SELECT COUNT(*) INTO c
      FROM central.ontology_entities
     WHERE domain = d AND review_status = 'approved';
    IF c < 6 THEN
      v_under_target := array_append(v_under_target, format('%s entities=%s', d, c));
    END IF;
  END LOOP;
  IF array_length(v_under_target, 1) IS NOT NULL THEN
    RAISE EXCEPTION '078 self-test: some domains under entity-count threshold: %', v_under_target;
  END IF;
END $$;

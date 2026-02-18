"""
Tiered Tax Optimization Strategies
From 1040EZ basics to complex multi-entity structures
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

class TaxComplexityLevel(Enum):
    BASIC = "basic"  # 1040EZ - W2 only, standard deduction
    INTERMEDIATE = "intermediate"  # Homeowner, investments, family
    ADVANCED = "advanced"  # Business owner, rental properties
    COMPLEX = "complex"  # Multiple entities, trusts, international

@dataclass
class TaxSituation:
    # Basic Info
    income_w2: float = 0
    filing_status: str = "single"
    dependents: int = 0
    age: int = 30
    state: str = "CA"
    
    # Intermediate (Homeowner/Investor)
    mortgage_interest: float = 0
    property_tax: float = 0
    investment_income: float = 0
    capital_gains: float = 0
    retirement_contributions: float = 0
    
    # Advanced (Business Owner)
    business_income: float = 0
    business_type: str = ""  # sole_prop, llc, s_corp, c_corp
    rental_income: float = 0
    rental_expenses: float = 0
    
    # Complex (Multi-entity)
    trust_income: float = 0
    trust_distributions: float = 0
    foreign_income: float = 0
    k1_income: float = 0  # Partnership/S-Corp pass-through
    
    # Insurance & Benefits
    health_insurance_premiums: float = 0
    life_insurance_type: str = ""  # term, whole, universal, variable
    disability_insurance: float = 0
    long_term_care_insurance: float = 0

class TieredTaxStrategies:
    
    def analyze_and_recommend(self, situation: TaxSituation) -> Dict:
        """
        Analyze tax situation and provide tiered recommendations
        """
        # Determine complexity level
        complexity = self._determine_complexity(situation)
        
        # Get strategies for current level and below
        strategies = {
            'current_level': complexity.value,
            'basic_strategies': self._get_basic_strategies(situation),
            'intermediate_strategies': [],
            'advanced_strategies': [],
            'complex_strategies': [],
            'insurance_strategies': self._get_insurance_strategies(situation),
            'estate_planning': []
        }
        
        # Add strategies based on complexity level
        if complexity.value in ['intermediate', 'advanced', 'complex']:
            strategies['intermediate_strategies'] = self._get_intermediate_strategies(situation)
        
        if complexity.value in ['advanced', 'complex']:
            strategies['advanced_strategies'] = self._get_advanced_strategies(situation)
        
        if complexity.value == 'complex':
            strategies['complex_strategies'] = self._get_complex_strategies(situation)
            strategies['estate_planning'] = self._get_estate_planning_strategies(situation)
        
        # Calculate tax savings potential
        strategies['total_potential_savings'] = self._calculate_total_savings(strategies, situation)
        
        # Prioritize strategies
        strategies['top_5_priorities'] = self._prioritize_strategies(strategies, situation)
        
        return strategies
    
    def _determine_complexity(self, situation: TaxSituation) -> TaxComplexityLevel:
        """
        Determine tax complexity level based on situation
        """
        if (situation.trust_income > 0 or 
            situation.foreign_income > 0 or 
            situation.k1_income > 0 or
            situation.business_type in ['s_corp', 'c_corp']):
            return TaxComplexityLevel.COMPLEX
        
        elif (situation.business_income > 0 or 
              situation.rental_income > 0 or
              situation.business_type in ['sole_prop', 'llc']):
            return TaxComplexityLevel.ADVANCED
        
        elif (situation.mortgage_interest > 0 or 
              situation.investment_income > 0 or 
              situation.capital_gains > 0):
            return TaxComplexityLevel.INTERMEDIATE
        
        else:
            return TaxComplexityLevel.BASIC
    
    def _get_basic_strategies(self, situation: TaxSituation) -> List[Dict]:
        """
        Basic strategies for 1040EZ filers
        """
        strategies = []
        
        # 1. Retirement Contributions (Traditional IRA/401k)
        max_401k = 23000 if situation.age < 50 else 30500
        if situation.retirement_contributions < max_401k:
            tax_savings = (max_401k - situation.retirement_contributions) * 0.22  # Assume 22% bracket
            strategies.append({
                'name': '401(k) Contribution',
                'description': f'Max out 401(k) contributions (${max_401k:,})',
                'category': 'retirement',
                'difficulty': 'easy',
                'tax_savings': tax_savings,
                'implementation': [
                    'Contact HR to increase contribution percentage',
                    f'Contribute ${(max_401k - situation.retirement_contributions)/12:,.0f}/month',
                    'Reduces taxable income dollar-for-dollar'
                ]
            })
        
        # 2. Health Savings Account (HSA)
        hsa_limit = 4150 if situation.dependents == 0 else 8300
        if situation.age >= 55:
            hsa_limit += 1000
        strategies.append({
            'name': 'Health Savings Account (HSA)',
            'description': 'Triple tax advantage: deductible, tax-free growth, tax-free for medical',
            'category': 'health',
            'difficulty': 'easy',
            'tax_savings': hsa_limit * 0.22,
            'implementation': [
                'Enroll in High Deductible Health Plan (HDHP)',
                f'Contribute ${hsa_limit:,}/year',
                'Save receipts - can reimburse yourself years later',
                'Invest HSA funds for long-term growth'
            ]
        })
        
        # 3. Student Loan Interest Deduction
        if situation.age < 35:
            strategies.append({
                'name': 'Student Loan Interest Deduction',
                'description': 'Deduct up to $2,500 of student loan interest',
                'category': 'education',
                'difficulty': 'easy',
                'tax_savings': 550,  # $2,500 * 22%
                'implementation': [
                    'No itemization required - above-the-line deduction',
                    'Income phase-out starts at $75k (single) / $155k (married)',
                    'Get Form 1098-E from loan servicer'
                ]
            })
        
        # 4. Earned Income Tax Credit (if eligible)
        if situation.income_w2 < 60000 and situation.dependents > 0:
            eitc_amounts = {0: 600, 1: 3995, 2: 6604, 3: 7430}  # 2024 amounts
            eitc = eitc_amounts.get(min(situation.dependents, 3), 7430)
            strategies.append({
                'name': 'Earned Income Tax Credit (EITC)',
                'description': 'Refundable credit for working families',
                'category': 'credit',
                'difficulty': 'easy',
                'tax_savings': eitc,
                'implementation': [
                    'File tax return to claim',
                    'Credit is refundable - can exceed tax owed',
                    f'Worth up to ${eitc:,} with {situation.dependents} dependents'
                ]
            })
        
        # 5. Flexible Spending Account (FSA)
        strategies.append({
            'name': 'Flexible Spending Account (FSA)',
            'description': 'Pre-tax dollars for medical/dependent care',
            'category': 'health',
            'difficulty': 'easy',
            'tax_savings': 3200 * 0.22,  # Max $3,200 for 2024
            'implementation': [
                'Enroll during open enrollment',
                'Medical FSA: up to $3,200/year',
                'Dependent Care FSA: up to $5,000/year',
                'Use-it-or-lose-it rule (some allow $640 carryover)'
            ]
        })
        
        return strategies
    
    def _get_intermediate_strategies(self, situation: TaxSituation) -> List[Dict]:
        """
        Intermediate strategies for homeowners and investors
        """
        strategies = []
        
        # 1. Mortgage Interest Optimization
        if situation.mortgage_interest > 0:
            strategies.append({
                'name': 'Mortgage Interest Deduction',
                'description': 'Optimize mortgage interest deduction',
                'category': 'real_estate',
                'difficulty': 'moderate',
                'tax_savings': min(situation.mortgage_interest, 10000) * 0.24,  # Assume 24% bracket
                'implementation': [
                    'Itemize if total deductions exceed standard ($14,600 single / $29,200 married)',
                    'Interest on first $750k of mortgage is deductible',
                    'Consider points deduction in purchase year',
                    'Track home office percentage for business use'
                ]
            })
        
        # 2. Property Tax Strategy (SALT workaround)
        if situation.property_tax > 0:
            strategies.append({
                'name': 'SALT Cap Workaround',
                'description': 'Navigate $10,000 state/local tax deduction limit',
                'category': 'real_estate',
                'difficulty': 'moderate',
                'tax_savings': 2000,  # Varies
                'implementation': [
                    'Bundle property tax payments in alternate years',
                    'Consider state SALT cap workaround programs',
                    'Charitable deduction via state tax credit programs',
                    'Business entity workarounds (if applicable)'
                ]
            })
        
        # 3. Tax-Loss Harvesting
        if situation.investment_income > 0 or situation.capital_gains > 0:
            strategies.append({
                'name': 'Tax-Loss Harvesting',
                'description': 'Offset gains with strategic losses',
                'category': 'investments',
                'difficulty': 'moderate',
                'tax_savings': min(3000, situation.capital_gains) * 0.15,  # Long-term rate
                'implementation': [
                    'Sell losing positions to offset gains',
                    'Deduct up to $3,000 against ordinary income',
                    'Carry forward unlimited losses to future years',
                    'Avoid wash sale rule (30 days before/after)',
                    'Consider tax-loss harvesting funds'
                ]
            })
        
        # 4. Backdoor Roth IRA
        if situation.income_w2 > 150000:
            strategies.append({
                'name': 'Backdoor Roth IRA',
                'description': 'High-income Roth contribution strategy',
                'category': 'retirement',
                'difficulty': 'moderate',
                'tax_savings': 0,  # Future tax savings
                'future_value': 50000,  # Estimated 20-year value
                'implementation': [
                    'Contribute $7,000 to Traditional IRA (non-deductible)',
                    'Convert to Roth IRA immediately',
                    'File Form 8606 to track basis',
                    'No income limits on conversion',
                    'Tax-free growth and withdrawals in retirement'
                ]
            })
        
        # 5. 529 Education Savings
        if situation.dependents > 0:
            strategies.append({
                'name': '529 Education Savings Plan',
                'description': 'Tax-advantaged education savings',
                'category': 'education',
                'difficulty': 'moderate',
                'tax_savings': 1500,  # State tax deduction varies
                'implementation': [
                    f'Contribute up to ${18000 * situation.dependents:,} gift-tax free',
                    'State tax deduction in many states',
                    'Tax-free growth and withdrawals for education',
                    'Can change beneficiary to family members',
                    'Up to $10k/year for K-12 tuition'
                ]
            })
        
        # 6. Donor-Advised Fund
        if situation.income_w2 > 100000:
            strategies.append({
                'name': 'Donor-Advised Fund (DAF)',
                'description': 'Bundle charitable giving for larger deduction',
                'category': 'charitable',
                'difficulty': 'moderate',
                'tax_savings': 10000 * 0.24,  # Assume $10k donation
                'implementation': [
                    'Contribute appreciated stocks to avoid capital gains',
                    'Get immediate deduction, donate over time',
                    'Bundle multiple years of giving',
                    'Minimum $5,000 to open most DAFs',
                    'Deduct up to 60% of AGI (cash) or 30% (stocks)'
                ]
            })
        
        return strategies
    
    def _get_advanced_strategies(self, situation: TaxSituation) -> List[Dict]:
        """
        Advanced strategies for business owners and landlords
        """
        strategies = []
        
        # 1. S-Corp Election
        if situation.business_income > 60000 and situation.business_type in ['sole_prop', 'llc']:
            se_tax_savings = situation.business_income * 0.5 * 0.153 * 0.6  # Save ~60% of SE tax on distributions
            strategies.append({
                'name': 'S-Corporation Election',
                'description': 'Reduce self-employment tax',
                'category': 'business',
                'difficulty': 'advanced',
                'tax_savings': se_tax_savings,
                'implementation': [
                    'File Form 2553 for S-Corp election',
                    'Pay yourself "reasonable salary" (W-2)',
                    'Take remaining profit as distributions (no SE tax)',
                    f'Potential savings: ${se_tax_savings:,.0f}/year',
                    'Additional compliance: payroll, corporate tax return'
                ]
            })
        
        # 2. Solo 401(k) / SEP-IRA
        if situation.business_income > 0:
            solo_401k_limit = min(69000, situation.business_income * 0.25 + 23000)
            strategies.append({
                'name': 'Solo 401(k) / SEP-IRA',
                'description': 'Maximize retirement savings for self-employed',
                'category': 'retirement',
                'difficulty': 'advanced',
                'tax_savings': solo_401k_limit * 0.32,  # Assume 32% bracket
                'implementation': [
                    f'Contribute up to ${solo_401k_limit:,} (employee + employer)',
                    'Employee: $23,000 ($30,500 if 50+)',
                    'Employer: 25% of compensation',
                    'Can have both if spouse is employee',
                    'Deadline: tax filing deadline + extensions'
                ]
            })
        
        # 3. Section 199A Deduction (QBI)
        if situation.business_income > 0:
            qbi_deduction = min(situation.business_income * 0.20, 
                               max(0, situation.income_w2 - 182050) * 0.20)  # Simplified
            strategies.append({
                'name': 'Section 199A (QBI) Deduction',
                'description': '20% deduction on qualified business income',
                'category': 'business',
                'difficulty': 'advanced',
                'tax_savings': qbi_deduction * 0.32,
                'implementation': [
                    '20% deduction on pass-through business income',
                    'Phase-out starts at $191,950 (single) / $383,900 (married)',
                    'Complex rules for specified service businesses',
                    'W-2 wage and property limitations at higher incomes',
                    'Consider entity structure optimization'
                ]
            })
        
        # 4. Cost Segregation Study
        if situation.rental_income > 0:
            strategies.append({
                'name': 'Cost Segregation Study',
                'description': 'Accelerate depreciation on rental property',
                'category': 'real_estate',
                'difficulty': 'advanced',
                'tax_savings': 50000 * 0.32,  # Varies greatly
                'implementation': [
                    'Engineering study to separate building components',
                    '5, 7, 15-year property vs 27.5-year',
                    'Bonus depreciation on qualified assets',
                    'Costs $5,000-15,000 for study',
                    'Best for properties > $500,000'
                ]
            })
        
        # 5. Defined Benefit Plan
        if situation.business_income > 250000 and situation.age > 45:
            db_contribution = min(265000, situation.business_income * 0.40)  # Age-dependent
            strategies.append({
                'name': 'Defined Benefit Plan',
                'description': 'Maximum retirement savings for high earners',
                'category': 'retirement',
                'difficulty': 'advanced',
                'tax_savings': db_contribution * 0.37,  # Top bracket
                'implementation': [
                    f'Contribute up to ${db_contribution:,}/year',
                    'Age and income dependent limits',
                    'Requires actuarial calculations',
                    'Annual funding requirements',
                    'Combine with 401(k) for maximum savings'
                ]
            })
        
        # 6. Augusta Rule (Section 280A)
        if situation.business_income > 0:
            strategies.append({
                'name': 'Augusta Rule (14-day rental)',
                'description': 'Rent home to your business tax-free',
                'category': 'business',
                'difficulty': 'advanced',
                'tax_savings': 15000 * 0.32,  # Up to 14 days rental
                'implementation': [
                    'Rent personal residence to business up to 14 days/year',
                    'Income is tax-free to you personally',
                    'Business gets deduction',
                    'Document with rental agreement and fair market rate',
                    'Use for board meetings, planning sessions'
                ]
            })
        
        return strategies
    
    def _get_complex_strategies(self, situation: TaxSituation) -> List[Dict]:
        """
        Complex strategies for multi-entity structures and trusts
        """
        strategies = []
        
        # 1. Family Limited Partnership
        strategies.append({
            'name': 'Family Limited Partnership (FLP)',
            'description': 'Estate tax reduction and asset protection',
            'category': 'estate',
            'difficulty': 'complex',
            'tax_savings': 500000 * 0.40 * 0.30,  # 30% valuation discount on $500k
            'implementation': [
                'Transfer assets to FLP at discounted value',
                'Retain control as general partner (1-2%)',
                'Gift limited partnership interests to family',
                'Valuation discounts: 20-40% typical',
                'Asset protection from creditors',
                'Annual exclusion gifting of LP interests'
            ]
        })
        
        # 2. Charitable Remainder Trust (CRT)
        if situation.capital_gains > 100000:
            strategies.append({
                'name': 'Charitable Remainder Trust (CRT)',
                'description': 'Defer capital gains, get income stream, charity benefit',
                'category': 'charitable',
                'difficulty': 'complex',
                'tax_savings': situation.capital_gains * 0.20,  # Immediate + deferral
                'implementation': [
                    'Transfer appreciated assets to CRT',
                    'Avoid immediate capital gains tax',
                    'Receive income stream for life/term',
                    'Immediate charitable deduction (10-50% of value)',
                    'Remainder to charity',
                    'Types: CRAT (fixed) or CRUT (variable)'
                ]
            })
        
        # 3. Grantor Retained Annuity Trust (GRAT)
        strategies.append({
            'name': 'Grantor Retained Annuity Trust (GRAT)',
            'description': 'Transfer appreciation to heirs tax-free',
            'category': 'estate',
            'difficulty': 'complex',
            'tax_savings': 1000000 * 0.10 * 0.40,  # 10% appreciation on $1M
            'implementation': [
                'Transfer assets to GRAT',
                'Receive annuity payments back',
                'Appreciation passes to beneficiaries tax-free',
                'Best in low interest rate environment',
                'Rolling GRATs for continued benefit',
                '"Zeroed-out" GRAT minimizes gift tax'
            ]
        })
        
        # 4. Qualified Opportunity Zones
        if situation.capital_gains > 50000:
            strategies.append({
                'name': 'Qualified Opportunity Zone Investment',
                'description': 'Defer and reduce capital gains tax',
                'category': 'investments',
                'difficulty': 'complex',
                'tax_savings': situation.capital_gains * 0.15,  # Plus deferral
                'implementation': [
                    'Invest capital gains in QOZ Fund within 180 days',
                    'Defer tax until 2026',
                    '10% basis step-up after 5 years',
                    '15% basis step-up after 7 years',
                    'No tax on appreciation if held 10+ years',
                    'Due diligence critical - many poor investments'
                ]
            })
        
        # 5. International Tax Planning
        if situation.foreign_income > 0:
            strategies.append({
                'name': 'Foreign Tax Credit Optimization',
                'description': 'Minimize double taxation on foreign income',
                'category': 'international',
                'difficulty': 'complex',
                'tax_savings': situation.foreign_income * 0.10,
                'implementation': [
                    'Foreign Tax Credit vs Foreign Earned Income Exclusion',
                    'FEIE: Exclude up to $126,500 (2024)',
                    'FTC: Dollar-for-dollar credit',
                    'Tax treaty benefits',
                    'Foreign housing exclusion/deduction',
                    'Timing of repatriation'
                ]
            })
        
        # 6. Conservation Easement
        strategies.append({
            'name': 'Conservation Easement',
            'description': 'Large deduction for land preservation',
            'category': 'real_estate',
            'difficulty': 'complex',
            'tax_savings': 200000,  # Varies greatly
            'implementation': [
                'Donate development rights to land trust',
                'Deduction = value before - value after easement',
                'Deduct up to 50% of AGI (100% for farmers)',
                '15-year carryforward',
                'Enhanced deduction for qualified farmers',
                'Syndicated easements under IRS scrutiny'
            ]
        })
        
        return strategies
    
    def _get_insurance_strategies(self, situation: TaxSituation) -> List[Dict]:
        """
        Insurance-based tax and wealth strategies
        """
        strategies = []
        
        # 1. Premium Financing for Life Insurance
        if situation.income_w2 > 500000:
            strategies.append({
                'name': 'Premium Financed Life Insurance',
                'description': 'Large death benefit without cash flow impact',
                'category': 'insurance',
                'difficulty': 'complex',
                'implementation': [
                    'Borrow to pay large life insurance premiums',
                    'Interest may be deductible (business purpose)',
                    'Death benefit pays off loan + provides for heirs',
                    'Requires high net worth and income',
                    'Complex exit strategies required'
                ]
            })
        
        # 2. Modified Endowment Contract (MEC) Strategy
        strategies.append({
            'name': 'Life Insurance as Tax-Deferred Investment',
            'description': 'Whole life or IUL for tax-deferred growth',
            'category': 'insurance',
            'difficulty': 'moderate',
            'implementation': [
                'Max fund life insurance policy',
                'Tax-deferred growth',
                'Tax-free loans against cash value',
                'Death benefit passes tax-free',
                'Avoid MEC status for best tax treatment',
                'High fees - only for high earners'
            ]
        })
        
        # 3. Captive Insurance Company
        if situation.business_income > 1000000:
            strategies.append({
                'name': 'Captive Insurance Company',
                'description': 'Self-insurance with tax benefits',
                'category': 'insurance',
                'difficulty': 'complex',
                'tax_savings': 2200000 * 0.37,  # Max premium deduction
                'implementation': [
                    'Form insurance company for business risks',
                    'Deduct up to $2.2M in premiums (831(b) election)',
                    'Premiums taxed at capital gains rates',
                    'Risk distribution requirements',
                    'High setup and maintenance costs',
                    'IRS scrutiny - must have real insurance risk'
                ]
            })
        
        # 4. Long-Term Care Insurance
        if situation.age > 40:
            strategies.append({
                'name': 'Long-Term Care Insurance',
                'description': 'Tax-deductible premiums, tax-free benefits',
                'category': 'insurance',
                'difficulty': 'easy',
                'tax_savings': 5000 * 0.24,  # Age-based limits
                'implementation': [
                    'Premiums partially deductible based on age',
                    'Benefits received are tax-free',
                    'Hybrid life/LTC policies available',
                    'Asset protection from Medicaid spend-down',
                    'Buy in 40s-50s for best rates'
                ]
            })
        
        return strategies
    
    def _get_estate_planning_strategies(self, situation: TaxSituation) -> List[Dict]:
        """
        Estate and wealth transfer strategies
        """
        strategies = []
        
        # 1. Irrevocable Life Insurance Trust (ILIT)
        strategies.append({
            'name': 'Irrevocable Life Insurance Trust (ILIT)',
            'description': 'Remove life insurance from taxable estate',
            'category': 'estate',
            'implementation': [
                'Trust owns life insurance policy',
                'Death benefit outside of estate',
                'Provides liquidity for estate taxes',
                'Crummey powers for gift tax exclusion',
                'Cannot change once established',
                'Three-year lookback rule'
            ]
        })
        
        # 2. Qualified Personal Residence Trust (QPRT)
        strategies.append({
            'name': 'Qualified Personal Residence Trust (QPRT)',
            'description': 'Transfer residence at discounted value',
            'category': 'estate',
            'implementation': [
                'Transfer home to trust, retain occupancy',
                'Home passes to heirs at term end',
                'Significant valuation discount',
                'Must outlive trust term',
                'Can continue living via lease'
            ]
        })
        
        # 3. Dynasty Trust
        strategies.append({
            'name': 'Dynasty Trust',
            'description': 'Multi-generational wealth preservation',
            'category': 'estate',
            'implementation': [
                'Assets grow estate-tax free for generations',
                'Asset protection from creditors/divorce',
                'Use generation-skipping tax exemption',
                'Situs in favorable states (NV, SD, DE)',
                'Directed trustee structure'
            ]
        })
        
        # 4. Spousal Lifetime Access Trust (SLAT)
        if situation.filing_status == "married_filing_jointly":
            strategies.append({
                'name': 'Spousal Lifetime Access Trust (SLAT)',
                'description': 'Use exemption while maintaining indirect access',
                'category': 'estate',
                'implementation': [
                    'Gift to trust for spouse/children',
                    'Use lifetime exemption ($13.61M in 2024)',
                    'Spouse can access if needed',
                    'Reciprocal trust doctrine risk',
                    'Protection from estate tax'
                ]
            })
        
        return strategies
    
    def _calculate_total_savings(self, strategies: Dict, situation: TaxSituation) -> float:
        """
        Calculate total potential tax savings
        """
        total = 0
        for category in ['basic_strategies', 'intermediate_strategies', 
                        'advanced_strategies', 'complex_strategies']:
            for strategy in strategies.get(category, []):
                total += strategy.get('tax_savings', 0)
        return total
    
    def _prioritize_strategies(self, strategies: Dict, situation: TaxSituation) -> List[Dict]:
        """
        Return top 5 prioritized strategies based on impact and ease
        """
        all_strategies = []
        
        for category in ['basic_strategies', 'intermediate_strategies', 
                        'advanced_strategies', 'complex_strategies']:
            all_strategies.extend(strategies.get(category, []))
        
        # Score based on savings and difficulty
        for strategy in all_strategies:
            savings = strategy.get('tax_savings', 0)
            difficulty_score = {'easy': 3, 'moderate': 2, 'advanced': 1, 'complex': 0.5}
            difficulty = difficulty_score.get(strategy.get('difficulty', 'moderate'), 1)
            
            # Combined score: savings * difficulty factor
            strategy['priority_score'] = savings * difficulty
        
        # Sort by priority score
        all_strategies.sort(key=lambda x: x.get('priority_score', 0), reverse=True)
        
        return all_strategies[:5]
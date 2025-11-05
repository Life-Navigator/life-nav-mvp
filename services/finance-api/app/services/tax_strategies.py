"""
Tax Optimization Strategies Service
Advanced tax planning and optimization algorithms
"""

from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

class FilingStatus(Enum):
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"

@dataclass
class TaxProfile:
    gross_income: float
    filing_status: FilingStatus
    state: str
    dependents: int = 0
    age: int = 30
    retirement_contributions: float = 0
    hsa_contributions: float = 0
    mortgage_interest: float = 0
    charitable_donations: float = 0
    state_local_taxes: float = 0
    capital_gains_short: float = 0
    capital_gains_long: float = 0
    business_income: float = 0
    rental_income: float = 0

class TaxOptimizationService:
    
    # 2024 Tax brackets (simplified)
    TAX_BRACKETS_2024 = {
        FilingStatus.SINGLE: [
            (11600, 0.10),   # $0 - $11,600
            (47150, 0.12),   # $11,601 - $47,150
            (100525, 0.22),  # $47,151 - $100,525
            (191950, 0.24),  # $100,526 - $191,950
            (243725, 0.32),  # $191,951 - $243,725
            (609350, 0.35),  # $243,726 - $609,350
            (float('inf'), 0.37)  # $609,351+
        ],
        FilingStatus.MARRIED_FILING_JOINTLY: [
            (23200, 0.10),   # $0 - $23,200
            (94300, 0.12),   # $23,201 - $94,300
            (201050, 0.22),  # $94,301 - $201,050
            (383900, 0.24),  # $201,051 - $383,900
            (487450, 0.32),  # $383,901 - $487,450
            (731200, 0.35),  # $487,451 - $731,200
            (float('inf'), 0.37)  # $731,201+
        ]
    }
    
    # Standard deductions for 2024
    STANDARD_DEDUCTIONS_2024 = {
        FilingStatus.SINGLE: 14600,
        FilingStatus.MARRIED_FILING_JOINTLY: 29200,
        FilingStatus.MARRIED_FILING_SEPARATELY: 14600,
        FilingStatus.HEAD_OF_HOUSEHOLD: 21900
    }
    
    # Contribution limits for 2024
    CONTRIBUTION_LIMITS_2024 = {
        '401k': 23000,
        '401k_catch_up': 30500,  # Age 50+
        'ira': 7000,
        'ira_catch_up': 8000,  # Age 50+
        'hsa_individual': 4150,
        'hsa_family': 8300,
        'hsa_catch_up': 1000,  # Age 55+
        'fsa': 3200,
        '529_gift_tax_free': 18000,
    }
    
    def analyze_tax_situation(self, profile: TaxProfile) -> Dict:
        """
        Comprehensive tax analysis and optimization recommendations
        """
        # Calculate current tax liability
        current_tax = self._calculate_tax_liability(profile)
        
        # Generate optimization strategies
        strategies = self._generate_optimization_strategies(profile)
        
        # Calculate savings from each strategy
        strategy_impacts = []
        for strategy in strategies:
            optimized_profile = self._apply_strategy(profile, strategy)
            optimized_tax = self._calculate_tax_liability(optimized_profile)
            savings = current_tax['total_tax'] - optimized_tax['total_tax']
            
            if savings > 0:
                strategy_impacts.append({
                    'strategy': strategy,
                    'savings': savings,
                    'new_tax': optimized_tax['total_tax'],
                    'implementation_difficulty': strategy['difficulty']
                })
        
        # Sort strategies by savings potential
        strategy_impacts.sort(key=lambda x: x['savings'], reverse=True)
        
        # Calculate effective tax rate
        effective_rate = (current_tax['total_tax'] / profile.gross_income * 100) if profile.gross_income > 0 else 0
        
        # Generate tax-efficient investment recommendations
        investment_recommendations = self._generate_investment_recommendations(profile)
        
        # Calculate marginal tax rate
        marginal_rate = self._calculate_marginal_rate(profile)
        
        return {
            "current_situation": {
                "gross_income": profile.gross_income,
                "taxable_income": current_tax['taxable_income'],
                "total_tax": current_tax['total_tax'],
                "federal_tax": current_tax['federal_tax'],
                "state_tax": current_tax['state_tax'],
                "fica_tax": current_tax['fica_tax'],
                "effective_tax_rate": f"{effective_rate:.2f}%",
                "marginal_tax_rate": f"{marginal_rate:.1f}%",
                "after_tax_income": profile.gross_income - current_tax['total_tax']
            },
            "optimization_strategies": strategy_impacts[:10],  # Top 10 strategies
            "tax_advantaged_space": {
                "retirement_401k": {
                    "current": profile.retirement_contributions,
                    "limit": self._get_401k_limit(profile.age),
                    "additional_available": max(0, self._get_401k_limit(profile.age) - profile.retirement_contributions)
                },
                "hsa": {
                    "current": profile.hsa_contributions,
                    "limit": self._get_hsa_limit(profile),
                    "additional_available": max(0, self._get_hsa_limit(profile) - profile.hsa_contributions)
                },
                "total_additional_space": self._calculate_total_tax_advantaged_space(profile)
            },
            "investment_recommendations": investment_recommendations,
            "year_end_strategies": self._generate_year_end_strategies(profile),
            "estimated_refund_or_owed": self._estimate_refund_or_owed(profile, current_tax)
        }
    
    def _calculate_tax_liability(self, profile: TaxProfile) -> Dict:
        """
        Calculate total tax liability including federal, state, and FICA
        """
        # Calculate adjusted gross income (AGI)
        agi = (profile.gross_income + 
               profile.capital_gains_short + 
               profile.capital_gains_long +
               profile.business_income +
               profile.rental_income -
               profile.retirement_contributions -
               profile.hsa_contributions)
        
        # Calculate itemized vs standard deduction
        itemized_deductions = (profile.mortgage_interest +
                              profile.charitable_donations +
                              min(10000, profile.state_local_taxes))  # SALT cap
        
        standard_deduction = self.STANDARD_DEDUCTIONS_2024.get(
            profile.filing_status,
            self.STANDARD_DEDUCTIONS_2024[FilingStatus.SINGLE]
        )
        
        deduction = max(itemized_deductions, standard_deduction)
        
        # Calculate taxable income
        taxable_income = max(0, agi - deduction)
        
        # Calculate federal tax
        federal_tax = self._calculate_federal_tax(taxable_income, profile.filing_status)
        
        # Add capital gains tax
        capital_gains_tax = (profile.capital_gains_short * 0.22 +  # Assuming 22% bracket
                            profile.capital_gains_long * 0.15)  # 15% long-term rate
        
        # Calculate state tax (simplified - varies by state)
        state_tax = self._calculate_state_tax(agi, profile.state)
        
        # Calculate FICA tax
        fica_tax = self._calculate_fica_tax(profile.gross_income)
        
        # Calculate net investment income tax (3.8% on investment income for high earners)
        niit = 0
        if agi > 200000 and profile.filing_status == FilingStatus.SINGLE:
            investment_income = profile.capital_gains_short + profile.capital_gains_long
            niit = investment_income * 0.038
        
        total_tax = federal_tax + capital_gains_tax + state_tax + fica_tax + niit
        
        return {
            'agi': agi,
            'taxable_income': taxable_income,
            'deduction_used': 'itemized' if itemized_deductions > standard_deduction else 'standard',
            'deduction_amount': deduction,
            'federal_tax': federal_tax,
            'capital_gains_tax': capital_gains_tax,
            'state_tax': state_tax,
            'fica_tax': fica_tax,
            'niit': niit,
            'total_tax': total_tax
        }
    
    def _calculate_federal_tax(self, taxable_income: float, filing_status: FilingStatus) -> float:
        """
        Calculate federal income tax using tax brackets
        """
        brackets = self.TAX_BRACKETS_2024.get(
            filing_status,
            self.TAX_BRACKETS_2024[FilingStatus.SINGLE]
        )
        
        tax = 0
        previous_bracket = 0
        
        for bracket_limit, rate in brackets:
            if taxable_income <= previous_bracket:
                break
            
            taxable_in_bracket = min(taxable_income - previous_bracket, 
                                    bracket_limit - previous_bracket)
            tax += taxable_in_bracket * rate
            
            previous_bracket = bracket_limit
            
            if taxable_income <= bracket_limit:
                break
        
        return tax
    
    def _calculate_state_tax(self, agi: float, state: str) -> float:
        """
        Calculate state income tax (simplified)
        """
        # State tax rates (simplified - actual rates vary)
        state_rates = {
            'CA': 0.093,  # California - high tax
            'NY': 0.0882,  # New York
            'TX': 0.0,     # Texas - no income tax
            'FL': 0.0,     # Florida - no income tax
            'WA': 0.0,     # Washington - no income tax
            'IL': 0.0495,  # Illinois - flat tax
            'MA': 0.05,    # Massachusetts
            'PA': 0.0307,  # Pennsylvania
            'NJ': 0.0897,  # New Jersey
            'DEFAULT': 0.05  # Average state tax
        }
        
        rate = state_rates.get(state, state_rates['DEFAULT'])
        return agi * rate
    
    def _calculate_fica_tax(self, gross_income: float) -> float:
        """
        Calculate FICA taxes (Social Security and Medicare)
        """
        # Social Security: 6.2% on first $168,600 (2024 limit)
        ss_tax = min(gross_income, 168600) * 0.062
        
        # Medicare: 1.45% on all income
        medicare_tax = gross_income * 0.0145
        
        # Additional Medicare: 0.9% on income over $200k (single)
        additional_medicare = max(0, gross_income - 200000) * 0.009
        
        return ss_tax + medicare_tax + additional_medicare
    
    def _generate_optimization_strategies(self, profile: TaxProfile) -> List[Dict]:
        """
        Generate personalized tax optimization strategies
        """
        strategies = []
        
        # 401(k) maximization
        limit_401k = self._get_401k_limit(profile.age)
        if profile.retirement_contributions < limit_401k:
            strategies.append({
                'name': 'Maximize 401(k) Contributions',
                'description': f'Increase 401(k) contributions to ${limit_401k:,}',
                'type': 'retirement',
                'difficulty': 'easy',
                'additional_contribution': limit_401k - profile.retirement_contributions
            })
        
        # HSA maximization
        hsa_limit = self._get_hsa_limit(profile)
        if profile.hsa_contributions < hsa_limit:
            strategies.append({
                'name': 'Maximize HSA Contributions',
                'description': f'Increase HSA contributions to ${hsa_limit:,} (triple tax advantage)',
                'type': 'hsa',
                'difficulty': 'easy',
                'additional_contribution': hsa_limit - profile.hsa_contributions
            })
        
        # Backdoor Roth IRA
        if profile.gross_income > 153000:  # Phase-out for Roth IRA
            strategies.append({
                'name': 'Backdoor Roth IRA',
                'description': 'Convert traditional IRA to Roth IRA for tax-free growth',
                'type': 'retirement',
                'difficulty': 'moderate',
                'additional_contribution': 7000
            })
        
        # Mega Backdoor Roth
        if profile.gross_income > 250000:
            strategies.append({
                'name': 'Mega Backdoor Roth',
                'description': 'After-tax 401(k) contributions converted to Roth',
                'type': 'retirement',
                'difficulty': 'complex',
                'additional_contribution': 46000  # 69000 total limit - 23000 regular
            })
        
        # Tax loss harvesting
        if profile.capital_gains_short > 0 or profile.capital_gains_long > 0:
            strategies.append({
                'name': 'Tax Loss Harvesting',
                'description': 'Offset capital gains with strategic losses',
                'type': 'investment',
                'difficulty': 'moderate',
                'potential_offset': min(3000, profile.capital_gains_short + profile.capital_gains_long)
            })
        
        # Donor-advised fund
        if profile.charitable_donations > 5000:
            strategies.append({
                'name': 'Donor-Advised Fund',
                'description': 'Bundle multiple years of donations for larger deduction',
                'type': 'charitable',
                'difficulty': 'moderate',
                'bundled_amount': profile.charitable_donations * 3
            })
        
        # 529 Plan
        if profile.dependents > 0:
            strategies.append({
                'name': '529 Education Savings',
                'description': 'State tax deduction + tax-free growth for education',
                'type': 'education',
                'difficulty': 'easy',
                'annual_contribution': 18000 * profile.dependents
            })
        
        # Municipal bonds
        marginal_rate = self._calculate_marginal_rate(profile)
        if marginal_rate > 32:
            strategies.append({
                'name': 'Municipal Bonds',
                'description': 'Tax-free income from municipal bonds',
                'type': 'investment',
                'difficulty': 'easy',
                'tax_equivalent_yield': 4.5 / (1 - marginal_rate/100)
            })
        
        # Qualified Small Business Stock
        if profile.business_income > 0:
            strategies.append({
                'name': 'QSBS Exemption',
                'description': 'Exclude up to $10M in capital gains from QSBS',
                'type': 'business',
                'difficulty': 'complex',
                'potential_exclusion': 10000000
            })
        
        return strategies
    
    def _calculate_marginal_rate(self, profile: TaxProfile) -> float:
        """
        Calculate marginal tax rate
        """
        brackets = self.TAX_BRACKETS_2024.get(
            profile.filing_status,
            self.TAX_BRACKETS_2024[FilingStatus.SINGLE]
        )
        
        taxable_income = profile.gross_income - self.STANDARD_DEDUCTIONS_2024[profile.filing_status]
        
        for bracket_limit, rate in brackets:
            if taxable_income <= bracket_limit:
                return rate * 100
        
        return 37.0  # Top rate
    
    def _get_401k_limit(self, age: int) -> float:
        """Get 401(k) contribution limit based on age"""
        if age >= 50:
            return self.CONTRIBUTION_LIMITS_2024['401k_catch_up']
        return self.CONTRIBUTION_LIMITS_2024['401k']
    
    def _get_hsa_limit(self, profile: TaxProfile) -> float:
        """Get HSA contribution limit"""
        # Assuming family coverage if dependents > 0
        base_limit = (self.CONTRIBUTION_LIMITS_2024['hsa_family'] 
                     if profile.dependents > 0 
                     else self.CONTRIBUTION_LIMITS_2024['hsa_individual'])
        
        if profile.age >= 55:
            base_limit += self.CONTRIBUTION_LIMITS_2024['hsa_catch_up']
        
        return base_limit
    
    def _calculate_total_tax_advantaged_space(self, profile: TaxProfile) -> float:
        """Calculate total remaining tax-advantaged contribution space"""
        total_space = 0
        
        # 401(k) space
        total_space += max(0, self._get_401k_limit(profile.age) - profile.retirement_contributions)
        
        # IRA space
        ira_limit = (self.CONTRIBUTION_LIMITS_2024['ira_catch_up'] 
                    if profile.age >= 50 
                    else self.CONTRIBUTION_LIMITS_2024['ira'])
        total_space += ira_limit
        
        # HSA space
        total_space += max(0, self._get_hsa_limit(profile) - profile.hsa_contributions)
        
        return total_space
    
    def _apply_strategy(self, profile: TaxProfile, strategy: Dict) -> TaxProfile:
        """Apply a tax strategy to create optimized profile"""
        import copy
        optimized = copy.deepcopy(profile)
        
        if strategy['type'] == 'retirement':
            if '401k' in strategy['name'].lower():
                optimized.retirement_contributions += strategy.get('additional_contribution', 0)
        elif strategy['type'] == 'hsa':
            optimized.hsa_contributions += strategy.get('additional_contribution', 0)
        elif strategy['type'] == 'investment' and 'loss harvesting' in strategy['name'].lower():
            # Reduce capital gains by offset amount
            offset = strategy.get('potential_offset', 0)
            optimized.capital_gains_short = max(0, optimized.capital_gains_short - offset)
        
        return optimized
    
    def _generate_investment_recommendations(self, profile: TaxProfile) -> List[str]:
        """Generate tax-efficient investment recommendations"""
        recommendations = []
        marginal_rate = self._calculate_marginal_rate(profile)
        
        if marginal_rate > 32:
            recommendations.append("Consider tax-free municipal bonds for fixed income allocation")
            recommendations.append("Prioritize index funds over actively managed funds (lower turnover)")
        
        if profile.capital_gains_long > 0:
            recommendations.append("Hold investments for >1 year to qualify for long-term capital gains rates")
        
        recommendations.append("Place tax-inefficient investments (REITs, bonds) in tax-advantaged accounts")
        recommendations.append("Use tax-managed or index funds in taxable accounts")
        
        if profile.age < 50:
            recommendations.append("Consider Roth conversions during low-income years")
        
        return recommendations[:5]
    
    def _generate_year_end_strategies(self, profile: TaxProfile) -> List[str]:
        """Generate year-end tax planning strategies"""
        strategies = []
        current_month = datetime.now().month
        
        if current_month >= 10:  # Q4 strategies
            strategies.append("Review and harvest tax losses before December 31")
            strategies.append("Make charitable contributions before year-end")
            strategies.append("Defer income to next year if possible (bonuses, invoices)")
            strategies.append("Accelerate deductible expenses into current year")
            strategies.append("Contribute to retirement accounts before deadlines")
        
        return strategies
    
    def _estimate_refund_or_owed(self, profile: TaxProfile, tax_calc: Dict) -> Dict:
        """Estimate tax refund or amount owed"""
        # Simplified withholding calculation
        estimated_withholding = profile.gross_income * 0.22  # Rough estimate
        
        difference = estimated_withholding - tax_calc['total_tax']
        
        return {
            'estimated_withholding': estimated_withholding,
            'total_tax_liability': tax_calc['total_tax'],
            'estimated_refund': max(0, difference),
            'estimated_owed': max(0, -difference),
            'quarterly_payment_needed': max(0, -difference) / 4 if difference < 0 else 0
        }
"""
Retirement Calculator Service
Advanced retirement planning calculations
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import math

@dataclass
class RetirementInputs:
    current_age: int
    retirement_age: int
    life_expectancy: int = 90
    current_savings: float = 0
    monthly_contribution: float = 0
    employer_match_percent: float = 0
    employer_match_limit: float = 0
    current_income: float = 0
    expected_return_rate: float = 0.07  # 7% default
    inflation_rate: float = 0.03  # 3% default
    retirement_income_replacement: float = 0.80  # 80% of pre-retirement income
    social_security_benefit: float = 0
    pension_benefit: float = 0
    retirement_tax_rate: float = 0.22  # 22% effective tax rate in retirement

class RetirementCalculator:
    
    def calculate_retirement_projection(self, inputs: RetirementInputs) -> Dict:
        """
        Calculate comprehensive retirement projection
        """
        years_to_retirement = inputs.retirement_age - inputs.current_age
        years_in_retirement = inputs.life_expectancy - inputs.retirement_age
        
        if years_to_retirement <= 0:
            return {"error": "Already at or past retirement age"}
        
        # Calculate accumulation phase
        future_value = self._calculate_future_value(
            inputs.current_savings,
            inputs.monthly_contribution,
            inputs.employer_match_percent,
            inputs.employer_match_limit,
            inputs.expected_return_rate,
            years_to_retirement
        )
        
        # Calculate required retirement income
        future_income = inputs.current_income * ((1 + inputs.inflation_rate) ** years_to_retirement)
        annual_retirement_need = future_income * inputs.retirement_income_replacement
        
        # Adjust for taxes
        gross_retirement_need = annual_retirement_need / (1 - inputs.retirement_tax_rate)
        
        # Account for other income sources
        future_social_security = inputs.social_security_benefit * ((1 + inputs.inflation_rate) ** years_to_retirement)
        future_pension = inputs.pension_benefit * ((1 + inputs.inflation_rate) ** years_to_retirement)
        
        net_annual_need = max(0, gross_retirement_need - future_social_security - future_pension)
        
        # Calculate if savings will last through retirement
        retirement_sustainability = self._calculate_retirement_sustainability(
            future_value,
            net_annual_need,
            inputs.expected_return_rate - inputs.inflation_rate,  # Real return
            years_in_retirement
        )
        
        # Calculate gap or surplus
        required_nest_egg = self._calculate_required_nest_egg(
            net_annual_need,
            inputs.expected_return_rate - inputs.inflation_rate,
            years_in_retirement
        )
        
        gap_or_surplus = future_value - required_nest_egg
        
        # Calculate required monthly contribution to close gap
        required_monthly = 0
        if gap_or_surplus < 0:
            required_monthly = self._calculate_required_monthly_contribution(
                abs(gap_or_surplus),
                inputs.expected_return_rate,
                years_to_retirement
            )
        
        # Run Monte Carlo simulation for success probability
        success_probability = self._monte_carlo_simulation(
            inputs,
            num_simulations=1000
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            inputs,
            gap_or_surplus,
            required_monthly,
            success_probability
        )
        
        return {
            "current_age": inputs.current_age,
            "retirement_age": inputs.retirement_age,
            "years_to_retirement": years_to_retirement,
            "current_savings": inputs.current_savings,
            "projected_savings_at_retirement": future_value,
            "required_nest_egg": required_nest_egg,
            "gap_or_surplus": gap_or_surplus,
            "monthly_contribution": inputs.monthly_contribution,
            "required_monthly_contribution": required_monthly,
            "annual_retirement_income": net_annual_need,
            "monthly_retirement_income": net_annual_need / 12,
            "retirement_sustainability_years": retirement_sustainability['years_sustained'],
            "will_last_lifetime": retirement_sustainability['will_last'],
            "success_probability": success_probability,
            "recommendations": recommendations,
            "assumptions": {
                "expected_return": f"{inputs.expected_return_rate:.1%}",
                "inflation_rate": f"{inputs.inflation_rate:.1%}",
                "retirement_tax_rate": f"{inputs.retirement_tax_rate:.1%}",
                "income_replacement": f"{inputs.retirement_income_replacement:.0%}"
            }
        }
    
    def _calculate_future_value(
        self,
        present_value: float,
        monthly_contribution: float,
        employer_match_percent: float,
        employer_match_limit: float,
        annual_return: float,
        years: int
    ) -> float:
        """
        Calculate future value with compound interest and monthly contributions
        """
        monthly_return = annual_return / 12
        months = years * 12
        
        # Calculate employer match
        employer_monthly_match = min(
            monthly_contribution * employer_match_percent,
            employer_match_limit / 12 if employer_match_limit > 0 else float('inf')
        )
        
        total_monthly_contribution = monthly_contribution + employer_monthly_match
        
        # Future value of current savings
        fv_current = present_value * ((1 + annual_return) ** years)
        
        # Future value of monthly contributions (annuity)
        if monthly_return > 0:
            fv_contributions = total_monthly_contribution * (
                ((1 + monthly_return) ** months - 1) / monthly_return
            )
        else:
            fv_contributions = total_monthly_contribution * months
        
        return fv_current + fv_contributions
    
    def _calculate_retirement_sustainability(
        self,
        nest_egg: float,
        annual_withdrawal: float,
        real_return: float,
        max_years: int
    ) -> Dict:
        """
        Calculate how long retirement savings will last
        """
        if annual_withdrawal <= 0:
            return {"years_sustained": float('inf'), "will_last": True}
        
        balance = nest_egg
        years = 0
        
        while balance > 0 and years < max_years:
            balance = balance * (1 + real_return) - annual_withdrawal
            years += 1
        
        return {
            "years_sustained": years,
            "will_last": years >= max_years,
            "final_balance": max(0, balance)
        }
    
    def _calculate_required_nest_egg(
        self,
        annual_withdrawal: float,
        real_return: float,
        years: int
    ) -> float:
        """
        Calculate required nest egg to sustain withdrawals
        Using present value of annuity formula
        """
        if real_return <= 0:
            return annual_withdrawal * years
        
        return annual_withdrawal * ((1 - (1 + real_return) ** -years) / real_return)
    
    def _calculate_required_monthly_contribution(
        self,
        target_amount: float,
        annual_return: float,
        years: int
    ) -> float:
        """
        Calculate required monthly contribution to reach target
        """
        monthly_return = annual_return / 12
        months = years * 12
        
        if monthly_return <= 0:
            return target_amount / months
        
        return target_amount * monthly_return / ((1 + monthly_return) ** months - 1)
    
    def _monte_carlo_simulation(
        self,
        inputs: RetirementInputs,
        num_simulations: int = 1000
    ) -> float:
        """
        Run Monte Carlo simulation to determine probability of retirement success
        """
        successful_runs = 0
        years_to_retirement = inputs.retirement_age - inputs.current_age
        years_in_retirement = inputs.life_expectancy - inputs.retirement_age
        
        # Historical market volatility (S&P 500)
        return_volatility = 0.18  # 18% standard deviation
        
        for _ in range(num_simulations):
            # Accumulation phase with random returns
            balance = inputs.current_savings
            
            for year in range(years_to_retirement):
                # Generate random return based on normal distribution
                annual_return = np.random.normal(
                    inputs.expected_return_rate,
                    return_volatility
                )
                
                # Add contributions
                annual_contribution = inputs.monthly_contribution * 12
                employer_match = min(
                    annual_contribution * inputs.employer_match_percent,
                    inputs.employer_match_limit if inputs.employer_match_limit > 0 else float('inf')
                )
                
                balance = balance * (1 + annual_return) + annual_contribution + employer_match
            
            # Distribution phase
            future_income = inputs.current_income * ((1 + inputs.inflation_rate) ** years_to_retirement)
            annual_need = future_income * inputs.retirement_income_replacement / (1 - inputs.retirement_tax_rate)
            
            # Subtract other income sources
            annual_need -= inputs.social_security_benefit * ((1 + inputs.inflation_rate) ** years_to_retirement)
            annual_need -= inputs.pension_benefit * ((1 + inputs.inflation_rate) ** years_to_retirement)
            annual_need = max(0, annual_need)
            
            # Simulate retirement years
            for year in range(years_in_retirement):
                if balance <= 0:
                    break
                
                # Generate random return for this year
                annual_return = np.random.normal(
                    inputs.expected_return_rate,
                    return_volatility * 0.7  # Lower volatility in retirement (more conservative portfolio)
                )
                
                # Apply return and withdrawal
                balance = balance * (1 + annual_return) - annual_need
                
                # Adjust withdrawal for inflation
                annual_need *= (1 + inputs.inflation_rate)
            
            if balance > 0:
                successful_runs += 1
        
        return (successful_runs / num_simulations) * 100
    
    def _generate_recommendations(
        self,
        inputs: RetirementInputs,
        gap_or_surplus: float,
        required_monthly: float,
        success_probability: float
    ) -> List[str]:
        """
        Generate personalized retirement recommendations
        """
        recommendations = []
        
        # Success probability recommendations
        if success_probability < 50:
            recommendations.append("⚠️ Critical: Your retirement plan has a low probability of success. Immediate action needed.")
        elif success_probability < 70:
            recommendations.append("📊 Your retirement plan needs improvement to increase success probability.")
        elif success_probability < 90:
            recommendations.append("✓ Your retirement plan is on track but could be optimized.")
        else:
            recommendations.append("🌟 Excellent! Your retirement plan has a high probability of success.")
        
        # Gap/surplus recommendations
        if gap_or_surplus < 0:
            recommendations.append(f"💰 Increase monthly contributions by ${required_monthly:,.0f} to close the retirement gap.")
            
            # Calculate impact of delaying retirement
            delay_years = min(5, 70 - inputs.retirement_age)
            if delay_years > 0:
                recommendations.append(f"📅 Consider delaying retirement by {delay_years} years to significantly improve outcomes.")
        else:
            recommendations.append(f"✅ You're projected to have a ${gap_or_surplus:,.0f} surplus at retirement.")
        
        # Contribution recommendations
        if inputs.monthly_contribution < inputs.current_income * 0.15 / 12:
            recommendations.append("📈 Aim to save at least 15% of your income for retirement.")
        
        # Employer match recommendations
        if inputs.employer_match_percent > 0 and inputs.monthly_contribution < inputs.employer_match_limit / 12:
            missing_match = (inputs.employer_match_limit / 12 - inputs.monthly_contribution) * inputs.employer_match_percent
            recommendations.append(f"🎁 You're missing ${missing_match:,.0f}/month in free employer match money!")
        
        # Age-specific recommendations
        years_to_retirement = inputs.retirement_age - inputs.current_age
        if years_to_retirement > 30:
            recommendations.append("🚀 With 30+ years to retirement, consider a more aggressive investment strategy.")
        elif years_to_retirement < 10:
            recommendations.append("🛡️ With less than 10 years to retirement, consider shifting to more conservative investments.")
        
        # Tax recommendations
        if inputs.current_income > 100000:
            recommendations.append("🏦 Consider maximizing tax-advantaged accounts (401k, IRA, HSA).")
        
        # Catch-up contributions
        if inputs.current_age >= 50:
            recommendations.append("➕ Take advantage of catch-up contributions ($7,500 extra for 401k, $1,000 for IRA).")
        
        return recommendations[:5]  # Return top 5 recommendations
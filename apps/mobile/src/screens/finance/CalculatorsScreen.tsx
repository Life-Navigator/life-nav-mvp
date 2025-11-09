/**
 * Life Navigator - Financial Calculators Screen
 *
 * Comprehensive suite of financial calculators including mortgage,
 * retirement, compound interest, loan payoff, and rent vs buy
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

type CalculatorType =
  | 'mortgage'
  | 'retirement'
  | 'compound'
  | 'loan'
  | 'rentVsBuy';

interface Calculator {
  id: CalculatorType;
  name: string;
  description: string;
  icon: string;
}

const CALCULATORS: Calculator[] = [
  {
    id: 'mortgage',
    name: 'Mortgage Calculator',
    description: 'Calculate monthly mortgage payments and total interest',
    icon: '🏠',
  },
  {
    id: 'retirement',
    name: 'Retirement Calculator',
    description: 'Plan for retirement with savings projections',
    icon: '💰',
  },
  {
    id: 'compound',
    name: 'Compound Interest',
    description: 'See how your investments grow over time',
    icon: '📈',
  },
  {
    id: 'loan',
    name: 'Loan Payoff',
    description: 'Calculate loan payoff timeline and savings',
    icon: '💳',
  },
  {
    id: 'rentVsBuy',
    name: 'Rent vs Buy',
    description: 'Compare the costs of renting versus buying',
    icon: '🏡',
  },
];

export function CalculatorsScreen() {
  const [selectedCalculator, setSelectedCalculator] =
    useState<CalculatorType | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Calculators</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Calculator Cards */}
        <View style={styles.calculatorsGrid}>
          {CALCULATORS.map((calculator) => (
            <TouchableOpacity
              key={calculator.id}
              style={styles.calculatorCard}
              onPress={() => setSelectedCalculator(calculator.id)}
            >
              <Text style={styles.calculatorIcon}>{calculator.icon}</Text>
              <Text style={styles.calculatorName}>{calculator.name}</Text>
              <Text style={styles.calculatorDescription}>
                {calculator.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Calculator Modals */}
      {selectedCalculator === 'mortgage' && (
        <MortgageCalculator
          visible={true}
          onClose={() => setSelectedCalculator(null)}
        />
      )}
      {selectedCalculator === 'retirement' && (
        <RetirementCalculator
          visible={true}
          onClose={() => setSelectedCalculator(null)}
        />
      )}
      {selectedCalculator === 'compound' && (
        <CompoundInterestCalculator
          visible={true}
          onClose={() => setSelectedCalculator(null)}
        />
      )}
      {selectedCalculator === 'loan' && (
        <LoanPayoffCalculator
          visible={true}
          onClose={() => setSelectedCalculator(null)}
        />
      )}
      {selectedCalculator === 'rentVsBuy' && (
        <RentVsBuyCalculator
          visible={true}
          onClose={() => setSelectedCalculator(null)}
        />
      )}
    </View>
  );
}

// Mortgage Calculator Component
function MortgageCalculator({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [homePrice, setHomePrice] = useState('300000');
  const [downPayment, setDownPayment] = useState('60000');
  const [interestRate, setInterestRate] = useState('6.5');
  const [loanTerm, setLoanTerm] = useState('30');

  const results = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    const down = parseFloat(downPayment) || 0;
    const rate = parseFloat(interestRate) || 0;
    const term = parseFloat(loanTerm) || 0;

    const principal = price - down;
    const monthlyRate = rate / 100 / 12;
    const numPayments = term * 12;

    const monthlyPayment =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalPaid = monthlyPayment * numPayments;
    const totalInterest = totalPaid - principal;

    return {
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      totalPaid: isNaN(totalPaid) ? 0 : totalPaid,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
      principal,
    };
  }, [homePrice, downPayment, interestRate, loanTerm]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🏠 Mortgage Calculator</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Input
              label="Home Price"
              value={homePrice}
              onChangeText={setHomePrice}
              keyboardType="decimal-pad"
              placeholder="300000"
            />
            <Input
              label="Down Payment"
              value={downPayment}
              onChangeText={setDownPayment}
              keyboardType="decimal-pad"
              placeholder="60000"
            />
            <Input
              label="Interest Rate (%)"
              value={interestRate}
              onChangeText={setInterestRate}
              keyboardType="decimal-pad"
              placeholder="6.5"
            />
            <Input
              label="Loan Term (years)"
              value={loanTerm}
              onChangeText={setLoanTerm}
              keyboardType="decimal-pad"
              placeholder="30"
            />

            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Results</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Monthly Payment</Text>
                <Text style={styles.resultValue}>
                  {formatCurrency(results.monthlyPayment)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Paid</Text>
                <Text style={styles.resultValue}>
                  {formatCurrency(results.totalPaid)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Interest</Text>
                <Text style={[styles.resultValue, { color: colors.semantic.error }]}>
                  {formatCurrency(results.totalInterest)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Loan Amount</Text>
                <Text style={styles.resultValue}>
                  {formatCurrency(results.principal)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Retirement Calculator Component
function RetirementCalculator({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [currentAge, setCurrentAge] = useState('30');
  const [retirementAge, setRetirementAge] = useState('65');
  const [currentSavings, setCurrentSavings] = useState('50000');
  const [monthlyContribution, setMonthlyContribution] = useState('500');
  const [returnRate, setReturnRate] = useState('7');

  const results = useMemo(() => {
    const age = parseFloat(currentAge) || 0;
    const retAge = parseFloat(retirementAge) || 0;
    const savings = parseFloat(currentSavings) || 0;
    const monthly = parseFloat(monthlyContribution) || 0;
    const rate = parseFloat(returnRate) / 100 || 0;

    const years = retAge - age;
    const months = years * 12;
    const monthlyRate = rate / 12;

    // Future value of current savings
    const futureSavings = savings * Math.pow(1 + monthlyRate, months);

    // Future value of monthly contributions
    const futureContributions =
      monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    const totalSavings = futureSavings + futureContributions;
    const totalContributions = savings + monthly * months;

    return {
      totalSavings: isNaN(totalSavings) ? 0 : totalSavings,
      totalContributions: isNaN(totalContributions) ? 0 : totalContributions,
      investmentGains: isNaN(totalSavings - totalContributions)
        ? 0
        : totalSavings - totalContributions,
      years,
    };
  }, [currentAge, retirementAge, currentSavings, monthlyContribution, returnRate]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>💰 Retirement Calculator</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Input
              label="Current Age"
              value={currentAge}
              onChangeText={setCurrentAge}
              keyboardType="decimal-pad"
              placeholder="30"
            />
            <Input
              label="Retirement Age"
              value={retirementAge}
              onChangeText={setRetirementAge}
              keyboardType="decimal-pad"
              placeholder="65"
            />
            <Input
              label="Current Savings"
              value={currentSavings}
              onChangeText={setCurrentSavings}
              keyboardType="decimal-pad"
              placeholder="50000"
            />
            <Input
              label="Monthly Contribution"
              value={monthlyContribution}
              onChangeText={setMonthlyContribution}
              keyboardType="decimal-pad"
              placeholder="500"
            />
            <Input
              label="Expected Return Rate (%)"
              value={returnRate}
              onChangeText={setReturnRate}
              keyboardType="decimal-pad"
              placeholder="7"
            />

            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>
                Retirement Savings in {results.years} Years
              </Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Savings</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {formatCurrency(results.totalSavings)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Contributions</Text>
                <Text style={styles.resultValue}>
                  {formatCurrency(results.totalContributions)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Investment Gains</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {formatCurrency(results.investmentGains)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Compound Interest Calculator Component
function CompoundInterestCalculator({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [principal, setPrincipal] = useState('10000');
  const [monthlyContribution, setMonthlyContribution] = useState('200');
  const [interestRate, setInterestRate] = useState('7');
  const [years, setYears] = useState('10');

  const results = useMemo(() => {
    const p = parseFloat(principal) || 0;
    const pmt = parseFloat(monthlyContribution) || 0;
    const r = parseFloat(interestRate) / 100 || 0;
    const t = parseFloat(years) || 0;

    const monthlyRate = r / 12;
    const months = t * 12;

    // Future value of principal
    const futurePrincipal = p * Math.pow(1 + monthlyRate, months);

    // Future value of contributions
    const futureContributions =
      pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    const futureValue = futurePrincipal + futureContributions;
    const totalContributed = p + pmt * months;
    const totalInterest = futureValue - totalContributed;

    return {
      futureValue: isNaN(futureValue) ? 0 : futureValue,
      totalContributed: isNaN(totalContributed) ? 0 : totalContributed,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
    };
  }, [principal, monthlyContribution, interestRate, years]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📈 Compound Interest</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Input
              label="Initial Investment"
              value={principal}
              onChangeText={setPrincipal}
              keyboardType="decimal-pad"
              placeholder="10000"
            />
            <Input
              label="Monthly Contribution"
              value={monthlyContribution}
              onChangeText={setMonthlyContribution}
              keyboardType="decimal-pad"
              placeholder="200"
            />
            <Input
              label="Annual Interest Rate (%)"
              value={interestRate}
              onChangeText={setInterestRate}
              keyboardType="decimal-pad"
              placeholder="7"
            />
            <Input
              label="Investment Period (years)"
              value={years}
              onChangeText={setYears}
              keyboardType="decimal-pad"
              placeholder="10"
            />

            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Investment Growth</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Future Value</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {formatCurrency(results.futureValue)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Contributed</Text>
                <Text style={styles.resultValue}>
                  {formatCurrency(results.totalContributed)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Interest Earned</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {formatCurrency(results.totalInterest)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Return on Investment</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {formatPercentage(
                    results.totalContributed > 0
                      ? (results.totalInterest / results.totalContributed) * 100
                      : 0
                  )}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Loan Payoff Calculator Component
function LoanPayoffCalculator({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [loanAmount, setLoanAmount] = useState('20000');
  const [interestRate, setInterestRate] = useState('5.5');
  const [loanTerm, setLoanTerm] = useState('5');
  const [extraPayment, setExtraPayment] = useState('100');

  const results = useMemo(() => {
    const principal = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) / 100 || 0;
    const term = parseFloat(loanTerm) || 0;
    const extra = parseFloat(extraPayment) || 0;

    const monthlyRate = rate / 12;
    const numPayments = term * 12;

    // Standard monthly payment
    const standardPayment =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalPayment = standardPayment * numPayments;
    const totalInterest = totalPayment - principal;

    // Calculate payoff with extra payments
    let balance = principal;
    let monthsToPayoff = 0;
    let totalPaidWithExtra = 0;

    while (balance > 0 && monthsToPayoff < numPayments) {
      const interestCharge = balance * monthlyRate;
      const principalPayment = standardPayment + extra - interestCharge;
      balance -= principalPayment;
      totalPaidWithExtra += standardPayment + extra;
      monthsToPayoff++;

      if (balance < 0) {
        totalPaidWithExtra += balance; // Adjust for overpayment
        balance = 0;
      }
    }

    const savedInterest = totalInterest - (totalPaidWithExtra - principal);
    const monthsSaved = numPayments - monthsToPayoff;

    return {
      standardPayment: isNaN(standardPayment) ? 0 : standardPayment,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
      payoffTime: monthsToPayoff,
      savedInterest: isNaN(savedInterest) ? 0 : savedInterest,
      monthsSaved: monthsSaved > 0 ? monthsSaved : 0,
    };
  }, [loanAmount, interestRate, loanTerm, extraPayment]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>💳 Loan Payoff Calculator</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Input
              label="Loan Amount"
              value={loanAmount}
              onChangeText={setLoanAmount}
              keyboardType="decimal-pad"
              placeholder="20000"
            />
            <Input
              label="Interest Rate (%)"
              value={interestRate}
              onChangeText={setInterestRate}
              keyboardType="decimal-pad"
              placeholder="5.5"
            />
            <Input
              label="Loan Term (years)"
              value={loanTerm}
              onChangeText={setLoanTerm}
              keyboardType="decimal-pad"
              placeholder="5"
            />
            <Input
              label="Extra Monthly Payment"
              value={extraPayment}
              onChangeText={setExtraPayment}
              keyboardType="decimal-pad"
              placeholder="100"
            />

            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Payoff Analysis</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Standard Payment</Text>
                <Text style={styles.resultValue}>
                  {formatCurrency(results.standardPayment)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Payoff Time</Text>
                <Text style={styles.resultValue}>
                  {results.payoffTime} months (
                  {Math.floor(results.payoffTime / 12)} yrs{' '}
                  {results.payoffTime % 12} mo)
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Time Saved</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {results.monthsSaved} months
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Interest Saved</Text>
                <Text
                  style={[styles.resultValue, { color: colors.semantic.success }]}
                >
                  {formatCurrency(results.savedInterest)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Rent vs Buy Calculator Component
function RentVsBuyCalculator({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [homePrice, setHomePrice] = useState('300000');
  const [downPayment, setDownPayment] = useState('60000');
  const [mortgageRate, setMortgageRate] = useState('6.5');
  const [monthlyRent, setMonthlyRent] = useState('1800');
  const [yearsToCompare, setYearsToCompare] = useState('5');

  const results = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    const down = parseFloat(downPayment) || 0;
    const rate = parseFloat(mortgageRate) / 100 || 0;
    const rent = parseFloat(monthlyRent) || 0;
    const years = parseFloat(yearsToCompare) || 0;

    const principal = price - down;
    const monthlyRate = rate / 12;
    const numPayments = 30 * 12; // Assume 30 year mortgage

    const monthlyMortgage =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    // Estimated property tax and insurance (1.5% of home value annually)
    const monthlyPropertyCosts = (price * 0.015) / 12;

    // Total monthly cost of owning
    const totalMonthlyOwnership = monthlyMortgage + monthlyPropertyCosts;

    // Total costs over period
    const totalRentCost = rent * years * 12;
    const totalOwnershipCost =
      down + totalMonthlyOwnership * years * 12;

    // Simplified home appreciation (3% annually)
    const homeValue = price * Math.pow(1.03, years);
    const equity = homeValue - principal;

    const difference = totalOwnershipCost - totalRentCost;
    const recommendation =
      difference < 0
        ? 'Buying is more cost-effective'
        : 'Renting is more cost-effective';

    return {
      monthlyMortgage: isNaN(monthlyMortgage) ? 0 : monthlyMortgage,
      totalMonthlyOwnership: isNaN(totalMonthlyOwnership)
        ? 0
        : totalMonthlyOwnership,
      totalRentCost: isNaN(totalRentCost) ? 0 : totalRentCost,
      totalOwnershipCost: isNaN(totalOwnershipCost) ? 0 : totalOwnershipCost,
      homeValue: isNaN(homeValue) ? 0 : homeValue,
      equity: isNaN(equity) ? 0 : equity,
      difference: isNaN(difference) ? 0 : difference,
      recommendation,
    };
  }, [homePrice, downPayment, mortgageRate, monthlyRent, yearsToCompare]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🏡 Rent vs Buy</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Input
              label="Home Price"
              value={homePrice}
              onChangeText={setHomePrice}
              keyboardType="decimal-pad"
              placeholder="300000"
            />
            <Input
              label="Down Payment"
              value={downPayment}
              onChangeText={setDownPayment}
              keyboardType="decimal-pad"
              placeholder="60000"
            />
            <Input
              label="Mortgage Rate (%)"
              value={mortgageRate}
              onChangeText={setMortgageRate}
              keyboardType="decimal-pad"
              placeholder="6.5"
            />
            <Input
              label="Monthly Rent"
              value={monthlyRent}
              onChangeText={setMonthlyRent}
              keyboardType="decimal-pad"
              placeholder="1800"
            />
            <Input
              label="Years to Compare"
              value={yearsToCompare}
              onChangeText={setYearsToCompare}
              keyboardType="decimal-pad"
              placeholder="5"
            />

            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Comparison Results</Text>

              <View style={styles.comparisonSection}>
                <Text style={styles.comparisonSectionTitle}>Buying</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Monthly Payment</Text>
                  <Text style={styles.resultValue}>
                    {formatCurrency(results.totalMonthlyOwnership)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Total Cost ({yearsToCompare} yrs)</Text>
                  <Text style={styles.resultValue}>
                    {formatCurrency(results.totalOwnershipCost)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Projected Home Value</Text>
                  <Text
                    style={[styles.resultValue, { color: colors.semantic.success }]}
                  >
                    {formatCurrency(results.homeValue)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Estimated Equity</Text>
                  <Text
                    style={[styles.resultValue, { color: colors.semantic.success }]}
                  >
                    {formatCurrency(results.equity)}
                  </Text>
                </View>
              </View>

              <View style={styles.comparisonSection}>
                <Text style={styles.comparisonSectionTitle}>Renting</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Monthly Rent</Text>
                  <Text style={styles.resultValue}>
                    {formatCurrency(parseFloat(monthlyRent) || 0)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Total Cost ({yearsToCompare} yrs)</Text>
                  <Text style={styles.resultValue}>
                    {formatCurrency(results.totalRentCost)}
                  </Text>
                </View>
              </View>

              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationTitle}>Recommendation</Text>
                <Text style={styles.recommendationText}>
                  {results.recommendation}
                </Text>
                <Text style={styles.recommendationNote}>
                  Note: This is a simplified comparison. Consider factors like
                  maintenance, HOA fees, tax benefits, and personal circumstances.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  scrollView: {
    flex: 1,
  },
  calculatorsGrid: {
    padding: spacing[4],
  },
  calculatorCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[5],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.md,
  },
  calculatorIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  calculatorName: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  calculatorDescription: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.light.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  closeButton: {
    ...textStyles.h3,
    color: colors.gray[500],
  },
  modalScroll: {
    maxHeight: '100%',
  },
  resultsCard: {
    backgroundColor: colors.gray[50],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[4],
    marginBottom: spacing[6],
  },
  resultsTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  resultLabel: {
    ...textStyles.body,
    color: colors.gray[600],
    flex: 1,
  },
  resultValue: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    textAlign: 'right',
  },
  comparisonSection: {
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[300],
  },
  comparisonSectionTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  recommendationCard: {
    backgroundColor: colors.primary.blue + '10',
    padding: spacing[4],
    borderRadius: borderRadius.md,
    marginTop: spacing[2],
  },
  recommendationTitle: {
    ...textStyles.body,
    color: colors.primary.blue,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  recommendationText: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  recommendationNote: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
    fontStyle: 'italic',
  },
});

export default CalculatorsScreen;

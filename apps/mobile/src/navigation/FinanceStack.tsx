/**
 * Life Navigator - Finance Stack Navigator
 *
 * Financial module navigation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FinanceStackParamList } from './types';
import { FinanceScreen } from '../screens/main/FinanceScreen';
import { BudgetScreen } from '../screens/finance/BudgetScreen';
import { TransactionsScreen } from '../screens/finance/TransactionsScreen';
import { AccountsScreen } from '../screens/finance/AccountsScreen';
import { CalculatorsScreen } from '../screens/finance/CalculatorsScreen';
// Advanced Financial Planning
import { FinancialPlanningDashboard } from '../screens/finance/advanced/FinancialPlanningDashboard';
import { LegacyPlanningScreen } from '../screens/finance/advanced/LegacyPlanningScreen';
import { RiskManagementScreen } from '../screens/finance/advanced/RiskManagementScreen';
import { TaxPlanningScreen } from '../screens/finance/advanced/TaxPlanningScreen';
import { RetirementPlanningScreen } from '../screens/finance/advanced/RetirementPlanningScreen';
import { BenefitsPlanningScreen } from '../screens/finance/advanced/BenefitsPlanningScreen';
import { InvestmentManagementScreen } from '../screens/finance/advanced/InvestmentManagementScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator<FinanceStackParamList>();

export function FinanceStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.light.primary,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.gray[900],
        },
        headerTintColor: colors.primary.blue,
      }}
    >
      <Stack.Screen
        name="FinanceOverview"
        component={FinanceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Budget"
        component={BudgetScreen}
        options={{ title: 'Budget Tracker' }}
      />
      <Stack.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Transactions' }}
      />
      <Stack.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{ title: 'Accounts' }}
      />
      <Stack.Screen
        name="Calculators"
        component={CalculatorsScreen}
        options={{ title: 'Financial Calculators' }}
      />

      {/* Advanced Financial Planning Screens */}
      <Stack.Screen
        name="FinancialPlanningDashboard"
        component={FinancialPlanningDashboard}
        options={{ title: 'Financial Planning' }}
      />
      <Stack.Screen
        name="LegacyPlanning"
        component={LegacyPlanningScreen}
        options={{ title: 'Legacy Planning' }}
      />
      <Stack.Screen
        name="RiskManagement"
        component={RiskManagementScreen}
        options={{ title: 'Risk & Insurance' }}
      />
      <Stack.Screen
        name="TaxPlanning"
        component={TaxPlanningScreen}
        options={{ title: 'Tax Planning' }}
      />
      <Stack.Screen
        name="RetirementPlanning"
        component={RetirementPlanningScreen}
        options={{ title: 'Retirement Planning' }}
      />
      <Stack.Screen
        name="BenefitsPlanning"
        component={BenefitsPlanningScreen}
        options={{ title: 'Benefits Planning' }}
      />
      <Stack.Screen
        name="InvestmentManagement"
        component={InvestmentManagementScreen}
        options={{ title: 'Investment Management' }}
      />
    </Stack.Navigator>
  );
}

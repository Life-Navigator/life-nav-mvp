/**
 * Life Navigator - Navigation Types
 *
 * Type-safe navigation with TypeScript
 */

import { NavigatorScreenParams } from '@react-navigation/native';

// Root Stack Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Auth Stack Navigator
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Dashboard: undefined;
  Health: NavigatorScreenParams<HealthStackParamList>;
  Finance: NavigatorScreenParams<FinanceStackParamList>;
  Career: NavigatorScreenParams<CareerStackParamList>;
  Education: NavigatorScreenParams<EducationStackParamList>;
  Family: undefined;
  More: NavigatorScreenParams<MoreStackParamList>;
};

// Health Stack Navigator
export type HealthStackParamList = {
  HealthOverview: undefined;
  Appointments: undefined;
  Records: undefined;
  Documents: undefined;
  Wellness: undefined;
  Preventive: undefined;
  WearableIntegrations: undefined;
};

// Finance Stack Navigator
export type FinanceStackParamList = {
  FinanceOverview: undefined;
  Budget: undefined;
  Transactions: undefined;
  Accounts: undefined;
  Calculators: undefined;
  // Advanced Financial Planning
  FinancialPlanningDashboard: undefined;
  LegacyPlanning: undefined;
  RiskManagement: undefined;
  TaxPlanning: undefined;
  RetirementPlanning: undefined;
  BenefitsPlanning: undefined;
  InvestmentManagement: undefined;
};

// Career Stack Navigator
export type CareerStackParamList = {
  CareerOverview: undefined;
  Skills: undefined;
  Resume: undefined;
  Opportunities: undefined;
  Networking: undefined;
};

// Education Stack Navigator
export type EducationStackParamList = {
  EducationOverview: undefined;
  Courses: undefined;
  Certifications: undefined;
  Progress: undefined;
  LearningPath: undefined;
};

// More Stack Navigator
export type MoreStackParamList = {
  MoreMenu: undefined;
  Goals: undefined;
  Calendar: undefined;
  Insights: undefined;
  Roadmap: undefined;
  Integrations: undefined;
  Settings: undefined;
  Profile: undefined;
};

// Screen Props Types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

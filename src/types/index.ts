/**
 * Life Navigator - Core TypeScript Types
 *
 * Elite-level type definitions for the entire application
 */

/**
 * User & Authentication
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  birthDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  birthDate: string;
  acceptTerms: boolean;
}

/**
 * Finance Domain
 */
export interface FinanceAccount {
  id: string;
  name: string;
  institutionName: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan';
  balance: number;
  lastFour: string;
  currency: string;
  status: 'active' | 'inactive' | 'closed';
  lastSynced: string;
  plaidAccountId?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  type: 'debit' | 'credit';
  pending: boolean;
  location?: string;
  notes?: string;
  attachments?: string[];
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
}

export interface Investment {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  totalValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercentage: number;
}

/**
 * Healthcare Domain
 */
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  refillDate: string;
  notes?: string;
  reminders: MedicationReminder[];
}

export interface MedicationReminder {
  id: string;
  medicationId: string;
  time: string; // HH:mm format
  days: number[]; // 0-6 (Sunday-Saturday)
  enabled: boolean;
}

export interface Appointment {
  id: string;
  type: string;
  provider: string;
  date: string;
  duration: number; // minutes
  location: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface HealthScreening {
  id: string;
  type: string;
  lastDate: string;
  nextDueDate: string;
  status: 'overdue' | 'due_soon' | 'up_to_date';
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface MedicalCondition {
  id: string;
  name: string;
  diagnosedDate: string;
  status: 'active' | 'managed' | 'resolved';
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
}

export interface HealthMetric {
  id: string;
  type: 'blood_pressure' | 'blood_sugar' | 'weight' | 'heart_rate';
  value: number;
  secondaryValue?: number; // For blood pressure diastolic
  unit: string;
  date: string;
  source: 'manual' | 'healthkit' | 'google_fit';
}

/**
 * Career Domain
 */
export interface SocialAccount {
  id: string;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'tiktok';
  username: string;
  followers: number;
  engagement: number;
  estimatedValue: number;
  influenceScore: number;
  lastSynced: string;
  connected: boolean;
}

export interface NetworkValue {
  totalValue: number;
  influenceScore: number;
  platforms: SocialAccount[];
  growthRate: number;
  monthlyGrowth: number;
}

export interface Skill {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  endorsements: number;
  lastUsed: string;
  verified: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  verifiedBy?: string;
  category: string;
}

/**
 * Family Domain
 */
export interface FamilyMember {
  id: string;
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  age: number;
  avatar?: string;
  birthDate?: string;
  healthStatus?: 'healthy' | 'needs_attention' | 'critical';
}

export interface FamilyTask {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  recurring: boolean;
  recurrenceRule?: string;
}

export interface FamilyEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  type: 'appointment' | 'school' | 'activity' | 'family_event';
  assignedTo: string[];
  reminders: number[]; // minutes before event
}

export interface FamilyDocument {
  id: string;
  name: string;
  type: 'medical' | 'financial' | 'legal' | 'education' | 'other';
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  sharedWith: string[];
}

/**
 * Goals
 */
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'financial' | 'health' | 'career' | 'family' | 'personal';
  targetDate: string;
  progress: number; // 0-100
  status: 'not_started' | 'in_progress' | 'at_risk' | 'completed';
  milestones: Milestone[];
  metrics: GoalMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
}

export interface GoalMetrics {
  current: number;
  target: number;
  unit: string;
}

/**
 * AI Agent
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  actions?: ChatAction[];
  metadata?: Record<string, any>;
}

export interface ChatAction {
  id: string;
  label: string;
  type: 'url' | 'navigation' | 'api_call';
  payload: any;
}

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  actions?: ChatAction[];
  createdAt: string;
}

/**
 * Notifications
 */
export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

/**
 * API Response
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Theme
 */
export type ColorTheme = 'light' | 'dark' | 'auto';

export interface AppSettings {
  theme: ColorTheme;
  notifications: NotificationSettings;
  biometricEnabled: boolean;
  language: string;
}

export interface NotificationSettings {
  medications: boolean;
  appointments: boolean;
  budgets: boolean;
  goals: boolean;
  aiInsights: boolean;
}

/**
 * Navigation
 */
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MFA: { userId: string };
  Main: undefined;
};

export type MainTabParamList = {
  Finance: undefined;
  Healthcare: undefined;
  Career: undefined;
  Family: undefined;
  Goals: undefined;
  Agent: undefined;
  Settings: undefined;
};

export type FinanceStackParamList = {
  FinanceOverview: undefined;
  Accounts: undefined;
  AccountDetails: { accountId: string };
  Transactions: { accountId?: string };
  TransactionDetails: { transactionId: string };
  AddAccount: undefined;
  Budget: undefined;
  Investments: undefined;
};

// ... similar for other domains

export default {};

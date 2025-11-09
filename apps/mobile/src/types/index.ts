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
  category: string;
  proficiency: number; // 1-5
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  endorsements: number;
  lastUsed: string;
  verified: boolean;
  progress?: SkillProgress[];
  aiRecommendations?: string[];
}

export interface SkillProgress {
  id: string;
  skillId: string;
  proficiency: number;
  date: string;
  notes?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  verifiedBy?: string;
  category: string;
}

export interface NetworkContact {
  id: string;
  name: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  category: 'mentor' | 'colleague' | 'recruiter' | 'client' | 'other';
  lastContact?: string;
  nextFollowUp?: string;
  notes?: string;
  linkedInUrl?: string;
  meetingHistory?: ContactMeeting[];
  tags?: string[];
}

export interface ContactMeeting {
  id: string;
  contactId: string;
  date: string;
  type: 'in_person' | 'video_call' | 'phone_call' | 'email';
  notes?: string;
  followUpRequired: boolean;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'accepted' | 'withdrawn';
  appliedDate: string;
  jobUrl?: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
  };
  location?: string;
  remote?: boolean;
  notes?: string;
  interviews?: Interview[];
  timeline?: ApplicationTimeline[];
}

export interface Interview {
  id: string;
  applicationId: string;
  date: string;
  type: 'phone_screen' | 'technical' | 'behavioral' | 'final' | 'other';
  interviewer?: string;
  duration?: number;
  notes?: string;
  feedback?: string;
}

export interface ApplicationTimeline {
  id: string;
  applicationId: string;
  status: string;
  date: string;
  notes?: string;
}

export interface Course {
  id: string;
  title: string;
  platform: string;
  instructor?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number; // 0-100
  startDate?: string;
  completionDate?: string;
  deadline?: string;
  url?: string;
  materials?: CourseMaterial[];
  grade?: string;
  certificateUrl?: string;
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  type: 'video' | 'document' | 'quiz' | 'assignment' | 'link';
  url?: string;
  completed: boolean;
}

export interface Certification {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expirationDate?: string;
  status: 'in_progress' | 'earned' | 'expired' | 'renewing';
  credentialId?: string;
  credentialUrl?: string;
  verificationUrl?: string;
  documentUrl?: string;
  renewalReminder?: boolean;
  notes?: string;
}

export interface LearningProgress {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalCertifications: number;
  activeCertifications: number;
  currentStreak: number;
  longestStreak: number;
  totalHoursLearned: number;
  weeklyHours: number[];
  monthlyHours: number[];
  achievements: LearningAchievement[];
  milestones: LearningMilestone[];
}

export interface LearningAchievement {
  id: string;
  title: string;
  description: string;
  earnedDate: string;
  icon?: string;
}

export interface LearningMilestone {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  achieved: boolean;
  achievedDate?: string;
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

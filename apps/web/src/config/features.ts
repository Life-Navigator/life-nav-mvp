/**
 * Feature Flags Configuration
 *
 * Control visibility of incomplete or beta features.
 * Set to `true` to enable a feature, `false` to hide it.
 */

export const FEATURES = {
  // ============================================================================
  // EDUCATION MODULE
  // ============================================================================
  EDUCATION_CERTIFICATIONS: true,      // ✅ Fully functional
  EDUCATION_COURSES: false,            // ❌ Coming Soon (no API)
  EDUCATION_PROGRESS: false,           // ❌ Coming Soon (no API)
  EDUCATION_LEARNING_PATHS: false,     // ❌ Coming Soon (no API)
  EDUCATION_DEGREE_ANALYSIS: false,    // ❌ Coming Soon (no API)
  EDUCATION_PLATFORM_INTEGRATIONS: false, // ❌ Coming Soon (all platforms)

  // ============================================================================
  // CAREER MODULE
  // ============================================================================
  CAREER_RESUME_BUILDER: true,         // ✅ Fully functional
  CAREER_JOB_APPLICATIONS: true,       // ✅ Fully functional
  CAREER_SKILLS_MANAGEMENT: true,      // ✅ Fully functional
  CAREER_JOB_BOARDS: false,            // ⚠️ Mock data only
  CAREER_RESUME_EXPORT_PDF: false,     // ❌ Coming Soon
  CAREER_RESUME_EXPORT_DOCX: false,    // ❌ Coming Soon
  CAREER_LINKEDIN_OAUTH: false,        // ❌ Coming Soon
  CAREER_NETWORKING: true,             // ⚠️ Beta (limited features)

  // ============================================================================
  // HEALTHCARE MODULE
  // ============================================================================
  HEALTHCARE_DASHBOARD: true,          // ✅ Basic dashboard
  HEALTHCARE_WEARABLES_CONNECT: true,  // ✅ OAuth works
  HEALTHCARE_WEARABLE_SYNC: false,     // ❌ Data sync not implemented
  HEALTHCARE_MEDICATIONS: false,       // ❌ Coming Soon (no API)
  HEALTHCARE_PROVIDERS: false,         // ❌ Coming Soon (no API)
  HEALTHCARE_APPOINTMENTS: false,      // ❌ Coming Soon (no API)
  HEALTHCARE_INSURANCE: false,         // ❌ Mock data only
  HEALTHCARE_MEDICAL_RECORDS: false,   // ❌ Coming Soon (no API)
  HEALTHCARE_DOCUMENTS: false,         // ❌ Coming Soon (no API)

  // ============================================================================
  // FINANCIAL MODULE
  // ============================================================================
  FINANCIAL_PLAID_ACCOUNTS: true,      // ✅ Fully functional
  FINANCIAL_TRANSACTIONS: true,        // ✅ Fully functional
  FINANCIAL_INVESTMENTS: true,         // ✅ Fully functional
  FINANCIAL_BUDGETS: false,            // ❌ Coming Soon (no API)
  FINANCIAL_RISK_MANAGEMENT: false,    // ❌ Coming Soon (no API)
  FINANCIAL_INSURANCE: false,          // ❌ Coming Soon (no API)
  FINANCIAL_EDUCATION_PLANNING: false, // ❌ Coming Soon (no backend)
  FINANCIAL_TAX_OPTIMIZATION: true,    // ⚠️ Beta (suggestions only)
  FINANCIAL_RETIREMENT_PLANNING: true, // ⚠️ Beta (basic features)

  // ============================================================================
  // GOALS MODULE
  // ============================================================================
  GOALS_CREATION: true,                // ✅ Fully functional
  GOALS_TRACKING: true,                // ✅ Fully functional
  GOALS_MILESTONES: true,              // ✅ Fully functional
  GOALS_ANALYTICS: true,               // ✅ Fully functional
  GOALS_AI_RECOMMENDATIONS: false,     // ❌ Coming Soon
  GOALS_TEMPLATES: false,              // ❌ Coming Soon
  GOALS_SHARING: false,                // ❌ Coming Soon

  // ============================================================================
  // CROSS-CUTTING FEATURES
  // ============================================================================
  AI_CHAT_INTERFACE: false,            // ❌ Phase 2 (Maverick integration)
  MULTI_AGENT_SYSTEM: false,           // ❌ Phase 2 (Maverick integration)
  GRAPHRAG_QUERIES: false,             // ❌ Phase 2 (Maverick integration)
  MOBILE_APP_FULL_SYNC: false,         // ⚠️ Beta (some endpoints missing)
  ANALYTICS_CROSS_DOMAIN: true,        // ✅ Fully functional
  DOCUMENT_VAULT: false,               // ❌ Coming Soon (no backend)
} as const;

/**
 * Check if a feature is enabled
 *
 * @param feature - The feature flag to check
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] ?? false;
}

/**
 * Get all enabled features
 *
 * @returns Array of enabled feature names
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature);
}

/**
 * Get all disabled features
 *
 * @returns Array of disabled feature names
 */
export function getDisabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => !enabled)
    .map(([feature, _]) => feature);
}

/**
 * Get feature status summary
 *
 * @returns Object with enabled and disabled counts
 */
export function getFeatureStats(): { total: number; enabled: number; disabled: number } {
  const total = Object.keys(FEATURES).length;
  const enabled = getEnabledFeatures().length;
  const disabled = getDisabledFeatures().length;

  return { total, enabled, disabled };
}

/**
 * Example usage in components:
 *
 * import { isFeatureEnabled } from '@/config/features';
 *
 * // In your component
 * {isFeatureEnabled('EDUCATION_COURSES') && (
 *   <Link href="/dashboard/education/courses">Courses</Link>
 * )}
 *
 * // Or conditionally render sections
 * if (!isFeatureEnabled('CAREER_JOB_BOARDS')) {
 *   return <ComingSoonBanner feature="Job Boards" />;
 * }
 */

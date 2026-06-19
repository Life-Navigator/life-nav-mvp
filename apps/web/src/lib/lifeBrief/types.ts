/** Stable Life Brief contract — reused by dashboard, advisor, and reports. */
export interface LifeBriefReadiness {
  score: number;
  status: string;
  topStrength: string;
  topGap: string;
}

export interface LifeBrief {
  title: string;
  summary: string;
  careerInsight: string;
  educationInsight: string;
  strengths: string[];
  gaps: string[];
  nextBestActions: string[];
  confidence: number;
  readiness: {
    career: LifeBriefReadiness;
    education: LifeBriefReadiness;
  };
  dataSources: string[];
  missingData: string[];
  /** Coarse data state so the UI can pick empty / limited / rich treatments. */
  state: 'empty' | 'limited' | 'rich';
  updatedAt: string;
}

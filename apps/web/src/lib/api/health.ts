import { 
  Health, 
  VitalData, 
  SleepData,
  NutritionLog,
  ActivityData,
  HealthGoal,
  WellnessScore,
  PreventiveCareRecommendation,
  HealthDocument
} from '@/types/health';

const API_BASE_URL = '/api/health';

export async function getHealthMetrics(): Promise<Health> {
  const response = await fetch(`${API_BASE_URL}/overview`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch health metrics');
  }
  
  return response.json();
}

export async function getVitals(timeRange: string = '7d'): Promise<VitalData[]> {
  const response = await fetch(`${API_BASE_URL}/vitals?timeRange=${timeRange}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch vitals data');
  }
  
  return response.json();
}

export async function getSleepData(timeRange: string = '7d'): Promise<SleepData[]> {
  const response = await fetch(`${API_BASE_URL}/sleep?timeRange=${timeRange}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch sleep data');
  }
  
  return response.json();
}

export async function getNutritionLogs(date?: string): Promise<NutritionLog> {
  const queryParam = date ? `?date=${date}` : '';
  const response = await fetch(`${API_BASE_URL}/nutrition${queryParam}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch nutrition logs');
  }
  
  return response.json();
}

export async function logNutritionEntry(mealData: any): Promise<NutritionLog> {
  const response = await fetch(`${API_BASE_URL}/nutrition/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mealData),
  });
  
  if (!response.ok) {
    throw new Error('Failed to log nutrition entry');
  }
  
  return response.json();
}

export async function getActivityData(timeRange: string = '7d'): Promise<ActivityData[]> {
  const response = await fetch(`${API_BASE_URL}/activity?timeRange=${timeRange}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch activity data');
  }
  
  return response.json();
}

export async function logActivityEntry(activityData: any): Promise<ActivityData> {
  const response = await fetch(`${API_BASE_URL}/activity/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activityData),
  });
  
  if (!response.ok) {
    throw new Error('Failed to log activity entry');
  }
  
  return response.json();
}

export async function logSleepEntry(sleepData: any): Promise<SleepData> {
  const response = await fetch(`${API_BASE_URL}/sleep/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sleepData),
  });
  
  if (!response.ok) {
    throw new Error('Failed to log sleep entry');
  }
  
  return response.json();
}

export async function getHealthGoals(): Promise<HealthGoal[]> {
  const response = await fetch(`${API_BASE_URL}/goals`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch health goals');
  }
  
  return response.json();
}

export async function updateHealthGoal(goalId: string, goalData: Partial<HealthGoal>): Promise<HealthGoal> {
  const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(goalData),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update health goal');
  }
  
  return response.json();
}

export async function getWellnessScore(timeRange: string = '7d'): Promise<WellnessScore[]> {
  const response = await fetch(`${API_BASE_URL}/wellness/score?timeRange=${timeRange}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch wellness score');
  }
  
  return response.json();
}

export async function getPreventiveCareRecommendations(): Promise<PreventiveCareRecommendation[]> {
  const response = await fetch(`${API_BASE_URL}/preventive`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch preventive care recommendations');
  }
  
  return response.json();
}

export async function getHealthDocuments(): Promise<HealthDocument[]> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch health documents');
  }
  
  return response.json();
}

export async function getHealthDocument(documentId: string): Promise<HealthDocument> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch health document');
  }
  
  return response.json();
}

export async function uploadHealthDocument(formData: FormData): Promise<HealthDocument> {
  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload health document');
  }
  
  return response.json();
}
export interface Health {
  healthScore: number;
  bmi: number;
  weight: number;
  height: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  heartRate: number;
  bloodSugar: number;
  cholesterol: {
    total: number;
    hdl: number;
    ldl: number;
  };
  activities: {
    date: string;
    steps: number;
    calories: number;
    activeMinutes: number;
  }[];
  lastUpdated: string;
  medications: Medication[];
  appointments: HealthAppointment[];
  nutritionSummary: NutritionSummary;
  sleepSummary: SleepSummary;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface HealthAppointment {
  id: string;
  provider: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface VitalData {
  date: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  bloodSugar?: number;
  weight?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
}

export interface NutritionSummary {
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  averageWater: number;
  commonFoods: string[];
}

export interface SleepSummary {
  averageDuration: number;
  averageQuality: number;
  averageDeepSleep: number;
  averageRemSleep: number;
}

export interface SleepData {
  date: string;
  duration: number;
  quality: number;
  deepSleep: number;
  remSleep: number;
  lightSleep: number;
  sleepStart: string;
  sleepEnd: string;
}

export interface NutritionLog {
  date: string;
  meals: {
    id: string;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    foods: {
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      servingSize: string;
    }[];
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  }[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  water: number;
}

export interface ActivityData {
  date: string;
  steps: number;
  calories: number;
  activeMinutes: number;
  distance: number;
  workouts?: {
    type: string;
    duration: number;
    calories: number;
    details?: Record<string, any>;
  }[];
  heartRateZones?: {
    restingHeartRate: number;
    zones: {
      name: string;
      min: number;
      max: number;
      minutes: number;
    }[];
  };
}

export interface HealthGoal {
  id: string;
  type: 'weight' | 'activity' | 'nutrition' | 'sleep' | 'other';
  name: string;
  target: number;
  unit: string;
  startDate: string;
  targetDate: string;
  progress: number;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface WellnessScore {
  overall: number;
  activity: number;
  nutrition: number;
  sleep: number;
  stress: number;
  date: string;
}

export interface PreventiveCareRecommendation {
  id: string;
  name: string;
  description: string;
  frequency: string;
  lastCompleted?: string;
  dueDate?: string;
  status: 'up_to_date' | 'due_soon' | 'overdue' | 'not_started';
  category: 'screening' | 'vaccination' | 'check_up' | 'dental' | 'vision' | 'other';
}

export interface HealthDocument {
  id: string;
  name: string;
  type: 'lab_result' | 'prescription' | 'medical_record' | 'insurance' | 'other';
  date: string;
  provider: string;
  fileUrl: string;
  thumbnailUrl?: string;
  notes?: string;
  tags?: string[];
  isShared?: boolean;
  sharedWith?: string[];
}

export interface HealthInsight {
  id: string;
  type: 'recommendation' | 'trend' | 'achievement' | 'warning';
  title: string;
  description: string;
  date: string;
  category: 'activity' | 'nutrition' | 'sleep' | 'vitals' | 'general';
  severity?: 'low' | 'medium' | 'high';
  relatedData?: Record<string, any>;
  action?: {
    label: string;
    url: string;
  };
}
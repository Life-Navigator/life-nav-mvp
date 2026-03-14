/**
 * Google Health Connect API Client
 * Uses Google Fitness API for web access to Health Connect synced data
 *
 * Note: Health Connect is Android-only. This client accesses the same data
 * via Google Fit REST API when Health Connect syncs to Google Fit.
 */

import type {
  FitnessDataSource,
  FitnessDataPoint,
  FitnessSession,
  HealthConnectDataTypes,
} from './types';

const FITNESS_API_BASE = 'https://www.googleapis.com/fitness/v1';

// Data type mappings for Health Connect -> Fitness API
export const HEALTH_DATA_TYPES = {
  // Activity & Fitness
  steps: 'com.google.step_count.delta',
  stepsDaily: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
  distance: 'com.google.distance.delta',
  calories: 'com.google.calories.expended',
  activeMinutes: 'com.google.active_minutes',
  moveMinutes: 'com.google.move_minutes',
  activitySegment: 'com.google.activity.segment',

  // Heart & Vitals
  heartRate: 'com.google.heart_rate.bpm',
  heartPoints: 'com.google.heart_minutes',
  restingHeartRate: 'com.google.heart_rate.summary',
  oxygenSaturation: 'com.google.oxygen_saturation',
  bloodPressure: 'com.google.blood_pressure',
  bodyTemperature: 'com.google.body.temperature',
  respiratoryRate: 'com.google.respiratory_rate',

  // Body Measurements
  weight: 'com.google.weight',
  height: 'com.google.height',
  bodyFat: 'com.google.body.fat.percentage',
  bmi: 'derived:com.google.weight:com.google.android.gms:merge_weight',

  // Sleep
  sleep: 'com.google.sleep.segment',
  sleepStages: 'com.google.sleep.segment',

  // Nutrition
  nutrition: 'com.google.nutrition',
  hydration: 'com.google.hydration',

  // Blood & Glucose
  bloodGlucose: 'com.google.blood_glucose',

  // Reproductive Health
  menstruation: 'com.google.menstruation',
  cervicalMucus: 'com.google.cervical_mucus',
  ovulationTest: 'com.google.ovulation_test',

  // Workouts
  workout: 'com.google.activity.exercise',
  cycling: 'com.google.cycling.pedaling.cadence',
  speed: 'com.google.speed',
  power: 'com.google.power.sample',

  // Location (if permitted)
  location: 'com.google.location.sample',
};

// Activity type mappings
export const ACTIVITY_TYPES: Record<number, string> = {
  0: 'Unknown',
  1: 'Biking',
  2: 'Walking',
  3: 'Running',
  4: 'Workout',
  7: 'Walking (Fitness)',
  8: 'Running (Fitness)',
  9: 'Aerobics',
  10: 'Badminton',
  11: 'Baseball',
  12: 'Basketball',
  13: 'Biathlon',
  14: 'Boxing',
  16: 'Cricket',
  17: 'Curling',
  18: 'Dancing',
  19: 'Diving',
  24: 'Fencing',
  25: 'Football (American)',
  26: 'Football (Australian)',
  27: 'Football (Soccer)',
  28: 'Frisbee',
  29: 'Gardening',
  30: 'Golf',
  31: 'Gymnastics',
  32: 'Handball',
  33: 'Hiking',
  34: 'Hockey',
  35: 'Horseback Riding',
  36: 'Housework',
  37: 'Ice Skating',
  38: 'Jumping Rope',
  39: 'Kayaking',
  40: 'Kickboxing',
  41: 'Kitesurfing',
  42: 'Martial Arts',
  43: 'Meditation',
  44: 'Mixed Martial Arts',
  51: 'Paddling',
  52: 'Paragliding',
  53: 'Pilates',
  54: 'Polo',
  55: 'Racquetball',
  56: 'Rock Climbing',
  57: 'Rowing',
  58: 'Rowing Machine',
  59: 'Rugby',
  60: 'Sailing',
  61: 'Scuba Diving',
  62: 'Skateboarding',
  63: 'Skating',
  64: 'Cross-Country Skiing',
  65: 'Downhill Skiing',
  66: 'Snowboarding',
  67: 'Snowmobile',
  68: 'Snowshoeing',
  72: 'Squash',
  73: 'Stair Climbing',
  74: 'Stair Climbing Machine',
  75: 'Standup Paddleboarding',
  76: 'Strength Training',
  77: 'Surfing',
  78: 'Swimming',
  79: 'Swimming (Pool)',
  80: 'Swimming (Open Water)',
  81: 'Table Tennis',
  82: 'Team Sports',
  83: 'Tennis',
  84: 'Treadmill Running',
  85: 'Treadmill Walking',
  86: 'Volleyball',
  87: 'Volleyball (Beach)',
  88: 'Volleyball (Indoor)',
  89: 'Wakeboarding',
  90: 'Walking (Fitness)',
  91: 'Nap',
  92: 'Water Polo',
  93: 'Weightlifting',
  94: 'Wheelchair',
  95: 'Windsurfing',
  96: 'Yoga',
  97: 'Zumba',
  108: 'Sleep',
  109: 'Light Sleep',
  110: 'Deep Sleep',
  111: 'REM Sleep',
  112: 'Awake (During Sleep)',
  113: 'Calisthenics',
  114: 'HIIT',
  115: 'Interval Training',
  116: 'Walking (Treadmill)',
  117: 'Elliptical',
  118: 'Other',
};

export class GoogleHealthConnectClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${FITNESS_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Fitness API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  // =====================
  // Data Sources
  // =====================

  /**
   * List all data sources
   */
  async listDataSources(dataTypeName?: string): Promise<FitnessDataSource[]> {
    const params = dataTypeName ? `?dataTypeName=${encodeURIComponent(dataTypeName)}` : '';
    const data = await this.request<{ dataSource: FitnessDataSource[] }>(
      `/users/me/dataSources${params}`
    );
    return data.dataSource || [];
  }

  /**
   * Get a specific data source
   */
  async getDataSource(dataSourceId: string): Promise<FitnessDataSource> {
    return this.request<FitnessDataSource>(
      `/users/me/dataSources/${encodeURIComponent(dataSourceId)}`
    );
  }

  /**
   * Create a data source
   */
  async createDataSource(dataSource: {
    dataStreamName: string;
    type: 'raw' | 'derived';
    dataType: {
      name: string;
      field: Array<{ name: string; format: string }>;
    };
    application?: {
      packageName: string;
      version: string;
    };
  }): Promise<FitnessDataSource> {
    return this.request<FitnessDataSource>('/users/me/dataSources', {
      method: 'POST',
      body: JSON.stringify(dataSource),
    });
  }

  // =====================
  // Data Points
  // =====================

  /**
   * Get data points for a time range
   */
  async getDataPoints(
    dataSourceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FitnessDataPoint[]> {
    const startNanos = startTime.getTime() * 1000000;
    const endNanos = endTime.getTime() * 1000000;

    const data = await this.request<{ point: FitnessDataPoint[] }>(
      `/users/me/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${startNanos}-${endNanos}`
    );

    return data.point || [];
  }

  /**
   * Add data points
   */
  async addDataPoints(
    dataSourceId: string,
    datasetId: string,
    points: FitnessDataPoint[]
  ): Promise<void> {
    await this.request(
      `/users/me/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${datasetId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          dataSourceId,
          point: points,
        }),
      }
    );
  }

  /**
   * Delete data points
   */
  async deleteDataPoints(dataSourceId: string, startTime: Date, endTime: Date): Promise<void> {
    const startNanos = startTime.getTime() * 1000000;
    const endNanos = endTime.getTime() * 1000000;

    await fetch(
      `${FITNESS_API_BASE}/users/me/dataSources/${encodeURIComponent(
        dataSourceId
      )}/datasets/${startNanos}-${endNanos}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
  }

  // =====================
  // Aggregated Data
  // =====================

  /**
   * Get aggregated data (daily summaries, etc.)
   */
  async aggregate(
    dataTypeNames: string[],
    startTime: Date,
    endTime: Date,
    bucketBy: 'time' | 'session' | 'activityType' | 'activitySegment' = 'time',
    bucketDuration?: number // milliseconds
  ): Promise<{
    bucket: Array<{
      startTimeMillis: string;
      endTimeMillis: string;
      dataset: Array<{
        dataSourceId: string;
        point: FitnessDataPoint[];
      }>;
      activity?: number;
      session?: FitnessSession;
    }>;
  }> {
    const body: Record<string, unknown> = {
      aggregateBy: dataTypeNames.map((name) => ({ dataTypeName: name })),
      startTimeMillis: startTime.getTime(),
      endTimeMillis: endTime.getTime(),
    };

    if (bucketBy === 'time') {
      body.bucketByTime = {
        durationMillis: bucketDuration || 86400000, // Default 1 day
      };
    } else if (bucketBy === 'session') {
      body.bucketBySession = {};
    } else if (bucketBy === 'activityType') {
      body.bucketByActivityType = {};
    } else if (bucketBy === 'activitySegment') {
      body.bucketByActivitySegment = { minDurationMillis: 60000 };
    }

    return this.request('/users/me/dataset:aggregate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // =====================
  // Sessions (Workouts)
  // =====================

  /**
   * List sessions (workouts)
   */
  async listSessions(
    startTime: Date,
    endTime: Date,
    activityType?: number
  ): Promise<{
    session: FitnessSession[];
    deletedSession: FitnessSession[];
  }> {
    const params = new URLSearchParams();
    params.append('startTime', startTime.toISOString());
    params.append('endTime', endTime.toISOString());
    if (activityType !== undefined) {
      params.append('activityType', activityType.toString());
    }

    return this.request(`/users/me/sessions?${params.toString()}`);
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<FitnessSession> {
    return this.request<FitnessSession>(`/users/me/sessions/${sessionId}`);
  }

  /**
   * Create a session
   */
  async createSession(session: {
    id: string;
    name: string;
    description?: string;
    startTimeMillis: number;
    endTimeMillis: number;
    activityType: number;
    application?: {
      packageName: string;
      version: string;
    };
  }): Promise<FitnessSession> {
    return this.request<FitnessSession>(`/users/me/sessions/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(session),
    });
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await fetch(`${FITNESS_API_BASE}/users/me/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // =====================
  // Convenience Methods
  // =====================

  /**
   * Get steps for a date range
   */
  async getSteps(
    startDate: Date,
    endDate: Date,
    dailyBuckets: boolean = true
  ): Promise<Array<{ date: Date; steps: number }>> {
    const result = await this.aggregate(
      [HEALTH_DATA_TYPES.steps],
      startDate,
      endDate,
      'time',
      dailyBuckets ? 86400000 : 3600000
    );

    return result.bucket.map((bucket) => ({
      date: new Date(parseInt(bucket.startTimeMillis)),
      steps: bucket.dataset[0]?.point[0]?.value[0]?.intVal || 0,
    }));
  }

  /**
   * Get heart rate data
   */
  async getHeartRate(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ timestamp: Date; bpm: number }>> {
    const sources = await this.listDataSources(HEALTH_DATA_TYPES.heartRate);
    if (sources.length === 0) return [];

    const allPoints: Array<{ timestamp: Date; bpm: number }> = [];

    for (const source of sources) {
      const points = await this.getDataPoints(source.dataStreamId, startDate, endDate);

      for (const point of points) {
        const bpm = point.value[0]?.fpVal;
        if (bpm) {
          allPoints.push({
            timestamp: new Date(parseInt(point.startTimeNanos) / 1000000),
            bpm,
          });
        }
      }
    }

    return allPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get sleep data
   */
  async getSleep(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      date: Date;
      totalMinutes: number;
      stages: {
        awake: number;
        light: number;
        deep: number;
        rem: number;
      };
    }>
  > {
    const result = await this.aggregate(
      [HEALTH_DATA_TYPES.sleep],
      startDate,
      endDate,
      'time',
      86400000
    );

    return result.bucket.map((bucket) => {
      const stages = { awake: 0, light: 0, deep: 0, rem: 0 };
      let totalMinutes = 0;

      for (const point of bucket.dataset[0]?.point || []) {
        const activityType = point.value[0]?.intVal;
        const duration =
          (parseInt(point.endTimeNanos) - parseInt(point.startTimeNanos)) / 60000000000; // nanoseconds to minutes

        totalMinutes += duration;

        switch (activityType) {
          case 112:
            stages.awake += duration;
            break;
          case 109:
            stages.light += duration;
            break;
          case 110:
            stages.deep += duration;
            break;
          case 111:
            stages.rem += duration;
            break;
        }
      }

      return {
        date: new Date(parseInt(bucket.startTimeMillis)),
        totalMinutes,
        stages,
      };
    });
  }

  /**
   * Get weight history
   */
  async getWeight(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; weightKg: number }>> {
    const result = await this.aggregate(
      [HEALTH_DATA_TYPES.weight],
      startDate,
      endDate,
      'time',
      86400000
    );

    return result.bucket
      .map((bucket) => {
        const weight = bucket.dataset[0]?.point[0]?.value[0]?.fpVal;
        if (!weight) return null;
        return {
          date: new Date(parseInt(bucket.startTimeMillis)),
          weightKg: weight,
        };
      })
      .filter((item): item is { date: Date; weightKg: number } => item !== null);
  }

  /**
   * Get blood pressure readings
   */
  async getBloodPressure(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      timestamp: Date;
      systolic: number;
      diastolic: number;
    }>
  > {
    const sources = await this.listDataSources(HEALTH_DATA_TYPES.bloodPressure);
    if (sources.length === 0) return [];

    const allReadings: Array<{
      timestamp: Date;
      systolic: number;
      diastolic: number;
    }> = [];

    for (const source of sources) {
      const points = await this.getDataPoints(source.dataStreamId, startDate, endDate);

      for (const point of points) {
        // Blood pressure has multiple values: systolic, diastolic, etc.
        const values = point.value;
        if (values.length >= 2) {
          allReadings.push({
            timestamp: new Date(parseInt(point.startTimeNanos) / 1000000),
            systolic: values[0]?.fpVal || 0,
            diastolic: values[1]?.fpVal || 0,
          });
        }
      }
    }

    return allReadings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get blood glucose readings
   */
  async getBloodGlucose(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      timestamp: Date;
      glucoseMmolL: number;
      mealType?: string;
    }>
  > {
    const sources = await this.listDataSources(HEALTH_DATA_TYPES.bloodGlucose);
    if (sources.length === 0) return [];

    const allReadings: Array<{
      timestamp: Date;
      glucoseMmolL: number;
      mealType?: string;
    }> = [];

    for (const source of sources) {
      const points = await this.getDataPoints(source.dataStreamId, startDate, endDate);

      for (const point of points) {
        const glucose = point.value[0]?.fpVal;
        const mealType = point.value[1]?.intVal;

        if (glucose !== undefined) {
          allReadings.push({
            timestamp: new Date(parseInt(point.startTimeNanos) / 1000000),
            glucoseMmolL: glucose,
            mealType: getMealType(mealType),
          });
        }
      }
    }

    return allReadings;
  }

  /**
   * Get workout sessions
   */
  async getWorkouts(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      id: string;
      name: string;
      activityType: string;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      calories?: number;
      distance?: number;
    }>
  > {
    const sessions = await this.listSessions(startDate, endDate);

    return sessions.session.map((session) => {
      const startTime = new Date(parseInt(session.startTimeMillis));
      const endTime = new Date(parseInt(session.endTimeMillis));

      return {
        id: session.id,
        name: session.name,
        activityType: ACTIVITY_TYPES[session.activityType] || `Activity ${session.activityType}`,
        startTime,
        endTime,
        durationMinutes: (endTime.getTime() - startTime.getTime()) / 60000,
      };
    });
  }

  /**
   * Get daily summary
   */
  async getDailySummary(date: Date): Promise<{
    steps: number;
    distance: number;
    calories: number;
    activeMinutes: number;
    heartPoints: number;
    weight?: number;
    sleepMinutes?: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.aggregate(
      [
        HEALTH_DATA_TYPES.steps,
        HEALTH_DATA_TYPES.distance,
        HEALTH_DATA_TYPES.calories,
        HEALTH_DATA_TYPES.activeMinutes,
        HEALTH_DATA_TYPES.heartPoints,
        HEALTH_DATA_TYPES.weight,
        HEALTH_DATA_TYPES.sleep,
      ],
      startOfDay,
      endOfDay,
      'time',
      86400000
    );

    const bucket = result.bucket[0];
    if (!bucket) {
      return {
        steps: 0,
        distance: 0,
        calories: 0,
        activeMinutes: 0,
        heartPoints: 0,
      };
    }

    return {
      steps: bucket.dataset[0]?.point[0]?.value[0]?.intVal || 0,
      distance: bucket.dataset[1]?.point[0]?.value[0]?.fpVal || 0,
      calories: bucket.dataset[2]?.point[0]?.value[0]?.fpVal || 0,
      activeMinutes: bucket.dataset[3]?.point[0]?.value[0]?.intVal || 0,
      heartPoints: bucket.dataset[4]?.point[0]?.value[0]?.fpVal || 0,
      weight: bucket.dataset[5]?.point[0]?.value[0]?.fpVal,
      sleepMinutes: bucket.dataset[6]?.point[0]?.value[0]?.intVal,
    };
  }

  /**
   * Get weekly summary
   */
  async getWeeklySummary(startDate: Date): Promise<{
    totalSteps: number;
    averageSteps: number;
    totalCalories: number;
    totalActiveMinutes: number;
    workoutCount: number;
    days: Array<{
      date: Date;
      steps: number;
      calories: number;
    }>;
  }> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const result = await this.aggregate(
      [HEALTH_DATA_TYPES.steps, HEALTH_DATA_TYPES.calories],
      startDate,
      endDate,
      'time',
      86400000
    );

    const sessions = await this.listSessions(startDate, endDate);

    let totalSteps = 0;
    let totalCalories = 0;
    const days: Array<{ date: Date; steps: number; calories: number }> = [];

    for (const bucket of result.bucket) {
      const steps = bucket.dataset[0]?.point[0]?.value[0]?.intVal || 0;
      const calories = bucket.dataset[1]?.point[0]?.value[0]?.fpVal || 0;

      totalSteps += steps;
      totalCalories += calories;

      days.push({
        date: new Date(parseInt(bucket.startTimeMillis)),
        steps,
        calories,
      });
    }

    return {
      totalSteps,
      averageSteps: Math.round(totalSteps / 7),
      totalCalories,
      totalActiveMinutes: 0, // Would need separate query
      workoutCount: sessions.session.length,
      days,
    };
  }
}

// Helper functions
function getMealType(type?: number): string | undefined {
  switch (type) {
    case 1:
      return 'unknown';
    case 2:
      return 'fasting';
    case 3:
      return 'before_meal';
    case 4:
      return 'after_meal';
    default:
      return undefined;
  }
}

// Factory function
export function createGoogleHealthConnectClient(accessToken: string): GoogleHealthConnectClient {
  return new GoogleHealthConnectClient(accessToken);
}

// Data type constants already exported at definition above

import { WearableProviderAdapter, WearableMetricData, MetricType } from './types';

export class FitbitAdapter implements WearableProviderAdapter {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  getAuthUrl(state: string): string {
    const scopes = [
      'activity',
      'heartrate',
      'sleep',
      'weight',
      'profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      state,
    });

    return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string) {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      userId: data.user_id,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getDeviceInfo(accessToken: string) {
    const response = await fetch('https://api.fitbit.com/1/user/-/devices.json', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return {};
    }

    const devices = await response.json();

    if (devices && devices.length > 0) {
      const device = devices[0];
      return {
        deviceType: device.type?.toLowerCase() || 'tracker',
        deviceModel: device.deviceVersion || device.type,
        deviceName: device.deviceVersion || 'Fitbit Device',
      };
    }

    return {};
  }

  async syncData(
    accessToken: string,
    dataTypes: MetricType[],
    startDate: Date,
    endDate: Date
  ): Promise<WearableMetricData[]> {
    const metrics: WearableMetricData[] = [];
    const dateStr = startDate.toISOString().split('T')[0];

    // Sync different data types
    for (const type of dataTypes) {
      try {
        switch (type) {
          case 'steps':
            const stepsData = await this.fetchSteps(accessToken, dateStr);
            metrics.push(...stepsData);
            break;
          case 'heart_rate':
            const hrData = await this.fetchHeartRate(accessToken, dateStr);
            metrics.push(...hrData);
            break;
          case 'sleep':
            const sleepData = await this.fetchSleep(accessToken, dateStr);
            metrics.push(...sleepData);
            break;
          case 'calories':
            const caloriesData = await this.fetchCalories(accessToken, dateStr);
            metrics.push(...caloriesData);
            break;
          // Add more metric types as needed
        }
      } catch (error) {
        console.error(`Error syncing ${type}:`, error);
      }
    }

    return metrics;
  }

  private async fetchSteps(accessToken: string, date: string): Promise<WearableMetricData[]> {
    const response = await fetch(
      `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const steps = data.summary?.steps;

    if (steps === undefined) return [];

    return [{
      metricType: 'steps',
      value: steps,
      unit: 'count',
      timestamp: new Date(date),
      sourceRecordId: `fitbit_steps_${date}`,
    }];
  }

  private async fetchHeartRate(accessToken: string, date: string): Promise<WearableMetricData[]> {
    const response = await fetch(
      `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const restingHR = data['activities-heart']?.[0]?.value?.restingHeartRate;

    if (!restingHR) return [];

    return [{
      metricType: 'resting_heart_rate',
      value: restingHR,
      unit: 'bpm',
      timestamp: new Date(date),
      sourceRecordId: `fitbit_rhr_${date}`,
    }];
  }

  private async fetchSleep(accessToken: string, date: string): Promise<WearableMetricData[]> {
    const response = await fetch(
      `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const sleep = data.sleep?.[0];

    if (!sleep) return [];

    const metrics: WearableMetricData[] = [];

    // Total sleep minutes
    if (sleep.minutesAsleep) {
      metrics.push({
        metricType: 'sleep',
        value: sleep.minutesAsleep,
        unit: 'minutes',
        timestamp: new Date(sleep.dateOfSleep),
        startTime: new Date(sleep.startTime),
        endTime: new Date(sleep.endTime),
        sourceRecordId: `fitbit_sleep_${sleep.logId}`,
        metadata: {
          efficiency: sleep.efficiency,
          stages: sleep.levels?.summary,
        },
      });
    }

    return metrics;
  }

  private async fetchCalories(accessToken: string, date: string): Promise<WearableMetricData[]> {
    const response = await fetch(
      `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const calories = data.summary?.caloriesOut;

    if (calories === undefined) return [];

    return [{
      metricType: 'calories',
      value: calories,
      unit: 'kcal',
      timestamp: new Date(date),
      sourceRecordId: `fitbit_calories_${date}`,
    }];
  }
}

// Factory function
export function createFitbitAdapter() {
  const clientId = process.env.FITBIT_CLIENT_ID || '';
  const clientSecret = process.env.FITBIT_CLIENT_SECRET || '';
  const redirectUri = process.env.FITBIT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/callback/fitbit`;

  if (!clientId || !clientSecret) {
    throw new Error('Fitbit credentials not configured');
  }

  return new FitbitAdapter(clientId, clientSecret, redirectUri);
}

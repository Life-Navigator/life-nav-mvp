import { WearableProviderAdapter, WearableMetricData, MetricType } from './types';

export class GoogleFitAdapter implements WearableProviderAdapter {
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
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.heart_rate.read',
      'https://www.googleapis.com/auth/fitness.sleep.read',
      'https://www.googleapis.com/auth/fitness.body.read',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
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
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
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
    const response = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataSources',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const wearableSource = data.dataSource?.find(
      (s: any) => s.device?.type === 'watch' || s.device?.type === 'phone'
    );

    if (wearableSource?.device) {
      return {
        deviceType: wearableSource.device.type,
        deviceModel: wearableSource.device.model,
        deviceName: `${wearableSource.device.manufacturer} ${wearableSource.device.model}`,
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

    for (const type of dataTypes) {
      try {
        let dataTypeName: string | null = null;

        switch (type) {
          case 'steps':
            dataTypeName = 'com.google.step_count.delta';
            break;
          case 'heart_rate':
            dataTypeName = 'com.google.heart_rate.bpm';
            break;
          case 'calories':
            dataTypeName = 'com.google.calories.expended';
            break;
          case 'distance':
            dataTypeName = 'com.google.distance.delta';
            break;
          case 'weight':
            dataTypeName = 'com.google.weight';
            break;
          case 'sleep':
            dataTypeName = 'com.google.sleep.segment';
            break;
        }

        if (dataTypeName) {
          const data = await this.fetchDataType(
            accessToken,
            dataTypeName,
            startDate,
            endDate
          );
          metrics.push(...this.transformData(data, type));
        }
      } catch (error) {
        console.error(`Error syncing ${type}:`, error);
      }
    }

    return metrics;
  }

  private async fetchDataType(
    accessToken: string,
    dataTypeName: string,
    startDate: Date,
    endDate: Date
  ) {
    const startTimeNanos = startDate.getTime() * 1000000;
    const endTimeNanos = endDate.getTime() * 1000000;

    const response = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName,
          }],
          bucketByTime: { durationMillis: 86400000 }, // 1 day buckets
          startTimeMillis: startDate.getTime(),
          endTimeMillis: endDate.getTime(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${dataTypeName}: ${response.statusText}`);
    }

    return await response.json();
  }

  private transformData(apiData: any, metricType: MetricType): WearableMetricData[] {
    const metrics: WearableMetricData[] = [];

    if (!apiData.bucket) return metrics;

    for (const bucket of apiData.bucket) {
      const startTime = new Date(parseInt(bucket.startTimeMillis));
      const endTime = new Date(parseInt(bucket.endTimeMillis));

      for (const dataset of bucket.dataset || []) {
        for (const point of dataset.point || []) {
          const value = point.value?.[0];
          if (!value) continue;

          let metricValue = 0;
          let unit = '';

          switch (metricType) {
            case 'steps':
              metricValue = value.intVal || 0;
              unit = 'count';
              break;
            case 'heart_rate':
              metricValue = value.fpVal || 0;
              unit = 'bpm';
              break;
            case 'calories':
              metricValue = value.fpVal || 0;
              unit = 'kcal';
              break;
            case 'distance':
              metricValue = (value.fpVal || 0) / 1000; // Convert meters to km
              unit = 'km';
              break;
            case 'weight':
              metricValue = value.fpVal || 0;
              unit = 'kg';
              break;
            case 'sleep':
              metricValue = (endTime.getTime() - startTime.getTime()) / 60000; // minutes
              unit = 'minutes';
              break;
          }

          if (metricValue > 0) {
            metrics.push({
              metricType,
              value: metricValue,
              unit,
              timestamp: startTime,
              startTime,
              endTime,
              sourceRecordId: `google_fit_${metricType}_${point.startTimeNanos}`,
            });
          }
        }
      }
    }

    return metrics;
  }
}

// Factory function
export function createGoogleFitAdapter() {
  const clientId = process.env.GOOGLE_FIT_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_FIT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/callback/google-fit`;

  if (!clientId || !clientSecret) {
    throw new Error('Google Fit credentials not configured');
  }

  return new GoogleFitAdapter(clientId, clientSecret, redirectUri);
}

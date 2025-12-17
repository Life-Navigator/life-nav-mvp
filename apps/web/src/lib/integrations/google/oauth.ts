/**
 * Google OAuth Service
 *
 * Unified OAuth handler for all Google APIs with scope management.
 */

import type { GoogleTokens, GoogleUserInfo } from './types';

// All available Google API scopes
export const GOOGLE_SCOPES = {
  // Core
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email',
  openid: 'openid',

  // Calendar
  calendarReadonly: 'https://www.googleapis.com/auth/calendar.readonly',
  calendarEvents: 'https://www.googleapis.com/auth/calendar.events',
  calendar: 'https://www.googleapis.com/auth/calendar',

  // Gmail
  gmailReadonly: 'https://www.googleapis.com/auth/gmail.readonly',
  gmailSend: 'https://www.googleapis.com/auth/gmail.send',
  gmailCompose: 'https://www.googleapis.com/auth/gmail.compose',
  gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
  gmail: 'https://mail.google.com/',

  // Drive
  driveReadonly: 'https://www.googleapis.com/auth/drive.readonly',
  driveFile: 'https://www.googleapis.com/auth/drive.file',
  driveMetadataReadonly: 'https://www.googleapis.com/auth/drive.metadata.readonly',
  drive: 'https://www.googleapis.com/auth/drive',
  driveActivity: 'https://www.googleapis.com/auth/drive.activity.readonly',

  // Docs
  docsReadonly: 'https://www.googleapis.com/auth/documents.readonly',
  docs: 'https://www.googleapis.com/auth/documents',

  // Sheets
  sheetsReadonly: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',

  // Tasks
  tasksReadonly: 'https://www.googleapis.com/auth/tasks.readonly',
  tasks: 'https://www.googleapis.com/auth/tasks',

  // Meet
  meetSpaceReadonly: 'https://www.googleapis.com/auth/meetings.space.readonly',
  meetSpaceCreated: 'https://www.googleapis.com/auth/meetings.space.created',

  // Chat
  chatSpaces: 'https://www.googleapis.com/auth/chat.spaces',
  chatSpacesReadonly: 'https://www.googleapis.com/auth/chat.spaces.readonly',
  chatMessages: 'https://www.googleapis.com/auth/chat.messages',
  chatMessagesCreate: 'https://www.googleapis.com/auth/chat.messages.create',
  chatMemberships: 'https://www.googleapis.com/auth/chat.memberships',

  // People / Contacts
  contactsReadonly: 'https://www.googleapis.com/auth/contacts.readonly',
  contacts: 'https://www.googleapis.com/auth/contacts',
  directoryReadonly: 'https://www.googleapis.com/auth/directory.readonly',

  // Vault (Admin)
  vaultReadonly: 'https://www.googleapis.com/auth/ediscovery.readonly',
  vault: 'https://www.googleapis.com/auth/ediscovery',

  // Fitness / Health Connect
  fitnessActivityRead: 'https://www.googleapis.com/auth/fitness.activity.read',
  fitnessActivityWrite: 'https://www.googleapis.com/auth/fitness.activity.write',
  fitnessBloodGlucoseRead: 'https://www.googleapis.com/auth/fitness.blood_glucose.read',
  fitnessBloodGlucoseWrite: 'https://www.googleapis.com/auth/fitness.blood_glucose.write',
  fitnessBloodPressureRead: 'https://www.googleapis.com/auth/fitness.blood_pressure.read',
  fitnessBloodPressureWrite: 'https://www.googleapis.com/auth/fitness.blood_pressure.write',
  fitnessBodyRead: 'https://www.googleapis.com/auth/fitness.body.read',
  fitnessBodyWrite: 'https://www.googleapis.com/auth/fitness.body.write',
  fitnessBodyTemperatureRead: 'https://www.googleapis.com/auth/fitness.body_temperature.read',
  fitnessBodyTemperatureWrite: 'https://www.googleapis.com/auth/fitness.body_temperature.write',
  fitnessHeartRateRead: 'https://www.googleapis.com/auth/fitness.heart_rate.read',
  fitnessHeartRateWrite: 'https://www.googleapis.com/auth/fitness.heart_rate.write',
  fitnessLocationRead: 'https://www.googleapis.com/auth/fitness.location.read',
  fitnessLocationWrite: 'https://www.googleapis.com/auth/fitness.location.write',
  fitnessNutritionRead: 'https://www.googleapis.com/auth/fitness.nutrition.read',
  fitnessNutritionWrite: 'https://www.googleapis.com/auth/fitness.nutrition.write',
  fitnessOxygenSaturationRead: 'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  fitnessOxygenSaturationWrite: 'https://www.googleapis.com/auth/fitness.oxygen_saturation.write',
  fitnessReproductiveHealthRead: 'https://www.googleapis.com/auth/fitness.reproductive_health.read',
  fitnessReproductiveHealthWrite: 'https://www.googleapis.com/auth/fitness.reproductive_health.write',
  fitnessSleepRead: 'https://www.googleapis.com/auth/fitness.sleep.read',
  fitnessSleepWrite: 'https://www.googleapis.com/auth/fitness.sleep.write',

  // Classroom
  classroomCoursesReadonly: 'https://www.googleapis.com/auth/classroom.courses.readonly',
  classroomCourseworkMe: 'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  classroomRosters: 'https://www.googleapis.com/auth/classroom.rosters.readonly',

  // Home Graph (Smart Home)
  homegraph: 'https://www.googleapis.com/auth/homegraph',
} as const;

// Scope bundles for common use cases
export const SCOPE_BUNDLES = {
  basic: [GOOGLE_SCOPES.profile, GOOGLE_SCOPES.email, GOOGLE_SCOPES.openid],
  calendar: [GOOGLE_SCOPES.calendarEvents, GOOGLE_SCOPES.calendarReadonly],
  calendarFull: [GOOGLE_SCOPES.calendar],
  gmail: [GOOGLE_SCOPES.gmailReadonly, GOOGLE_SCOPES.gmailSend],
  gmailFull: [GOOGLE_SCOPES.gmail],
  drive: [GOOGLE_SCOPES.driveFile, GOOGLE_SCOPES.driveMetadataReadonly],
  driveFull: [GOOGLE_SCOPES.drive, GOOGLE_SCOPES.driveActivity],
  docs: [GOOGLE_SCOPES.docs],
  tasks: [GOOGLE_SCOPES.tasks],
  meet: [GOOGLE_SCOPES.meetSpaceCreated, GOOGLE_SCOPES.meetSpaceReadonly],
  chat: [GOOGLE_SCOPES.chatMessages, GOOGLE_SCOPES.chatSpaces],
  contacts: [GOOGLE_SCOPES.contacts],
  contactsReadonly: [GOOGLE_SCOPES.contactsReadonly],
  fitness: [
    GOOGLE_SCOPES.fitnessActivityRead,
    GOOGLE_SCOPES.fitnessHeartRateRead,
    GOOGLE_SCOPES.fitnessSleepRead,
    GOOGLE_SCOPES.fitnessBodyRead,
  ],
  fitnessFull: [
    GOOGLE_SCOPES.fitnessActivityRead,
    GOOGLE_SCOPES.fitnessActivityWrite,
    GOOGLE_SCOPES.fitnessHeartRateRead,
    GOOGLE_SCOPES.fitnessBloodPressureRead,
    GOOGLE_SCOPES.fitnessBloodGlucoseRead,
    GOOGLE_SCOPES.fitnessBodyRead,
    GOOGLE_SCOPES.fitnessBodyTemperatureRead,
    GOOGLE_SCOPES.fitnessNutritionRead,
    GOOGLE_SCOPES.fitnessOxygenSaturationRead,
    GOOGLE_SCOPES.fitnessSleepRead,
  ],
  classroom: [
    GOOGLE_SCOPES.classroomCoursesReadonly,
    GOOGLE_SCOPES.classroomCourseworkMe,
  ],
  vault: [GOOGLE_SCOPES.vault],
  all: Object.values(GOOGLE_SCOPES),
};

export class GoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    clientId: string = process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: string = process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: string = process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback/google`
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(scopes: string[], state: string, options?: {
    accessType?: 'online' | 'offline';
    prompt?: 'none' | 'consent' | 'select_account';
    loginHint?: string;
    includeGrantedScopes?: boolean;
  }): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: options?.accessType || 'offline',
      prompt: options?.prompt || 'consent',
    });

    if (options?.loginHint) {
      params.append('login_hint', options.loginHint);
    }

    if (options?.includeGrantedScopes) {
      params.append('include_granted_scopes', 'true');
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<GoogleTokens> {
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
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<GoogleTokens> {
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
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Refresh token doesn't change
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${token}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error('Token revocation failed');
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      givenName: data.given_name,
      familyName: data.family_name,
      picture: data.picture,
      locale: data.locale,
    };
  }

  /**
   * Check if token has required scopes
   */
  hasScopes(grantedScopes: string, requiredScopes: string[]): boolean {
    const granted = grantedScopes.split(' ');
    return requiredScopes.every(scope => granted.includes(scope));
  }

  /**
   * Get missing scopes
   */
  getMissingScopes(grantedScopes: string, requiredScopes: string[]): string[] {
    const granted = grantedScopes.split(' ');
    return requiredScopes.filter(scope => !granted.includes(scope));
  }
}

// Factory function
export function createGoogleOAuthService(): GoogleOAuthService {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new GoogleOAuthService(clientId, clientSecret);
}

// Token storage helpers (for use with your database)
export interface StoredGoogleToken {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  provider: 'google';
}

export function isTokenExpired(expiresAt: Date, bufferSeconds: number = 300): boolean {
  return new Date(expiresAt).getTime() - bufferSeconds * 1000 < Date.now();
}

export async function getValidToken(
  stored: StoredGoogleToken,
  oauth: GoogleOAuthService
): Promise<string> {
  if (!isTokenExpired(stored.expiresAt)) {
    return stored.accessToken;
  }

  // Token expired, refresh it
  const newTokens = await oauth.refreshToken(stored.refreshToken);
  // Note: Caller should update stored token in database
  return newTokens.accessToken;
}

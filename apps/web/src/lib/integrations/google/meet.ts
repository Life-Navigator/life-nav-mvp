/**
 * Google Meet API Client
 */

import type { GoogleMeetSpace, GoogleMeetConferenceRecord } from './types';

const MEET_API_BASE = 'https://meet.googleapis.com/v2';

export class GoogleMeetClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${MEET_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Meet API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Create a new meeting space
   */
  async createSpace(config?: {
    accessType?: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
    entryPointAccess?: 'ALL' | 'CREATOR_APP_ONLY';
  }): Promise<GoogleMeetSpace> {
    const body: Record<string, unknown> = {};

    if (config) {
      body.config = {
        accessType: config.accessType || 'OPEN',
        entryPointAccess: config.entryPointAccess || 'ALL',
      };
    }

    return this.request<GoogleMeetSpace>('/spaces', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get a meeting space
   */
  async getSpace(spaceName: string): Promise<GoogleMeetSpace> {
    return this.request<GoogleMeetSpace>(`/${spaceName}`);
  }

  /**
   * Update a meeting space
   */
  async updateSpace(
    spaceName: string,
    config: {
      accessType?: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
      entryPointAccess?: 'ALL' | 'CREATOR_APP_ONLY';
    }
  ): Promise<GoogleMeetSpace> {
    return this.request<GoogleMeetSpace>(`/${spaceName}`, {
      method: 'PATCH',
      body: JSON.stringify({ config }),
    });
  }

  /**
   * End an active meeting
   */
  async endActiveConference(spaceName: string): Promise<void> {
    await this.request(`/${spaceName}:endActiveConference`, {
      method: 'POST',
    });
  }

  /**
   * List conference records for a space
   */
  async listConferenceRecords(options?: {
    filter?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<{
    conferenceRecords: GoogleMeetConferenceRecord[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.filter) params.append('filter', options.filter);
    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    return this.request(`/conferenceRecords${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a conference record
   */
  async getConferenceRecord(name: string): Promise<GoogleMeetConferenceRecord> {
    return this.request<GoogleMeetConferenceRecord>(`/${name}`);
  }

  /**
   * List participants in a conference
   */
  async listParticipants(
    conferenceRecordName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
    }
  ): Promise<{
    participants: Array<{
      name: string;
      displayName?: string;
      earliestStartTime?: string;
      latestEndTime?: string;
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);

    const queryString = params.toString();
    return this.request(
      `/${conferenceRecordName}/participants${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * List participant sessions
   */
  async listParticipantSessions(
    participantName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
    }
  ): Promise<{
    participantSessions: Array<{
      name: string;
      startTime: string;
      endTime?: string;
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.filter) params.append('filter', options.filter);

    const queryString = params.toString();
    return this.request(
      `/${participantName}/participantSessions${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * List recordings for a conference
   */
  async listRecordings(
    conferenceRecordName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<{
    recordings: Array<{
      name: string;
      state: 'STARTED' | 'ENDED' | 'FILE_GENERATED';
      startTime: string;
      endTime?: string;
      driveDestination?: {
        file: string;
        exportUri: string;
      };
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    return this.request(
      `/${conferenceRecordName}/recordings${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * List transcripts for a conference
   */
  async listTranscripts(
    conferenceRecordName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<{
    transcripts: Array<{
      name: string;
      state: 'STARTED' | 'ENDED' | 'FILE_GENERATED';
      startTime: string;
      endTime?: string;
      docsDestination?: {
        document: string;
        exportUri: string;
      };
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    return this.request(
      `/${conferenceRecordName}/transcripts${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Get transcript entries
   */
  async listTranscriptEntries(
    transcriptName: string,
    options?: {
      pageSize?: number;
      pageToken?: string;
    }
  ): Promise<{
    transcriptEntries: Array<{
      name: string;
      participant: string;
      text: string;
      languageCode: string;
      startTime: string;
      endTime: string;
    }>;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();

    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    return this.request(
      `/${transcriptName}/entries${queryString ? `?${queryString}` : ''}`
    );
  }

  // =====================
  // Convenience Methods
  // =====================

  /**
   * Create an instant meeting and get the join URL
   */
  async createInstantMeeting(): Promise<{
    meetingUri: string;
    meetingCode: string;
    spaceName: string;
  }> {
    const space = await this.createSpace({ accessType: 'OPEN' });
    return {
      meetingUri: space.meetingUri,
      meetingCode: space.meetingCode,
      spaceName: space.name,
    };
  }

  /**
   * Create a restricted meeting (only invited users can join)
   */
  async createRestrictedMeeting(): Promise<{
    meetingUri: string;
    meetingCode: string;
    spaceName: string;
  }> {
    const space = await this.createSpace({ accessType: 'RESTRICTED' });
    return {
      meetingUri: space.meetingUri,
      meetingCode: space.meetingCode,
      spaceName: space.name,
    };
  }

  /**
   * Get meeting statistics
   */
  async getMeetingStats(conferenceRecordName: string): Promise<{
    participantCount: number;
    duration: number; // in milliseconds
    hasRecording: boolean;
    hasTranscript: boolean;
  }> {
    const [conference, participants, recordings, transcripts] = await Promise.all([
      this.getConferenceRecord(conferenceRecordName),
      this.listParticipants(conferenceRecordName),
      this.listRecordings(conferenceRecordName).catch(() => ({ recordings: [] })),
      this.listTranscripts(conferenceRecordName).catch(() => ({ transcripts: [] })),
    ]);

    const startTime = new Date(conference.startTime).getTime();
    const endTime = conference.endTime
      ? new Date(conference.endTime).getTime()
      : Date.now();

    return {
      participantCount: participants.participants.length,
      duration: endTime - startTime,
      hasRecording: recordings.recordings.length > 0,
      hasTranscript: transcripts.transcripts.length > 0,
    };
  }
}

// Factory function
export function createGoogleMeetClient(accessToken: string): GoogleMeetClient {
  return new GoogleMeetClient(accessToken);
}

/**
 * Create a Google Meet link using Calendar API
 * (Alternative method for creating meetings with more features)
 */
export async function createMeetWithCalendar(
  accessToken: string,
  options: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
  }
): Promise<{
  meetLink: string;
  eventId: string;
  eventLink: string;
}> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: options.summary,
        description: options.description,
        start: {
          dateTime: options.start.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: options.end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: options.attendees?.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create meeting: ${error.error?.message}`);
  }

  const event = await response.json();

  return {
    meetLink: event.conferenceData?.entryPoints?.find(
      (e: { entryPointType: string }) => e.entryPointType === 'video'
    )?.uri || '',
    eventId: event.id,
    eventLink: event.htmlLink,
  };
}

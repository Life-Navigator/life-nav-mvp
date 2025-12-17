/**
 * Google Calendar API Client
 */

import type {
  GoogleCalendar,
  GoogleCalendarEvent,
  CreateEventRequest,
  GoogleApiResponse,
} from './types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleCalendarClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
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
        `Calendar API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * List all calendars
   */
  async listCalendars(): Promise<GoogleCalendar[]> {
    const data = await this.request<{ items: GoogleCalendar[] }>(
      '/users/me/calendarList'
    );
    return data.items || [];
  }

  /**
   * Get a specific calendar
   */
  async getCalendar(calendarId: string): Promise<GoogleCalendar> {
    return this.request<GoogleCalendar>(
      `/users/me/calendarList/${encodeURIComponent(calendarId)}`
    );
  }

  /**
   * List events from a calendar
   */
  async listEvents(
    calendarId: string = 'primary',
    options?: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
      orderBy?: 'startTime' | 'updated';
      singleEvents?: boolean;
      q?: string;
      pageToken?: string;
    }
  ): Promise<GoogleApiResponse<GoogleCalendarEvent[]>> {
    const params = new URLSearchParams();

    if (options?.timeMin) {
      params.append('timeMin', options.timeMin.toISOString());
    }
    if (options?.timeMax) {
      params.append('timeMax', options.timeMax.toISOString());
    }
    if (options?.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }
    if (options?.orderBy) {
      params.append('orderBy', options.orderBy);
    }
    if (options?.singleEvents !== undefined) {
      params.append('singleEvents', options.singleEvents.toString());
    }
    if (options?.q) {
      params.append('q', options.q);
    }
    if (options?.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    const queryString = params.toString();
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events${
      queryString ? `?${queryString}` : ''
    }`;

    const data = await this.request<{
      items: GoogleCalendarEvent[];
      nextPageToken?: string;
    }>(endpoint);

    return {
      data: data.items || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get a specific event
   */
  async getEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
        eventId
      )}`
    );
  }

  /**
   * Create a new event
   */
  async createEvent(
    request: CreateEventRequest
  ): Promise<GoogleCalendarEvent> {
    const calendarId = request.calendarId || 'primary';

    const eventBody: Record<string, unknown> = {
      summary: request.summary,
      description: request.description,
      location: request.location,
      start: {
        dateTime: request.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: request.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (request.attendees?.length) {
      eventBody.attendees = request.attendees.map((email) => ({ email }));
    }

    if (request.recurrence?.length) {
      eventBody.recurrence = request.recurrence;
    }

    // Add Google Meet conference if requested
    if (request.conferenceDataVersion === 1) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const params = new URLSearchParams();
    if (request.conferenceDataVersion !== undefined) {
      params.append(
        'conferenceDataVersion',
        request.conferenceDataVersion.toString()
      );
    }
    if (request.sendUpdates) {
      params.append('sendUpdates', request.sendUpdates);
    }

    const queryString = params.toString();
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events${
      queryString ? `?${queryString}` : ''
    }`;

    return this.request<GoogleCalendarEvent>(endpoint, {
      method: 'POST',
      body: JSON.stringify(eventBody),
    });
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CreateEventRequest>,
    calendarId: string = 'primary',
    sendUpdates?: 'all' | 'externalOnly' | 'none'
  ): Promise<GoogleCalendarEvent> {
    const params = new URLSearchParams();
    if (sendUpdates) {
      params.append('sendUpdates', sendUpdates);
    }

    const queryString = params.toString();
    const endpoint = `/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}${
      queryString ? `?${queryString}` : ''
    }`;

    const eventBody: Record<string, unknown> = {};

    if (updates.summary) eventBody.summary = updates.summary;
    if (updates.description) eventBody.description = updates.description;
    if (updates.location) eventBody.location = updates.location;
    if (updates.start) {
      eventBody.start = {
        dateTime: updates.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (updates.end) {
      eventBody.end = {
        dateTime: updates.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (updates.attendees) {
      eventBody.attendees = updates.attendees.map((email) => ({ email }));
    }

    return this.request<GoogleCalendarEvent>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(eventBody),
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary',
    sendUpdates?: 'all' | 'externalOnly' | 'none'
  ): Promise<void> {
    const params = new URLSearchParams();
    if (sendUpdates) {
      params.append('sendUpdates', sendUpdates);
    }

    const queryString = params.toString();
    const endpoint = `/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}${
      queryString ? `?${queryString}` : ''
    }`;

    await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Quick add event using natural language
   */
  async quickAddEvent(
    text: string,
    calendarId: string = 'primary'
  ): Promise<GoogleCalendarEvent> {
    const params = new URLSearchParams({ text });
    return this.request<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?${params}`,
      { method: 'POST' }
    );
  }

  /**
   * Get free/busy information
   */
  async getFreeBusy(
    timeMin: Date,
    timeMax: Date,
    calendarIds: string[] = ['primary']
  ): Promise<Record<string, { busy: Array<{ start: string; end: string }> }>> {
    const data = await this.request<{
      calendars: Record<
        string,
        { busy: Array<{ start: string; end: string }> }
      >;
    }>('/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      }),
    });

    return data.calendars;
  }

  /**
   * Watch for changes (webhook setup)
   */
  async watchCalendar(
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    expiration?: Date
  ): Promise<{
    resourceId: string;
    resourceUri: string;
    expiration: string;
  }> {
    return this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: 'POST',
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          expiration: expiration?.getTime(),
        }),
      }
    );
  }
}

// Factory function
export function createGoogleCalendarClient(
  accessToken: string
): GoogleCalendarClient {
  return new GoogleCalendarClient(accessToken);
}

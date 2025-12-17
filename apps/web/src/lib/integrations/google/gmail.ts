/**
 * Gmail API Client
 */

import type {
  GmailMessage,
  GmailThread,
  GmailLabel,
  SendEmailRequest,
  GoogleApiResponse,
} from './types';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export class GmailClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
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
        `Gmail API error: ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * List messages
   */
  async listMessages(options?: {
    q?: string;
    labelIds?: string[];
    maxResults?: number;
    pageToken?: string;
    includeSpamTrash?: boolean;
  }): Promise<GoogleApiResponse<Array<{ id: string; threadId: string }>>> {
    const params = new URLSearchParams();

    if (options?.q) params.append('q', options.q);
    if (options?.labelIds) {
      options.labelIds.forEach((id) => params.append('labelIds', id));
    }
    if (options?.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.includeSpamTrash !== undefined) {
      params.append('includeSpamTrash', options.includeSpamTrash.toString());
    }

    const queryString = params.toString();
    const data = await this.request<{
      messages: Array<{ id: string; threadId: string }>;
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>(`/users/me/messages${queryString ? `?${queryString}` : ''}`);

    return {
      data: data.messages || [],
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
    };
  }

  /**
   * Get a specific message
   */
  async getMessage(
    messageId: string,
    format: 'minimal' | 'full' | 'raw' | 'metadata' = 'full'
  ): Promise<GmailMessage> {
    return this.request<GmailMessage>(
      `/users/me/messages/${messageId}?format=${format}`
    );
  }

  /**
   * Get message body text
   */
  getMessageBody(message: GmailMessage): string {
    const payload = message.payload;

    // Check for plain text in body
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Check parts for text/plain or text/html
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return '';
  }

  /**
   * Get message header value
   */
  getHeader(message: GmailMessage, name: string): string | undefined {
    const header = message.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value;
  }

  /**
   * Send an email
   */
  async sendEmail(request: SendEmailRequest): Promise<GmailMessage> {
    const boundary = `boundary_${Date.now()}`;
    const mimeMessage = this.buildMimeMessage(request, boundary);
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const body: Record<string, unknown> = { raw: encodedMessage };

    if (request.threadId) {
      body.threadId = request.threadId;
    }

    return this.request<GmailMessage>('/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private buildMimeMessage(request: SendEmailRequest, boundary: string): string {
    const lines: string[] = [];

    // Headers
    lines.push(`To: ${request.to.join(', ')}`);
    if (request.cc?.length) {
      lines.push(`Cc: ${request.cc.join(', ')}`);
    }
    if (request.bcc?.length) {
      lines.push(`Bcc: ${request.bcc.join(', ')}`);
    }
    lines.push(`Subject: ${request.subject}`);

    if (request.replyToMessageId) {
      lines.push(`In-Reply-To: ${request.replyToMessageId}`);
      lines.push(`References: ${request.replyToMessageId}`);
    }

    if (request.attachments?.length) {
      // Multipart message with attachments
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
    }

    // Body
    const contentType = request.isHtml ? 'text/html' : 'text/plain';
    lines.push(`Content-Type: ${contentType}; charset="UTF-8"`);
    lines.push('');
    lines.push(request.body);

    // Attachments
    if (request.attachments?.length) {
      for (const attachment of request.attachments) {
        lines.push(`--${boundary}`);
        lines.push(
          `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`
        );
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(
          `Content-Disposition: attachment; filename="${attachment.filename}"`
        );
        lines.push('');
        lines.push(attachment.data);
      }
      lines.push(`--${boundary}--`);
    }

    return lines.join('\r\n');
  }

  /**
   * Create a draft
   */
  async createDraft(request: SendEmailRequest): Promise<{ id: string }> {
    const boundary = `boundary_${Date.now()}`;
    const mimeMessage = this.buildMimeMessage(request, boundary);
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return this.request<{ id: string }>('/users/me/drafts', {
      method: 'POST',
      body: JSON.stringify({
        message: { raw: encodedMessage },
      }),
    });
  }

  /**
   * List labels
   */
  async listLabels(): Promise<GmailLabel[]> {
    const data = await this.request<{ labels: GmailLabel[] }>(
      '/users/me/labels'
    );
    return data.labels || [];
  }

  /**
   * Get a label
   */
  async getLabel(labelId: string): Promise<GmailLabel> {
    return this.request<GmailLabel>(`/users/me/labels/${labelId}`);
  }

  /**
   * Create a label
   */
  async createLabel(
    name: string,
    options?: {
      messageListVisibility?: 'show' | 'hide';
      labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
    }
  ): Promise<GmailLabel> {
    return this.request<GmailLabel>('/users/me/labels', {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...options,
      }),
    });
  }

  /**
   * Modify message labels
   */
  async modifyMessage(
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<GmailMessage> {
    return this.request<GmailMessage>(`/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    });
  }

  /**
   * Trash a message
   */
  async trashMessage(messageId: string): Promise<GmailMessage> {
    return this.request<GmailMessage>(`/users/me/messages/${messageId}/trash`, {
      method: 'POST',
    });
  }

  /**
   * Untrash a message
   */
  async untrashMessage(messageId: string): Promise<GmailMessage> {
    return this.request<GmailMessage>(`/users/me/messages/${messageId}/untrash`, {
      method: 'POST',
    });
  }

  /**
   * Delete a message permanently
   */
  async deleteMessage(messageId: string): Promise<void> {
    await fetch(`${GMAIL_API_BASE}/users/me/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * List threads
   */
  async listThreads(options?: {
    q?: string;
    labelIds?: string[];
    maxResults?: number;
    pageToken?: string;
  }): Promise<GoogleApiResponse<Array<{ id: string; snippet: string }>>> {
    const params = new URLSearchParams();

    if (options?.q) params.append('q', options.q);
    if (options?.labelIds) {
      options.labelIds.forEach((id) => params.append('labelIds', id));
    }
    if (options?.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString();
    const data = await this.request<{
      threads: Array<{ id: string; snippet: string }>;
      nextPageToken?: string;
    }>(`/users/me/threads${queryString ? `?${queryString}` : ''}`);

    return {
      data: data.threads || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get a thread with all messages
   */
  async getThread(threadId: string): Promise<GmailThread> {
    return this.request<GmailThread>(`/users/me/threads/${threadId}`);
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<{
    emailAddress: string;
    messagesTotal: number;
    threadsTotal: number;
    historyId: string;
  }> {
    return this.request('/users/me/profile');
  }

  /**
   * Watch for changes (push notifications)
   */
  async watch(
    topicName: string,
    labelIds?: string[]
  ): Promise<{
    historyId: string;
    expiration: string;
  }> {
    return this.request('/users/me/watch', {
      method: 'POST',
      body: JSON.stringify({
        topicName,
        labelIds,
      }),
    });
  }

  /**
   * Stop watching for changes
   */
  async stopWatch(): Promise<void> {
    await this.request('/users/me/stop', { method: 'POST' });
  }
}

// Factory function
export function createGmailClient(accessToken: string): GmailClient {
  return new GmailClient(accessToken);
}

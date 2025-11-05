// Email-related types

// Email Provider
export interface EmailProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  oauthEnabled: boolean;
  calendarSupport: boolean;
  contactsSupport: boolean;
  defaultSettings?: {
    imapServer?: string;
    imapPort?: number;
    smtpServer?: string;
    smtpPort?: number;
    useSSL?: boolean;
  };
}

// Email Account
export interface EmailAccount {
  id: string;
  provider: string;
  email: string;
  connected: boolean;
  lastSync: string | Date;
  unread?: number;
  folders?: string[];
  calendarConnected?: boolean;
  calendarId?: string;
}

// Email Connection Request
export interface EmailConnectionRequest {
  provider: string;
  email: string;
  credentials?: {
    password?: string;
    imapServer?: string;
    imapPort?: string;
    smtpServer?: string;
    smtpPort?: string;
    useSSL?: boolean;
  };
}

// Email Address
export interface EmailAddress {
  name: string;
  email: string;
}

// Email Attachment
export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
}

// Email Message
export interface EmailMessage {
  id: string;
  accountId: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  date: string | Date;
  body: string;
  htmlBody?: string;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  folder: string;
  labels?: string[];
  threadId?: string;
  isForwarded?: boolean;
  isReplied?: boolean;
  isDraft?: boolean;
}

// Email Folder
export interface EmailFolder {
  id: string;
  name: string;
  path: string;
  unread: number;
  total: number;
  system: boolean;
}

// Email Thread
export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  lastMessageDate: string | Date;
  messageCount: number;
  unread: boolean;
  hasAttachments: boolean;
  participants: EmailAddress[];
  messages: EmailMessage[];
}

// Email Compose Options
export interface EmailComposeOptions {
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject?: string;
  body?: string;
  htmlBody?: string;
  attachments?: File[];
  draft?: boolean;
  replyTo?: EmailMessage;
  forwardFrom?: EmailMessage;
}

// Email OAuth Token Response
export interface EmailOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

// Email Search Options
export interface EmailSearchOptions {
  query: string;
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  read?: boolean;
  starred?: boolean;
  after?: Date;
  before?: Date;
}

// Email Sync Status
export interface EmailSyncStatus {
  accountId: string;
  lastSync: Date | null;
  inProgress: boolean;
  error: string | null;
  totalMessages: number;
  newMessages: number;
}

// Calendar Connection from Email
export interface CalendarConnection {
  id: string;
  provider: string;
  name: string;
  email: string;
  connected: boolean;
  lastSync: Date | null;
  emailConnectionId: string;
  color?: string;
  isDefault?: boolean;
}

// Calendar Sync Result
export interface CalendarSyncResult {
  email: string;
  calendarId: string;
  success: boolean;
  eventsAdded: number;
  eventsUpdated?: number;
  eventsRemoved?: number;
  error?: string;
}
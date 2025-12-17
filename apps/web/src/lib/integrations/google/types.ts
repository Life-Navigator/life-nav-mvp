/**
 * Google API Types
 */

// OAuth Types
export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
  tokenType: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
}

// Calendar Types
export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  creator?: {
    email: string;
    displayName?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: {
      name: string;
      iconUri?: string;
    };
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
  recurrence?: string[];
  recurringEventId?: string;
}

export interface CreateEventRequest {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  conferenceDataVersion?: 0 | 1;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
  recurrence?: string[];
}

// Gmail Types
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string; size: number };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size: number };
    }>;
    mimeType: string;
  };
  sizeEstimate: number;
}

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: string; // Base64 encoded
  }>;
  replyToMessageId?: string;
  threadId?: string;
}

// Drive Types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  owners?: Array<{
    email: string;
    displayName?: string;
  }>;
  permissions?: DrivePermission[];
}

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  domain?: string;
}

export interface DriveActivity {
  primaryActionDetail: {
    create?: object;
    edit?: object;
    move?: { addedParents?: object[]; removedParents?: object[] };
    rename?: { oldTitle: string; newTitle: string };
    delete?: { type: string };
    restore?: { type: string };
    permissionChange?: object;
    comment?: object;
  };
  actors: Array<{
    user?: { knownUser?: { personName: string } };
    anonymous?: object;
    impersonation?: object;
    system?: object;
    administrator?: object;
  }>;
  targets: Array<{
    driveItem?: {
      name: string;
      title: string;
      mimeType: string;
    };
  }>;
  timestamp: string;
}

// Docs Types
export interface GoogleDoc {
  documentId: string;
  title: string;
  body: {
    content: DocContent[];
  };
  revisionId: string;
  suggestionsViewMode: string;
}

export interface DocContent {
  startIndex: number;
  endIndex: number;
  paragraph?: {
    elements: Array<{
      startIndex: number;
      endIndex: number;
      textRun?: {
        content: string;
        textStyle?: object;
      };
    }>;
  };
  table?: object;
  sectionBreak?: object;
}

// Tasks Types
export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
  selfLink: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  parent?: string;
  position?: string;
  links?: Array<{
    type: string;
    description?: string;
    link: string;
  }>;
}

export interface CreateTaskRequest {
  taskListId?: string;
  title: string;
  notes?: string;
  due?: Date;
  parent?: string;
}

// Meet Types
export interface GoogleMeetSpace {
  name: string;
  meetingUri: string;
  meetingCode: string;
  config?: {
    accessType: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
    entryPointAccess: 'ALL' | 'CREATOR_APP_ONLY';
  };
}

export interface GoogleMeetConferenceRecord {
  name: string;
  startTime: string;
  endTime?: string;
  expireTime?: string;
  space: string;
}

// Chat Types
export interface GoogleChatSpace {
  name: string;
  type: 'ROOM' | 'DM' | 'SPACE';
  displayName?: string;
  singleUserBotDm?: boolean;
  threaded?: boolean;
  spaceDetails?: {
    description?: string;
    guidelines?: string;
  };
}

export interface GoogleChatMessage {
  name: string;
  sender: {
    name: string;
    displayName: string;
    type: 'HUMAN' | 'BOT';
  };
  createTime: string;
  text?: string;
  cards?: object[];
  thread?: {
    name: string;
  };
}

// People Types
export interface GooglePerson {
  resourceName: string;
  etag: string;
  names?: Array<{
    displayName: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
  }>;
  photos?: Array<{
    url: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  addresses?: Array<{
    formattedValue?: string;
    type?: string;
  }>;
  birthdays?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
  }>;
}

export interface GoogleContactGroup {
  resourceName: string;
  etag: string;
  name: string;
  memberCount: number;
  groupType: 'USER_CONTACT_GROUP' | 'SYSTEM_CONTACT_GROUP';
}

// Vault Types
export interface VaultMatter {
  matterId: string;
  name: string;
  description?: string;
  state: 'OPEN' | 'CLOSED' | 'DELETED';
  matterPermissions?: Array<{
    accountId: string;
    role: 'OWNER' | 'COLLABORATOR';
  }>;
}

export interface VaultHold {
  holdId: string;
  name: string;
  updateTime: string;
  accounts?: Array<{ accountId: string }>;
  orgUnit?: { orgUnitId: string };
  corpus: 'DRIVE' | 'MAIL' | 'GROUPS' | 'HANGOUTS_CHAT' | 'VOICE';
  query?: object;
}

// Health Connect / Fitness API Types
export interface FitnessDataSource {
  dataStreamId: string;
  dataStreamName?: string;
  type: string;
  dataType: {
    name: string;
    field: Array<{
      name: string;
      format: string;
    }>;
  };
  device?: {
    uid?: string;
    type?: string;
    version?: string;
    model?: string;
    manufacturer?: string;
  };
  application?: {
    packageName?: string;
    version?: string;
  };
}

export interface FitnessDataPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataTypeName: string;
  value: Array<{
    intVal?: number;
    fpVal?: number;
    stringVal?: string;
    mapVal?: Array<{ key: string; value: { fpVal?: number } }>;
  }>;
}

export interface FitnessSession {
  id: string;
  name: string;
  description?: string;
  startTimeMillis: string;
  endTimeMillis: string;
  modifiedTimeMillis?: string;
  application?: {
    packageName?: string;
    version?: string;
  };
  activityType: number;
  activeTimeMillis?: string;
}

export interface HealthConnectDataTypes {
  steps: boolean;
  heartRate: boolean;
  sleep: boolean;
  weight: boolean;
  height: boolean;
  bloodPressure: boolean;
  bloodGlucose: boolean;
  oxygenSaturation: boolean;
  bodyTemperature: boolean;
  nutrition: boolean;
  hydration: boolean;
  exercise: boolean;
  distance: boolean;
  calories: boolean;
  menstruation: boolean;
}

// API Response Types
export interface GoogleApiResponse<T> {
  data: T;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GoogleApiError {
  code: number;
  message: string;
  errors?: Array<{
    message: string;
    domain: string;
    reason: string;
  }>;
}

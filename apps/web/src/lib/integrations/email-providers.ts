// Email provider configurations

// Base provider interface
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

// Email provider definitions
export const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '/images/email/gmail.svg',
    color: '#DB4437',
    description: 'Connect your Google email account',
    oauthEnabled: true,
    calendarSupport: true,
    contactsSupport: true,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '/images/email/outlook.svg',
    color: '#0078D4',
    description: 'Connect your Microsoft email account',
    oauthEnabled: true,
    calendarSupport: true,
    contactsSupport: true,
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    icon: '/images/email/yahoo.svg',
    color: '#6001D2',
    description: 'Connect your Yahoo email account',
    oauthEnabled: true,
    calendarSupport: true,
    contactsSupport: true,
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    icon: '/images/email/icloud.svg',
    color: '#999999',
    description: 'Connect your Apple email account',
    oauthEnabled: true,
    calendarSupport: true,
    contactsSupport: true,
  },
  {
    id: 'zoho',
    name: 'Zoho Mail',
    icon: '/images/email/zoho.svg',
    color: '#C52F24',
    description: 'Connect your Zoho email account',
    oauthEnabled: true,
    calendarSupport: true,
    contactsSupport: true,
  },
  {
    id: 'protonmail',
    name: 'ProtonMail',
    icon: '/images/email/proton.svg',
    color: '#8A6AFE',
    description: 'Connect your ProtonMail account',
    oauthEnabled: false,
    calendarSupport: true,
    contactsSupport: true,
    defaultSettings: {
      imapServer: 'imap.protonmail.ch',
      imapPort: 993,
      smtpServer: 'smtp.protonmail.ch',
      smtpPort: 587,
      useSSL: true,
    },
  },
  {
    id: 'aol',
    name: 'AOL Mail',
    icon: '/images/email/aol.svg',
    color: '#2A0DBD',
    description: 'Connect your AOL email account',
    oauthEnabled: true,
    calendarSupport: false,
    contactsSupport: true,
  },
  {
    id: 'other',
    name: 'Other Email Service',
    icon: '/images/email/other.svg',
    color: '#555555',
    description: 'Connect via IMAP/SMTP settings',
    oauthEnabled: false,
    calendarSupport: false,
    contactsSupport: false,
  },
];

// Get provider by ID
export function getProviderById(id: string): EmailProvider | undefined {
  return EMAIL_PROVIDERS.find(provider => provider.id === id);
}

// Get provider by email domain
export function getProviderByEmail(email: string): EmailProvider | undefined {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) return undefined;
  
  if (domain.includes('gmail.com')) return getProviderById('gmail');
  if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com')) return getProviderById('outlook');
  if (domain.includes('yahoo.com')) return getProviderById('yahoo');
  if (domain.includes('icloud.com') || domain.includes('me.com')) return getProviderById('icloud');
  if (domain.includes('zoho.com')) return getProviderById('zoho');
  if (domain.includes('protonmail.com') || domain.includes('proton.me')) return getProviderById('protonmail');
  if (domain.includes('aol.com')) return getProviderById('aol');
  
  return getProviderById('other');
}

// OAuth config for email providers
export const EMAIL_OAUTH_CONFIG = {
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/ https://www.googleapis.com/auth/calendar',
  },
  outlook: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access Mail.Read Mail.Send Calendars.Read Calendars.ReadWrite',
  },
  yahoo: {
    authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    scope: 'mail-r mail-w calendar-r',
  },
};
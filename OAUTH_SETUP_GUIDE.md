# OAuth Integration Setup Guide
## Life Navigator - Complete Third-Party Integration Configuration

This guide walks you through setting up OAuth applications for all third-party integrations needed for beta testing and production deployment.

---

## 🎯 Overview

Life Navigator integrates with multiple platforms to provide comprehensive life management:

| Platform | Purpose | Data Accessed |
|----------|---------|---------------|
| **Plaid** | Financial data | Bank accounts, transactions, balances |
| **Google** | Calendar, Email | Events, contacts, emails |
| **Microsoft** | Calendar, Email | Outlook events, contacts |
| **LinkedIn** | Professional network | Connections, profile, posts |
| **Twitter** | Social network | Followers, tweets, metrics |
| **Instagram** | Social network | Followers, posts, engagement |
| **TikTok** | Social network | Followers, videos, analytics |
| **SendGrid** | Email delivery | Send transactional emails |
| **Upstash** | Redis caching | Rate limiting, session storage |
| **Sentry** | Error tracking | Application errors, performance |

---

## 🏦 1. Plaid (Financial Data Integration)

**Purpose**: Connect bank accounts, fetch transactions, and account balances

### Step 1: Create Plaid Account
1. Go to [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. Sign up for a Plaid account
3. Verify your email address

### Step 2: Get Sandbox Credentials (for testing)
1. Log in to [Plaid Dashboard](https://dashboard.plaid.com)
2. Navigate to **Team Settings** → **Keys**
3. Copy your **client_id** and **sandbox** secret
4. Add to environment variables:
   ```bash
   PLAID_CLIENT_ID=your_client_id_here
   PLAID_SECRET=your_sandbox_secret_here
   PLAID_ENV=sandbox
   ```

### Step 3: Apply for Production Access (when ready)
1. In Plaid Dashboard, click **Get Production Access**
2. Complete the application (requires business details)
3. Approval typically takes 1-3 business days
4. Once approved, get production credentials:
   - Navigate to **Team Settings** → **Keys**
   - Copy **production** secret
   - Update environment variables:
     ```bash
     PLAID_SECRET=your_production_secret_here
     PLAID_ENV=production
     ```

### Scopes Required:
- `auth` - Bank account authentication
- `transactions` - Transaction history
- `identity` - Account holder information
- `assets` - Asset reports
- `investments` - Investment holdings

### Testing with Sandbox:
- Use test credentials provided in [Plaid Docs](https://plaid.com/docs/sandbox/test-credentials/)
- Username: `user_good`
- Password: `pass_good`

---

## 📧 2. Google OAuth (Gmail & Calendar)

**Purpose**: Sync Google Calendar events and email integration

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project:
   - Click **Select a project** → **New Project**
   - Name: `Life Navigator`
   - Click **Create**

### Step 2: Enable APIs
1. Navigate to **APIs & Services** → **Library**
2. Search and enable the following APIs:
   - **Google Calendar API**
   - **Gmail API**
   - **Google People API** (for contacts)

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → **Create**
3. Fill in application information:
   - **App name**: Life Navigator
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (for beta):
   - Click **Add Users**
   - Add beta tester email addresses
6. Click **Save and Continue**

### Step 4: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Life Navigator Web Client`
5. **Authorized redirect URIs**:
   - Development: `http://localhost:3000/api/oauth/google/callback`
   - Production: `https://your-app.vercel.app/api/oauth/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 5: Add to Environment Variables
```bash
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/oauth/google/callback
```

### Production Publishing:
- For public release, submit app for verification
- Go to **OAuth consent screen** → **Publish App**
- Verification process takes 1-2 weeks

---

## 📅 3. Microsoft OAuth (Outlook & Calendar)

**Purpose**: Sync Outlook Calendar and email integration

### Step 1: Register Application
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in details:
   - **Name**: Life Navigator
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://your-app.vercel.app/api/oauth/microsoft/callback`
5. Click **Register**

### Step 2: Configure API Permissions
1. In your app, navigate to **API permissions**
2. Click **Add a permission** → **Microsoft Graph**
3. Select **Delegated permissions**
4. Add the following permissions:
   - `Calendars.Read`
   - `Mail.Read`
   - `User.Read`
   - `offline_access` (for refresh tokens)
5. Click **Add permissions**
6. Click **Grant admin consent** (if you're an admin)

### Step 3: Create Client Secret
1. Navigate to **Certificates & secrets**
2. Click **New client secret**
3. Description: `Production Secret`
4. Expires: **24 months** (recommended)
5. Click **Add**
6. **Copy the secret value immediately** (you can't see it again!)

### Step 4: Get Application ID
1. Navigate to **Overview**
2. Copy the **Application (client) ID**

### Step 5: Add to Environment Variables
```bash
MICROSOFT_CLIENT_ID=your_application_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_REDIRECT_URI=https://your-app.vercel.app/api/oauth/microsoft/callback
MICROSOFT_TENANT_ID=common
```

---

## 💼 4. LinkedIn OAuth

**Purpose**: Access professional network data and calculate network value

### Step 1: Create LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create app**
3. Fill in details:
   - **App name**: Life Navigator
   - **LinkedIn Page**: Create or select a company page
   - **App logo**: Upload your logo
   - **Legal agreement**: Accept terms
4. Click **Create app**

### Step 2: Configure App Settings
1. Navigate to **Auth** tab
2. **Authorized redirect URLs**:
   - Add: `https://your-app.vercel.app/api/oauth/linkedin/callback`
3. Click **Update**

### Step 3: Request API Access
1. Navigate to **Products** tab
2. Request access to:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn** (if posting features needed)
3. Wait for approval (usually instant for basic access)

### Step 4: Get Credentials
1. Navigate to **Auth** tab
2. Copy **Client ID**
3. Copy **Client Secret**

### Step 5: Add to Environment Variables
```bash
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=https://your-app.vercel.app/api/oauth/linkedin/callback
```

### Scopes:
- `openid`
- `profile`
- `email`
- `w_member_social` (if posting)

---

## 🐦 5. Twitter OAuth 2.0

**Purpose**: Access Twitter network data and metrics

### Step 1: Apply for Developer Account
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Click **Sign up**
3. Complete the application:
   - **Use case**: Building a life management platform
   - **Will you make Twitter content available to government entities?**: No
4. Wait for approval (usually within 24 hours)

### Step 2: Create Project and App
1. Once approved, log in to [Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Click **Create Project**
3. Fill in project details:
   - **Project name**: Life Navigator
   - **Use case**: Making a bot
4. Create an app:
   - **App name**: Life Navigator (must be unique)
   - **Environment**: Production

### Step 3: Configure App Settings
1. Navigate to your app → **Settings**
2. **User authentication settings** → **Set up**
3. Configure OAuth 2.0:
   - **App permissions**: Read
   - **Type of App**: Web App
   - **Callback URI**: `https://your-app.vercel.app/api/oauth/twitter/callback`
   - **Website URL**: `https://your-app.vercel.app`
4. Click **Save**

### Step 4: Get Credentials
1. Navigate to **Keys and tokens** tab
2. Copy **API Key** (Client ID)
3. Generate and copy **API Key Secret** (Client Secret)
4. Generate **Bearer Token** (for API v2 access)

### Step 5: Add to Environment Variables
```bash
TWITTER_CLIENT_ID=your_api_key
TWITTER_CLIENT_SECRET=your_api_key_secret
TWITTER_BEARER_TOKEN=your_bearer_token
TWITTER_REDIRECT_URI=https://your-app.vercel.app/api/oauth/twitter/callback
```

### API Access Levels:
- **Free**: Basic access (good for beta)
- **Basic**: $100/month - Enhanced access
- **Pro**: $5,000/month - Full access

---

## 📸 6. Instagram Basic Display API

**Purpose**: Access Instagram profile and post data

### Step 1: Create Facebook App
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Consumer** as app type
4. Fill in details:
   - **App name**: Life Navigator
   - **App contact email**: Your email
5. Click **Create App**

### Step 2: Add Instagram Basic Display
1. In app dashboard, click **Add Product**
2. Find **Instagram Basic Display** → **Set Up**
3. Click **Create New App**
4. **Display Name**: Life Navigator
5. Click **Create App**

### Step 3: Configure Basic Display
1. Navigate to **Basic Display** → **Basic Display**
2. **Valid OAuth Redirect URIs**:
   - Add: `https://your-app.vercel.app/api/oauth/instagram/callback`
3. **Deauthorize Callback URL**:
   - Add: `https://your-app.vercel.app/api/oauth/instagram/deauthorize`
4. **Data Deletion Request URL**:
   - Add: `https://your-app.vercel.app/api/oauth/instagram/data-deletion`
5. Click **Save Changes**

### Step 4: Add Test Users
1. Navigate to **Roles** → **Instagram Testers**
2. Click **Add Instagram Testers**
3. Enter Instagram usernames
4. Test users must accept the invitation in their Instagram app

### Step 5: Get Credentials
1. Navigate to **Basic Display** → **Basic Display**
2. Copy **Instagram App ID**
3. Copy **Instagram App Secret**

### Step 6: Add to Environment Variables
```bash
INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
INSTAGRAM_REDIRECT_URI=https://your-app.vercel.app/api/oauth/instagram/callback
```

### Permissions:
- `user_profile`
- `user_media`

---

## 🎵 7. TikTok Developer Platform

**Purpose**: Access TikTok profile and video analytics

### Step 1: Register Developer Account
1. Go to [TikTok Developers](https://developers.tiktok.com/)
2. Click **Register** → **Log in with TikTok**
3. Complete registration with your TikTok account

### Step 2: Create App
1. Go to [Manage Apps](https://developers.tiktok.com/apps/)
2. Click **+ Create an app**
3. Fill in details:
   - **App name**: Life Navigator
   - **Category**: Lifestyle
   - **Description**: Personal life management platform
4. Click **Create**

### Step 3: Configure App
1. In app dashboard, navigate to **Login Kit**
2. Click **Configure**
3. **Redirect URI**:
   - Add: `https://your-app.vercel.app/api/oauth/tiktok/callback`
4. **Scopes**:
   - Select: `user.info.basic`
   - Select: `user.info.stats`
   - Select: `video.list`
5. Click **Save**

### Step 4: Submit for Review (when ready)
1. Complete all required information
2. Add privacy policy URL
3. Add terms of service URL
4. Submit app for review

### Step 5: Get Credentials
1. Navigate to **Settings** → **Basic information**
2. Copy **Client Key**
3. Copy **Client Secret**

### Step 6: Add to Environment Variables
```bash
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_REDIRECT_URI=https://your-app.vercel.app/api/oauth/tiktok/callback
```

---

## 📧 8. SendGrid (Email Delivery)

**Purpose**: Send transactional emails (password reset, notifications)

### Step 1: Create SendGrid Account
1. Go to [SendGrid Sign Up](https://signup.sendgrid.com/)
2. Complete registration
3. Verify your email address

### Step 2: Create API Key
1. Log in to [SendGrid Dashboard](https://app.sendgrid.com/)
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. **API Key Name**: Life Navigator Production
5. **API Key Permissions**: Full Access (or Mail Send only)
6. Click **Create & View**
7. **Copy the API key immediately** (you can't see it again!)

### Step 3: Verify Domain (Recommended for Production)
1. Navigate to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender** (quickest for testing)
   - Or **Authenticate Your Domain** (best for production)
3. Follow the verification steps
4. Wait for verification (instant for single sender, DNS propagation for domain)

### Step 4: Add to Environment Variables
```bash
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=noreply@your-verified-domain.com
```

---

## 🔴 9. Upstash Redis (Rate Limiting & Caching)

**Purpose**: Session storage, rate limiting, caching

### Step 1: Create Upstash Account
1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up with GitHub or Google

### Step 2: Create Redis Database
1. Click **Create Database**
2. **Name**: lifenavigator-prod
3. **Region**: Choose closest to your Vercel region (us-east-1)
4. **Type**: Regional (for production) or Global (for multi-region)
5. Click **Create**

### Step 3: Get Connection Details
1. In your database dashboard
2. Scroll to **REST API** section
3. Copy **UPSTASH_REDIS_REST_URL**
4. Copy **UPSTASH_REDIS_REST_TOKEN**

### Step 4: Add to Environment Variables
```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

---

## 🐛 10. Sentry (Error Tracking)

**Purpose**: Monitor errors and performance in production

### Step 1: Create Sentry Account
1. Go to [Sentry Sign Up](https://sentry.io/signup/)
2. Sign up with GitHub or email

### Step 2: Create Project
1. Click **Create Project**
2. **Platform**: Next.js
3. **Project name**: life-navigator
4. **Alert frequency**: On every new issue
5. Click **Create Project**

### Step 3: Get DSN
1. After project creation, copy the **DSN** shown
2. Or navigate to **Settings** → **Projects** → **life-navigator** → **Client Keys (DSN)**

### Step 4: Create Auth Token
1. Navigate to **Settings** → **Account** → **API** → **Auth Tokens**
2. Click **Create New Token**
3. **Scopes**: Select `project:releases` and `org:read`
4. Click **Create Token**
5. Copy the token

### Step 5: Add to Environment Variables
```bash
SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your_auth_token
NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
```

---

## 📊 11. Google Analytics (Optional)

**Purpose**: Track user behavior and app usage

### Step 1: Create Google Analytics Account
1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Start measuring**
3. **Account name**: Life Navigator
4. Click **Next**

### Step 2: Create Property
1. **Property name**: Life Navigator Production
2. **Reporting time zone**: Your timezone
3. **Currency**: USD
4. Click **Next**

### Step 3: Set Up Data Stream
1. **Platform**: Web
2. **Website URL**: `https://your-app.vercel.app`
3. **Stream name**: Life Navigator Web
4. Click **Create stream**

### Step 4: Get Measurement ID
1. Copy the **Measurement ID** (format: G-XXXXXXXXXX)

### Step 5: Add to Environment Variables
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## ✅ Integration Checklist

Use this checklist to track your OAuth setup progress:

### Financial:
- [ ] Plaid sandbox credentials configured
- [ ] Plaid production access applied for
- [ ] Stripe account created (if using payments)

### Calendar & Email:
- [ ] Google OAuth app created
- [ ] Google Calendar API enabled
- [ ] Microsoft OAuth app created
- [ ] Microsoft Graph permissions granted

### Social Networks:
- [ ] LinkedIn app created and approved
- [ ] Twitter developer account approved
- [ ] Instagram Basic Display configured
- [ ] TikTok developer app created

### Infrastructure:
- [ ] SendGrid account verified
- [ ] Domain verified in SendGrid
- [ ] Upstash Redis database created
- [ ] Sentry project created
- [ ] Google Analytics property created

### Environment Variables:
- [ ] All credentials added to `.env.local` (development)
- [ ] All credentials added to Vercel (production)
- [ ] Secrets are cryptographically random
- [ ] Redirect URIs match production domain

---

## 🧪 Testing OAuth Integrations

### Local Testing:
1. Set all environment variables in `.env.local`
2. Start development server: `npm run dev`
3. Navigate to OAuth connect pages
4. Test each integration flow
5. Verify data is fetched correctly

### Production Testing:
1. Deploy to Vercel preview branch
2. Set environment variables in Vercel
3. Test OAuth flows on preview URL
4. Verify webhooks and callbacks work
5. Check error tracking in Sentry

---

## 🔒 Security Best Practices

1. **Never commit credentials** to version control
   - Add `.env.local`, `.env.production`, `.env.gcp` to `.gitignore`

2. **Use environment-specific secrets**
   - Different secrets for development, staging, production

3. **Rotate secrets regularly**
   - Regenerate API keys every 90 days
   - Update OAuth secrets annually

4. **Use scoped permissions**
   - Request minimum required scopes
   - Don't request write access if read-only needed

5. **Monitor access logs**
   - Review OAuth app access logs monthly
   - Watch for suspicious activity

6. **Implement token refresh**
   - Store refresh tokens securely
   - Implement automatic token renewal

---

## 📞 Support Resources

| Platform | Support Link |
|----------|-------------|
| Plaid | https://plaid.com/docs/support/ |
| Google | https://support.google.com/googleapi |
| Microsoft | https://docs.microsoft.com/en-us/graph/support |
| LinkedIn | https://www.linkedin.com/help/linkedin/ask |
| Twitter | https://developer.twitter.com/en/support |
| Instagram | https://developers.facebook.com/support/ |
| TikTok | https://developers.tiktok.com/contact |
| SendGrid | https://support.sendgrid.com/ |
| Upstash | https://docs.upstash.com/ |
| Sentry | https://sentry.io/support/ |

---

## 🎉 You're Ready!

Once you've completed all integrations:
1. Verify all environment variables are set
2. Run the deployment script: `./scripts/deploy-production.sh`
3. Test all integrations in production
4. Invite beta testers
5. Monitor errors in Sentry
6. Track usage in Google Analytics

Happy deploying! 🚀

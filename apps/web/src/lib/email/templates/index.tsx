/**
 * Email Template Renderer
 * Renders React components to HTML/Text for emails
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import WelcomeEmail from './welcome';
import PasswordResetEmail from './password-reset';
import AssessmentCompleteEmail from './assessment-complete';
import GoalReminderEmail from './goal-reminder';
import NotificationEmail from './notification';

export interface EmailTemplate {
  html: string;
  text: string;
}

const templates = {
  welcome: WelcomeEmail,
  'password-reset': PasswordResetEmail,
  'assessment-complete': AssessmentCompleteEmail,
  'goal-reminder': GoalReminderEmail,
  notification: NotificationEmail,
};

/**
 * Render email template with data
 */
export async function renderEmailTemplate(
  templateName: string,
  data: Record<string, any>
): Promise<EmailTemplate> {
  const Template = templates[templateName as keyof typeof templates];

  if (!Template) {
    throw new Error(`Email template "${templateName}" not found`);
  }

  // Render React component to HTML
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(EmailLayout as any, {}, React.createElement(Template as any, data))
  );

  // Generate text version (simplified)
  const text = generateTextVersion(html);

  return { html, text };
}

/**
 * Email layout wrapper
 */
function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>LifeNavigator</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
          }
          h1 {
            color: #1f2937;
            font-size: 24px;
            margin-bottom: 16px;
          }
          p {
            color: #4b5563;
            margin-bottom: 16px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .list {
            margin: 20px 0;
            padding-left: 20px;
          }
          .list-item {
            margin-bottom: 10px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <div className="logo">LifeNavigator</div>
          </div>
          {children}
          <div className="footer">
            <p>© 2024 LifeNavigator. All rights reserved.</p>
            <p>
              <a href="https://lifenavigator.com/unsubscribe" style={{ color: '#6b7280' }}>
                Unsubscribe
              </a>
              {' | '}
              <a href="https://lifenavigator.com/privacy" style={{ color: '#6b7280' }}>
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

/**
 * Generate plain text version from HTML
 */
function generateTextVersion(html: string): string {
  // Remove HTML tags and clean up
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

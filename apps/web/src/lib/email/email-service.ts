/**
 * Email Service
 * Handles sending emails via SendGrid or Nodemailer
 */

import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { renderEmailTemplate } from './templates';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private static instance: EmailService;
  private provider: 'sendgrid' | 'smtp';
  private transporter?: nodemailer.Transporter;
  private fromEmail: string;
  private fromName: string;

  private constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@lifenavigator.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'LifeNavigator';

    // Configure email provider
    if (process.env.SENDGRID_API_KEY) {
      this.provider = 'sendgrid';
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    } else {
      this.provider = 'smtp';
      this.configureNodemailer();
    }
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private configureNodemailer() {
    // Use environment variables or defaults for development
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      // For development with MailHog
      ignoreTLS: process.env.NODE_ENV === 'development',
    });
  }

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<void> {
    try {
      // Prepare email content
      let html = options.html;
      let text = options.text;

      // If template is specified, render it
      if (options.template) {
        const rendered = await renderEmailTemplate(options.template, options.data || {});
        html = rendered.html;
        text = rendered.text;
      }

      const from = options.from || `${this.fromName} <${this.fromEmail}>`;

      if (this.provider === 'sendgrid') {
        await this.sendWithSendGrid({
          ...options,
          html,
          text,
          from,
        });
      } else {
        await this.sendWithNodemailer({
          ...options,
          html,
          text,
          from,
        });
      }

      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  private async sendWithSendGrid(options: EmailOptions & { html?: string; text?: string; from: string }) {
    const msg = {
      to: options.to,
      from: options.from,
      subject: options.subject,
      text: options.text || '',
      html: options.html || options.text || '',
      replyTo: options.replyTo,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        type: att.contentType,
      })),
    };

    if (Array.isArray(options.to)) {
      await sgMail.sendMultiple(msg);
    } else {
      await sgMail.send(msg);
    }
  }

  private async sendWithNodemailer(options: EmailOptions & { html?: string; text?: string; from: string }) {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    await this.transporter.sendMail({
      from: options.from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, data: { name: string; verificationUrl?: string }) {
    await this.send({
      to,
      subject: 'Welcome to LifeNavigator!',
      template: 'welcome',
      data,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, data: { name: string; resetUrl: string }) {
    await this.send({
      to,
      subject: 'Reset Your Password',
      template: 'password-reset',
      data,
    });
  }

  /**
   * Send assessment complete email
   */
  async sendAssessmentCompleteEmail(to: string, data: { name: string; score: number; recommendations: string[] }) {
    await this.send({
      to,
      subject: 'Your Risk Assessment Results',
      template: 'assessment-complete',
      data,
    });
  }

  /**
   * Send goal reminder email
   */
  async sendGoalReminderEmail(to: string, data: { name: string; goals: any[] }) {
    await this.send({
      to,
      subject: 'Your Daily Goal Reminder',
      template: 'goal-reminder',
      data,
    });
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(to: string, subject: string, data: { title: string; message: string; actionUrl?: string }) {
    await this.send({
      to,
      subject,
      template: 'notification',
      data,
    });
  }

  /**
   * Verify email configuration
   */
  async verifyConnection(): Promise<boolean> {
    try {
      if (this.provider === 'smtp' && this.transporter) {
        await this.transporter.verify();
        console.log('SMTP connection verified');
      } else if (this.provider === 'sendgrid') {
        // SendGrid doesn't have a verify method, just check if key is set
        if (process.env.SENDGRID_API_KEY) {
          console.log('SendGrid API key configured');
        }
      }
      return true;
    } catch (error) {
      console.error('Email configuration verification failed:', error);
      return false;
    }
  }
}

export const emailService = EmailService.getInstance();

// Export convenience functions
export const sendEmail = (options: EmailOptions) => emailService.send(options);
export const sendWelcomeEmail = (to: string, data: any) => emailService.sendWelcomeEmail(to, data);
export const sendPasswordResetEmail = (to: string, data: any) => emailService.sendPasswordResetEmail(to, data);
export const sendAssessmentCompleteEmail = (to: string, data: any) => emailService.sendAssessmentCompleteEmail(to, data);
export const sendGoalReminderEmail = (to: string, data: any) => emailService.sendGoalReminderEmail(to, data);
export const sendNotificationEmail = (to: string, subject: string, data: any) => emailService.sendNotificationEmail(to, subject, data);
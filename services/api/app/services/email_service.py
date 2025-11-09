"""
Email service for sending verification and notification emails
"""

import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service for sending emails

    For development: Logs emails to console
    For production: Replace with actual email service (SendGrid, AWS SES, etc.)
    """

    def __init__(self):
        self.from_email = getattr(settings, "FROM_EMAIL", "noreply@lifenavigator.com")
        self.frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")

    async def send_verification_email(
        self,
        to_email: str,
        username: str,
        verification_token: str
    ) -> bool:
        """
        Send email verification email

        Args:
            to_email: Recipient email address
            username: User's username
            verification_token: Verification token

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        verification_url = f"{self.frontend_url}/auth/verify-email?token={verification_token}"

        subject = "Verify your Life Navigator account"

        # HTML email body (for future production use with email service like SendGrid)
        # html_body = f"""
        # <!DOCTYPE html>
        # <html>
        # <head>
        #     <style>
        #         body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        #         .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        #         .header {{ background-color: #3b82f6; color: white; padding: 20px; text-align: center; }}
        #         .content {{ background-color: #f9fafb; padding: 30px; }}
        #         .button {{
        #             display: inline-block;
        #             padding: 12px 24px;
        #             background-color: #3b82f6;
        #             color: white;
        #             text-decoration: none;
        #             border-radius: 6px;
        #             margin: 20px 0;
        #         }}
        #         .footer {{ padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }}
        #     </style>
        # </head>
        # <body>
        #     <div class="container">
        #         <div class="header">
        #             <h1>Welcome to Life Navigator!</h1>
        #         </div>
        #         <div class="content">
        #             <h2>Hi {username},</h2>
        #             <p>Thank you for signing up for Life Navigator! We're excited to have you on board.</p>
        #             <p>To complete your registration, please verify your email address by clicking the button below:</p>
        #             <div style="text-align: center;">
        #                 <a href="{verification_url}" class="button">Verify Email Address</a>
        #             </div>
        #             <p>Or copy and paste this link into your browser:</p>
        #             <p style="background-color: #e5e7eb; padding: 10px; word-break: break-all;">
        #                 {verification_url}
        #             </p>
        #             <p><strong>This link will expire in 24 hours.</strong></p>
        #             <p>If you didn't create an account with Life Navigator, you can safely ignore this email.</p>
        #         </div>
        #         <div class="footer">
        #             <p>&copy; 2025 Life Navigator. All rights reserved.</p>
        #             <p>This is an automated email, please do not reply.</p>
        #         </div>
        #     </div>
        # </body>
        # </html>
        # """

        # Plain text version
        text_body = f"""
        Hi {username},

        Thank you for signing up for Life Navigator!

        To complete your registration, please verify your email address by visiting:
        {verification_url}

        This link will expire in 24 hours.

        If you didn't create an account with Life Navigator, you can safely ignore this email.

        ---
        Life Navigator Team
        """

        # For development: Log to console
        logger.info("=" * 80)
        logger.info("EMAIL VERIFICATION")
        logger.info("=" * 80)
        logger.info(f"To: {to_email}")
        logger.info(f"From: {self.from_email}")
        logger.info(f"Subject: {subject}")
        logger.info("-" * 80)
        logger.info(text_body)
        logger.info("=" * 80)
        logger.info(f"Verification URL: {verification_url}")
        logger.info("=" * 80)

        # In production, replace with actual email sending:
        # try:
        #     # Example with SendGrid:
        #     # message = Mail(
        #         from_email=self.from_email,
        #         to_emails=to_email,
        #         subject=subject,
        #         html_content=html_body
        #     )
        #     # sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        #     # response = sg.send(message)
        #     return True
        # except Exception as e:
        #     logger.error(f"Failed to send verification email: {e}")
        #     return False

        return True

    async def send_password_reset_email(
        self,
        to_email: str,
        username: str,
        reset_token: str
    ) -> bool:
        """
        Send password reset email

        Args:
            to_email: Recipient email address
            username: User's username
            reset_token: Password reset token

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        reset_url = f"{self.frontend_url}/auth/reset-password?token={reset_token}"

        subject = "Reset your Life Navigator password"

        text_body = f"""
        Hi {username},

        We received a request to reset your password for your Life Navigator account.

        To reset your password, please visit:
        {reset_url}

        This link will expire in 1 hour.

        If you didn't request a password reset, you can safely ignore this email.

        ---
        Life Navigator Team
        """

        logger.info("=" * 80)
        logger.info("PASSWORD RESET EMAIL")
        logger.info("=" * 80)
        logger.info(f"To: {to_email}")
        logger.info(f"From: {self.from_email}")
        logger.info(f"Subject: {subject}")
        logger.info("-" * 80)
        logger.info(text_body)
        logger.info("=" * 80)
        logger.info(f"Reset URL: {reset_url}")
        logger.info("=" * 80)

        return True


# Singleton instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service

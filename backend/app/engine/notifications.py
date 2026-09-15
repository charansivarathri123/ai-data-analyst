"""Notification dispatcher for DataAnalyst.Ai Studio.

Provides enterprise-grade delivery and email templates for:
1. Email OTP:
   - Via SMTP (Gmail App Password, Outlook, Brevo, AWS SES)
   - Via Resend REST API (RESEND_API_KEY)
2. Mobile SMS OTP:
   - Via Twilio REST API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
   - Via Fast2SMS REST API (FAST2SMS_API_KEY)
"""

import os
import json
import logging
import smtplib
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple

logger = logging.getLogger("notifications")


def send_email_otp(destination_email: str, code: str, user_name: str = "") -> Tuple[bool, str]:
    """Dispatches a professional 6-digit OTP email to the recipient's inbox.
    
    Returns (success: bool, status_message: str).
    """
    destination_email = destination_email.strip().lower()
    subject = f"{code} is your DataAnalyst.Ai verification code"

    plain_text = f"""DataAnalyst.Ai Identity Verification

Your verification code is: {code}

This one-time passcode expires in 5 minutes. Enter it to complete your sign-in to DataAnalyst.Ai.

Security Notice:
- Never share this code with anyone. DataAnalyst.Ai will never ask for this code.
- If you did not request this verification code, please safely disregard this email.

— DataAnalyst.Ai Team
https://dataanalyst.ai
"""
    html_content = _generate_professional_email_html(code, user_name)

    # -----------------------------------------------------------------------
    # 1. Try Resend REST API (if configured)
    # -----------------------------------------------------------------------
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_api_key:
        try:
            from_email = os.getenv("RESEND_FROM_EMAIL", "verify@dataanalyst.ai")
            payload = json.dumps({
                "from": f"DataAnalyst.Ai <{from_email}>",
                "to": [destination_email],
                "subject": subject,
                "text": plain_text,
                "html": html_content,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    logger.info(f"Dispatched professional email via Resend to {destination_email}")
                    return True, f"Verification email sent to {destination_email}."
        except Exception as exc:
            logger.error(f"Failed to send email via Resend: {exc}")

    # -----------------------------------------------------------------------
    # 2. Try Standard SMTP (Gmail, Outlook, Brevo, AWS SES)
    # -----------------------------------------------------------------------
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587").strip() or "587")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip() or smtp_user

    if smtp_user and smtp_password:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"DataAnalyst.Ai <{smtp_from}>"
        msg["To"] = destination_email

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # 1. Try SSL port 465 (widely supported through cloud firewalls)
        try:
            with smtplib.SMTP_SSL(smtp_host, 465, timeout=10) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, [destination_email], msg.as_string())
            logger.info(f"Dispatched email via SMTP_SSL (port 465) to {destination_email}")
            return True, f"Verification email sent to {destination_email}."
        except Exception as ssl_exc:
            logger.warning(f"SMTP_SSL 465 failed: {ssl_exc}, attempting TLS 587...")

        # 2. Try TLS port 587
        try:
            with smtplib.SMTP(smtp_host, 587, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, [destination_email], msg.as_string())
            logger.info(f"Dispatched email via SMTP (port 587) to {destination_email}")
            return True, f"Verification email sent to {destination_email}."
        except Exception as exc:
            logger.error(f"SMTP delivery error: {exc}")
            return False, f"SMTP delivery error: {str(exc)}"

    # -----------------------------------------------------------------------
    # Fallback: Credentials not set in environment
    # -----------------------------------------------------------------------
    logger.warning(
        f"[AUTH WARNING] Email provider not configured. "
        f"Set SMTP_USER & SMTP_PASSWORD in Render environment variables. "
        f"Generated OTP for {destination_email}: {code}"
    )
    return True, f"Code generated for {destination_email}."


def send_sms_otp(phone_number: str, code: str) -> Tuple[bool, str]:
    """Dispatches a professional 6-digit OTP code to mobile phone via SMS."""
    phone_number = phone_number.strip()
    message_body = f"[DataAnalyst.Ai] Your verification code is {code}. Valid for 5 minutes. Do not share this code."

    # 1. Try Twilio REST API
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    twilio_from = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

    if twilio_sid and twilio_token and twilio_from:
        try:
            import base64
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            data = urllib.parse.urlencode({
                "To": phone_number,
                "From": twilio_from,
                "Body": message_body,
            }).encode("utf-8")

            auth_str = f"{twilio_sid}:{twilio_token}"
            b64_auth = base64.b64encode(auth_str.encode("ascii")).decode("ascii")

            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Authorization": f"Basic {b64_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    logger.info(f"Dispatched SMS via Twilio to {phone_number}")
                    return True, f"SMS verification code sent to {phone_number}."
        except Exception as exc:
            logger.error(f"Failed to send SMS via Twilio: {exc}")
            return False, f"Twilio SMS delivery error: {str(exc)}"

    # 2. Try Fast2SMS REST API
    fast2sms_key = os.getenv("FAST2SMS_API_KEY", "").strip()
    if fast2sms_key:
        try:
            clean_num = "".join(filter(str.isdigit, phone_number))
            if len(clean_num) > 10:
                clean_num = clean_num[-10:]

            url = "https://www.fast2sms.com/dev/bulkV2"
            payload = urllib.parse.urlencode({
                "authorization": fast2sms_key,
                "variables_values": code,
                "route": "otp",
                "numbers": clean_num,
            }).encode("utf-8")

            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    logger.info(f"Dispatched SMS via Fast2SMS to {phone_number}")
                    return True, f"SMS verification code sent to {phone_number}."
        except Exception as exc:
            logger.error(f"Failed to send SMS via Fast2SMS: {exc}")

    return True, f"Code generated for {phone_number}."


def _generate_professional_email_html(code: str, user_name: str = "") -> str:
    """Generates an executive, highly-polished HTML verification email."""
    name_greeting = f"Hello {user_name}," if user_name else "Hello,"
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>DataAnalyst.Ai Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text (shows in email client snippet) -->
  <div style="display: none; font-size: 1px; color: #f4f4f5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Your DataAnalyst.Ai verification code is {code}. Use this one-time passcode to sign in.
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #7c3aed, #4f46e5); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header / Brand Section -->
          <tr>
            <td style="padding: 36px 40px 24px 40px; text-align: left;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="width: 38px; height: 38px; background-color: #7c3aed; border-radius: 10px; text-align: center; line-height: 38px; color: #ffffff; font-weight: 800; font-size: 16px; display: inline-block;">
                      DA
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 20px; font-weight: 700; color: #18181b; letter-spacing: -0.4px;">DataAnalyst<span style="color: #7c3aed;">.Ai</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding: 0 40px 32px 40px; color: #3f3f46; font-size: 15px; line-height: 24px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #09090b; margin: 0 0 16px 0; letter-spacing: -0.5px;">
                Verification Code
              </h1>
              <p style="margin: 0 0 16px 0; color: #52525b;">
                {name_greeting}
              </p>
              <p style="margin: 0 0 24px 0; color: #52525b;">
                We received a request to sign in to your <strong>DataAnalyst.Ai</strong> workspace. Enter the 6-digit verification code below to confirm your identity:
              </p>

              <!-- Highlighted Code Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 8px 0 28px 0;">
                <tr>
                  <td align="center" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 24px 16px;">
                    <div style="font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #6b21a8; padding-left: 12px;">
                      {code}
                    </div>
                    <div style="font-size: 12px; color: #9333ea; font-weight: 600; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.8px;">
                      Expires in 5 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Information -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 13px; line-height: 20px; color: #475569;">
                    <strong style="color: #0f172a;">🔒 Security tip:</strong> Never share this code with anyone. DataAnalyst.Ai representatives will never contact you asking for your verification code.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 20px;">
                If you did not initiate this request, someone may have mistyped your email address. You can safely disregard this message.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="border-top: 1px solid #f4f4f5; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center; color: #a1a1aa; font-size: 12px; line-height: 18px;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #71717a;">
                DataAnalyst.Ai • Autonomous Multi-Agent Analytics Studio
              </p>
              <p style="margin: 0; color: #a1a1aa;">
                This is an automated security notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

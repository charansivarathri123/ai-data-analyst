"""Notification dispatcher for Autonomous AI Data Analyst Studio.

Supports REAL delivery for:
1. Email OTP:
   - Via SMTP (e.g. Gmail App Password, Outlook, Brevo, AWS SES)
   - Via Resend REST API (if RESEND_API_KEY is provided)
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
    """Dispatches a 6-digit OTP code to the recipient's real email inbox.
    
    Returns (success: bool, status_message: str).
    """
    destination_email = destination_email.strip().lower()
    subject = f"{code} is your AI Data Analyst verification code"

    # -----------------------------------------------------------------------
    # 1. Try Resend REST API (if configured)
    # -----------------------------------------------------------------------
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_api_key:
        try:
            from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
            payload = json.dumps({
                "from": f"AI Data Analyst <{from_email}>",
                "to": [destination_email],
                "subject": subject,
                "html": _generate_email_html(code, user_name),
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
                    logger.info(f"Dispatched real email via Resend to {destination_email}")
                    return True, f"Verification email successfully sent to {destination_email}."
        except Exception as exc:
            logger.error(f"Failed to send email via Resend: {exc}")

    # -----------------------------------------------------------------------
    # 2. Try Standard SMTP (e.g. Gmail, Outlook, Brevo, Custom SMTP)
    # -----------------------------------------------------------------------
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587").strip() or "587")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip() or smtp_user

    if smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"AI Data Analyst Studio <{smtp_from}>"
            msg["To"] = destination_email

            text_content = f"Your verification code is: {code}. It expires in 5 minutes."
            html_content = _generate_email_html(code, user_name)

            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, [destination_email], msg.as_string())

            logger.info(f"Dispatched real email via SMTP to {destination_email}")
            return True, f"Verification email sent to {destination_email}."
        except Exception as exc:
            logger.error(f"Failed to send email via SMTP ({smtp_host}): {exc}")
            return False, f"SMTP delivery error: {str(exc)}"

    # -----------------------------------------------------------------------
    # Fallback: No Email credentials set in environment
    # -----------------------------------------------------------------------
    logger.warning(
        f"[AUTH WARNING] Email provider not configured. "
        f"Set SMTP_USER & SMTP_PASSWORD or RESEND_API_KEY in Render environment variables. "
        f"Generated OTP for {destination_email}: {code}"
    )
    return True, f"Code generated for {destination_email} (configure SMTP_USER/PASSWORD for direct inbox delivery)."


def send_sms_otp(phone_number: str, code: str) -> Tuple[bool, str]:
    """Dispatches a 6-digit OTP code to the recipient's real mobile phone via SMS.
    
    Returns (success: bool, status_message: str).
    """
    phone_number = phone_number.strip()
    message_body = f"Your AI Data Analyst verification code is: {code}. Valid for 5 minutes."

    # -----------------------------------------------------------------------
    # 1. Try Twilio REST API (if configured)
    # -----------------------------------------------------------------------
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
                    logger.info(f"Dispatched real SMS via Twilio to {phone_number}")
                    return True, f"SMS verification code successfully sent to {phone_number}."
        except Exception as exc:
            logger.error(f"Failed to send SMS via Twilio: {exc}")
            return False, f"Twilio SMS delivery error: {str(exc)}"

    # -----------------------------------------------------------------------
    # 2. Try Fast2SMS REST API (if configured)
    # -----------------------------------------------------------------------
    fast2sms_key = os.getenv("FAST2SMS_API_KEY", "").strip()
    if fast2sms_key:
        try:
            # Clean number for Indian phone formats
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
                    logger.info(f"Dispatched real SMS via Fast2SMS to {phone_number}")
                    return True, f"SMS verification code successfully sent to {phone_number}."
        except Exception as exc:
            logger.error(f"Failed to send SMS via Fast2SMS: {exc}")

    # -----------------------------------------------------------------------
    # Fallback: No SMS credentials set in environment
    # -----------------------------------------------------------------------
    logger.warning(
        f"[AUTH WARNING] SMS provider not configured. "
        f"Set TWILIO_ACCOUNT_SID/TOKEN/PHONE or FAST2SMS_API_KEY in Render environment variables. "
        f"Generated OTP for {phone_number}: {code}"
    )
    return True, f"Code generated for {phone_number} (configure TWILIO or FAST2SMS for cellular SMS delivery)."


def _generate_email_html(code: str, user_name: str = "") -> str:
    """Renders a sleek, responsive HTML email template for the OTP code."""
    greeting = f"Hello {user_name}," if user_name else "Hello,"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin:0; padding:0; background-color:#09090b; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:480px; background-color:#121215; border:1px solid #27272a; border-radius:24px; padding:36px; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block; width:48px; height:48px; line-height:48px; background:linear-gradient(135deg, #9333ea, #6366f1); border-radius:14px; text-align:center; font-size:24px; color:#ffffff; font-weight:bold;">
                AI
              </div>
              <h1 style="color:#ffffff; font-size:20px; font-weight:700; margin:16px 0 4px 0; letter-spacing:-0.5px;">Autonomous AI Data Analyst</h1>
              <p style="color:#a1a1aa; font-size:13px; margin:0;">Identity Verification</p>
            </td>
          </tr>
          <!-- Body Text -->
          <tr>
            <td style="color:#e4e4e7; font-size:14px; line-height:22px; padding-bottom:20px;">
              <p style="margin:0 0 10px 0;">{greeting}</p>
              <p style="margin:0; color:#a1a1aa;">Please use the 6-digit verification code below to complete your sign-in:</p>
            </td>
          </tr>
          <!-- 6-Digit Code Box -->
          <tr>
            <td align="center" style="padding:10px 0 24px 0;">
              <div style="background-color:#1c1917; border:1px solid #3f3f46; border-radius:16px; padding:18px 24px; display:inline-block; text-align:center;">
                <span style="font-family:'SF Mono', Monaco, 'Courier New', monospace; font-size:36px; font-weight:800; letter-spacing:10px; color:#c084fc; text-shadow:0 0 20px rgba(192,132,252,0.4);">
                  {code}
                </span>
              </div>
            </td>
          </tr>
          <!-- Expiry Notice -->
          <tr>
            <td align="center" style="padding-bottom:24px; border-bottom:1px solid #27272a;">
              <p style="color:#71717a; font-size:12px; margin:0;">
                This passcode is strictly confidential and expires in <strong style="color:#e4e4e7;">5 minutes</strong>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="color:#52525b; font-size:11px; margin:0; line-height:18px;">
                If you did not request this verification code, you can safely ignore this message.
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

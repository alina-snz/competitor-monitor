import requests
import logging
import os
from dotenv import load_dotenv
import firebase_client
import resend

load_dotenv()

log = logging.getLogger(__name__)

# Constants — defined once at module level
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "onboarding@resend.dev")

def build_telegram_message(site_url: str, changes: dict) -> str:
    """
    Formats the alert message with HTML markup for Telegram.
    Handles missing or empty red_flags gracefully.
    """
    red_flags = changes.get("red_flags", [])
    red_flags_text = "\n".join(f"• {flag}" for flag in red_flags) if red_flags else "No specific flags."

    return (
        f"🚨 <b>Changes detected!</b>\n\n"
        f"🌐 <b>Site:</b> {site_url}\n\n"
        f"📋 <b>Summary:</b> {changes.get('summary', 'No summary available.')}\n\n"
        f"⚠️ <b>Details:</b>\n{red_flags_text}"
    )


def build_email_html(site_url: str, changes: dict) -> str:
    """Formats alert as HTML email."""
    red_flags = changes.get("red_flags", [])
    flags_html = "".join(f"<li>{flag}</li>" for flag in red_flags) if red_flags else "<li>No specific flags.</li>"
    return f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">🚨 Changes detected!</h2>
        <p><strong>Site:</strong> {site_url}</p>
        <p><strong>Summary:</strong> {changes.get('summary', 'No summary available.')}</p>
        <p><strong>Details:</strong></p>
        <ul>{flags_html}</ul>
        <hr>
        <p style="color: #9ca3af; font-size: 12px;">
            Competitor Monitor — AI-powered competitor tracking
        </p>
    </div>
    """


def send_via_telegram(chat_id: str, site_url: str, changes: dict) -> None:
    """Sends Telegram alert. Raises on failure."""
    message = build_telegram_message(site_url, changes)
    try:
        response = requests.post(
            TELEGRAM_API_URL,
            json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            timeout=10
        )
        response.raise_for_status()
        log.info("Telegram alert sent for %s (chat_id=%s)", site_url, chat_id)
    except requests.exceptions.HTTPError as e:
        log.error("Telegram HTTP error for %s: %s", site_url, e)
        raise
    except requests.exceptions.ConnectionError:
        log.error("No connection to Telegram for %s", site_url)
        raise
    except requests.exceptions.Timeout:
        log.error("Telegram request timed out for %s", site_url)
        raise


def send_via_email(email: str, site_url: str, changes: dict) -> None:
    """
    Sends a formatted HTML message to an email address.
    Raises on HTTP, connection, or timeout errors — caller handles them.
    """
    html = build_email_html(site_url, changes)

    try:
        resend.emails.send({
            "from": EMAIL_FROM,
            "to": email,
            "subject": f"Changes detected on {site_url}",
            "html": html
        })
        log.info("Email alert sent for %s (to=%s)", site_url, email)
    except Exception as e:
        log.error("Resend error for %s: %s", site_url, e)
        raise



def send_alert(site_url: str, changes: dict, user_id: str | None = None) -> None:
    """
    Main entry point.
    Reads user settings from Firebase, determines notification channel,
    builds and sends the alert. Errors are caught so pipeline doesn't crash.
    """
    if not user_id:
        log.warning("No user_id provided for alert on %s — skipping alert.", site_url)
        return
    
    user_settings = firebase_client.get_user_settings(user_id)
    if not user_settings:
        log.warning("No user settings found for user_id=%s — skipping alert for %s.", user_id, site_url)
        return
    
    channel = user_settings.get("notificationChannel", "email")
    email = user_settings.get("email")
    chat_id = user_settings.get("telegramChatId")

    try:
        if channel == "telegram":
            if chat_id:
                send_via_telegram(chat_id, site_url, changes)
            elif email:
                log.warning("No Telegram chat ID found for user_id=%s — falling back to email alert for %s.", user_id, site_url)
                send_via_email(email, site_url, changes)
            else:
                log.warning("No Telegram chat ID found for user_id=%s — skipping Telegram alert for %s.", user_id, site_url)

        elif channel == "email":
            if email:
                send_via_email(email, site_url, changes)
            else:
                log.warning("No email found for user_id=%s — skipping email alert for %s.", user_id, site_url)

        else:
            log.warning("Unknown notification channel '%s' for user_id=%s — skipping alert for %s.", channel, user_id, site_url)

    except Exception as e:
        log.error("Failed to send alert for %s (user_id=%s): %s", site_url, user_id, e)


























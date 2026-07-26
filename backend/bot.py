import os
import logging
from dotenv import load_dotenv
import firebase_client
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

load_dotenv()
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
    level=logging.INFO
) 
log = logging.getLogger(__name__)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    user_name = update.effective_user.first_name
    token = context.args[0] if context.args else None

    if not token:
        await update.message.reply_text(f"Hi {user_name}! Please connect through the website.")
        return

    log.info("Connection attempt: token=%s chat_id=%s", token, chat_id)

    try:
        result = firebase_client.save_telegram_connection(token, chat_id)
    except Exception:
        log.exception("save_telegram_connection failed for token=%s chat_id=%s", token, chat_id)
        await update.message.reply_text(
            "⚠️ Something went wrong on our side. Please try the link again or contact support."
        )
        return

    if not result:
        log.warning("save_telegram_connection returned falsy for token=%s — token likely invalid or expired", token)
        await update.message.reply_text(
            "❌ This link is invalid or expired. Please generate a new one from the website."
        )
        return

    log.info("Telegram connected: chat_id=%s", chat_id)
    await update.message.reply_text("✅ Connected! You'll now receive competitor alerts here.")

def run_bot():
    app = ApplicationBuilder().token(os.getenv("TELEGRAM_TOKEN")).build()
    app.add_handler(CommandHandler("start", start))
    log.info("Bot started and listening for messages...")
    app.run_polling()

if __name__ == "__main__":
    run_bot()
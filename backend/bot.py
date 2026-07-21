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
    """When user sends /start — save their chat_id to Firebase."""
    chat_id = str(update.effective_chat.id)
    user_name = update.effective_user.first_name

    token = context.args[0] if context.args else None

    if token:
        firebase_client.save_telegram_connection(token, chat_id)
        await update.message.reply_text(
            f"✅ Connected! You'll now receive competitor alerts here."
        )
    else:
        await update.message.reply_text(
            f"Hi {user_name}! Please connect through the website."
        )

def run_bot():
    app = ApplicationBuilder().token(os.getenv("TELEGRAM_TOKEN")).build()
    app.add_handler(CommandHandler("start", start))
    log.info("Bot started and listening for messages...")
    app.run_polling()

if __name__ == "__main__":
    run_bot()
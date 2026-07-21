import firebase_admin
from firebase_admin import credentials, firestore
import os
import logging
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS", "firebase-key.json"))
firebase_admin.initialize_app(cred)
db = firestore.client()


def save_snapshot(site_url: str, content: str) -> None:
    try:
        db.collection("snapshots").add({
            "site_url": site_url,
            "content": content,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        log.info("Snapshot saved for %s", site_url)
    except Exception as e:
        log.error("Error saving snapshot for %s: %s", site_url, e)


def get_last_snapshot(site_url: str) -> str | None:
    try:
        docs = (db.collection("snapshots")
                .where("site_url", "==", site_url)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream())
        for doc in docs:
            return doc.to_dict().get("content")
        return None
    except Exception as e:
        log.error("Error retrieving snapshot for %s: %s", site_url, e)
        return None


def save_hash(site_url: str, hash_value: str) -> None:
    try:
        db.collection("hashes").add({
            "site_url": site_url,
            "hash": hash_value,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        log.info("Hash saved for %s", site_url)
    except Exception as e:
        log.error("Error saving hash for %s: %s", site_url, e)


def get_last_hash(site_url: str) -> str | None:
    try:
        docs = (db.collection("hashes")
                .where("site_url", "==", site_url)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream())
        for doc in docs:
            return doc.to_dict().get("hash")
        return None
    except Exception as e:
        log.error("Error retrieving hash for %s: %s", site_url, e)
        return None


def save_selectors(site_url: str, selectors: dict) -> None:
    try:
        db.collection("selectors").add({
            "site_url": site_url,
            "selectors": selectors,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        log.info("Selectors saved for %s", site_url)
    except Exception as e:
        log.error("Error saving selectors for %s: %s", site_url, e)


def get_last_selectors(site_url: str) -> dict | None:
    try:
        docs = (db.collection("selectors")
                .where("site_url", "==", site_url)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream())
        for doc in docs:
            return doc.to_dict().get("selectors")
        return None
    except Exception as e:
        log.error("Error retrieving selectors for %s: %s", site_url, e)
        return None


def save_site(site_url: str, user_id: str) -> None:
    try:
        db.collection("sites").add({
            "url": site_url,
            "userId": user_id,
            "active": True,
            "status": "scanning",
            "created_at": firestore.SERVER_TIMESTAMP
        })
        log.info("Site saved for monitoring: %s", site_url)
    except Exception as e:
        log.error("Error saving site %s: %s", site_url, e)


def get_all_sites() -> list[dict]:
    try:
        docs = db.collection("sites").where("active", "==", True).stream()
        sites = []
        for doc in docs:
            data = doc.to_dict()
            url = data.get("url")
            user_id = data.get("userId")
            if url and user_id:
                sites.append({"url": url, "userId": user_id})
        log.info("Retrieved %d active sites", len(sites))
        return sites
    except Exception as e:
        log.error("Error retrieving sites: %s", e)
        return []


def save_change(site_url: str, changes: dict, user_id: str | None = None) -> None:
    try:
        db.collection("changes").add({
            "url": site_url,
            "userId": user_id,
            "summary": changes.get("summary"),
            "red_flags": changes.get("red_flags", []),
            "detected_at": firestore.SERVER_TIMESTAMP
        })
        log.info("Change saved for %s", site_url)
    except Exception as e:
        log.error("Error saving change for %s: %s", site_url, e)


def get_user_settings(user_id: str) -> dict | None:
    try:
        doc = db.collection("users").document(user_id).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        log.error("Error retrieving user settings for %s: %s", user_id, e)
        return None


def save_telegram_connection(token: str, chat_id: str) -> None:
    try:
        db.collection("telegram_connections").document(token).set({
            "chat_id": chat_id,
            "created_at": firestore.SERVER_TIMESTAMP
        })
        log.info("Telegram connection saved for token %s", token)
    except Exception as e:
        log.error("Error saving telegram connection: %s", e)


def get_telegram_connection(token: str) -> str | None:
    try:
        doc = db.collection("telegram_connections").document(token).get()
        if doc.exists:
            return doc.to_dict().get("chat_id")
        return None
    except Exception as e:
        log.error("Error getting telegram connection: %s", e)
        return None


def update_site_status(site_url: str, user_id: str, status: str) -> None:
    try:
        docs = (db.collection("sites")
                .where("url", "==", site_url)
                .where("userId", "==", user_id)
                .limit(1)
                .stream())
        for doc in docs:
            doc.reference.update({"status": status})
            log.info("Site status updated to '%s' for %s", status, site_url)
    except Exception as e:
        log.error("Error updating site status for %s: %s", site_url, e)
import logging
import os
import hashlib
import json
import signal
import time

from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler

from notifier import send_alert
from scraper import scrape_site
from analyzer import run_analysis
from discoverer import run_discovery
import firebase_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

load_dotenv()

CRON_HOUR = int(os.getenv("CRON_HOUR", "8"))
CRON_MINUTE = int(os.getenv("CRON_MINUTE", "1"))
CRON_TIMEZONE = os.getenv("CRON_TIMEZONE", "UTC")

VALID_SNAPSHOT_TYPES = {"full_text", "product_cards"}


def is_valid_snapshot(content) -> bool:
    """
    Checks that a scraped snapshot has the shape the rest of the pipeline
    (hashing, analyzer) expects: {"type": "full_text"|"product_cards", "content": ...}
    with non-empty content.
    """
    if not isinstance(content, dict):
        return False

    snapshot_type = content.get("type")
    if snapshot_type not in VALID_SNAPSHOT_TYPES:
        return False

    body = content.get("content")

    if snapshot_type == "full_text":
        return isinstance(body, str) and bool(body.strip())

    if snapshot_type == "product_cards":
        return isinstance(body, list) and len(body) > 0

    return False


def scrape_with_discovery_retry(site_url: str, had_selectors: bool):
    """
    Scrapes the site once. If the result looks broken (wrong shape / empty)
    AND selectors already existed on file, the layout most likely changed
    since discovery last ran — re-run discovery once and retry the scrape.

    Returns (content, rediscovered: bool).
    """
    content = scrape_site(site_url)

    if is_valid_snapshot(content):
        return content, False

    if not had_selectors:
        # Nothing to retry against — this site never had selectors to begin with.
        return content, False

    log.warning(
        "Scrape for %s returned an invalid/empty snapshot despite existing "
        "selectors — they may be stale. Re-running discovery.",
        site_url
    )

    rediscovered = run_discovery(site_url, force=True)
    if not rediscovered:
        log.warning("Re-discovery failed for %s.", site_url)
        return content, True

    return scrape_site(site_url), True


def check_all_sites():
    """
    Main orchestrator function.
    Iterates over all active monitored sites, runs AI-powered discovery
    if needed (or if selectors appear stale), detects content changes via
    hashing, compares with AI, and dispatches Telegram alerts when
    significant changes are found.
    """

    try:
        sites = firebase_client.get_all_sites()
    except Exception:
        log.exception("Failed to load site list from Firestore — skipping this cycle.")
        return

    if not sites:
        log.warning("No active sites found in Firestore. Add sites to the 'sites' collection.")
        return

    log.info("Starting monitoring cycle for %d site(s)...", len(sites))

    stats = {
        "changes_detected": 0,
        "no_change": 0,
        "first_run": 0,
        "invalid_snapshot": 0,
        "rediscoveries": 0,
        "errors": 0,
        "skipped_invalid_entry": 0,
    }
    cycle_start = time.monotonic()

    for site in sites:
        site_start = time.monotonic()
        site_url = site.get("url")
        user_id = site.get("userId")

        if not site_url or not user_id:
            log.warning("Skipping invalid site entry: %s", site)
            stats["skipped_invalid_entry"] += 1
            continue

        log.info("--- Processing: %s ---", site_url)

        try:
            # 1. Run discovery if selectors don't exist
            selectors = firebase_client.get_last_selectors(site_url)
            had_selectors = bool(selectors)

            if not had_selectors:
                log.info("No selectors found for %s — running AI discovery...", site_url)
                success = run_discovery(site_url, force=True)
                if not success:
                    log.warning(
                        "Discovery failed for %s — scraper will fall back to full-text mode.",
                        site_url
                    )
                had_selectors = success

            # 2. Scrape current snapshot, retrying discovery once if it looks stale
            new_content, rediscovered = scrape_with_discovery_retry(site_url, had_selectors)
            if rediscovered:
                stats["rediscoveries"] += 1

            # 3. Validate structure before we hash/store/compare anything
            if not is_valid_snapshot(new_content):
                log.error(
                    "Invalid or empty snapshot for %s after retry — skipping this cycle.",
                    site_url
                )
                stats["invalid_snapshot"] += 1
                continue

            # 4. Serialize JSON before hashing
            serialized_content = json.dumps(
                new_content,
                ensure_ascii=False,
                sort_keys=True
            )
            new_hash = hashlib.sha256(
                serialized_content.encode("utf-8")
            ).hexdigest()

            # 5. Load previous snapshot/hash
            old_content = firebase_client.get_last_snapshot(site_url)
            old_hash = firebase_client.get_last_hash(site_url)

            # 6. Persist today's snapshot/hash immediately — new_content is valid,
            #    so this baseline should be saved regardless of what happens below.
            #    (Saving this AFTER the hash/first-run "continue" checks would mean
            #    a first run never gets persisted and re-triggers "first run" forever.)
            firebase_client.save_snapshot(site_url, new_content)
            firebase_client.save_hash(site_url, new_hash)
            log.info("Snapshot and hash saved for %s", site_url)

            # 7. Skip if hash didn't change
            if old_hash and new_hash == old_hash:
                log.info("Hash unchanged for %s — no further analysis needed.", site_url)
                stats["no_change"] += 1
                continue

            # 8. First run
            if not old_content:
                log.info("First snapshot recorded for %s — baseline established.", site_url)
                stats["first_run"] += 1
                continue

            # 9. Compare snapshots using AI
            if not (isinstance(old_content, dict) and isinstance(new_content, dict)):
                log.warning(
                    "Hash changed for %s but snapshot format is unexpected "
                    "(old=%s, new=%s) — skipping AI comparison.",
                    site_url, type(old_content).__name__, type(new_content).__name__
                )
                stats["invalid_snapshot"] += 1
                continue

            changes = run_analysis(old_content, new_content, site_url)

            if changes:
                firebase_client.save_change(site_url, changes, user_id)
                send_alert(site_url, changes, user_id=user_id)
                log.info("Change detected and alert dispatched for %s", site_url)
                stats["changes_detected"] += 1
            else:
                log.info(
                    "Hash changed for %s but AI found no significant differences.",
                    site_url
                )
                stats["no_change"] += 1

        except Exception:
            log.exception("Unhandled error while processing %s", site_url)
            stats["errors"] += 1
            continue

        finally:
            log.info("Finished %s in %.2fs", site_url, time.monotonic() - site_start)

    total_elapsed = time.monotonic() - cycle_start
    log.info(
        "Cycle complete in %.1fs — %d sites | %d changes | %d unchanged | "
        "%d baselines | %d invalid | %d rediscoveries | %d errors | %d skipped entries",
        total_elapsed,
        len(sites),
        stats["changes_detected"],
        stats["no_change"],
        stats["first_run"],
        stats["invalid_snapshot"],
        stats["rediscoveries"],
        stats["errors"],
        stats["skipped_invalid_entry"],
    )


if __name__ == "__main__":
    log.info("Competitor Monitor starting up...")

    check_all_sites()

    scheduler = BlockingScheduler(timezone=CRON_TIMEZONE)
    scheduler.add_job(
        check_all_sites,
        "cron",
        hour=CRON_HOUR,
        minute=CRON_MINUTE,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    log.info(
        "Scheduler active — daily run at %02d:%02d %s.",
        CRON_HOUR, CRON_MINUTE, CRON_TIMEZONE
    )

    def _handle_shutdown(signum, frame):
        log.info("Shutdown signal received — stopping scheduler...")
        scheduler.shutdown(wait=False)

    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)

    scheduler.start()


    
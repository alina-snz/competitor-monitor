import logging
import os
import hashlib
import json

from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler

from notifier import send_alert
from scraper import scrape_site
from analyzer import compare_with_ai
from discoverer import run_discovery
import firebase_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

load_dotenv()


def check_all_sites():
    """
    Main orchestrator function.
    Iterates over all active monitored sites, runs AI-powered discovery
    if needed, detects content changes via hashing, compares with AI,
    and dispatches Telegram alerts when significant changes are found.
    """

    sites = firebase_client.get_all_sites()
    if not sites:
        log.warning("No active sites found in Firestore. Add sites to the 'sites' collection.")
        return

    log.info("Starting monitoring cycle for %d site(s)...", len(sites))

    for site in sites:
        site_url = site.get("url")
        user_id = site.get("userId")

        if not site_url or not user_id:
            log.warning("Skipping invalid site entry: %s", site)
            continue

        log.info("--- Processing: %s ---", site_url)

        try:
            # 1. Run discovery if selectors don't exist
            selectors = firebase_client.get_last_selectors(site_url)

            if not selectors:
                log.info("No selectors found for %s — running AI discovery...", site_url)

                success = run_discovery(site_url)

                if not success:
                    log.warning(
                        "Discovery failed for %s — scraper will fall back to full-text mode.",
                        site_url
                    )

            # 2. Scrape current snapshot
            new_content = scrape_site(site_url)

            if not new_content:
                log.error("Empty content returned for %s — skipping this cycle.", site_url)
                continue

            # 3. Serialize JSON before hashing
            serialized_content = json.dumps(
                new_content,
                ensure_ascii=False,
                sort_keys=True
            )

            new_hash = hashlib.sha256(
                serialized_content.encode("utf-8")
            ).hexdigest()

            # 4. Load previous snapshot/hash
            old_content = firebase_client.get_last_snapshot(site_url)
            old_hash = firebase_client.get_last_hash(site_url)

            # 5. Save today's snapshot/hash
            firebase_client.save_snapshot(site_url, new_content)
            firebase_client.save_hash(site_url, new_hash)

            log.info("Snapshot and hash saved for %s", site_url)

            # 6. Skip if hash didn't change
            if old_hash and new_hash == old_hash:
                log.info("Hash unchanged for %s — no further analysis needed.", site_url)
                continue

            # 7. First run
            if not old_content:
                log.info("First snapshot recorded for %s — baseline established.", site_url)
                continue

            # 8. Compare snapshots using AI
            changes = compare_with_ai(
                old_content,
                new_content,
                site_url
            )

            if changes:
                firebase_client.save_change(
                    site_url,
                    changes,
                    user_id
                )

                send_alert(
                    site_url,
                    changes,
                    user_id=user_id
                )

                log.info(
                    "Change detected and alert dispatched for %s",
                    site_url
                )

            else:
                log.info(
                    "Hash changed for %s but AI found no significant differences.",
                    site_url
                )

        except Exception as e:
            log.error(
                "Unhandled error while processing %s: %s",
                site_url,
                e
            )
            continue


if __name__ == "__main__":
    log.info("Competitor Monitor starting up...")

    check_all_sites()

    scheduler = BlockingScheduler()
    scheduler.add_job(check_all_sites, "cron", minute=1)

    log.info("Scheduler active — daily run at 08:00.")

    scheduler.start()
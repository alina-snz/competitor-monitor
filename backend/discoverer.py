import logging
import os
import json

from playwright.sync_api import sync_playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeout, Error as PlaywrightError
from bs4 import BeautifulSoup, Comment
from openai import OpenAI, APIError, APITimeoutError, RateLimitError
from typing import TypedDict
from dotenv import load_dotenv

import firebase_client

load_dotenv()

log = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    timeout=120.0,
    max_retries=2
)

DISCOVERY_MODEL = os.getenv("OPENAI_DISCOVERY_MODEL", "gpt-4o-mini")

# Max characters of cleaned HTML sent to AI — prevents token overflow
MAX_HTML_CHARS = 15_000

DISCOVERY_PROMPT = """
You are a web discovery expert. You receive the HTML of a competitor's website.
Identify CSS selectors for product catalog elements.

Always respond in valid JSON format:
{
    "product_card": ".selector",
    "product_name": ".selector",
    "product_price": ".selector",
    "product_availability": ".selector or null"
}
""".strip()


class Selectors(TypedDict):
    product_card: str
    product_name: str
    product_price: str
    product_availability: str | None


def get_page_html(page, site_url: str) -> str | None:
    """Extracts raw HTML from an already-loaded Playwright page."""
    try:
        html = page.content()
        log.info("Raw HTML fetched for %s (length: %d chars)", site_url, len(html))
        return html
    except PlaywrightError as e:
        log.error("Failed to get page HTML for %s: %s", site_url, e)
        return None


def clean_html(html_content: str) -> str:
    """
    Strips scripts, styles, SVGs, comments and excess whitespace.
    Truncates to MAX_HTML_CHARS to stay within AI token limits.
    Returns cleaned, compacted HTML string.
    """
    original_len = len(html_content)

    soup = BeautifulSoup(html_content, "html.parser")

    # Remove tags that add noise but carry no product data
    for tag in soup(["script", "style", "svg", "noscript", "meta", "link"]):
        tag.decompose()

    # Remove HTML comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    cleaned = " ".join(str(soup).split())

    reduction = (1 - len(cleaned) / original_len) * 100 if original_len else 0
    log.info(
        "HTML cleaned for AI: %d → %d chars (%.0f%% reduction)",
        original_len, len(cleaned), reduction
    )

    if len(cleaned) > MAX_HTML_CHARS:
        log.warning(
            "Cleaned HTML truncated: %d → %d chars",
            len(cleaned), MAX_HTML_CHARS
        )

    return cleaned[:MAX_HTML_CHARS]


def discover_selectors(cleaned_html: str, site_url: str) -> Selectors | None:
    """
    Sends cleaned HTML to OpenAI and extracts CSS selectors for product elements.
    Returns None if AI response is missing required selectors or is malformed.
    """
    if not cleaned_html:
        log.warning("Empty HTML for %s — skipping selector discovery", site_url)
        return None

    user_prompt = (
        f"Analyze the HTML content of {site_url} and identify CSS selectors.\n\n"
        f"HTML CONTENT:\n{cleaned_html}"
    )

    log.info("Sending %d chars of HTML to AI for selector discovery: %s", len(cleaned_html), site_url)

    try:
        response = client.chat.completions.create(
            model=DISCOVERY_MODEL,
            messages=[
                {"role": "system", "content": DISCOVERY_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        data = json.loads(response.choices[0].message.content)

        # Type check first — before any key access
        if not isinstance(data, dict):
            log.error("AI returned non-dict response: %s", type(data))
            return None

        # Validate required keys are present
        required = {"product_card", "product_name", "product_price", "product_availability"}
        missing = required - data.keys()
        if missing:
            log.error("AI response missing required selectors: %s", missing)
            return None

        REQUIRED_NON_NULL = {"product_card", "product_name", "product_price"}
        invalid = {
            key for key in REQUIRED_NON_NULL
            if not isinstance(data.get(key), str) or not data[key].strip()
        }
        if invalid:
            log.error("AI response has empty/invalid selectors: %s", invalid)
            return None

        selectors: Selectors = {
            "product_card":         data["product_card"],
            "product_name":         data["product_name"],
            "product_price":        data["product_price"],
            "product_availability": data.get("product_availability"),
        }

        # Log which selectors were actually found vs null
        found = {k: v for k, v in selectors.items() if v is not None}
        log.info(
            "Selectors discovered for %s (%d/%d non-null): %s",
            site_url, len(found), len(selectors), list(found.keys())
        )

        return selectors

    except (APIError, APITimeoutError, RateLimitError) as e:
        log.error("OpenAI error during selector discovery for %s: %s", site_url, e)
        return None


def run_discovery(site_url: str, force: bool = False) -> bool:
    """
    Orchestrates the full discovery flow for one site.
    Skips if selectors already exist in Firebase — unless force=True, in
    which case existing selectors are ignored and discovery runs anyway.
    Use force=True when the caller suspects current selectors are stale
    (e.g. the site started returning empty/broken scrapes despite selectors
    being on file).
    Returns True if selectors are available (existing or newly found), False otherwise.
    """
    if not force:
        existing = firebase_client.get_last_selectors(site_url)
        if existing:
            log.info("Selectors already exist for %s — skipping discovery", site_url)
            return True
    else:
        log.info("Forcing fresh discovery for %s (ignoring existing selectors)", site_url)

    log.info("Starting selector discovery for %s", site_url)

    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"]
    )

    try:
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        try:
            page.goto(site_url, timeout=60000)
            page.wait_for_load_state("networkidle")
            log.info("Page loaded successfully: %s", site_url)
        except PlaywrightTimeout:
            log.error("Page load timeout for %s — site may be blocking bots", site_url)
            return False
        except PlaywrightError as e:
            log.error("Playwright error loading %s: %s", site_url, e)
            return False

        html_content = get_page_html(page, site_url)
        if not html_content:
            log.error("No HTML content retrieved for %s", site_url)
            return False

        cleaned_html = clean_html(html_content)
        selectors = discover_selectors(cleaned_html, site_url)

        if selectors:
            firebase_client.save_selectors(site_url, selectors)
            log.info("Discovery complete — selectors saved for %s", site_url)
            return True

        log.error("Discovery failed — no valid selectors found for %s", site_url)
        return False

    finally:
        browser.close()
        playwright.stop()
        log.info("Browser closed after discovery for %s", site_url)
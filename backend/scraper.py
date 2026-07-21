from playwright.sync_api import sync_playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeout, Error as PlaywrightError

import logging
from typing import TypedDict, Literal
import firebase_client

log = logging.getLogger(__name__)

class Product(TypedDict):
    name: str
    price: str
    availability: str

class FullTextResult(TypedDict):
    type: Literal["full_text"]
    content: str

class ProductCardsResult(TypedDict):
    type: Literal["product_cards"]
    content: list[Product]

ScrapeResult = FullTextResult | ProductCardsResult

def extract_product(card, selectors: dict) -> Product | None:
    """Extracts product data from a single card element.
    Returns None if required fields are missing."""
    name_el = card.query_selector(selectors["product_name"])
    price_el = card.query_selector(selectors["product_price"])

    if not (name_el and price_el):
        return None
    
    availability_selector = selectors.get("product_availability")
    availability_el = (
        card.query_selector(availability_selector)
        if availability_selector
        else None
        )

    product = {
        "name": name_el.inner_text().strip(),
        "price": price_el.inner_text().strip(),
        "availability": (availability_el.inner_text().strip()
        if availability_el
        else ""
        ),
    }
    return product
    

def _scrape_full_site(page, url: str) -> FullTextResult:
    """Fallback: scrapes full page text when no selectors available."""
    content = page.inner_text("body")
    log.info("Full text scraped for %s (length: %d)", url, len(content))
    return {
        "type": "full_text",
        "content": content[:8000]
    }


def _scrape_with_selectors(page, url: str, selectors: dict) -> ScrapeResult:
    """Smart scraper: uses CSS selectors to extract only product data."""
    try:

        cards = page.query_selector_all(selectors["product_card"])

        if not cards:
            log.warning("No product cards found for %s, falling back", url)
            return _scrape_full_site(url)

        scraped_content = []

        for card in cards:
            product = extract_product(card, selectors)
            if product:
                scraped_content.append(product)

        log.info("Scraped %d products from %s", len(scraped_content), url)

        return {
            "type": "product_cards",
            "content": scraped_content
        }

    except PlaywrightTimeout:
        log.warning("Timeout while scraping %s — site too slow", url)
        return _scrape_full_site(url)
    except PlaywrightError as e:
        log.error("Playwright error for %s: %s", url, e)
        return _scrape_full_site(url)


def scrape_site(url: str) -> ScrapeResult:
    """Public entry point. Opens browser once, loads page, scrapes data.
    Uses CSS selectors if available, falls back to full text."""
    
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
            page.goto(url, timeout=60000)
            page.wait_for_load_state("networkidle")
        except PlaywrightTimeout:
            log.error("Page load timeout for %s", url)
            return {"type": "full_text", "content": ""}
        except PlaywrightError as e:
            log.error("Failed to load page %s: %s", url, e)
            return {"type": "full_text", "content": ""}

        try:    
            selectors = firebase_client.get_last_selectors(url)
        except Exception as e:
            log.error("Failed to load selectors for %s: %s", url, e)
            selectors = None
        
        if selectors:
            log.info("Using discovered selectors for %s", url)
            return _scrape_with_selectors(url, selectors)
        
        log.info("No selectors found for %s, using full text scraper", url)
        return _scrape_full_site(url)
    
    finally:
        browser.close()
        playwright.stop()

    

    



        
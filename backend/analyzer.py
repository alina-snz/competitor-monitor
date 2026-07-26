import logging
import os
import json

from dotenv import load_dotenv
from openai import OpenAI, APIError, APITimeoutError, RateLimitError
from typing import TypedDict

load_dotenv()

log = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    timeout=120.0,
    max_retries=2
)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

SYSTEM_PROMPT_STRUCTURED = """
You are a competitor pricing analyst. You receive two JSON lists of products scraped from a competitor website.
Each product has: name, price, availability.

Compare the lists and identify:
- Price changes (which product, old price, new price)
- New products added
- Products removed
- Availability changes (in stock → out of stock)

Be specific — mention exact product names and prices.

Always respond in valid JSON:
{
    "has_changes": true or false,
    "summary": "brief description or null",
    "red_flags": ["Product X price changed from $Y to $Z", ...]
}
""".strip()


SYSTEM_PROMPT_TEXT = """
You are a competitor analysis expert. You receive two text snapshots of a website.

Look for: price changes, new or removed products, promotions, structural changes.

Always respond in valid JSON:
{
    "has_changes": true or false,
    "summary": "brief description or null",
    "red_flags": ["list of specific changes"]
}
""".strip()

class AnalysisResult(TypedDict):
    summary: str
    red_flags: list[str]


def format_for_prompt(data: dict, text_limit: int = 6000, max_products: int = 50) -> str:
    """
    Converts scraper result into text for AI prompt.
    """

    data_type = data.get("type")
    content = data.get("content")
    
    if data_type == "product_cards" and isinstance(content, list):
        limited_products = content[:max_products]
        if len(content) > max_products:
            log.warning(
                "Truncated product list: %d → %d items for AI prompt",
                len(content), max_products
            )
        return json.dumps(
            limited_products,
            ensure_ascii=False,
            indent=2
        )

    if data_type == "full_text" and isinstance(content, str):
        return content[:text_limit]

    log.warning("Unknown content type: %s", data_type)
    return str(content)[:text_limit]


def find_changed_products(old_data: dict, new_data: dict) -> list[dict]:
    """
    Pre-filters changed products before sending to AI.
    Only works for product_cards type — saves tokens.
    """
    if old_data.get("type") != "product_cards":
        return []
    if new_data.get("type") != "product_cards":
        return []
    
    old_products = {
        p["name"]: p for p in old_data.get("content", [])
    }
    new_products = {
        p["name"]: p for p in new_data.get("content", [])
    }

    changed = []

    for name, new_p in new_products.items():
        old_p = old_products.get(name)

        if old_p is None:
            changed.append({
                "change": "new_product",
                **new_p
                })
            
        elif old_p["price"] != new_p["price"]:
            changed.append({
                "change": "price_changed",
                "name": name,
                "old_price": old_p["price"],
                "new_price": new_p["price"]
                })

        elif old_p.get("availability") != new_p.get("availability"):
            changed.append({
                "change": "availability_changed",
                "name": name,
                "old": old_p.get("availability"),
                "new": new_p.get("availability")
            })

    for name in old_products:
        if name not in new_products:
            changed.append({
                "change": "removed",
                "name": name
            })

    return changed


def compare_with_ai(old_data: dict, new_data: dict, site_url: str) -> AnalysisResult | None:
    """
    Sends both snapshots to OpenAI for semantic comparison.
    Chooses prompt based on data type (structured vs full text).
    Returns AnalysisResult if changes found, None otherwise.
    """

    if old_data["type"] == "product_cards":
        system_prompt = SYSTEM_PROMPT_STRUCTURED
    else:
        system_prompt = SYSTEM_PROMPT_TEXT
    
    old_format = format_for_prompt(old_data, max_products=50, text_limit=6000)
    new_format = format_for_prompt(new_data, max_products=50, text_limit=6000)

    user_prompt = (
        f"Compare these two snapshots of {site_url}.\n\n"
        f"YESTERDAY:\n{old_format}\n\n"
        f"TODAY:\n{new_format}"
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )

        data = json.loads(response.choices[0].message.content)

        if not isinstance (data, dict):
            log.error("Unexpected response format: %s", data)
            return None

        log.info("Comparison result for %s: %s", site_url, json.dumps(data, indent=2))

        if not data.get("has_changes"):
            return None

        return {
            "summary": data.get("summary"),
            "red_flags": data.get("red_flags", []),
        }

    except RateLimitError:
        log.error("Rate limit exceeded")
        return None

    except APITimeoutError:
        log.error("Request timed out")
        return None

    except APIError as e:
        log.error("API error: %s", e)
        return None


def run_analysis(old_data: dict, new_data: dict, site_url: str):
    """Entry point for analysing"""
    try:
        if old_data["type"] == "product_cards":
            changes = find_changed_products(old_data, new_data)
            if not changes:
                log.info("No product changes detected for %s — skipping AI", site_url)
                return None
        
        return compare_with_ai(old_data, new_data, site_url)

    except Exception as e:
        log.error("Analysis failed: %s", e)
        return None




    
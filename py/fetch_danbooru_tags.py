"""Fetch Danbooru tag database for the Danbooru Tag Validator node.

Usage:
    python fetch_danbooru_tags.py          # Fetch all tags sorted by popularity
    python fetch_danbooru_tags.py --fast   # Stop at 100k tags (~3 min)
    python fetch_danbooru_tags.py --resume # Resume from last save

Saves to: py/danbooru_tags.json
"""

import json
import time
import urllib.request
import urllib.error
import sys
from pathlib import Path

API_BASE = "https://danbooru.donmai.us/tags.json"
OUTPUT_FILE = Path(__file__).parent / "danbooru_tags.json"
PAGE_SIZE = 200
REQUEST_DELAY = 0.3  # seconds between requests

# Category ID to name mapping (Danbooru standard)
CATEGORIES = {0: "general", 1: "artist", 3: "copyright", 4: "character", 5: "meta"}


def fetch_page(page, sort="count"):
    """Fetch a single page of tags, sorted by post count descending."""
    url = f"{API_BASE}?limit={PAGE_SIZE}&page={page}&search[order]={sort}"
    req = urllib.request.Request(url, headers={"User-Agent": "BossNodes-TagFetcher/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  Rate limited, waiting 5s...")
            time.sleep(5)
            return fetch_page(page, sort)
        raise


def load_existing():
    """Load existing tags from file if it exists."""
    if OUTPUT_FILE.exists():
        try:
            with OUTPUT_FILE.open("r", encoding="utf-8") as f:
                data = json.load(f)
            tags = data.get("tags", {})
            print(f"Loaded {len(tags)} existing tags from file")
            return tags
        except Exception:
            pass
    return {}


def save_tags(tags, mode="full"):
    """Save tags to file."""
    output = {
        "_meta": {
            "total_tags": len(tags),
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "mode": mode,
            "categories": CATEGORIES,
        },
        "tags": tags,
    }
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)


def fetch_all_tags(fast_mode=False, resume=False):
    """Fetch tags sorted by popularity (most posts first)."""
    tags = load_existing() if resume else {}
    page = 1
    consecutive_empty = 0
    target = 100000 if fast_mode else None  # fast mode: stop at 100k

    mode = "fast" if fast_mode else "full"
    print(f"Fetching tags from Danbooru API ({mode} mode, sorted by popularity)...")

    while consecutive_empty < 3:
        data = fetch_page(page)
        if not data:
            consecutive_empty += 1
            page += 1
            time.sleep(REQUEST_DELAY)
            continue

        consecutive_empty = 0
        for tag in data:
            name = tag.get("name", "")
            post_count = tag.get("post_count", 0)
            category = tag.get("category", 0)
            tag_id = tag.get("id", 0)

            tags[name] = {
                "id": tag_id,
                "category": category,
                "post_count": post_count,
            }

        if page % 25 == 0:
            print(f"  Page {page}: {len(tags)} tags so far...")
            # Save progress every 25 pages
            save_tags(tags, mode)

        # In fast mode, stop once we have enough
        if target and len(tags) >= target:
            print(f"  Reached {len(tags)} tags, stopping early.")
            break

        # If tags have very low post counts, we've passed the useful ones
        if data and all(t.get("post_count", 0) < 2 for t in data):
            print(f"  Tags dropped below 2 posts at page {page}, stopping.")
            break

        page += 1
        time.sleep(REQUEST_DELAY)

    return tags


def main():
    fast = "--fast" in sys.argv
    resume = "--resume" in sys.argv
    tags = fetch_all_tags(fast_mode=fast, resume=resume)

    save_tags(tags, "fast" if fast else "full")

    print(f"\nDone! Saved {len(tags)} tags to {OUTPUT_FILE}")
    print(f"File size: {OUTPUT_FILE.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()

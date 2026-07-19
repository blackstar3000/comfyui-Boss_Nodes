"""Fetch artist preview images from nax.moe for the Artist Selector Editor.

Usage:
    python fetch_artist_previews.py          # Fetch all pages
    python fetch_artist_previews.py --fast   # First 5 pages only
    python fetch_artist_previews.py --resume # Skip already-fetched pages

Saves to: py/artist_previews.json
"""

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

GALLERY_URL = "https://nax.moe/?gallery=danbooru-artist-tags-v4.5&sort=date&page={page}"
OUTPUT_FILE = Path(__file__).parent / "artist_previews.json"
CACHE_FILE = Path(__file__).parent / ".artist_previews_cache.json"
REQUEST_DELAY = 1.0
SAVE_INTERVAL = 5

# Regex patterns for parsing nax.moe HTML
# Matches copy('gallery', 'artist_tag') calls — the primary source of artist names
COPY_FN_RE = re.compile(r"copy\('danbooru-artist-tags-v4\.5',\s*'([^']+)'\)")
# Matches CDN image URLs in img src
CDN_IMG_RE = re.compile(r'src="(https://cdn\.zele\.st/data/NAX/Images/danbooru-artist-tags-v4\.5/[^"?]+\.jpg)"', re.IGNORECASE)


def fetch_page(page):
    """Fetch a single gallery page from nax.moe."""
    url = GALLERY_URL.format(page=page)
    req = urllib.request.Request(url, headers={
        "User-Agent": "BossNodes-Scraper/1.0 (ComfyUI custom node)"
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  Rate limited, waiting 5s...")
            time.sleep(5)
            return fetch_page(page)
        raise


def parse_page(html):
    """Extract artist tags and image URLs from HTML page.

    The nax.moe gallery page has a consistent structure where each item contains:
    - onclick="copy('danbooru-artist-tags-v4.5', 'ARTIST_TAG')" for the tag name
    - <img src="CDN_URL" ...> for the preview image
    These appear in matching order within the HTML.
    """
    results = {}

    # Primary: extract artist tags from onclick copy() calls
    artist_tags = COPY_FN_RE.findall(html)

    # Extract CDN image URLs
    cdn_images = CDN_IMG_RE.findall(html)

    if not artist_tags or not cdn_images:
        return results

    # Pair by position — each copy() call corresponds to the next img tag
    for i, tag in enumerate(artist_tags):
        if i < len(cdn_images):
            # Store the raw CDN URL as-is (CDN expects double-encoded names)
            results[tag] = cdn_images[i]

    return results


def load_cache():
    """Load the set of already-fetched page numbers."""
    if CACHE_FILE.exists():
        try:
            with CACHE_FILE.open("r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()


def save_cache(pages):
    """Save the set of fetched page numbers."""
    with CACHE_FILE.open("w", encoding="utf-8") as f:
        json.dump(sorted(pages), f)


def load_existing():
    """Load existing artist previews from file."""
    if OUTPUT_FILE.exists():
        try:
            with OUTPUT_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_previews(previews):
    """Save artist previews to file."""
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(previews, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Fetch artist previews from nax.moe")
    parser.add_argument("--fast", action="store_true", help="Fetch first 5 pages only")
    parser.add_argument("--resume", action="store_true", help="Skip already-fetched pages")
    args = parser.parse_args()

    previews = load_existing() if args.resume else {}
    fetched_pages = load_cache() if args.resume else set()
    max_pages = 5 if args.fast else None
    page = 1
    consecutive_empty = 0

    mode = "fast" if args.fast else "full"
    print(f"Fetching artist previews from nax.moe ({mode} mode)...")

    while consecutive_empty < 3:
        if max_pages and page > max_pages:
            print(f"  Reached page limit ({max_pages}), stopping.")
            break

        if args.resume and page in fetched_pages:
            print(f"  Page {page}: already fetched, skipping")
            page += 1
            continue

        try:
            html = fetch_page(page)
        except Exception as e:
            print(f"  Page {page}: error fetching - {e}")
            consecutive_empty += 1
            page += 1
            time.sleep(REQUEST_DELAY)
            continue

        results = parse_page(html)
        if not results:
            consecutive_empty += 1
            print(f"  Page {page}: no results found")
        else:
            consecutive_empty = 0
            previews.update(results)
            fetched_pages.add(page)
            print(f"  Page {page}: found {len(results)} artists (total: {len(previews)})")

        # Save progress every 5 pages
        if page % SAVE_INTERVAL == 0:
            save_previews(previews)
            save_cache(fetched_pages)
            print(f"  Progress saved at page {page}")

        page += 1
        time.sleep(REQUEST_DELAY)

    # Final save
    save_previews(previews)
    save_cache(fetched_pages)

    print(f"\nDone! Saved {len(previews)} artist previews to {OUTPUT_FILE}")
    print(f"File size: {OUTPUT_FILE.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()

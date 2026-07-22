# Artist Selector Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Artist Selector Editor with preview images, post counts, and style categories from nax.moe and Danbooru.

**Architecture:** Three data collection scripts scrape/fetch metadata, which is stored in JSON files. Python backend loads enriched data and exposes it via API. JS frontend renders thumbnails, category chips, and post count badges.

**Tech Stack:** Python 3.13, aiohttp (for ComfyUI routes), vanilla JS (ComfyUI frontend), HTML scraping (BeautifulSoup or regex), Danbooru REST API

## Global Constraints

- 100% backward compatibility: existing workflows must load unchanged
- Node class name: `BossArtistSelector`, display name: `Artist Selector Boss`
- Node inputs/outputs/categories must not change
- `artists.json` must handle both old string format and new object format
- Preview images gracefully degrade (gray placeholder) when unavailable
- nax.moe scraping: rate-limit to 1 request/second, add User-Agent header
- Danbooru API: batch 200 tags per request, respect rate limits

---

## Phase 1: Data Collection Scripts

### Task 1: Create nax.moe scraper (`fetch_artist_previews.py`)

**Files:**
- Create: `py/fetch_artist_previews.py`
- Output: `py/artist_previews.json`

**Interfaces:**
- Produces: `artist_previews.json` — `{ "artist_tag": "image_url", ... }`
- CLI args: `--fast` (5 pages), `--resume` (skip fetched pages)

- [ ] **Step 1: Create the scraper script with HTML parsing**

```python
#!/usr/bin/env python3
"""Scrape nax.moe for artist preview images from the Danbooru artist tags gallery."""

import argparse
import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path
from html.parser import HTMLParser

BASE_DIR = Path(__file__).parent
OUTPUT_FILE = BASE_DIR / "artist_previews.json"
CACHE_FILE = BASE_DIR / ".artist_previews_cache.json"

GALLERY_URL = "https://nax.moe/?gallery=danbooru-artist-tags-v4.5&sort=date&page={page}"
USER_AGENT = "BossNodes-Scraper/1.0 (ComfyUI custom node)"
REQUEST_DELAY = 1.0  # seconds between requests


class GalleryParser(HTMLParser):
    """Extract artist tags and image URLs from nax.moe gallery pages."""

    def __init__(self):
        super().__init__()
        self.results = {}  # artist_tag -> image_url
        self._in_votes = False
        self._current_image_url = None
        self._current_artist = None

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag == "img":
            src = attr_dict.get("src", "")
            if "cdn.zele.st" in src and "danbooru-artist-tags" in src:
                self._current_image_url = src
        if tag == "div" and "imageText" in attr_dict.get("class", ""):
            pass  # will get text in handle_data

    def handle_endtag(self, tag):
        if tag == "figure" and self._current_image_url and self._current_artist:
            self.results[self._current_artist] = self._current_image_url
            self._current_image_url = None
            self._current_artist = None

    def handle_data(self, data):
        text = data.strip()
        if not text:
            return
        # Check if this is inside an imageText element
        # The artist tag is the caption text after the image
        if self._current_image_url and not self._current_artist:
            # Simple heuristic: if we have an image URL pending and get text, it's the artist
            if not text.startswith("An image") and len(text) < 100:
                self._current_artist = text


def fetch_page(page_num, retries=3):
    """Fetch a single gallery page and return parsed results."""
    url = GALLERY_URL.format(page=page_num)
    headers = {"User-Agent": USER_AGENT}

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            break
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  Failed to fetch page {page_num}: {e}")
                return {}

    # Parse using regex for reliability (HTML structure may vary)
    results = {}
    # Find all image panels with artist tags
    # Pattern: <img src="CDN_URL" ...> followed by <figurecaption class="imageText">ARTIST</figurecaption>
    img_pattern = re.compile(
        r'<img\s+src="(https://cdn\.zele\.st/data/NAX/Images/danbooru-artist-tags-v4\.5/[^"]+)"[^>]*>',
        re.IGNORECASE
    )
    caption_pattern = re.compile(
        r'<figurecaption[^>]*class="imageText"[^>]*>([^<]+)</figurecaption>',
        re.IGNORECASE
    )

    img_urls = img_pattern.findall(html)
    captions = caption_pattern.findall(html)

    for url, artist in zip(img_urls, captions):
        artist = artist.strip()
        if artist and url:
            results[artist] = url

    return results


def load_cache():
    """Load existing cache of fetched pages."""
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"fetched_pages": [], "artists": {}}


def save_cache(cache):
    """Save cache to disk."""
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Scrape nax.moe artist preview images")
    parser.add_argument("--fast", action="store_true", help="Only fetch first 5 pages")
    parser.add_argument("--resume", action="store_true", help="Skip already-fetched pages")
    args = parser.parse_args()

    max_pages = 5 if args.fast else 41
    cache = load_cache() if args.resume else {"fetched_pages": [], "artists": {}}

    all_artists = dict(cache.get("artists", {}))
    fetched = set(cache.get("fetched_pages", []))

    for page in range(1, max_pages + 1):
        if page in fetched:
            print(f"Page {page}: cached, skipping")
            continue

        print(f"Page {page}/{max_pages}...", end=" ", flush=True)
        results = fetch_page(page)
        all_artists.update(results)
        fetched.add(page)
        print(f"found {len(results)} artists (total: {len(all_artists)})")

        # Save progress every 5 pages
        if page % 5 == 0:
            cache = {"fetched_pages": sorted(fetched), "artists": all_artists}
            save_cache(cache)

        if page < max_pages:
            time.sleep(REQUEST_DELAY)

    # Save final output
    OUTPUT_FILE.write_text(
        json.dumps(all_artists, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"\nSaved {len(all_artists)} artist previews to {OUTPUT_FILE}")

    # Clean up cache
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test the scraper in fast mode**

Run: `cd F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes && python py/fetch_artist_previews.py --fast`
Expected: Fetches 5 pages, saves `artist_previews.json` with ~100-150 entries, prints progress

- [ ] **Step 3: Verify output format**

Run: `python -c "import json; d=json.load(open('py/artist_previews.json')); print(f'Artists: {len(d)}'); print('Sample:', list(d.items())[:3])"`
Expected: Shows count and sample entries with artist names mapped to CDN URLs

- [ ] **Step 4: Commit**

```bash
git add py/fetch_artist_previews.py py/artist_previews.json
git commit -m "feat: add nax.moe artist preview scraper"
```

---

### Task 2: Create Danbooru post count fetcher (`fetch_artist_post_counts.py`)

**Files:**
- Create: `py/fetch_artist_post_counts.py`
- Reads: `py/artists.json`
- Writes: `py/artists.json` (enriched with post_count)

**Interfaces:**
- Consumes: `artists.json` (string or object format)
- Produces: updates `artists.json` in-place with `post_count` field
- CLI args: `--dry-run` (preview without writing)

- [ ] **Step 1: Create the post count fetcher script**

```python
#!/usr/bin/env python3
"""Fetch Danbooru post counts for all artists in artists.json."""

import argparse
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).parent
ARTISTS_FILE = BASE_DIR / "artists.json"
DANBOORU_TAGS_URL = "https://danbooru.donmai.us/tags.json"
USER_AGENT = "BossNodes-Fetcher/1.0 (ComfyUI custom node)"
BATCH_SIZE = 200
REQUEST_DELAY = 1.0


def get_artist_names(artists_data):
    """Extract artist names from artists.json (handles both formats)."""
    raw = artists_data.get("artists", {})
    if not isinstance(raw, dict):
        return []
    names = []
    for key, value in raw.items():
        names.append(key)
    return names


def fetch_tag_post_counts(tag_names, retries=3):
    """Fetch post counts for a batch of tag names from Danbooru."""
    results = {}

    # Danbooru allows searching with wildcards in name_matches
    # We fetch artist tags (category=1) ordered by post_count
    # Then match against our list
    for i in range(0, len(tag_names), BATCH_SIZE):
        batch = tag_names[i:i + BATCH_SIZE]
        print(f"  Fetching batch {i // BATCH_SIZE + 1} ({len(batch)} tags)...", end=" ", flush=True)

        # Build search query - fetch all artist tags and filter
        url = f"{DANBOORU_TAGS_URL}?search%5Btag_category%5D=1&limit=200&search%5Border%5D=post_count"
        headers = {"User-Agent": USER_AGENT}

        for attempt in range(retries):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                break
            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    print(f"Failed: {e}")
                    data = []

        # Match tags to our names
        batch_set = set(n.lower() for n in batch)
        found = 0
        for tag in data:
            name = tag.get("name", "")
            if name.lower() in batch_set:
                results[name] = tag.get("post_count", 0)
                found += 1

        print(f"found {found}/{len(batch)}")
        time.sleep(REQUEST_DELAY)

    return results


def fetch_all_post_counts(tag_names):
    """Fetch post counts using the tags API with pagination."""
    results = {}
    page = 1
    total_fetched = 0
    names_set = set(n.lower() for n in tag_names)
    headers = {"User-Agent": USER_AGENT}

    print(f"Fetching post counts for {len(tag_names)} artists from Danbooru...")

    while True:
        url = f"{DANBOORU_TAGS_URL}?search%5Btag_category%5D=1&limit=200&page={page}&search%5Border%5D=post_count"

        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2 ** attempt)
                else:
                    print(f"  Page {page} failed: {e}")
                    data = []

        if not data:
            break

        found_this_page = 0
        for tag in data:
            name = tag.get("name", "")
            if name.lower() in names_set:
                results[name] = tag.get("post_count", 0)
                found_this_page += 1

        total_fetched += len(data)
        print(f"  Page {page}: scanned {len(data)} tags, matched {found_this_page} (total matched: {len(results)}/{len(tag_names)})")

        # If we've found all our tags, we can stop early
        if len(results) >= len(tag_names):
            print("  All artists matched, stopping early.")
            break

        # If we got fewer than 200 results, we've reached the end
        if len(data) < 200:
            break

        page += 1
        time.sleep(REQUEST_DELAY)

    return results


def main():
    parser = argparse.ArgumentParser(description="Fetch Danbooru post counts for artists")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    artists_data = json.loads(ARTISTS_FILE.read_text(encoding="utf-8"))
    names = get_artist_names(artists_data)

    if not names:
        print("No artists found in artists.json")
        return

    post_counts = fetch_all_post_counts(names)

    print(f"\nFound post counts for {len(post_counts)}/{len(names)} artists")

    if args.dry_run:
        print("\nDry run - top 10 by post count:")
        sorted_counts = sorted(post_counts.items(), key=lambda x: -x[1])
        for name, count in sorted_counts[:10]:
            print(f"  {name}: {count} posts")
        return

    # Enrich artists.json
    raw = artists_data.get("artists", {})
    enriched = 0
    for name, value in raw.items():
        if name in post_counts:
            if isinstance(value, str):
                # Convert string format to object format
                raw[name] = {
                    "prompt": value,
                    "post_count": post_counts[name],
                    "categories": []
                }
            elif isinstance(value, dict):
                raw[name]["post_count"] = post_counts[name]
            enriched += 1

    artists_data["artists"] = raw
    ARTISTS_FILE.write_text(
        json.dumps(artists_data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"\nEnriched {enriched} artists with post counts in {ARTISTS_FILE}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test with dry-run**

Run: `cd F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes && python py/fetch_artist_post_counts.py --dry-run`
Expected: Shows top 10 artists by post count, no file changes

- [ ] **Step 3: Run for real**

Run: `python py/fetch_artist_post_counts.py`
Expected: Enriches artists.json with post_count field for matched artists

- [ ] **Step 4: Verify artists.json format**

Run: `python -c "import json; d=json.load(open('py/artists.json')); artists=d['artists']; print('Sample:', json.dumps({k: artists[k] for k in list(artists.keys())[:3]}, indent=2))"`
Expected: Shows 3 artist entries with object format (prompt, post_count, categories)

- [ ] **Step 5: Commit**

```bash
git add py/fetch_artist_post_counts.py py/artists.json
git commit -m "feat: add Danbooru post count fetcher and enrich artists.json"
```

---

### Task 3: Create category curator script (`curate_categories.py`)

**Files:**
- Create: `py/curate_categories.py`
- Output: `py/artist_categories.json`

**Interfaces:**
- Produces: `artist_categories.json` — `{ "categories": [...], "artist_categories": { "name": ["cat1"] } }`

- [ ] **Step 1: Create the interactive category curator**

```python
#!/usr/bin/env python3
"""Interactive script to assign style categories to artists."""

import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
ARTISTS_FILE = BASE_DIR / "artists.json"
CATEGORIES_FILE = BASE_DIR / "artist_categories.json"

DEFAULT_CATEGORIES = [
    "realistic", "anime", "manga", "watercolor", "pixel_art",
    "3d", "sketch", "dark", "cute", "sexy", "fantasy",
    "scifi", "horror", "comedy", "slice_of_life", "painterly",
    "cel_shaded", "line_art", "detailed", "minimalist"
]


def load_data():
    """Load artists and existing categories."""
    artists_data = json.loads(ARTISTS_FILE.read_text(encoding="utf-8"))
    raw = artists_data.get("artists", {})

    if CATEGORIES_FILE.exists():
        cat_data = json.loads(CATEGORIES_FILE.read_text(encoding="utf-8"))
    else:
        cat_data = {"categories": DEFAULT_CATEGORIES, "artist_categories": {}}

    # Get artists sorted by post count (most popular first)
    artists_with_counts = []
    for name, value in raw.items():
        if isinstance(value, dict):
            count = value.get("post_count", 0)
        else:
            count = 0
        artists_with_counts.append((name, count))

    artists_with_counts.sort(key=lambda x: -x[1])

    return artists_with_counts, cat_data


def save_categories(cat_data):
    """Save categories to disk."""
    CATEGORIES_FILE.write_text(
        json.dumps(cat_data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )


def main():
    artists, cat_data = load_data()
    existing = cat_data.get("artist_categories", {})
    categories = cat_data.get("categories", DEFAULT_CATEGORIES)

    # Filter to uncategorized artists
    uncategorized = [(name, count) for name, count in artists if name not in existing]

    print(f"Total artists: {len(artists)}")
    print(f"Already categorized: {len(existing)}")
    print(f"Uncategorized: {len(uncategorized)}")
    print(f"\nCategories: {', '.join(categories)}")
    print("\nCommands: Enter comma-separated category names, 'skip' to skip, 'quit' to save and exit\n")

    for i, (name, count) in enumerate(uncategorized[:50]):  # Show top 50
        print(f"[{i+1}/50] {name} ({count} posts)")
        response = input("  Categories: ").strip()

        if response.lower() == "quit":
            break
        if response.lower() == "skip" or not response:
            continue

        cats = [c.strip().lower() for c in response.split(",") if c.strip()]
        valid_cats = [c for c in cats if c in categories]
        if valid_cats:
            existing[name] = valid_cats
            print(f"  -> {valid_cats}")

    cat_data["artist_categories"] = existing
    save_categories(cat_data)
    print(f"\nSaved {len(existing)} categorized artists to {CATEGORIES_FILE}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test the script (abort after a few entries)**

Run: `cd F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes && python py/curate_categories.py`
Expected: Shows top 50 uncategorized artists by post count, prompts for categories. Enter `quit` after a few entries.

- [ ] **Step 3: Pre-populate with seed categories**

For initial deployment, manually create `artist_categories.json` with ~200 popular artists:

```python
import json
from pathlib import Path

# Seed categories for the most well-known artists
SEED = {
    "wlop": ["realistic", "fantasy"],
    "rossdraws": ["realistic", "fantasy"],
    "makimio": ["anime", "cute"],
    "ikeno": ["anime", "sexy"],
    "hews": ["realistic", "detailed"],
    "as109": ["manga", "line_art"],
    "krenz": ["anime", "detailed"],
    "lack": ["anime", "cute"],
    "wada": ["anime", "detailed"],
    "redjuice": ["anime", "detailed"],
    # Add more as needed
}

output = {
    "categories": [
        "realistic", "anime", "manga", "watercolor", "pixel_art",
        "3d", "sketch", "dark", "cute", "sexy", "fantasy",
        "scifi", "horror", "comedy", "slice_of_life", "painterly",
        "cel_shaded", "line_art", "detailed", "minimalist"
    ],
    "artist_categories": SEED
}

Path("py/artist_categories.json").write_text(
    json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(f"Created seed categories for {len(SEED)} artists")
```

- [ ] **Step 4: Commit**

```bash
git add py/curate_categories.py py/artist_categories.json
git commit -m "feat: add interactive category curator and seed data"
```

---

## Phase 2: Backend Enrichment

### Task 4: Update `artist_selector.py` with enriched data support

**Files:**
- Modify: `py/artist_selector.py`
- Reads: `py/artist_previews.json`, `py/artist_categories.json`

**Interfaces:**
- Consumes: enriched `artists.json` (object format), `artist_previews.json`, `artist_categories.json`
- Produces: updated `/wai_artist/data` response, new `/wai_artist/previews`, `/wai_artist/categories` endpoints

- [ ] **Step 1: Add helper functions and load enriched data**

At the top of `py/artist_selector.py`, after the existing imports and constants, add:

```python
# ── Enriched data files ──────────────────────────────────────────────────────
PREVIEWS_FILE = BASE_DIR / "artist_previews.json"
CATEGORIES_FILE = BASE_DIR / "artist_categories.json"

# Module-level caches for enriched data
_previews_cache = None
_categories_cache = None


def _get_artist_prompt(entry):
    """Return prompt text from artist entry (handles string or object format)."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return entry.get("prompt", "")
    return ""


def _get_artist_post_count(entry):
    """Return post count from artist entry."""
    if isinstance(entry, dict):
        return entry.get("post_count", 0)
    return 0


def _get_artist_categories(entry):
    """Return categories list from artist entry."""
    if isinstance(entry, dict):
        return entry.get("categories", [])
    return []


def _get_previews(force_refresh=False):
    """Load and cache artist preview images."""
    global _previews_cache
    if force_refresh or _previews_cache is None:
        _previews_cache = load_json(PREVIEWS_FILE, {})
    return _previews_cache or {}


def _get_artist_categories_file(force_refresh=False):
    """Load and cache artist categories file."""
    global _categories_cache
    if force_refresh or _categories_cache is None:
        data = load_json(CATEGORIES_FILE, {"categories": [], "artist_categories": {}})
        _categories_cache = data
    return _categories_cache or {"categories": [], "artist_categories": {}}
```

- [ ] **Step 2: Update `_sort_names` to support "Popular" sort**

Find the `_sort_names` function and add the "Popular" case:

```python
def _sort_names(names, sort_mode, favorites, history, post_counts=None):
    if sort_mode == "A-Z":
        return sorted(names, key=str.casefold)
    if sort_mode == "Z-A":
        return sorted(names, key=str.casefold, reverse=True)
    if sort_mode == "Favorites":
        fav_set = set(favorites)
        return sorted(names, key=lambda n: (n not in fav_set, n.casefold()))
    if sort_mode == "Recent":
        def key(n):
            try:
                return (history.index(n), "")
            except ValueError:
                return (len(history), n.casefold())
        return sorted(names, key=key)
    if sort_mode == "Popular":
        counts = post_counts or {}
        return sorted(names, key=lambda n: -counts.get(n, 0))
    return names
```

- [ ] **Step 3: Update `_format_output` to use helper function**

```python
def _format_output(names, output_mode, library):
    if output_mode == "Names":
        joined = ", ".join(names)
        return joined, joined
    if output_mode == "Both":
        combined = [f"{n}, {_get_artist_prompt(library.get(n, n))}" for n in names]
        return ", ".join(combined), ", ".join(names)
    # Prompt
    return ", ".join(_get_artist_prompt(library.get(n, n)) for n in names), ", ".join(names)
```

- [ ] **Step 4: Update `_get_database` to return enriched data**

Modify the `_get_database` function to also load previews, categories, and extract post counts:

```python
def _get_database(force_refresh: bool = False):
    """Load and cache the artist database. Returns (library, favorites, history, previews, categories, post_counts)."""
    global _db_cache
    if force_refresh or _db_cache is None:
        raw_artists = load_json(ARTISTS_FILE, {})
        library = raw_artists.get("artists", {}) if isinstance(raw_artists, dict) else {}

        favorites = load_json(FAVORITES_FILE, [])
        if not isinstance(favorites, list):
            favorites = []

        history = load_json(HISTORY_FILE, [])
        if not isinstance(history, list):
            history = []

        previews = _get_previews(force_refresh=force_refresh)
        cat_data = _get_artist_categories_file(force_refresh=force_refresh)
        categories_list = cat_data.get("categories", [])
        artist_categories = cat_data.get("artist_categories", {})

        # Extract post counts from enriched library
        post_counts = {}
        for name, entry in library.items():
            post_counts[name] = _get_artist_post_count(entry)

        # Merge categories into library entries
        for name, cats in artist_categories.items():
            if name in library:
                entry = library[name]
                if isinstance(entry, str):
                    library[name] = {"prompt": entry, "post_count": post_counts.get(name, 0), "categories": cats}
                elif isinstance(entry, dict):
                    entry["categories"] = cats

        _db_cache = (library, favorites, history, previews, categories_list, post_counts)
    return _db_cache
```

- [ ] **Step 5: Update `select` method to use enriched data**

Find the `select` method and update it to pass post_counts to `_sort_names`:

```python
def select(self, selection, max_artists, randomize, favorites_only,
           output_mode, sort_mode, force_refresh, ArtistState="{}"):
    (
        selection,
        max_artists,
        randomize,
        favorites_only,
        output_mode,
        sort_mode,
        force_refresh,
    ) = _state_overrides(
        ArtistState,
        selection,
        max_artists,
        randomize,
        favorites_only,
        output_mode,
        sort_mode,
        force_refresh,
    )

    try:
        library, favorites, history, previews, categories_list, post_counts = _get_database(force_refresh=force_refresh)
    except Exception:
        return ("", "", 0)

    selected = []

    if randomize:
        pool = [n for n in (favorites if favorites_only else list(library.keys()))]
        if pool:
            count = min(max_artists, len(pool))
            selected = random.sample(pool, count)
    else:
        if selection and selection.strip():
            raw = [n.strip() for n in selection.split(",")]
            selected = [n for n in raw if n and n in library][:max_artists]

    if not selected:
        return ("", "", 0)

    # Update on-disk history (most-recent first, deduped, capped).
    for name in reversed(selected):
        while name in history:
            history.remove(name)
        history.insert(0, name)
    del history[HISTORY_LIMIT:]
    if save_json(HISTORY_FILE, history):
        global _db_cache
        if _db_cache is not None:
            lib, fav, hist, prev, cats, counts = _db_cache
            _db_cache = (lib, fav, history, prev, cats, counts)

    sorted_names = _sort_names(selected, sort_mode, favorites, history, post_counts)
    prompt, names = _format_output(sorted_names, output_mode, library)
    return (prompt, names, len(sorted_names))
```

- [ ] **Step 6: Update `get_artists_data` route to include enriched data**

```python
@routes.get("/wai_artist/data")
async def get_artists_data(request):
    try:
        library, favorites, history, previews, categories_list, post_counts = _get_database(force_refresh=False)
        return web.json_response({
            "library": library,
            "favorites": favorites,
            "history": history,
            "previews": previews,
            "categories": categories_list,
            "post_counts": post_counts,
        })
    except Exception:
        return web.json_response({"error": "Internal server error"}, status=500)
```

- [ ] **Step 7: Update `_set_favorites` to match new cache signature**

```python
def _set_favorites(favorites: list):
    """Update cache + persist. Used by the /wai_artist/toggle_favorite route."""
    global _db_cache
    library, _, history, previews, cats, counts = _get_database(force_refresh=False)
    _db_cache = (library, list(favorites), history, previews, cats, counts)
    save_json(FAVORITES_FILE, favorites)
```

- [ ] **Step 8: Test backend changes**

Start ComfyUI and verify:
1. `GET /wai_artist/data` returns enriched response with `previews`, `categories`, `post_counts`
2. Node still outputs correct prompt text
3. Existing workflow loads unchanged

- [ ] **Step 9: Commit**

```bash
git add py/artist_selector.py
git commit -m "feat: enrich artist_selector.py with previews, categories, post counts"
```

---

## Phase 3: Frontend Enrichment

### Task 5: Update JS with thumbnails, categories, and post count badges

**Files:**
- Modify: `js/artist_selector/index.js`

**Interfaces:**
- Consumes: enriched `/wai_artist/data` response (previews, categories, post_counts)

- [ ] **Step 1: Update constants and state**

Find and update the SORT_MODES constant:

```javascript
const SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent", "Popular"];
```

Update `defaultStateFromWidgets` to include `selectedCategories`:

```javascript
function defaultStateFromWidgets(node) {
  const selection = String(widgetValue(node, "selection", "") || "");
  const selectedNames = selection
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const outputMode = widgetValue(node, "output_mode", "Prompt");
  const sortMode = widgetValue(node, "sort_mode", "A-Z");
  return {
    selectedNames,
    maxArtists: clampMaxArtists(
      widgetValue(node, "max_artists", MAX_ARTISTS_DEFAULT),
    ),
    randomize: !!widgetValue(node, "randomize", false),
    favoritesOnly: !!widgetValue(node, "favorites_only", false),
    outputMode: OUTPUT_MODES.includes(outputMode) ? outputMode : "Prompt",
    sortMode: SORT_MODES.includes(sortMode) ? sortMode : "A-Z",
    forceRefresh: !!widgetValue(node, "force_refresh", false),
    selectedCategories: [],
  };
}
```

Update `readState` to handle `selectedCategories`:

```javascript
// In readState(), after the existing merge logic, add:
merged.selectedCategories = Array.isArray(obj.selectedCategories)
  ? obj.selectedCategories.filter((c) => typeof c === "string")
  : [];
```

Update `writeState` to include `selectedCategories`:

```javascript
function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify({
    selectedNames: state.selectedNames || [],
    maxArtists: clampMaxArtists(state.maxArtists),
    randomize: !!state.randomize,
    favoritesOnly: !!state.favoritesOnly,
    outputMode: OUTPUT_MODES.includes(state.outputMode)
      ? state.outputMode
      : "Prompt",
    sortMode: SORT_MODES.includes(state.sortMode) ? state.sortMode : "A-Z",
    forceRefresh: !!state.forceRefresh,
    selectedCategories: state.selectedCategories || [],
  });
}
```

- [ ] **Step 2: Add new CSS styles**

In the `injectCSS()` function, add these styles inside the existing CSS string:

```css
/* Category chips */
.boss-art-categories {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0;
  flex-wrap: nowrap;
}
.boss-art-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  background: var(--boss-bg-section);
  color: var(--boss-text-muted);
  border: 1px solid var(--boss-border-input);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.boss-art-chip:hover:not(.active) {
  color: var(--boss-text-bright);
  border-color: var(--boss-border-strong);
}
.boss-art-chip.active {
  background: var(--boss-brand);
  color: #fff;
  border-color: var(--boss-brand);
}

/* Thumbnail */
.boss-art-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--boss-bg-section);
  flex-shrink: 0;
}
.boss-art-thumb-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: var(--boss-bg-section);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--boss-text-faint);
  font-size: 10px;
}

/* Artist item layout with thumbnail */
.boss-art-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--boss-bg-hover);
  border: 1px solid var(--boss-border-input);
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 6px;
  cursor: pointer;
}
.boss-art-item-info {
  flex: 1;
  min-width: 0;
}
.boss-art-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--boss-text-dim);
}
.boss-art-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.boss-art-cats {
  font-size: 10px;
  color: var(--boss-text-faint);
}
.boss-art-posts {
  font-size: 11px;
  color: var(--boss-text-dim);
  white-space: nowrap;
}
```

- [ ] **Step 3: Add `buildCategorySection` method to `ArtistEditor` class**

Add this new method inside the `ArtistEditor` class, after `buildForceRefreshSection()`:

```javascript
buildCategorySection() {
  const wrap = document.createElement("div");
  const label = document.createElement("span");
  label.className = "boss-label";
  label.textContent = "Categories";

  const chips = document.createElement("div");
  chips.className = "boss-art-categories";

  const categories = this.data.categories || [];

  // "All" chip
  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "boss-art-chip" + (this.state.selectedCategories.length === 0 ? " active" : "");
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    this.state.selectedCategories = [];
    this.updateCategoryChips(chips);
    this.refreshList();
  });
  chips.appendChild(allChip);

  // Category chips
  for (const cat of categories) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "boss-art-chip";
    chip.dataset.category = cat;
    chip.textContent = cat.replace(/_/g, " ");
    chip.addEventListener("click", () => {
      const idx = this.state.selectedCategories.indexOf(cat);
      if (idx === -1) {
        this.state.selectedCategories.push(cat);
      } else {
        this.state.selectedCategories.splice(idx, 1);
      }
      this.updateCategoryChips(chips);
      this.refreshList();
    });
    chips.appendChild(chip);
  }

  wrap.appendChild(label);
  wrap.appendChild(chips);
  return wrap;
}

updateCategoryChips(chipsContainer) {
  const allBtn = chipsContainer.querySelector(".boss-art-chip:first-child");
  const catBtns = chipsContainer.querySelectorAll(".boss-art-chip:not(:first-child)");

  if (this.state.selectedCategories.length === 0) {
    allBtn.classList.add("active");
  } else {
    allBtn.classList.remove("active");
  }

  catBtns.forEach((btn) => {
    const cat = btn.dataset.category;
    btn.classList.toggle("active", this.state.selectedCategories.includes(cat));
  });
}
```

- [ ] **Step 4: Update `buildModal` to include category section**

In the `buildModal()` method, after the line that appends `buildForceRefreshSection()`:

```javascript
// Add this line after side.appendChild(this.buildForceRefreshSection());
side.appendChild(this.buildCategorySection());
```

- [ ] **Step 5: Update `filteredList` to filter by categories**

In the `filteredList()` method, add category filtering after the search filter:

```javascript
// After the existing search filter, add:
const selectedCats = this.state.selectedCategories || [];
if (selectedCats.length > 0) {
  const artistCats = this.data.artist_categories || {};
  list = list.filter((n) => {
    const cats = artistCats[n] || [];
    return selectedCats.some((c) => cats.includes(c));
  });
}
```

- [ ] **Step 6: Update `refreshList` to render thumbnails, categories, and post counts**

Replace the item rendering loop in `refreshList()` with:

```javascript
for (const name of list) {
  const item = document.createElement("div");
  item.className =
    "boss-art-item" + (selected.has(name) ? " selected" : "");

  // Thumbnail
  const previews = this.data.previews || {};
  if (previews[name]) {
    const thumb = document.createElement("img");
    thumb.className = "boss-art-thumb";
    thumb.src = previews[name];
    thumb.alt = name;
    thumb.loading = "lazy";
    thumb.onerror = () => {
      thumb.replaceWith(this.createThumbPlaceholder());
    };
    item.appendChild(thumb);
  } else {
    item.appendChild(this.createThumbPlaceholder());
  }

  // Info container
  const info = document.createElement("div");
  info.className = "boss-art-item-info";

  // Name
  const nameEl = document.createElement("div");
  nameEl.className = "boss-art-item-name";
  nameEl.textContent = name;
  nameEl.title = name;
  info.appendChild(nameEl);

  // Meta row (categories + post count)
  const meta = document.createElement("div");
  meta.className = "boss-art-item-meta";

  const artistCats = this.data.artist_categories || {};
  const cats = artistCats[name] || [];
  if (cats.length > 0) {
    const catsEl = document.createElement("span");
    catsEl.className = "boss-art-cats";
    catsEl.textContent = cats.slice(0, 3).join(", ");
    meta.appendChild(catsEl);
  }

  const postCounts = this.data.post_counts || {};
  if (postCounts[name]) {
    const postsEl = document.createElement("span");
    postsEl.className = "boss-art-posts";
    postsEl.textContent = `${postCounts[name]} posts`;
    meta.appendChild(postsEl);
  }

  info.appendChild(meta);
  item.appendChild(info);

  // Favorite button
  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className =
    "boss-art-fav" + (favorites.has(name) ? " active" : "");
  favBtn.textContent = "*";
  favBtn.title = favorites.has(name)
    ? "Remove from favorites"
    : "Add to favorites";
  favBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await this.toggleFavorite(name);
      this.refreshList();
    } catch (err) {
      console.error("[BossArtistSelector] favorite toggle failed", err);
    }
  });
  item.appendChild(favBtn);

  item.addEventListener("click", () => {
    const next = new Set(this.state.selectedNames || []);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.state.selectedNames = Array.from(next);
    this.refreshList();
  });
  this.listEl.appendChild(item);
}
```

- [ ] **Step 7: Add `createThumbPlaceholder` method**

```javascript
createThumbPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "boss-art-thumb-placeholder";
  placeholder.textContent = "?";
  return placeholder;
}
```

- [ ] **Step 8: Test frontend changes**

1. Start ComfyUI and open Artist Selector Editor
2. Verify thumbnails load for artists with preview images
3. Verify category chips appear and filter correctly
4. Verify post count badges display
5. Verify "Popular" sort works
6. Verify workflow save/load preserves selectedCategories

- [ ] **Step 9: Commit**

```bash
git add js/artist_selector/index.js
git commit -m "feat: add thumbnails, category chips, and post count badges to artist editor"
```

---

## Phase 4: Integration Testing

### Task 6: End-to-end testing and backward compatibility

**Files:**
- Test: manual testing of all features

- [ ] **Step 1: Test backward compatibility with old artists.json**

Temporarily revert `artists.json` to the old string format:
```json
{
  "artists": {
    "wlop": "by wlop",
    "makimio": "by makimio"
  }
}
```

Verify:
1. Node still loads and outputs correct prompts
2. Editor opens and shows artists (without thumbnails/categories)
3. Favorites and history still work

- [ ] **Step 2: Test with enriched artists.json**

Restore the enriched `artists.json` and verify:
1. Post counts display for all artists
2. Categories filter works
3. "Popular" sort orders correctly
4. Preview images load (for artists in nax.moe data)

- [ ] **Step 3: Test all sort modes**

Verify in the editor:
- A-Z: alphabetical order
- Z-A: reverse alphabetical
- Favorites: favorited artists first
- Recent: most recently used first
- Popular: highest post count first

- [ ] **Step 4: Test random mode with filters**

1. Enable Random mode
2. Filter by a category
3. Verify random selection only picks from filtered pool
4. Verify favorites-only checkbox still works

- [ ] **Step 5: Test workflow save/load**

1. Save a workflow with Artist Selector state
2. Reload the page
3. Verify all state is preserved (selected artists, categories, sort mode, etc.)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete artist selector enrichment with previews, categories, and popularity"
```

---

## Summary

| Task | Files Created | Files Modified |
|------|--------------|----------------|
| 1 | `py/fetch_artist_previews.py`, `py/artist_previews.json` | — |
| 2 | `py/fetch_artist_post_counts.py` | `py/artists.json` |
| 3 | `py/curate_categories.py`, `py/artist_categories.json` | — |
| 4 | — | `py/artist_selector.py` |
| 5 | — | `js/artist_selector/index.js` |
| 6 | — | Manual testing |

**Execution order:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

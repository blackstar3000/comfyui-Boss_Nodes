"""Fetch Danbooru post counts for all artists and enrich artists.json.

Usage:
    python fetch_artist_post_counts.py --dry-run   # Preview top 10, no file changes
    python fetch_artist_post_counts.py              # Enrich artists.json in-place

Reads: py/artists.json
Writes: py/artists.json (enriched with post_count field)

Note: Uses curl.exe to bypass Cloudflare protection on Danbooru.
      Danbooru's tags.json API does not support sorting by post_count,
      so we batch-search artist names directly.
"""

import argparse
import json
import subprocess
import time
import urllib.parse
from pathlib import Path

ARTISTS_FILE = Path(__file__).parent / "artists.json"
DANBOORU_TAGS_URL = "https://danbooru.donmai.us/tags.json"
REQUEST_DELAY = 1.0
BATCH_SIZE = 30


def load_artists():
    """Load artists.json and return the artists dict."""
    with ARTISTS_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("artists", {})


def save_artists(data):
    """Save the full artists.json structure."""
    with ARTISTS_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def fetch_tags_by_names(names):
    """Fetch tags for a batch of artist names using search[name_normalize]."""
    params = urllib.parse.urlencode({
        "search[name_normalize]": ",".join(names),
        "limit": 1000,
    })
    url = f"{DANBOORU_TAGS_URL}?{params}"
    result = subprocess.run(
        [
            "curl.exe", "--silent", "--fail",
            "--header", "User-Agent: BossNodes-Fetcher/1.0",
            "--max-time", "30",
            url,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return []


def enrich_artists(dry_run=False):
    """Main logic: fetch post counts and enrich artists.json."""
    artists = load_artists()
    total_artists = len(artists)
    matched = 0
    all_results = []
    artist_names = list(artists.keys())

    print(f"Loaded {total_artists} artists from {ARTISTS_FILE.name}")
    print(f"Fetching post counts from Danbooru in batches of {BATCH_SIZE}...")

    for i in range(0, len(artist_names), BATCH_SIZE):
        batch = artist_names[i : i + BATCH_SIZE]
        tags = fetch_tags_by_names(batch)

        for tag in tags:
            name = tag.get("name", "")
            post_count = tag.get("post_count", 0)
            key = name if name in artists else None
            if key is None:
                continue
            matched += 1
            all_results.append((key, post_count))

        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(artist_names) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  Batch {batch_num}/{total_batches}: matched {matched}/{total_artists}")

        time.sleep(REQUEST_DELAY)

    if dry_run:
        all_results.sort(key=lambda x: x[1], reverse=True)
        print(f"\n[DRY RUN] Would enrich {matched} artists.")
        print(f"Top 10 by post count:")
        for key, count in all_results[:10]:
            print(f"  {key}: {count} posts")
        return

    for key, count in all_results:
        old_val = artists[key]
        if isinstance(old_val, str):
            artists[key] = {
                "prompt": old_val,
                "post_count": count,
                "categories": [],
            }
        else:
            artists[key]["post_count"] = count

    data = {"artists": artists}
    save_artists(data)
    print(f"\nEnriched {matched} artists with post counts.")
    print(f"Saved to {ARTISTS_FILE}")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Danbooru post counts and enrich artists.json"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview top 10 artists by post count without writing"
    )
    args = parser.parse_args()
    enrich_artists(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Interactive category curator for artists.

Reads artists.json, sorts by post count, and interactively prompts
for category assignments. Saves results to artist_categories.json.
"""

import json
import os
import sys

DEFAULT_CATEGORIES = [
    "realistic", "anime", "manga", "watercolor", "pixel_art", "3d",
    "sketch", "dark", "cute", "sexy", "fantasy", "scifi", "horror",
    "comedy", "slice_of_life", "painterly", "cel_shaded", "line_art",
    "detailed", "minimalist"
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARTISTS_PATH = os.path.join(SCRIPT_DIR, "artists.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "artist_categories.json")


def load_artists():
    with open(ARTISTS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    artists = data.get("artists", {})
    result = []
    for name, value in artists.items():
        if isinstance(value, dict):
            post_count = value.get("post_count", 0)
            cats = value.get("categories", [])
        else:
            post_count = 0
            cats = []
        result.append({"name": name, "post_count": post_count, "categories": cats})
    result.sort(key=lambda x: x["post_count"], reverse=True)
    return result


def load_existing_categories():
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"categories": list(DEFAULT_CATEGORIES), "artist_categories": {}}


def save(data):
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {OUTPUT_PATH}")


def main():
    artists = load_artists()
    existing = load_existing_categories()
    artist_cats = existing.get("artist_categories", {})
    categories = existing.get("categories", list(DEFAULT_CATEGORIES))

    uncategorized = [
        a for a in artists
        if a["name"] not in artist_cats and a["post_count"] > 0
    ]

    if not uncategorized:
        print("All artists with post counts already have categories assigned.")
        return

    print(f"Found {len(uncategorized)} uncategorized artists (sorted by post count).")
    print(f"Available categories: {', '.join(categories)}")
    print("Commands: enter comma-separated categories, 'skip' to skip, 'quit' to save and exit.\n")

    batch_size = 10
    index = 0

    while index < len(uncategorized):
        batch = uncategorized[index:index + batch_size]
        for i, artist in enumerate(batch, start=index + 1):
            print(f"[{i}/{len(uncategorized)}] {artist['name']} ({artist['post_count']} posts)")

        raw = input("\nAssign categories to the LAST listed artist (or 'skip'/'quit'): ")
        choice = raw.strip().lstrip("\ufeff")

        if choice.lower() == "quit":
            break
        if choice.lower() == "skip":
            index += 1
            print()
            continue

        artist_name = batch[-1]["name"]
        assigned = [c.strip() for c in choice.split(",") if c.strip()]
        if assigned:
            artist_cats[artist_name] = assigned
            print(f"  Assigned: {artist_name} -> {assigned}\n")
        else:
            print("  No valid categories entered, skipping.\n")

        index += 1

    existing["categories"] = categories
    existing["artist_categories"] = artist_cats
    save(existing)
    print(f"\nDone. {len(artist_cats)} artists have categories assigned.")


if __name__ == "__main__":
    main()

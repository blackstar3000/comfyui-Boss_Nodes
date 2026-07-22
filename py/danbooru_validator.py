"""Danbooru Tag Validator Boss — validate prompts against the Danbooru tag database.

Features:
- Validates each tag against ~500k Danbooru tags
- Suggests corrections for misspelled tags
- Reports valid/invalid/rare tags with statistics
- Category filtering (general/artist/character/copyright/meta)
- Optional auto-clean mode (removes invalid tags from prompt)

Inputs:
    prompt:        The text prompt to validate
    strict_mode:   If true, returns cleaned prompt with invalid tags removed
    category:      Filter which tag categories to check

Outputs:
    cleaned_prompt:  Prompt with invalid tags removed (or original if not strict)
    valid_tags:      Comma-separated list of valid tags found
    invalid_tags:    Comma-separated list of invalid tags found
    suggestions:     JSON string of {invalid_tag: [suggestions]} mappings
    stats:           Summary string like "42 valid, 3 invalid, 2 suggestions"
"""

import json
import os
import re
from difflib import get_close_matches
from pathlib import Path

# ── Tag database ────────────────────────────────────────────────────────────
TAGS_FILE = Path(__file__).parent / "danbooru_tags.json"

# Category ID → name (Danbooru standard)
CATEGORY_MAP = {0: "general", 1: "artist", 3: "copyright", 4: "character", 5: "meta"}
CATEGORY_NAMES = set(CATEGORY_MAP.values())

# Module-level cache
_db_cache = None
_trigram_index = None  # {trigram: [tag_name, ...]} for fast substring suggest
_allowed_cache = {}    # {category_filter: set_of_allowed_tags}


def _load_db():
    """Load the Danbooru tag database from disk."""
    global _db_cache, _trigram_index, _allowed_cache
    if _db_cache is not None:
        return _db_cache
    if not TAGS_FILE.exists():
        print(f"[DanbooruValidator] Tag database not found: {TAGS_FILE}")
        return {}
    try:
        with TAGS_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        tags = raw.get("tags", {})
        if not tags:
            print(f"[DanbooruValidator] WARNING: tags dict is empty in {TAGS_FILE}")
            return {}
        _db_cache = tags
        # Build trigram index for fast substring matching in suggest_tag
        _trigram_index = {}
        for name in _db_cache:
            low = name.lower()
            for i in range(len(low) - 2):
                tri = low[i:i + 3]
                if tri not in _trigram_index:
                    _trigram_index[tri] = []
                _trigram_index[tri].append(name)
        _allowed_cache = {}
        print(f"[DanbooruValidator] Loaded {len(tags)} tags from {TAGS_FILE.name}")
        return _db_cache
    except Exception as e:
        print(f"[DanbooruValidator] Error loading {TAGS_FILE}: {e}")
        return {}


# ── Tag parser ──────────────────────────────────────────────────────────────

# Patterns to strip from prompts before extracting tags
_BREAK_RE = re.compile(r"\bBREAK\b")
_WEIGHT_RE = re.compile(r"\(([^():]+:[\d.]+)\)")
_NEST_RE = re.compile(r"\(\(([^()]+)\)\)")
_WILDCARD_RE = re.compile(r"\{([^{}]*)\}")


def parse_tags(text):
    """Extract raw Danbooru tags from a prompt string.

    Handles: weights (tag:1.3), wildcards {a|b|c}, BREAK, nesting ((tag)).
    Skips: labels like "Actors:", "Action:", "Skin:", etc.
    Returns a deduplicated list of tag strings.
    """
    if not text:
        return []

    # Remove BREAK keywords
    text = _BREAK_RE.sub(" ", text)

    # Extract wildcard options before stripping them
    wildcard_tags = []
    for match in _WILDCARD_RE.finditer(text):
        options = match.group(1).split("|")
        for opt in options:
            opt = opt.strip()
            if opt:
                wildcard_tags.append(opt)

    # Strip wildcards
    text = _WILDCARD_RE.sub(" ", text)

    # Strip weights: (tag:1.3) → tag
    text = _WEIGHT_RE.sub(r"\1", text)

    # Strip double parens: ((tag)) → tag
    text = _NEST_RE.sub(r"\1", text)

    # Strip remaining single parens
    text = text.replace("(", " ").replace(")", " ")

    # Split on commas and whitespace
    raw = re.split(r"[,\s]+", text.strip())

    # Filter out labels (words ending with ":" like "Actors:", "Action:", etc.)
    # Also filter empty strings and very short tokens
    filtered = []
    for t in raw:
        if not t:
            continue
        # Skip labels (single word ending with colon)
        if re.match(r'^[A-Za-z_]+:$', t):
            continue
        # Skip values that are just "none" or empty
        if t.lower() in ("none", ""):
            continue
        filtered.append(t)

    # Combine with wildcard tags, filter empties, deduplicate
    all_tags = filtered + wildcard_tags
    seen = set()
    unique = []
    for t in all_tags:
        t_lower = t.lower()
        if t_lower not in seen:
            seen.add(t_lower)
            unique.append(t)
    return unique


def suggest_tag(tag, db_tags, n=3):
    """Find similar tags for a misspelled/invalid tag."""
    tag_lower = tag.lower()

    # 1. Trigram substring index (fast — pre-built on DB load)
    if _trigram_index and len(tag_lower) >= 3:
        candidates = set()
        for i in range(len(tag_lower) - 2):
            tri = tag_lower[i:i + 3]
            matches = _trigram_index.get(tri)
            if matches:
                for m in matches:
                    candidates.add(m)
        substring_matches = [
            t for t in candidates
            if tag_lower in t.lower() or t in tag_lower
        ]
        if substring_matches:
            substring_matches.sort(key=lambda t: abs(len(t) - len(tag_lower)))
            return substring_matches[:n]
    elif _trigram_index and len(tag_lower) < 3:
        substring_matches = [
            t for t in db_tags
            if tag_lower in t or t in tag_lower
        ]
        if substring_matches:
            substring_matches.sort(key=lambda t: abs(len(t) - len(tag_lower)))
            return substring_matches[:n]

    # 2. Fuzzy match (slower, only if trigram found nothing)
    return get_close_matches(tag_lower, db_tags, n=n, cutoff=0.6)


# ── Validator ───────────────────────────────────────────────────────────────

def validate_prompt(text, category_filter="all"):
    """Validate a prompt string against the Danbooru tag database.

    Returns:
        valid_tags:    list of valid tag names
        invalid_tags:  list of invalid tag names
        suggestions:   dict of {invalid_tag: [suggestion, ...]}
        stats:         dict with counts
    """
    db = _load_db()
    if not db:
        return [], [], {}, {"valid": 0, "invalid": 0, "rare": 0, "total": 0, "db_loaded": False}

    tags = parse_tags(text)
    db_tag_names = set(db.keys())

    # Filter by category if needed
    if category_filter and category_filter != "all":
        if category_filter not in _allowed_cache:
            _allowed_cache[category_filter] = {
                name for name, info in db.items()
                if CATEGORY_MAP.get(info.get("category", -1)) == category_filter
            } | {"1girl", "1boy", "solo", "no_humans", "multiple_girls"}
        allowed = _allowed_cache[category_filter]
    else:
        allowed = db_tag_names

    valid_tags = []
    invalid_tags = []
    suggestions = {}
    rare_count = 0
    filtered_count = 0

    for tag in tags:
        tag_lower = tag.lower()
        if tag_lower in db:
            info = db[tag_lower]
            cat = CATEGORY_MAP.get(info.get("category", -1), "unknown")
            # If filtering, check category
            if category_filter != "all" and cat != category_filter:
                filtered_count += 1
                continue
            post_count = info.get("post_count", 0)
            if post_count < 10:
                rare_count += 1
            valid_tags.append(tag)
        else:
            invalid_tags.append(tag)
            # Find suggestions
            sims = suggest_tag(tag, db_tag_names)
            if sims:
                suggestions[tag] = sims

    stats = {
        "valid": len(valid_tags),
        "invalid": len(invalid_tags),
        "rare": rare_count,
        "filtered": filtered_count,
        "total": len(tags),
        "db_loaded": bool(db),
        "db_size": len(db),
    }

    return valid_tags, invalid_tags, suggestions, stats


def clean_prompt(text, invalid_tags):
    """Remove invalid tags from a prompt string, preserving formatting."""
    if not invalid_tags:
        return text
    result = text
    for tag in invalid_tags:
        pattern = re.compile(r"\b" + re.escape(tag) + r"\b", re.IGNORECASE)
        result = pattern.sub("", result)
    result = re.sub(r",\s*,", ",", result)
    result = re.sub(r"^\s*,\s*", "", result)
    result = re.sub(r"\s*,\s*$", "", result)
    result = re.sub(r"\s{2,}", " ", result).strip()
    return result


# ── Node class ──────────────────────────────────────────────────────────────

class DanbooruTagValidator:
    DESCRIPTION = (
        "Validate prompts against the Danbooru tag database (~500k tags).\n\n"
        "Checks each tag for validity, suggests corrections for misspellings, "
        "and reports rare tags. Optional strict mode auto-removes invalid tags.\n\n"
        "Run 'python fetch_danbooru_tags.py' in the py/ directory first to "
        "build the tag database."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": "1girl, solo, dark_skin, masterpiece, best_quality",
                    "tooltip": "The prompt text to validate against Danbooru tags.",
                }),
            },
            "optional": {
                "strict_mode": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Clean",
                    "label_off": "Report",
                    "tooltip": "If enabled, removes invalid tags from the output prompt.",
                }),
                "category": (["all", "general", "artist", "character", "copyright", "meta"], {
                    "default": "all",
                    "tooltip": "Filter validation to specific tag category.",
                }),
            },
            "hidden": {
                "ValidatorState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("cleaned_prompt", "valid_tags", "invalid_tags", "suggestions", "stats")
    OUTPUT_TOOLTIPS = (
        "The prompt with invalid tags removed (or original if not strict).",
        "Comma-separated valid tags.",
        "Comma-separated invalid tags.",
        "JSON {wrong: [suggestions]} for invalid tags.",
        "Summary: X valid, Y invalid, Z rare.",
    )
    FUNCTION = "validate"
    CATEGORY = "👑 Boss Nodes/⚡ Prompting"

    def validate(self, prompt, strict_mode=False, category="all", ValidatorState="{}"):
        # Override from state if present
        try:
            state = json.loads(ValidatorState) if ValidatorState else {}
            if isinstance(state, dict) and state:
                strict_mode = state.get("strict_mode", strict_mode)
                category = state.get("category", category)
        except Exception:
            pass

        if not prompt or not prompt.strip():
            return ("", "", "", "", json.dumps({
                "valid": 0, "invalid": 0, "rare": 0, "total": 0, "db_loaded": bool(_load_db())
            }))

        valid_tags, invalid_tags, suggestions, stats = validate_prompt(prompt, category)

        if strict_mode:
            cleaned = clean_prompt(prompt, invalid_tags)
        else:
            cleaned = prompt

        valid_str = ", ".join(valid_tags) if valid_tags else "(none)"
        invalid_str = ", ".join(invalid_tags) if invalid_tags else "(none)"
        suggestions_str = json.dumps(suggestions, indent=2) if suggestions else "{}"

        stats_str = (
            f"{stats['valid']} valid, {stats['invalid']} invalid, "
            f"{stats['rare']} rare"
            + (f", {stats['filtered']} filtered" if stats.get('filtered') else "")
            + f" | DB: {stats.get('db_size', 0)} tags"
        )

        return (cleaned, valid_str, invalid_str, suggestions_str, stats_str)


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/danbooru_boss/data")
    async def get_danbooru_data(request):
        """Return tag database stats and a sample of tags."""
        db = _load_db()
        return web.json_response({
            "loaded": bool(db),
            "total_tags": len(db),
            "categories": CATEGORY_MAP,
        })

    @routes.post("/danbooru_boss/refresh")
    async def refresh_danbooru_data(request):
        """Reload the tag database from disk."""
        global _db_cache
        _db_cache = None
        db = _load_db()
        return web.json_response({
            "loaded": bool(db),
            "total_tags": len(db),
        })

    @routes.post("/danbooru_boss/validate")
    async def validate_text(request):
        """Validate a text prompt via HTTP API."""
        try:
            body = await request.json()
            text = body.get("prompt", "")
            category = body.get("category", "all")
            valid, invalid, suggestions, stats = validate_prompt(text, category)
            return web.json_response({
                "valid": valid,
                "invalid": invalid,
                "suggestions": suggestions,
                "stats": stats,
            })
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


register_api_routes()


# ── ComfyUI registration ────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "DanbooruTagValidator": DanbooruTagValidator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DanbooruTagValidator": "Danbooru Tag Validator",
}

__all__ = [
    "DanbooruTagValidator",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

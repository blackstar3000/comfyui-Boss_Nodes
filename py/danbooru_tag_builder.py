# Danbooru Tag Builder Pro — BOSS EDITION v2.0
# Full UI, multi‑select, randomization, favorites, wildcard support, and caching.

import json
import random
from pathlib import Path
from datetime import datetime

from utils.json_utils import load_json, save_json

BASE_DIR = Path(__file__).parent
TAG_FOLDER = BASE_DIR / "danbooru_tags"
FAVORITES_FILE = BASE_DIR / "tag_favorites.json"

# ── Caching ──────────────────────────────────────────────────────────────
_TAG_CACHE = {}
_DATABASE = None

def _load_tag_file(path):
    """Load a tag file with caching."""
    path = str(path)
    if path in _TAG_CACHE:
        return _TAG_CACHE[path]
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if "," in content:
            tags = [t.strip() for t in content.split(",") if t.strip()]
        else:
            tags = [t.strip() for t in content.splitlines() if t.strip()]
        _TAG_CACHE[path] = tags
        return tags
    except Exception as e:
        print(f"[DanbooruTagBuilder] Failed to load tag file '{path}': {e}")
        return []

def _build_database():
    """Scan the TAG_FOLDER and build a full database dict."""
    db = {}
    if not TAG_FOLDER.exists():
        return db
    for cat_dir in TAG_FOLDER.iterdir():
        if not cat_dir.is_dir():
            continue
        cat = cat_dir.name
        db[cat] = {"main": {}, "sub": {}}
        # main folder
        main_dir = cat_dir / "main"
        if main_dir.exists():
            for f in main_dir.glob("*.txt"):
                db[cat]["main"][f.stem] = _load_tag_file(f)
        # sub folders (can be "sub", "styles", "variants")
        for sub_dir_name in ["sub", "styles", "variants"]:
            sub_dir = cat_dir / sub_dir_name
            if sub_dir.exists():
                for f in sub_dir.glob("*.txt"):
                    db[cat]["sub"][f.stem] = _load_tag_file(f)
    return db

def get_database():
    global _DATABASE
    if _DATABASE is None:
        _DATABASE = _build_database()
    return _DATABASE

def invalidate_database_cache():
    """Force the next get_database() call to rescan disk (picks up new/edited tag files)."""
    global _DATABASE
    _DATABASE = None
    _TAG_CACHE.clear()

# ── Favorites I/O ────────────────────────────────────────────────────────

def _load_favorites():
    return load_json(FAVORITES_FILE, default={})

def _save_favorites(data):
    save_json(FAVORITES_FILE, data, backup=False)

# ── API routes ───────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/danbooru_tags/database")
    async def get_database_api(request):
        return web.json_response(get_database())

    @routes.get("/danbooru_tags/list")   # kept for backward compatibility
    async def list_tags(request):
        return web.json_response(get_database())

    @routes.post("/danbooru_tags/refresh")
    async def refresh_database(request):
        invalidate_database_cache()
        return web.json_response(get_database())

    @routes.get("/danbooru_tags/favorites")
    async def get_favorites(request):
        return web.json_response(_load_favorites())

    @routes.post("/danbooru_tags/favorites")
    async def save_favorite(request):
        data = await request.json()
        name = data.get("name")
        if not name or not isinstance(name, str) or len(name) > 200:
            return web.json_response({"error": "Valid name required (max 200 chars)"}, status=400)
        name = name.strip()
        if not name:
            return web.json_response({"error": "Name required"}, status=400)
        favs = _load_favorites()
        favs[name] = {
            "config": data.get("config", {}),
            "timestamp": datetime.now().isoformat(),
            "preview": data.get("preview", ""),
            "notes": data.get("notes", ""),
            "version": "2.0"
        }
        _save_favorites(favs)
        return web.json_response({"success": True})

    @routes.post("/danbooru_tags/favorites/delete")
    async def delete_favorite(request):
        data = await request.json()
        name = data.get("name")
        if not name or not isinstance(name, str):
            return web.json_response({"error": "Name required"}, status=400)
        favs = _load_favorites()
        if name in favs:
            del favs[name]
            _save_favorites(favs)
        return web.json_response({"success": True})

register_api_routes()

# ── Node class ────────────────────────────────────────────────────────────

class DanbooruTagBuilder:
    @classmethod
    def INPUT_TYPES(cls):
        db = get_database()
        required = {
            "characters": (["1girl", "2girls", "3girls", "4girls", "5girls", "6+girls", "1girl + solo", "1boy","2boys", "3boys", "4boys", "5boys", "6+boys", "1boy + solo", "solo", "solo_focus", "multiple girls and boys"], {"default": "1girl"}),
            "quality_tags": ("STRING", {"default": "masterpiece, best quality, ultra detailed, realistic, photorealistic, 8k"}),
            "use_wildcards": ("BOOLEAN", {"default": False, "label_on": "Use Wildcards", "label_off": "Plain Tags"}),
            "wildcard_format": (["__category_sub__", "__category/main/sub__", "__category_sub"], {"default": "__category_sub__"}),
            "randomize": ("BOOLEAN", {"default": False, "label_on": "Random", "label_off": "Manual"}),
            "random_min": ("INT", {"default": 1, "min": 0, "max": 10}),
            "random_max": ("INT", {"default": 3, "min": 1, "max": 20}),
        }
        # Add main and sub widgets per category
        for cat, items in db.items():
            main_opts = list(items.get("main", {}).keys())
            sub_opts = list(items.get("sub", {}).keys())
            if main_opts:
                required[f"{cat}_main"] = (main_opts, {"default": main_opts[0]})
            if sub_opts:
                required[f"{cat}_sub"] = ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "Comma‑separated sub‑tags",
                })

        return {
            "required": required,
            "optional": {
                "custom_tags": ("STRING", {"multiline": True, "default": ""}),
            },
            "hidden": {
                "TagState": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "build"
    CATEGORY = "👑 Boss Nodes/🏷️ Tags"

    @classmethod
    def IS_CHANGED(cls, TagState, randomize=False, **kwargs):
        if randomize:
            # Always report "changed" so ComfyUI re-executes and re-rolls
            # random tags every run instead of reusing the cached output.
            return float("nan")
        return TagState

    def build(self, characters, quality_tags, custom_tags="",
              use_wildcards=False, wildcard_format="__category_sub__",
              randomize=False, random_min=1, random_max=3,
              TagState="{}", **kwargs):
        # Parse hidden state (overrides all widget values)
        try:
            state = json.loads(TagState) if isinstance(TagState, str) else {}
        except (json.JSONDecodeError, ValueError) as e:
            print(f"[DanbooruTagBuilder] Failed to parse TagState: {e}")
            state = {}
        # Merge state overrides
        for key, value in state.items():
            if key in kwargs:
                kwargs[key] = value
        # Also override explicit parameters from state if present.
        # (Note: `locals()[key] = value` does NOT work in CPython for reassigning
        # local variables, so we override the named params directly instead.)
        characters = state.get("characters", characters)
        quality_tags = state.get("quality_tags", quality_tags)
        custom_tags = state.get("custom_tags", custom_tags)
        use_wildcards = state.get("use_wildcards", use_wildcards)
        wildcard_format = state.get("wildcard_format", wildcard_format)
        random_min = state.get("random_min", random_min)
        random_max = state.get("random_max", random_max)
        randomize = state.get("randomize", randomize)

        db = get_database()
        parts = [characters]
        all_tags = []

        # Process each category
        for cat, items in db.items():
            main_key = f"{cat}_main"
            sub_key = f"{cat}_sub"
            
            main_choice = kwargs.get(main_key, "")
            
            # FIXED: Correctly fetch the string/list safely from state or overrides
            sub_choices = kwargs.get(sub_key, "")
            if isinstance(sub_choices, list):
                sub_list = [str(s).strip() for s in sub_choices if str(s).strip()]
            else:
                sub_list = [s.strip() for s in str(sub_choices).split(",") if s.strip()]

            # Collect tag list
            cat_tags = []
            if main_choice in items.get("main", {}):
                cat_tags.extend(items["main"][main_choice])
                
            # FIXED: Match token arrays securely without losing subkey formatting
            for sub in sub_list:
                if sub in items.get("sub", {}):
                    cat_tags.extend(items["sub"][sub])

            if not cat_tags:
                continue

            # Randomize (Python runtime evaluation)
            if randomize and random_max > 0:
                lo, hi = min(random_min, random_max), max(random_min, random_max)
                count = random.randint(lo, hi)
                count = min(count, len(cat_tags))
                selected = random.sample(cat_tags, count) if count > 0 else []
            else:
                selected = cat_tags

            if not selected:
                continue

            # If using wildcards, output placeholder
            if use_wildcards:
                # Ensure sub_list matches frontend join format (underscore-separated)
                sub_str = "_".join(sub_list) if sub_list else main_choice
                if wildcard_format == "__category_sub__":
                    parts.append(f"__{cat}_{main_choice}_{sub_str}__")
                elif wildcard_format == "__category/main/sub__":
                    sub_path = "/".join(sub_list) if sub_list else main_choice
                    parts.append(f"__{cat}/{main_choice}/{sub_path}__")
                else:  # __category_sub
                    parts.append(f"__{cat}_{main_choice}_{sub_str}")
            else:
                # Output actual tags
                all_tags.extend(selected)

        # Add all collected tags as a single block
        if all_tags and not use_wildcards:
            parts.append(", ".join(all_tags))

        # Build final prompt
        final_prompt = ", ".join(parts)
        if quality_tags:
            final_prompt += f", {quality_tags}"
        if custom_tags:
            final_prompt += f", {custom_tags}"

        return (final_prompt,)

NODE_CLASS_MAPPINGS = {"DanbooruTagBuilder": DanbooruTagBuilder}
NODE_DISPLAY_NAME_MAPPINGS = {"DanbooruTagBuilder": "🏷️ Danbooru Tag Builder Pro"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
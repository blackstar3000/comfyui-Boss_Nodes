"""Outfit Selector Boss — pick an outfit from the WAI library, with category
filter, strength weighting, and a Random/Fixed seed source.

Mirrors the rebuilt artist_selector (py/artist_selector.py) and the Pixaroma
"stateful UI" pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `OutfitState` STRING input carries the JS-side settings so the
  editor modal can read/write all four values (outfit / category / strength /
  seed + seedMode) through a single channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only when
  state actually changes.
- All interactive UI lives in `js/outfit_selector/index.js`.
"""

import json
import random
import time
from pathlib import Path

from utils.constants import SEED_MAX

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
OUTFITS_FILE = BASE_DIR / "outfits.json"

# Sentinel values for the outfit combo. "(Random)" tells Python to sample
# from the category pool; "(None)" emits an empty prompt.
RANDOM_SENTINEL = "(Random)"
NONE_SENTINEL = "(None)"

# outfit_selector uses 2.5 max (higher than the common 2.0 default).
STRENGTH_MIN = 0.0
STRENGTH_MAX = 2.5
STRENGTH_DEFAULT = 1.35
STRENGTH_STEP = 0.05

SEED_DEFAULT = 0

# Module-level cache; busted by force_refresh=True.
_db_cache = None


# ── Data I/O ─────────────────────────────────────────────────────────────────

def _load_library(force: bool = False):
    """Read outfits.json. Returns (outfits: dict, categories: dict).

    outfits:     {name: text}
    categories:  {category: [name, ...]}   (list, may include names from
                 multiple categories — outfits can appear in more than one).

    Raises FileNotFoundError if the file is missing — the caller falls back to
    a single empty entry so the node still loads.
    """
    global _db_cache
    if force or _db_cache is None:
        with OUTFITS_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        outfits = raw.get("outfits", {}) if isinstance(raw, dict) else {}
        cats = raw.get("categories", {}) if isinstance(raw, dict) else {}
        _db_cache = (outfits, cats)
    return _db_cache


def _category_pool(outfits: dict, categories: dict, category: str):
    """Return the list of outfit names in `category`. Falls back to all
    outfits when the category is missing or empty."""
    if not category or category == "All":
        return list(outfits.keys())
    items = categories.get(category, [])
    # Filter against the actual library so deleted outfits can't linger.
    return [n for n in items if n in outfits]


# ── Node class ──────────────────────────────────────────────────────────────

class BossOutfitSelector:
    DESCRIPTION = (
        "Outfit Selector Boss - pick an outfit from the WAI outfit library "
        "(94+ curated prompt fragments, organized into 50+ themed categories) "
        "and emit a weighted prompt string.\n\n"
        "Click Open Editor to choose an outfit with a live preview, filter "
        "by category, drag the strength slider (0 = omit, 1.0 = normal, "
        "1.35 = bold), and pick a Random or Fixed seed. Random rolls a "
        "fresh outfit from the category each run; Fixed replays the same "
        "outfit every run.\n\n"
        "If you only need the basic combo widgets, the native outfit / "
        "category / strength / seed inputs are still on the node - the "
        "editor is just a friendlier way to pick from the full library."
    )

    @classmethod
    def INPUT_TYPES(cls):
        # Always load so the COMBO lists reflect the current outfits.json
        # (force_refresh on the previous run already busted the cache).
        outfits, categories = _load_library()
        outfit_options = [RANDOM_SENTINEL, NONE_SENTINEL] + sorted(
            n for n, t in outfits.items() if t
        )
        category_options = ["All"] + sorted(categories.keys())

        return {
            "required": {
                "outfit": (
                    outfit_options,
                    {
                        "default": RANDOM_SENTINEL,
                        "tooltip": (
                            "Pick a specific outfit from the library, leave on "
                            "(Random) to sample from the category each run, or "
                            "(None) to emit an empty prompt. The Open Editor "
                            "button offers search + category filtering."
                        ),
                    },
                ),
                "category": (
                    category_options,
                    {
                        "default": "All",
                        "tooltip": (
                            "Filter the random pool by theme. 'All' uses every "
                            "outfit; named categories narrow it to a curated subset."
                        ),
                    },
                ),
                "strength": (
                    "FLOAT",
                    {
                        "default": STRENGTH_DEFAULT,
                        "min": STRENGTH_MIN,
                        "max": STRENGTH_MAX,
                        "step": STRENGTH_STEP,
                        "display": "slider",
                        "tooltip": (
                            "How strongly the outfit should dominate the image. "
                            "0.0 = omit, 1.0 = normal, 1.3+ = bold. Values != 1.0 "
                            "are wrapped as (text:strength)."
                        ),
                    },
                ),
                "seed": (
                    "INT",
                    {
                        "default": SEED_DEFAULT,
                        "min": 0,
                        "max": SEED_MAX,
                        "tooltip": (
                            "Random mode rolls a fresh seed on every Run; Fixed "
                            "mode locks this value. Same seed + same category = "
                            "same outfit."
                        ),
                    },
                ),
                "force_refresh": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "label_on": "Refresh",
                        "label_off": "Cached",
                        "tooltip": (
                            "Reload outfits.json from disk on the next run. "
                            "Useful after editing the library by hand."
                        ),
                    },
                ),
            },
            "hidden": {
                # Carries the full editor state (outfit, category, strength,
                # seed, seedMode). Mirrors ArtistState in artist_selector.py.
                "OutfitState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("outfit_prompt", "outfit_name", "debug")
    OUTPUT_TOOLTIPS = (
        "The weighted outfit prompt fragment. Empty if strength is 0 or (None) was picked.",
        "The chosen outfit name (or 'None' / 'Random').",
        "A short 'category → name' debug string.",
    )
    FUNCTION = "dress"
    CATEGORY = "👑 Boss Nodes/👔 Outfit"

    @classmethod
    def IS_CHANGED(cls, OutfitState: str, **kwargs):
        # Parse OutfitState to check seedMode; if "random", force re‑execution.
        try:
            state = json.loads(OutfitState) if OutfitState else {}
            if isinstance(state, dict) and state.get("seedMode") == "random":
                # Return a unique value to force a fresh execution each time.
                return str(time.time_ns())
        except Exception:
            # If state is invalid, fall back to default behaviour.
            pass
        # For fixed mode (or invalid state), use the state string as the cache key.
        return OutfitState

    def dress(self, outfit, category, strength, seed,
              force_refresh, OutfitState="{}", delimiter=None):
        # delimiter intentionally not surfaced as a widget; kept as a hidden
        # param so old workflow JSONs that referenced it still load.
        del delimiter

        # ── Override all widget arguments from OutfitState ──
        try:
            state = json.loads(OutfitState) if OutfitState else {}
            if isinstance(state, dict) and state:
                # Respect every field from the state; this includes the fresh
                # seed injected by the front‑end for Random mode.
                outfit = state.get("outfit", outfit)
                category = state.get("category", category)
                strength = state.get("strength", strength)
                seed = state.get("seed", seed)
                # seedMode is not needed here – the seed itself is already resolved.
        except Exception:
            # If the state is invalid, fall back to the widget values.
            pass

        # ── Load library ──
        try:
            outfits, categories = _load_library(force=force_refresh)
        except FileNotFoundError:
            return ("", "Missing: outfits.json", "→ missing library")
        except Exception:
            return ("", "Library error", "→ load failed")

        # Clamp strength defensively.
        strength = max(STRENGTH_MIN, min(STRENGTH_MAX, float(strength)))

        name = ""
        text = ""

        if outfit == NONE_SENTINEL:
            name = "None"
            text = ""
        elif outfit == RANDOM_SENTINEL:
            pool = _category_pool(outfits, categories, category)
            if not pool:
                name = f"No outfit in category '{category}'"
                text = ""
            else:
                rng = random.Random(int(seed) if seed else None)
                name = rng.choice(pool)
                text = outfits.get(name, "")
        else:
            name = outfit
            text = outfits.get(outfit, "")
            if not text:
                name = f"Missing: {outfit}"
                text = ""

        if strength <= 0.01 or not text:
            prompt = ""
        elif abs(strength - 1.0) > 0.01:
            prompt = f"({text}:{strength:.2f})"
        else:
            prompt = text

        return (prompt, name, f"{category} → {name}")


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/outfit_boss/data")
    async def get_outfit_data(request):
        try:
            outfits, categories = _load_library()
            return web.json_response({
                "outfits": outfits,
                "categories": categories,
            })
        except FileNotFoundError:
            return web.json_response(
                {"error": "outfits.json not found"},
                status=404,
            )
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/outfit_boss/refresh")
    async def refresh_outfit_data(request):
        # Force reload from disk on the next execution. The JS editor calls
        # this after the user clicks the Force Reload button on the node.
        try:
            outfits, categories = _load_library(force=True)
            return web.json_response({
                "outfits": outfits,
                "categories": categories,
                "count": len(outfits),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "BossOutfitSelector": BossOutfitSelector,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BossOutfitSelector": "Outfit Selector Boss",
}

__all__ = [
    "BossOutfitSelector",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
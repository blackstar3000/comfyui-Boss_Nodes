"""Camera Style Mixer Boss — pick a camera angle, framing, and art style, with
category filtering, strength weighting, and a Random/Fixed seed source.

Mirrors the rebuilt `py/outfit_selector.py` and the Pixaroma "stateful UI"
pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `CameraState` STRING input carries all editor settings so the
  modal can read/write them through one channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only
  when state actually changes.
- All interactive UI lives in `js/camera_style_mixer/index.js`.
- The library loads from `camera_style_mixer.json` (sibling file) with
  mtime-based hot reload + backwards-compatible category-split fallback.
"""

import json
import os
import random
import re
from datetime import datetime
from pathlib import Path

from utils.constants import SEED_MAX, STRENGTH_MIN, STRENGTH_MAX, STRENGTH_DEFAULT, STRENGTH_STEP, ALL_CATEGORIES, RANDOM_STYLE
from utils.prompt_utils import apply_weight
from utils.logging_utils import make_logger
from utils.json_utils import sanitize_entries, sanitize_categories

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
JSON_FILE = BASE_DIR / "camera_style_mixer.json"

# ── Sentinel values for the angle / framing / style combos ────────────────
RANDOM_ANGLE = "__RANDOM_ANGLE__"
RANDOM_FRAMING = "__RANDOM_FRAMING__"
NONE_SENTINEL = "__NONE__"

# ── Weight format registry ──────────────────────────────────────────────────
# camera_style_mixer uses 5 formats (includes "deemphasis" beyond the common 4).
WEIGHT_FORMAT_KEYS = [
    "comfyui",       # (text:1.30)
    "parentheses",   # ((text))  stacked by strength
    "multiply",      # text * 1.30
    "deemphasis",    # [text]
    "none",          # text  (no wrapping)
]

WEIGHT_FORMAT_LABELS = {
    "comfyui":      "(text:1.30)  — ComfyUI / A1111 standard",
    "parentheses":  "((text))     — Stacked parentheses",
    "multiply":     "text * 1.30  — Multiply style",
    "deemphasis":   "[text]       — De-emphasis brackets",
    "none":         "none         — No weighting",
}

WEIGHT_FORMAT_DEFAULT = "comfyui"


# ── Library cache ───────────────────────────────────────────────────────────

class _LibraryState:
    """Loaded data shared across all node instances. Mirrors the v3.0 cache."""

    def __init__(self):
        self.angles: dict[str, str] = {}
        self.framings: dict[str, str] = {}
        self.styles: dict[str, str] = {}
        self.cat_angle: dict[str, list[str]] = {}
        self.cat_framing: dict[str, list[str]] = {}
        self.cat_style: dict[str, list[str]] = {}
        self.mtime: float | None = None

    def is_empty(self) -> bool:
        return not (self.angles or self.framings or self.styles)


_LIB = _LibraryState()


_log = make_logger("CameraStyleMixer")


def _to_slug(name: str) -> str:
    """Lowercase, spaces→underscores, strip non-alphanumeric."""
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "entry"


def _unique_slug(slug: str, existing: set[str]) -> str:
    """Append _2, _3, ... until unique."""
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}_{n}" in existing:
        n += 1
    return f"{slug}_{n}"


def _save_json(path: Path, data: dict) -> None:
    """Atomic write: write to .tmp then os.replace."""
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def _split_unified_categories(
    unified: dict, angle_keys: set, framing_keys: set, style_keys: set,
) -> tuple[dict[str, list[str]], dict[str, list[str]], dict[str, list[str]]]:
    """Split a unified `categories` block into angle/framing/style halves by
    checking which data dict each item belongs to. A category can appear in
    multiple if it references multiple types. Removes the fragile name-heuristic."""
    cat_angle: dict[str, list[str]] = {}
    cat_framing: dict[str, list[str]] = {}
    cat_style: dict[str, list[str]] = {}
    for cat_name, items in unified.items():
        if not isinstance(items, list):
            continue
        a_items = [x for x in items if x in angle_keys]
        f_items = [x for x in items if x in framing_keys]
        s_items = [x for x in items if x in style_keys]
        if a_items:
            cat_angle[cat_name] = a_items
        if f_items:
            cat_framing[cat_name] = f_items
        if s_items:
            cat_style[cat_name] = s_items
    return cat_angle, cat_framing, cat_style


def _load_library(force: bool = False) -> _LibraryState:
    """Hot-reload the JSON file. Returns the populated `_LibraryState`.

    Reads from disk only when the file's mtime changes (or `force=True`).
    On any parse error, leaves the previous cache intact and logs a warning.
    """
    if not force and _LIB.mtime is not None:
        try:
            if os.path.getmtime(JSON_FILE) == _LIB.mtime:
                return _LIB
        except OSError:
            pass  # fall through to the full load below

    if not JSON_FILE.exists():
        _log(f"File not found: {JSON_FILE} — node will return empty prompts.")
        return _LIB

    try:
        mtime = os.path.getmtime(JSON_FILE)
    except OSError as e:
        _log(f"Cannot stat file: {e}")
        return _LIB

    try:
        with JSON_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"Error reading {JSON_FILE.name}: {e}")
        return _LIB

    raw_angles = data.get("camera_angles", {})
    raw_framings = data.get("camera_framings", {})
    raw_styles = data.get("art_styles", {})
    if not isinstance(raw_angles, dict):
        _log("'camera_angles' must be a dict — skipped.")
        raw_angles = {}
    if not isinstance(raw_framings, dict):
        _log("'camera_framings' must be a dict — skipped.")
        raw_framings = {}
    if not isinstance(raw_styles, dict):
        _log("'art_styles' must be a dict — skipped.")
        raw_styles = {}

    def _normalize_entries(raw: dict) -> dict[str, dict]:
        """Convert legacy string values to objects, keep objects as-is."""
        out = {}
        for key, value in raw.items():
            if isinstance(value, str):
                out[key] = {
                    "name": key,
                    "prompt": value,
                    "description": "",
                    "favorite": False,
                    "preview": "",
                }
            elif isinstance(value, dict):
                value.setdefault("name", key)
                value.setdefault("prompt", "")
                value.setdefault("description", "")
                value.setdefault("favorite", False)
                value.setdefault("preview", "")
                out[key] = value
        return out

    angles = _normalize_entries(raw_angles)
    framings = _normalize_entries(raw_framings)
    styles = _normalize_entries(raw_styles)

    # Prefer the explicit split keys; fall back to splitting the unified
    # `categories` block (matches the v3.0 backwards-compat path).
    raw_cat_angle = data.get("angle_categories")
    raw_cat_framing = data.get("framing_categories")
    raw_cat_style = data.get("style_categories")
    if any(x is None for x in (raw_cat_angle, raw_cat_framing, raw_cat_style)):
        raw_cat_angle, raw_cat_framing, raw_cat_style = _split_unified_categories(
            data.get("categories", {}),
            set(angles.keys()),
            set(framings.keys()),
            set(styles.keys()),
        )

    _LIB.angles = angles
    _LIB.framings = framings
    _LIB.styles = styles
    _LIB.cat_angle = sanitize_categories(raw_cat_angle, set(angles.keys()))
    _LIB.cat_framing = sanitize_categories(raw_cat_framing, set(framings.keys()))
    _LIB.cat_style = sanitize_categories(raw_cat_style, set(styles.keys()))
    _LIB.mtime = mtime

    _log(
        f"Loaded: {len(angles)} angles, {len(framings)} framings, {len(styles)} styles, "
        f"{len(_LIB.cat_angle)} angle-cats, {len(_LIB.cat_framing)} framing-cats, {len(_LIB.cat_style)} style-cats"
    )
    return _LIB


# ── Resolve + weight helpers ───────────────────────────────────────────────

def _resolve(
    rng: random.Random, choice: str, random_sentinel: str,
    data: dict[str, str], cat_dict: dict[str, list[str]], category: str,
) -> tuple[str, str]:
    """Resolve a dropdown choice to (key, prompt_text). Handles the random
    sentinel, the none sentinel, and explicit keys uniformly."""
    if choice == NONE_SENTINEL:
        return "", ""

    if choice == random_sentinel:
        if category == ALL_CATEGORIES or not category:
            pool = list(data.keys())
        else:
            pool = [x for x in cat_dict.get(category, []) if x in data]
        if not pool:
            _log(f"Empty pool for category '{category}' — skipping.")
            return "", ""
        key = rng.choice(pool)
        return key, data[key]

    text = data.get(choice)
    if text is None:
        _log(f"Key '{choice}' not found in library — skipping.")
        return "", ""
    return choice, text


# ── Node class ──────────────────────────────────────────────────────────────

class CameraStyleMixer:
    DESCRIPTION = (
        "Camera Style Mixer Boss - mix a camera angle, framing, and an art style into a "
        "single weighted prompt. Click Open Editor to choose from the loaded "
        "library (camera_style_mixer.json), filter by category, drag each "
        "strength slider (0 = omit, 1.0 = normal, 1.3+ = bold), pick a weight "
        "format (ComfyUI / stacked parentheses / multiply / de-emphasis / "
        "none), and pick a Random or Fixed seed for reproducible picks.\n\n"
        "Returns three STRING outputs: combined_prompt (angle + framing + style, each weighted), "
        "angle_prompt (angle alone, weighted), and style_prompt (style alone, weighted)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        lib = _load_library()

        def entry_list(data: dict, random_sentinel: str) -> list[str]:
            return [random_sentinel, NONE_SENTINEL] + sorted(data.keys())

        def cat_list(cats: dict) -> list[str]:
            return [ALL_CATEGORIES] + sorted(cats.keys())

        return {
            "required": {
                "camera_angle": (
                    entry_list(lib.angles, RANDOM_ANGLE),
                    {
                        "default": RANDOM_ANGLE,
                        "tooltip": (
                            "Camera angle preset. '(Random)' samples from the "
                            "selected angle category on each run; '(None)' "
                            "omits the angle from the combined output."
                        ),
                    },
                ),
                "angle_category": (
                    cat_list(lib.cat_angle),
                    {
                        "default": ALL_CATEGORIES,
                        "tooltip": "Filter random angle picks to this category.",
                    },
                ),
                "angle_strength": (
                    "FLOAT",
                    {
                        "default": STRENGTH_DEFAULT,
                        "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                        "step": STRENGTH_STEP, "display": "slider",
                        "tooltip": "Attention weight for the angle prompt. 1.0 = no change.",
                    },
                ),
                "camera_framing": (
                    entry_list(lib.framings, RANDOM_FRAMING),
                    {
                        "default": RANDOM_FRAMING,
                        "tooltip": (
                            "Camera framing preset. '(Random)' samples from the "
                            "selected framing category on each run; '(None)' "
                            "omits the framing from the combined output."
                        ),
                    },
                ),
                "framing_category": (
                    cat_list(lib.cat_framing),
                    {
                        "default": ALL_CATEGORIES,
                        "tooltip": "Filter random framing picks to this category.",
                    },
                ),
                "framing_strength": (
                    "FLOAT",
                    {
                        "default": STRENGTH_DEFAULT,
                        "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                        "step": STRENGTH_STEP, "display": "slider",
                        "tooltip": "Attention weight for the framing prompt. 1.0 = no change.",
                    },
                ),
                "art_style": (
                    entry_list(lib.styles, RANDOM_STYLE),
                    {
                        "default": RANDOM_STYLE,
                        "tooltip": (
                            "Art style preset. '(Random)' samples from the "
                            "selected style category on each run; '(None)' "
                            "omits the style from the combined output."
                        ),
                    },
                ),
                "style_category": (
                    cat_list(lib.cat_style),
                    {
                        "default": ALL_CATEGORIES,
                        "tooltip": "Filter random style picks to this category.",
                    },
                ),
                "style_strength": (
                    "FLOAT",
                    {
                        "default": STRENGTH_DEFAULT,
                        "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                        "step": STRENGTH_STEP, "display": "slider",
                        "tooltip": "Attention weight for the style prompt. 1.0 = no change.",
                    },
                ),
                "weight_format": (
                    WEIGHT_FORMAT_KEYS,
                    {
                        "default": WEIGHT_FORMAT_DEFAULT,
                        "tooltip": "\n".join(
                            f"{k}: {v}" for k, v in WEIGHT_FORMAT_LABELS.items()
                        ),
                    },
                ),
            },
            "optional": {
                "delimiter": (
                    "STRING",
                    {
                        "default": ", ",
                        "tooltip": "String placed between angle, framing, and style in the combined output.",
                    },
                ),
                "seed": (
                    "INT",
                    {
                        "default": -1,
                        "min": -1,
                        "max": SEED_MAX,
                        "tooltip": (
                            "-1 = random each run\n"
                            "0 or higher = deterministic (same seed → same pick)"
                        ),
                    },
                ),
                "force_refresh": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "label_on": "Refresh",
                        "label_off": "Cached",
                        "tooltip": "Force re-reading the JSON file from disk, even if unchanged.",
                    },
                ),
            },
            "hidden": {
                # Mirrors OutfitState / ArtistState: full editor state, with
                # the resolved per-run seed injected by the JS wrapper.
                "CameraState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("combined_prompt", "angle_prompt", "style_prompt")
    OUTPUT_TOOLTIPS = (
        "Angle, framing, and style joined by `delimiter`, each wrapped by `weight_format`.",
        "The angle fragment alone, weighted.",
        "The style fragment alone, weighted.",
    )
    FUNCTION = "mix"
    CATEGORY = "👑 Boss Nodes/📷 Camera"

    @classmethod
    def IS_CHANGED(cls, CameraState: str, **kwargs):
        # Re-execute whenever the JS-side state changes. Random mode writes a
        # fresh run-seed on the JS side via the graphToPrompt wrapper, so
        # identical Fixed-mode state caches like ComfyUI's native seed widget.
        return CameraState

    def mix(
        self, camera_angle, angle_category, angle_strength,
        camera_framing, framing_category, framing_strength,
        art_style, style_category, style_strength,
        weight_format, delimiter=", ", seed=-1, force_refresh=False,
        CameraState="{}",
    ):
        if force_refresh:
            _load_library(force=True)

        # Parse the hidden editor state.
        try:
            _state = json.loads(CameraState) if isinstance(CameraState, str) else {}
        except (TypeError, ValueError):
            _state = {}
        if isinstance(_state, dict):
            camera_angle = _state.get("cameraAngle", camera_angle)
            angle_category = _state.get("angleCategory", angle_category)
            if "angleStrength" in _state:
                angle_strength = _state["angleStrength"]
            camera_framing = _state.get("cameraFraming", camera_framing)
            framing_category = _state.get("framingCategory", framing_category)
            if "framingStrength" in _state:
                framing_strength = _state["framingStrength"]
            art_style = _state.get("artStyle", art_style)
            style_category = _state.get("styleCategory", style_category)
            if "styleStrength" in _state:
                style_strength = _state["styleStrength"]
            if "weightFormat" in _state:
                weight_format = _state["weightFormat"]
            if "delimiter" in _state:
                delimiter = _state["delimiter"]
            if "seed" in _state:
                seed = _state["seed"]

        lib = _LIB

        # Per-call RNG so a node can't disturb the global random state.
        rng = random.Random()
        if seed is not None and seed >= 0:
            rng.seed(int(seed))
        else:
            rng.seed(int(datetime.now().timestamp() * 1e6))

        angle_key, angle_text = _resolve(
            rng, camera_angle, RANDOM_ANGLE, lib.angles, lib.cat_angle, angle_category,
        )
        framing_key, framing_text = _resolve(
            rng, camera_framing, RANDOM_FRAMING, lib.framings, lib.cat_framing, framing_category,
        )
        style_key, style_text = _resolve(
            rng, art_style, RANDOM_STYLE, lib.styles, lib.cat_style, style_category,
        )

        weighted_angle = apply_weight(angle_text, angle_strength, weight_format)
        weighted_framing = apply_weight(framing_text, framing_strength, weight_format)
        weighted_style = apply_weight(style_text, style_strength, weight_format)
        combined = delimiter.join(filter(None, [weighted_angle, weighted_framing, weighted_style]))

        return (combined, weighted_angle, weighted_style)


# ── HTTP API routes ─────────────────────────────────────────────────────────

# Mapping from API type name to (data_key, category_key, library_attr)
_COLLECTION_MAP = {
    "angles":  ("camera_angles",  "angle_categories",  "angles"),
    "framings": ("camera_framings", "framing_categories", "framings"),
    "styles":  ("art_styles",     "style_categories",  "styles"),
}


def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/camera_boss/data")
    async def get_camera_data(request):
        try:
            lib = _load_library()
            return web.json_response({
                "angles": lib.angles,
                "framings": lib.framings,
                "styles": lib.styles,
                "angleCategories": lib.cat_angle,
                "framingCategories": lib.cat_framing,
                "styleCategories": lib.cat_style,
                "weightFormats": [
                    {"key": k, "label": WEIGHT_FORMAT_LABELS[k]}
                    for k in WEIGHT_FORMAT_KEYS
                ],
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/camera_boss/refresh")
    async def refresh_camera_data(request):
        try:
            lib = _load_library(force=True)
            return web.json_response({
                "angles": lib.angles,
                "framings": lib.framings,
                "styles": lib.styles,
                "angleCategories": lib.cat_angle,
                "framingCategories": lib.cat_framing,
                "styleCategories": lib.cat_style,
                "count": len(lib.angles) + len(lib.framings) + len(lib.styles),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/camera_boss/save")
    async def save_camera_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            slug = body.get("slug", "").strip()
            name = body.get("name", "").strip()
            prompt = body.get("prompt", "").strip()
            description = body.get("description", "").strip()
            favorite = bool(body.get("favorite", False))
            categories = body.get("categories", [])

            if lib_type not in _COLLECTION_MAP:
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            if not prompt:
                return web.json_response({"error": "Prompt required"}, status=400)

            data_key, cat_key, lib_attr = _COLLECTION_MAP[lib_type]
            lib = _load_library()
            collection = getattr(lib, lib_attr)

            if not isinstance(categories, list):
                categories = []

            # Generate or validate slug
            if slug and slug in collection:
                # Updating existing entry
                is_new = False
            else:
                # New entry — generate unique slug
                slug = _unique_slug(_to_slug(name), set(collection.keys()))
                is_new = True

            entry = {
                "name": name,
                "prompt": prompt,
                "description": description,
                "favorite": favorite,
                "preview": collection.get(slug, {}).get("preview", "") if isinstance(collection.get(slug), dict) else "",
            }
            collection[slug] = entry

            # Update categories
            cat_dict = getattr(lib, f"cat_{lib_attr.split('s')[0] if lib_attr.endswith('s') else lib_attr}")
            # Ensure all requested categories exist
            for cat in categories:
                if cat and cat != ALL_CATEGORIES and cat not in cat_dict:
                    cat_dict[cat] = []
            # Update membership
            for cat, members in cat_dict.items():
                if cat == ALL_CATEGORIES:
                    continue
                if slug in members and cat not in categories:
                    members.remove(slug)
                elif slug not in members and cat in categories:
                    members.append(slug)

            # Save to disk
            try:
                with JSON_FILE.open("r", encoding="utf-8") as f:
                    disk_data = json.load(f)
            except (json.JSONDecodeError, OSError):
                disk_data = {}

            disk_data[data_key] = {k: v if isinstance(v, dict) else v for k, v in collection.items()}
            disk_data[cat_key] = cat_dict
            _save_json(JSON_FILE, disk_data)

            # Bust mtime cache
            _LIB.mtime = None

            return web.json_response({
                "slug": slug,
                "name": name,
                "is_new": is_new,
                "count": len(collection),
            })
        except Exception as e:
            _log(f"/camera_boss/save failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/camera_boss/delete")
    async def delete_camera_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            slug = body.get("slug", "").strip()

            if lib_type not in _COLLECTION_MAP:
                return web.json_response({"error": "Invalid type"}, status=400)
            if not slug:
                return web.json_response({"error": "Slug required"}, status=400)

            data_key, cat_key, lib_attr = _COLLECTION_MAP[lib_type]
            lib = _load_library()
            collection = getattr(lib, lib_attr)

            if slug not in collection:
                return web.json_response({"error": "Not found"}, status=404)

            del collection[slug]

            # Remove from all categories
            cat_dict = getattr(lib, f"cat_{lib_attr.split('s')[0] if lib_attr.endswith('s') else lib_attr}")
            for members in cat_dict.values():
                if isinstance(members, list) and slug in members:
                    members.remove(slug)

            # Save to disk
            try:
                with JSON_FILE.open("r", encoding="utf-8") as f:
                    disk_data = json.load(f)
            except (json.JSONDecodeError, OSError):
                disk_data = {}

            disk_data[data_key] = dict(collection)
            disk_data[cat_key] = cat_dict
            _save_json(JSON_FILE, disk_data)

            # Bust mtime cache
            _LIB.mtime = None

            return web.json_response({"count": len(collection)})
        except Exception as e:
            _log(f"/camera_boss/delete failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ────────────────────────────────────────────────────
# Mapping key is intentionally preserved as "CameraStyleMixer" so existing
# workflows that reference this node keep loading unchanged.

NODE_CLASS_MAPPINGS = {
    "CameraStyleMixer": CameraStyleMixer,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CameraStyleMixer": "Camera Style Mixer Boss",
}

__all__ = [
    "CameraStyleMixer",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
"""Prompt Unstuck Pro Boss — compose a fragment-rich prompt by sampling from
multiple library sub-arrays. Chaos mode crosses categories; (None) emits an
empty prompt.

Mirrors the rebuilt `py/camera_style_mixer.py` and the Pixaroma "stateful UI"
pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `PunstuckState` STRING input carries the editor settings so the
  modal can read/write all four values (mode / intensity / flags / seed+seedMode)
  through a single channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only
  when state actually changes.
- All interactive UI lives in `js/promptunstuck_pro/index.js`.
- The library loads from `promptunstuck.json` (sibling file) with mtime-based
  hot reload + tiny built-in fallback if the JSON is missing or broken.
"""

import json
import os
import random
from pathlib import Path

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
JSON_FILE = BASE_DIR / "promptunstuck.json"

# ── Sentinel modes ──────────────────────────────────────────────────────────
NONE_MODE = "None"
CHAOS_MODE = "Chaos"
EXPLICIT_CATEGORIES = {"fsolo", "ff", "mf", "ffm", "mfm", "bdsmx"}

# ── Strength bounds (shared by Python + JS) ────────────────────────────────
INTENSITY_MIN = 0.0
INTENSITY_MAX = 2.0
INTENSITY_DEFAULT = 1.0
INTENSITY_STEP = 0.05

SEED_MAX = 0xFFFFFFFFFFFFFFFF  # match ComfyUI's own seed widget bound

# Fragment flags — mirrors the JS-side toggle grid.
DEFAULT_FLAGS = {
    "useEyes": True,
    "useBreast": True,
    "useBody": True,
    "useHair": True,
    "useClothing": True,
    "useLocation": True,
    "usePose": True,
    "useView": True,
    "useWeather": True,
    "useExplicitSubjects": False,  # only used for EXPLICIT_CATEGORIES
}

# Built-in fallback that mirrors the v3.0 in-code `default`. Kept small —
# the real library lives in `promptunstuck.json`. If both are missing we
# still load with a sane minimum instead of crashing.
_FALLBACK_LIBRARY = {
    "universal": {
        "subjects": ["A Beautiful woman with", "Two beautiful women with"],
        "eyes": ["(perfect, blue eyes)", "(perfect, brown eyes)"],
        "breasts": ["(large breasts)", "(medium breasts)"],
        "body": ["(fit body)", "(curvy body)"],
        "hairLength": ["long", "short", "wavy"],
        "hairColor": ["(Blonde hair)", "(Brunette hair)", "(Black hair)"],
        "poses": ["standing", "sitting", "leaning"],
        "views": ["view from front", "view from side"],
        "weather": ["day", "night"],
    },
    "categories": {
        "swimwear": {
            "colors": ["Red", "Blue", "Black"],
            "clothing": ["micro bikini", "string bikini", "one-piece swimsuit"],
            "locations": ["pool", "beach", "jacuzzi"],
        },
        "lingerie": {
            "colors": ["Red", "Black", "White"],
            "clothing": ["lace lingerie", "silk babydoll"],
            "locations": ["luxury bedroom", "candle-lit room"],
        },
    },
}


# ── Library cache ───────────────────────────────────────────────────────────

class _LibraryState:
    """Loaded data shared across all node instances. Mirrors the v3.0 cache
    but with mtime-based hot reload."""

    def __init__(self):
        self.data: dict = {}
        self.mtime: float | None = None

    def is_empty(self) -> bool:
        return not self.data


_LIB = _LibraryState()


def _log(msg: str) -> None:
    print(f"[PromptUnstuckPro] {msg}")


def _safe_list(d: dict, *keys, default=None):
    """Walk nested dicts and return the list at `keys`, else `default`."""
    cur = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default if default is not None else []
        cur = cur[k]
    return cur if isinstance(cur, list) else (default if default is not None else [])


def _load_library(force: bool = False) -> _LibraryState:
    """Hot-reload the JSON file. Returns the populated `_LibraryState`.

    Reads from disk only when the file's mtime changes (or `force=True`).
    On any parse error, leaves the previous cache intact and logs a warning.
    """
    if not force and _LIB.mtime is not None and _LIB.data:
        try:
            if os.path.getmtime(JSON_FILE) == _LIB.mtime:
                return _LIB
        except OSError:
            pass  # fall through to the full load below

    if not JSON_FILE.exists():
        _log(f"File not found: {JSON_FILE.name} — using built-in fallback.")
        _LIB.data = _FALLBACK_LIBRARY
        _LIB.mtime = None
        return _LIB

    try:
        mtime = os.path.getmtime(JSON_FILE)
    except OSError as e:
        _log(f"Cannot stat file: {e} — using built-in fallback.")
        _LIB.data = _FALLBACK_LIBRARY
        _LIB.mtime = None
        return _LIB

    try:
        with JSON_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"Error reading {JSON_FILE.name}: {e} — using built-in fallback.")
        _LIB.data = _FALLBACK_LIBRARY
        _LIB.mtime = None
        return _LIB

    if not isinstance(data, dict):
        _log(f"{JSON_FILE.name} root is not an object — using built-in fallback.")
        _LIB.data = _FALLBACK_LIBRARY
        _LIB.mtime = None
        return _LIB

    cats = data.get("categories")
    if not isinstance(cats, dict):
        _log(f"{JSON_FILE.name} has no 'categories' object — using built-in fallback.")
        _LIB.data = _FALLBACK_LIBRARY
        _LIB.mtime = None
        return _LIB

    _LIB.data = data
    _LIB.mtime = mtime

    univ = data.get("universal", {}) if isinstance(data.get("universal"), dict) else {}
    _log(
        f"Loaded: {len(cats)} categories, "
        f"{len(_safe_list(univ, 'subjects'))} subjects, "
        f"{len(_safe_list(univ, 'hairColor'))} hair colors"
    )
    return _LIB


def _category_names() -> list[str]:
    """Real category keys from the loaded library, alphabetized."""
    lib = _load_library()
    cats = lib.data.get("categories", {})
    return sorted(cats.keys())


# ── Prompt assembly ─────────────────────────────────────────────────────────

def _pick(rng: random.Random, items: list[str]) -> str:
    """Random pick with graceful fallback to empty string."""
    if not items:
        return ""
    return rng.choice(items)


def _clamp_intensity(intensity) -> float:
    try:
        v = float(intensity)
    except (TypeError, ValueError):
        return INTENSITY_DEFAULT
    return max(INTENSITY_MIN, min(INTENSITY_MAX, v))


def _merge_flags(flags) -> dict:
    """Coerce a (possibly partial) flags dict into a full DEFAULT_FLAGS copy."""
    if not isinstance(flags, dict):
        return dict(DEFAULT_FLAGS)
    out = dict(DEFAULT_FLAGS)
    for k, v in flags.items():
        if k in out:
            out[k] = bool(v)
    return out


def _assemble(
    rng: random.Random,
    lib_data: dict,
    category: str,
    flags: dict,
    intensity: float,
) -> tuple[str, str]:
    """Build the unweighted (raw) and weighted (final) prompt strings.

    Returns (raw, final). Empty final if raw is empty.
    """
    univ = lib_data.get("universal", {}) if isinstance(lib_data.get("universal"), dict) else {}
    cats = lib_data.get("categories", {}) if isinstance(lib_data.get("categories"), dict) else {}
    explicit = univ.get("explicitSubjects", {}) if isinstance(univ.get("explicitSubjects"), dict) else {}

    cat_data = cats.get(category, {}) if isinstance(cats.get(category), dict) else {}

    # Subject: explicitSubjects[cat] takes priority for the explicit categories.
    subject = ""
    if category in EXPLICIT_CATEGORIES and flags.get("useExplicitSubjects"):
        explicit_list = explicit.get(category, [])
        subject = _pick(rng, explicit_list)
    if not subject:
        subject = _pick(rng, _safe_list(univ, "subjects"))

    eye = _pick(rng, _safe_list(univ, "eyes")) if flags.get("useEyes") else ""
    breast = _pick(rng, _safe_list(univ, "breasts")) if flags.get("useBreast") else ""
    body = _pick(rng, _safe_list(univ, "body")) if flags.get("useBody") else ""
    hair = ""
    if flags.get("useHair"):
        hl = _pick(rng, _safe_list(univ, "hairLength"))
        hc = _pick(rng, _safe_list(univ, "hairColor"))
        hair = f"{hl} {hc}".strip()

    color = ""
    clothing = ""
    if flags.get("useClothing"):
        color = _pick(rng, _safe_list(cat_data, "colors"))
        clothing = _pick(rng, _safe_list(cat_data, "clothing"))

    # Pose: cat_data.poses overrides universal.poses (matches v3.0).
    pose_universal = _pick(rng, _safe_list(univ, "poses")) if flags.get("usePose") else ""
    pose_cat = _pick(rng, _safe_list(cat_data, "poses")) if flags.get("usePose") else ""
    pose = pose_cat or pose_universal

    location = _pick(rng, _safe_list(cat_data, "locations")) if flags.get("useLocation") else ""
    view = _pick(rng, _safe_list(univ, "views")) if flags.get("useView") else ""
    ambiance = _pick(rng, _safe_list(univ, "weather")) if flags.get("useWeather") else ""

    color_clothing = f"{color} {clothing}".strip()
    elements = [subject, eye, breast, body, hair, color_clothing, pose, location, view, ambiance]
    raw = ", ".join(x.strip() for x in elements if x and x.strip())

    if not raw:
        return "", ""

    if abs(intensity - 1.0) < 1e-4:
        return raw, raw
    return raw, f"({raw}:{intensity:.2f})"


# ── Node class ──────────────────────────────────────────────────────────────

class PromptUnstuckPro:
    DESCRIPTION = (
        "Prompt Unstuck Pro Boss - compose a fragment-rich prompt by sampling "
        "from the loaded library (13 themed categories × universal traits). "
        "Click Open Editor to pick a mode (None / Chaos / a category), drag "
        "the intensity slider (0 = omit, 1.0 = normal, 1.5+ = bold), toggle "
        "which fragments to include (eyes / breast / body / hair / clothing / "
        "location / pose / view / weather / explicit subject), and pick a "
        "Random or Fixed seed for reproducible picks.\n\n"
        "Returns three STRING outputs: unstuck_prompt (the weighted final), "
        "raw_debug (the unweighted parts), and category_used (the resolved "
        "category, or 'None' / 'CHAOS')."
    )

    @classmethod
    def INPUT_TYPES(cls):
        # Always load so the COMBO list reflects the current promptunstuck.json
        # (force_refresh on the previous run already busted the cache).
        _load_library()
        category_options = [NONE_MODE, CHAOS_MODE] + _category_names()

        return {
            "required": {
                "mode": (
                    category_options,
                    {
                        "default": CHAOS_MODE,
                        "tooltip": (
                            "Pick a category, choose Chaos to roll a random "
                            "category on each Run, or None to emit an empty "
                            "prompt."
                        ),
                    },
                ),
                "intensity": (
                    "FLOAT",
                    {
                        "default": INTENSITY_DEFAULT,
                        "min": INTENSITY_MIN, "max": INTENSITY_MAX,
                        "step": INTENSITY_STEP, "display": "slider",
                        "tooltip": (
                            "Attention weight for the final prompt. 1.0 = no "
                            "change. 0 = omit."
                        ),
                    },
                ),
            },
            "optional": {
                "seed": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": SEED_MAX,
                        "tooltip": (
                            "Random mode rolls a fresh seed on every Run; "
                            "Fixed mode locks this value. Same seed + same "
                            "category = same picks."
                        ),
                    },
                ),
                "force_refresh": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "label_on": "Refresh",
                        "label_off": "Cached",
                        "tooltip": "Reload promptunstuck.json from disk on the next run.",
                    },
                ),
            },
            "hidden": {
                # Carries the full editor state (mode, intensity, seed, seedMode,
                # flags). Mirrors OutfitState / CameraState.
                "PunstuckState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("unstuck_prompt", "raw_debug", "category_used")
    OUTPUT_TOOLTIPS = (
        "The weighted final prompt fragment. Empty if mode is None.",
        "The unweighted fragment parts, comma-joined. Useful for debugging.",
        "The resolved category name (or 'None' / 'CHAOS').",
    )
    FUNCTION = "unleash"
    CATEGORY = "👑 Boss Nodes/⚡ Prompting"

    @classmethod
    def IS_CHANGED(cls, PunstuckState: str, **kwargs):
        # Re-execute whenever the JS-side state changes. Random mode writes a
        # fresh run-seed on the JS side via the graphToPrompt wrapper, so
        # identical Fixed-mode state caches like ComfyUI's native seed widget.
        return PunstuckState

    def unleash(
        self, mode, intensity=INTENSITY_DEFAULT, seed=0,
        force_refresh=False, PunstuckState="{}", **kwargs,
    ):
        if force_refresh:
            _load_library(force=True)
        lib = _load_library()

        # Per-call RNG so a node can't disturb the global random state.
        rng = random.Random()
        rng.seed(int(seed) if seed else int.from_bytes(os.urandom(8), "big"))

        flags = _merge_flags(PunstuckState_flags(PunstuckState))
        intensity = _clamp_intensity(intensity)

        # Resolve mode.
        if mode == NONE_MODE:
            return ("", "", "None")
        if mode == CHAOS_MODE:
            cats = lib.data.get("categories", {})
            cat_keys = [k for k in cats.keys() if k != "universal"]
            if not cat_keys:
                return ("", "", "CHAOS")
            actual_category = rng.choice(cat_keys)
            category_used = "CHAOS"
        else:
            actual_category = mode
            category_used = actual_category

        raw, final = _assemble(rng, lib.data, actual_category, flags, intensity)
        return (final, raw, category_used)


def PunstuckState_flags(state_str: str) -> dict:
    """Pull the `flags` object out of a serialized PunstuckState JSON string."""
    if not isinstance(state_str, str) or not state_str:
        return {}
    try:
        obj = json.loads(state_str)
    except (json.JSONDecodeError, ValueError):
        return {}
    if not isinstance(obj, dict):
        return {}
    return obj.get("flags", {}) if isinstance(obj.get("flags"), dict) else {}


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/punstuck_boss/data")
    async def get_punstuck_data(request):
        try:
            lib = _load_library()
            data = lib.data or {}
            return web.json_response({
                "universal": data.get("universal", {}),
                "categories": data.get("categories", {}),
                "explicitSubjects": (
                    data.get("universal", {}).get("explicitSubjects", {})
                    if isinstance(data.get("universal"), dict) else {}
                ),
                "intensityRange": {
                    "min": INTENSITY_MIN,
                    "max": INTENSITY_MAX,
                    "step": INTENSITY_STEP,
                    "default": INTENSITY_DEFAULT,
                },
                "modeOptions": [NONE_MODE, CHAOS_MODE] + _category_names(),
                "explicitCategories": sorted(EXPLICIT_CATEGORIES),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/punstuck_boss/refresh")
    async def refresh_punstuck_data(request):
        try:
            lib = _load_library(force=True)
            cats = lib.data.get("categories", {}) if isinstance(lib.data, dict) else {}
            return web.json_response({
                "categories": cats,
                "count": len(cats),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ───────────────────────────────────────────────────
# Mapping key is intentionally preserved as "PromptUnstuckPro" so existing
# workflows that reference this node keep loading unchanged.

NODE_CLASS_MAPPINGS = {
    "PromptUnstuckPro": PromptUnstuckPro,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptUnstuckPro": "Prompt Unstuck Pro Boss",
}

__all__ = [
    "PromptUnstuckPro",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

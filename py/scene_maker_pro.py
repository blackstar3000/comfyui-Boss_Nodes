"""Scene Maker Pro Boss — pick a girl + a male + a scene from three sibling
JSON libraries, with category filters, strength weighting, a Random/Fixed
seed source, and the v4.0 placeholder system ({girl}/{girls}/{male}/{males}).

Mirrors the rebuilt `py/camera_style_mixer.py` and the Pixaroma "stateful UI"
pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `SceneState` STRING input carries all editor settings so the
  modal can read/write them through one channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only
  when state actually changes.
- All interactive UI lives in `js/scene_maker_pro/index.js`.
- The libraries load from `girls.json`, `males.json`, `scenes.json` (sibling
  files) with mtime-based hot reload. On any missing file: warn and leave
  that collection empty (no auto-creation).
"""

import json
import os
import random
from pathlib import Path

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent

# Sentinel values for the per-collection combos.
RANDOM_SENTINEL = "Random"
NONE_SENTINEL = "None"
ALL_CATEGORIES = "All"

# Strength bounds (shared by Python + JS) — match v4.0 ranges exactly.
STRENGTH_MIN = 0.0
STRENGTH_MAX = 2.5
STRENGTH_STEP = 0.05

SEED_MAX = 0xFFFFFFFFFFFFFFFF  # match ComfyUI's seed widget bound
DELIMITER_DEFAULT = ", "


# ── Per-collection library cache ───────────────────────────────────────────

class _Collection:
    """One library (girls / males / scenes) with hot reload."""

    def __init__(self, filename: str, data_key: str):
        self.filename = filename
        self.data_key = data_key  # 'girls' / 'males' / 'scenes'
        self.items: dict[str, str] = {}
        self.categories: dict[str, list[str]] = {}
        self.mtime: float | None = None

    @property
    def path(self) -> Path:
        return BASE_DIR / self.filename

    def is_empty(self) -> bool:
        return not self.items


_GIRLS = _Collection("girls.json", "girls")
_MALES = _Collection("males.json", "males")
_SCENES = _Collection("scenes.json", "scenes")


def _log(msg: str) -> None:
    print(f"[SceneMakerPro] {msg}")


def _sanitize_entries(raw: dict) -> dict[str, str]:
    """Keep only entries with non-empty string values. Warn on bad entries."""
    clean: dict[str, str] = {}
    for k, v in raw.items():
        if isinstance(v, str) and v.strip():
            clean[k] = v.strip()
        else:
            _log(f"  Skipped entry '{k}': expected non-empty string, got {type(v).__name__}")
    return clean


def _sanitize_categories(cats: dict, valid_keys: set) -> dict[str, list[str]]:
    """Validate category lists against known keys. Warn on missing refs."""
    clean: dict[str, list[str]] = {}
    for cat_name, items in cats.items():
        if not isinstance(items, list):
            _log(f"  Category '{cat_name}' skipped: expected list")
            continue
        valid = [x for x in items if x in valid_keys]
        missing = [x for x in items if x not in valid_keys]
        if missing:
            _log(f"  Category '{cat_name}': {len(missing)} item(s) not in library — skipped")
        if valid:
            clean[cat_name] = valid
    return clean


def _load_collection(col: _Collection, force: bool = False) -> _Collection:
    """Hot-reload a collection's JSON file. Returns the populated `_Collection`.

    Reads from disk only when the file's mtime changes (or `force=True`).
    On any parse error, leaves the previous cache intact and logs a warning.
    """
    if not force and col.mtime is not None and col.items:
        try:
            if os.path.getmtime(col.path) == col.mtime:
                return col
        except OSError:
            pass  # fall through to the full load below

    if not col.path.exists():
        _log(f"File not found: {col.filename} — that collection will be empty.")
        return col

    try:
        mtime = os.path.getmtime(col.path)
    except OSError as e:
        _log(f"Cannot stat {col.filename}: {e}")
        return col

    try:
        with col.path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"Error reading {col.filename}: {e}")
        return col

    if not isinstance(data, dict):
        _log(f"{col.filename} root is not an object — skipping.")
        return col

    # v4.0 layout: {<data_key>: {name: text}, categories: {...}}
    raw_items = data.get(col.data_key)
    if not isinstance(raw_items, dict):
        _log(f"{col.filename} has no '{col.data_key}' object — skipping.")
        return col

    items = _sanitize_entries(raw_items)
    cats = _sanitize_categories(data.get("categories", {}), set(items.keys()))

    col.items = items
    col.categories = cats
    col.mtime = mtime
    _log(f"Loaded {col.filename}: {len(items)} items, {len(cats)} categories")
    return col


def _load_all(force: bool = False) -> None:
    _load_collection(_GIRLS, force)
    _load_collection(_MALES, force)
    _load_collection(_SCENES, force)


# ── Resolve + weight helpers ───────────────────────────────────────────────

def _resolve(
    rng: random.Random, choice: str, data: dict[str, str],
    cats: dict[str, list[str]], category: str,
) -> tuple[str, str]:
    """Resolve a dropdown choice to (key, prompt_text). Handles Random,
    None, and explicit keys uniformly."""
    if choice == NONE_SENTINEL:
        return "", ""
    if choice == RANDOM_SENTINEL:
        if category == ALL_CATEGORIES or not category:
            pool = list(data.keys())
        else:
            pool = [x for x in cats.get(category, []) if x in data]
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


def _apply_weight(text: str, strength: float) -> str:
    """ComfyUI-format attention weight: `(text:1.30)` when !=1.0, else `text`.
    Empty text stays empty."""
    if not text or strength < 0.01:
        return ""
    s = float(strength)
    if abs(s - 1.0) < 1e-4:
        return text
    return f"({text}:{s:.2f})"


def _clamp_strength(strength) -> float:
    try:
        v = float(strength)
    except (TypeError, ValueError):
        return 1.0
    return max(STRENGTH_MIN, min(STRENGTH_MAX, v))


def _substitute_placeholders(
    scene_text: str,
    girl_weighted: str,
    male_weighted: str,
) -> str:
    """Replace {girl}/{girls}/{male}/{males} in the scene text. If a token
    is absent from `girl_weighted` or `male_weighted` (i.e. None), the
    token is left untouched — matches v4.0's defensive behaviour."""
    if not scene_text:
        return scene_text
    out = scene_text
    if girl_weighted:
        out = out.replace("{girl}", girl_weighted)
        out = out.replace("{girls}", f"{girl_weighted}, {girl_weighted}")
    if male_weighted:
        out = out.replace("{male}", male_weighted)
        out = out.replace("{males}", f"{male_weighted}, {male_weighted}")
    return out


# ── Node class ──────────────────────────────────────────────────────────────

class SceneMakerGOD:
    DESCRIPTION = (
        "Scene Maker Pro Boss - compose a scene prompt from three independent "
        "libraries (girls, males, scenes). Click Open Editor to pick a girl, "
        "a male, and a scene from each library, filter each by category, drag "
        "each strength slider (0 = omit, 1.0 = normal, 1.3+ = bold), set the "
        "delimiter, and pick a Random or Fixed seed for reproducible picks.\n\n"
        "Scene text supports the {girl}/{girls}/{male}/{males} placeholder "
        "system — the scene is weighted first, then placeholders are replaced "
        "with the weighted girl/male fragments.\n\n"
        "Returns seven STRING outputs: final_prompt (delimiter-joined weighted "
        "parts with substitution applied), girl_only / male_only / scene_only "
        "(each fragment alone, weighted), and girl_name / male_name / "
        "scene_name (the resolved key for each)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        _load_all()

        def opts(data: dict) -> list[str]:
            return [RANDOM_SENTINEL, NONE_SENTINEL] + sorted(data.keys())

        def cat_opts(cats: dict) -> list[str]:
            return [ALL_CATEGORIES] + sorted(cats.keys())

        return {
            "required": {
                "girl": (
                    opts(_GIRLS.items),
                    {"default": RANDOM_SENTINEL, "tooltip": "Girl preset. (Random) samples from the selected category on each run; (None) omits the girl from the output."},
                ),
                "girl_cat": (
                    cat_opts(_GIRLS.categories),
                    {"default": ALL_CATEGORIES, "tooltip": "Filter random girl picks to this category."},
                ),
                "girl_w": (
                    "FLOAT",
                    {"default": 1.3, "min": STRENGTH_MIN, "max": STRENGTH_MAX, "step": STRENGTH_STEP,
                     "tooltip": "Attention weight for the girl fragment. 1.0 = no change."},
                ),
                "male": (
                    opts(_MALES.items),
                    {"default": NONE_SENTINEL, "tooltip": "Male preset. (Random) samples from the selected category on each run; (None) omits the male from the output."},
                ),
                "male_cat": (
                    cat_opts(_MALES.categories),
                    {"default": ALL_CATEGORIES, "tooltip": "Filter random male picks to this category."},
                ),
                "male_w": (
                    "FLOAT",
                    {"default": 1.2, "min": STRENGTH_MIN, "max": STRENGTH_MAX, "step": STRENGTH_STEP,
                     "tooltip": "Attention weight for the male fragment. 1.0 = no change."},
                ),
                "scene": (
                    opts(_SCENES.items),
                    {"default": RANDOM_SENTINEL, "tooltip": "Scene preset. (Random) samples from the selected category on each run; (None) omits the scene from the output."},
                ),
                "scene_cat": (
                    cat_opts(_SCENES.categories),
                    {"default": ALL_CATEGORIES, "tooltip": "Filter random scene picks to this category."},
                ),
                "scene_w": (
                    "FLOAT",
                    {"default": 1.1, "min": STRENGTH_MIN, "max": STRENGTH_MAX, "step": STRENGTH_STEP,
                     "tooltip": "Attention weight for the scene fragment. 1.0 = no change. Weight is applied BEFORE placeholder substitution."},
                ),
            },
            "optional": {
                "seed": (
                    "INT",
                    {"default": 0, "min": 0, "max": SEED_MAX,
                     "tooltip": "Random mode rolls a fresh seed on every Run; Fixed mode locks this value. Same seed + same picks = same prompt."},
                ),
                "force_refresh": (
                    "BOOLEAN",
                    {"default": False, "label_on": "Refresh", "label_off": "Cached",
                     "tooltip": "Reload girls.json / males.json / scenes.json from disk on the next run."},
                ),
                "delimiter": (
                    "STRING",
                    {"default": DELIMITER_DEFAULT,
                     "tooltip": "String placed between the girl/male/scene fragments in the final output."},
                ),
            },
            "hidden": {
                # Mirrors CameraState / OutfitState: full editor state with
                # the resolved per-run seed injected by the JS wrapper.
                "SceneState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("final_prompt", "girl_only", "male_only", "scene_only",
                    "girl_name", "male_name", "scene_name")
    OUTPUT_TOOLTIPS = (
        "Girl + male + scene joined by `delimiter`, with placeholder substitution applied to the scene.",
        "The girl fragment alone, weighted.",
        "The male fragment alone, weighted.",
        "The scene fragment alone, weighted, with {girl}/{male}/{girls}/{males} substituted.",
        "The chosen girl name (or 'None' / 'Random').",
        "The chosen male name (or 'None' / 'Random').",
        "The chosen scene name (or 'None' / 'Random').",
    )
    FUNCTION = "direct"
    CATEGORY = "👑 Boss Nodes/🎞️ Scene"

    @classmethod
    def IS_CHANGED(cls, SceneState: str, **kwargs):
        # Re-execute whenever the JS-side state changes. Random mode writes
        # a fresh run-seed on the JS side via the graphToPrompt wrapper.
        return SceneState

    def direct(self, girl, girl_cat, girl_w,
               male, male_cat, male_w,
               scene, scene_cat, scene_w,
               seed=0, force_refresh=False, delimiter=DELIMITER_DEFAULT,
               SceneState="{}"):

        if force_refresh:
            _load_all(force=True)

        # Parse the hidden editor state. Despite being documented as "the"
        # state channel, this was previously accepted but never read -
        # dead code (same gap found and fixed in the sibling
        # prompt_master_library_pro.py). Use it as a fallback so SceneState
        # actually has the effect the architecture doc describes,
        # independent of whether the native widgets happened to be synced
        # before this run.
        try:
            _state = json.loads(SceneState) if isinstance(SceneState, str) else {}
        except (TypeError, ValueError):
            _state = {}
        if isinstance(_state, dict):
            girl = _state.get("girl", girl)
            girl_cat = _state.get("girlCat", girl_cat)
            if "girlW" in _state:
                girl_w = _state["girlW"]
            male = _state.get("male", male)
            male_cat = _state.get("maleCat", male_cat)
            if "maleW" in _state:
                male_w = _state["maleW"]
            scene = _state.get("scene", scene)
            scene_cat = _state.get("sceneCat", scene_cat)
            if "sceneW" in _state:
                scene_w = _state["sceneW"]
            if "delimiter" in _state:
                delimiter = _state["delimiter"]
            if "seed" in _state:
                seed = _state["seed"]

        # Per-call RNG so a node can't disturb the global random state.
        rng = random.Random()
        rng.seed(int(seed) if seed else int.from_bytes(os.urandom(8), "big"))

        girl_key, girl_text = _resolve(rng, girl, _GIRLS.items, _GIRLS.categories, girl_cat)
        male_key, male_text = _resolve(rng, male, _MALES.items, _MALES.categories, male_cat)
        scene_key, scene_text = _resolve(rng, scene, _SCENES.items, _SCENES.categories, scene_cat)

        girl_w = _clamp_strength(girl_w)
        male_w = _clamp_strength(male_w)
        scene_w = _clamp_strength(scene_w)

        # Weight-then-substitute (user decision: weight before substitute).
        weighted_girl = _apply_weight(girl_text, girl_w)
        weighted_male = _apply_weight(male_text, male_w)
        weighted_scene = _apply_weight(scene_text, scene_w)
        substituted_scene = _substitute_placeholders(weighted_scene, weighted_girl, weighted_male)

        parts = [p for p in [weighted_girl, weighted_male, substituted_scene] if p]
        final_prompt = delimiter.join(parts) if parts else ""

        # scene_only output is the substituted weighted scene (so {girl}->KIM is visible).
        # girl_only / male_only are the bare weighted fragments (no substitution).
        return (
            final_prompt,
            weighted_girl,
            weighted_male,
            substituted_scene,
            girl_key or "None",
            male_key or "None",
            scene_key or "None",
        )


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/scene_boss/data")
    async def get_scene_data(request):
        try:
            _load_all()
            return web.json_response({
                "girls": _GIRLS.items,
                "males": _MALES.items,
                "scenes": _SCENES.items,
                "girlCategories": _GIRLS.categories,
                "maleCategories": _MALES.categories,
                "sceneCategories": _SCENES.categories,
                "delimiterDefault": DELIMITER_DEFAULT,
                "strengthRange": {
                    "min": STRENGTH_MIN, "max": STRENGTH_MAX, "step": STRENGTH_STEP,
                },
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/scene_boss/refresh")
    async def refresh_scene_data(request):
        try:
            _load_all(force=True)
            return web.json_response({
                "girls": len(_GIRLS.items),
                "males": len(_MALES.items),
                "scenes": len(_SCENES.items),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ───────────────────────────────────────────────────
# Mapping key is intentionally preserved as "SceneMakerGOD" so existing
# workflows that reference this node keep loading unchanged. The class name
# also stays the same.

NODE_CLASS_MAPPINGS = {
    "SceneMakerGOD": SceneMakerGOD,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SceneMakerGOD": "Scene Maker Pro Boss",
}

__all__ = [
    "SceneMakerGOD",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
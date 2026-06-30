"""Ultimate Character Builder Pro Boss — pick a character + expression +
pose from three categorized JSON libraries, with category filters, strength
weighting, a Random/Fixed seed source, and a delimiter.

Mirrors the rebuilt `py/scene_maker_pro.py` and the Pixaroma "stateful UI"
pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `CharacterState` STRING input carries all editor settings so
  the modal can read/write them through one channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only
  when state actually changes.
- All interactive UI lives in `js/ultimate_character_builder/index.js`.
- Libraries load from `characters.json` / `poses.json` / `expressions.json`
  with mtime-based hot reload. On any missing file: warn and leave that
  collection empty (no auto-creation).
"""

import json
import os
import random
from datetime import datetime
from pathlib import Path

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent

CHARACTERS_FILE   = BASE_DIR / "characters.json"
POSES_FILE        = BASE_DIR / "poses.json"
EXPRESSIONS_FILE  = BASE_DIR / "expressions.json"

# ── Sentinel values for the per-collection combos ──────────────────────────
RANDOM_CHARACTER    = "__RANDOM_CHARACTER__"
RANDOM_EXPRESSION   = "__RANDOM_EXPRESSION__"
RANDOM_POSE         = "__RANDOM_POSE__"
NONE_SENTINEL       = "__NONE__"
ALL_CATEGORIES      = "All"

# ── Strength bounds (shared by Python + JS) ────────────────────────────────
# Character strength goes to 2.5 (preserved from v3.2); expression + pose
# cap at 2.0 (matches v3.2).
CHARACTER_STRENGTH_MIN = 0.0
CHARACTER_STRENGTH_MAX = 2.5
SUB_STRENGTH_MIN       = 0.0
SUB_STRENGTH_MAX       = 2.0
STRENGTH_STEP          = 0.05

CHARACTER_STRENGTH_DEFAULT = 1.3
EXPRESSION_STRENGTH_DEFAULT = 1.1
POSE_STRENGTH_DEFAULT = 1.2

DELIMITER_DEFAULT = ", "

SEED_MAX = 0xFFFFFFFFFFFFFFFF  # match ComfyUI's seed widget bound


# ── Per-collection library cache ───────────────────────────────────────────

class _Collection:
    """One library (character / pose / expression) with hot reload."""

    def __init__(self, filename: str, data_key: str):
        self.filename = filename
        self.data_key = data_key  # 'characters' / 'poses' / 'expressions'
        self.items: dict[str, str] = {}
        self.categories: dict[str, list[str]] = {}
        self.mtime: float | None = None

    @property
    def path(self) -> Path:
        return BASE_DIR / self.filename

    def is_empty(self) -> bool:
        return not self.items


_CHARACTERS  = _Collection("characters.json",  "characters")
_POSES       = _Collection("poses.json",        "poses")
_EXPRESSIONS = _Collection("expressions.json",  "expressions")


def _log(msg: str) -> None:
    print(f"[UltimateCharacterBuilderPro] {msg}")


def _sanitize_entries(raw: dict, filename: str) -> dict[str, str]:
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

    raw_items = data.get(col.data_key)
    if not isinstance(raw_items, dict):
        _log(f"{col.filename} has no '{col.data_key}' object — skipping.")
        return col

    items = _sanitize_entries(raw_items, col.filename)
    cats = _sanitize_categories(data.get("categories", {}), set(items.keys()))

    col.items = items
    col.categories = cats
    col.mtime = mtime
    _log(f"Loaded {col.filename}: {len(items)} items, {len(cats)} categories")
    return col


def _load_all(force: bool = False) -> None:
    _load_collection(_CHARACTERS, force)
    _load_collection(_POSES, force)
    _load_collection(_EXPRESSIONS, force)


# ── Resolve + weight helpers ───────────────────────────────────────────────

def _resolve(
    rng: random.Random, choice: str,
    items: dict[str, str], cats: dict[str, list[str]], category: str,
) -> tuple[str, str]:
    """Resolve a dropdown choice to (key, prompt_text). Handles Random,
    None, and explicit keys uniformly."""
    if choice == NONE_SENTINEL:
        return "", ""
    if choice.startswith("__RANDOM_"):
        if category == ALL_CATEGORIES or not category:
            pool = list(items.keys())
        else:
            pool = [x for x in cats.get(category, []) if x in items]
        if not pool:
            _log(f"Empty pool for category '{category}' — skipping.")
            return "", ""
        key = rng.choice(pool)
        return key, items[key]
    text = items.get(choice)
    if text is None:
        _log(f"Key '{choice}' not found in library — skipping.")
        return "", ""
    return choice, text


def _apply_weight(text: str, strength: float) -> str:
    """Single comfyui-format attention weight. Returns '' when text or
    strength is effectively zero."""
    if not text or strength < 0.01:
        return ""
    s = float(strength)
    if abs(s - 1.0) < 1e-4:
        return text
    return f"({text}:{s:.2f})"


def _clamp_strength(strength, minimum, maximum, default) -> float:
    try:
        v = float(strength)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, v))


def _collection_payload(items: dict[str, str], cats: dict[str, list[str]]) -> tuple[dict, list[str]]:
    """Flatten + sort so the editor can render one big searchable list."""
    flat: dict[str, str] = {}
    for cat in sorted(items):
        flat[cat] = items[cat]
    return flat, sorted(cats.keys())


# ── Node class ──────────────────────────────────────────────────────────────

class UltimateCharacterBuilderPRO:
    DESCRIPTION = (
        "Ultimate Character Builder Pro Boss - compose a character prompt "
        "from three independent libraries (characters.json 7 cats, "
        "expressions.json 6 cats, poses.json 12 cats). Click Open Editor "
        "to pick a character, expression, and pose from each library, filter "
        "each by category, drag each strength slider, set the delimiter, "
        "and pick a Random or Fixed seed for reproducible picks.\n\n"
        "Returns five STRING outputs: full_prompt (all three fragments joined "
        "by delimiter), character_only / expression_only / pose_only (each "
        "fragment alone, weighted), and debug (resolved names + seed)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        _load_all()

        def opts(items: dict, random_sentinel: str) -> list[str]:
            # The combo list must include the per-collection RANDOM_* sentinel
            # so the JS editor can write `__RANDOM_*__` back into the (hidden)
            # widget on Save without ComfyUI rejecting it as "Value not in
            # list". NONE_SENTINEL + RANDOM_* go first so user-visible names
            # stay grouped below.
            return [NONE_SENTINEL, random_sentinel] + sorted(items.keys())

        def cat_opts(cats: dict) -> list[str]:
            return [ALL_CATEGORIES] + sorted(cats.keys())

        return {
            "required": {
                "character": (opts(_CHARACTERS.items, RANDOM_CHARACTER),
                              {"default": RANDOM_CHARACTER,
                               "tooltip": "Character preset. Random samples from the selected category; None omits the character from the output."}),
                "character_cat": (cat_opts(_CHARACTERS.categories),
                                  {"default": ALL_CATEGORIES,
                                   "tooltip": "Filter random character picks to this category."}),
                "character_strength": ("FLOAT", {
                    "default": CHARACTER_STRENGTH_DEFAULT,
                    "min": CHARACTER_STRENGTH_MIN, "max": CHARACTER_STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Attention weight for the character fragment. 1.0 = no change."}),

                "expression": (opts(_EXPRESSIONS.items, RANDOM_EXPRESSION),
                               {"default": RANDOM_EXPRESSION,
                                "tooltip": "Expression preset."}),
                "expression_cat": (cat_opts(_EXPRESSIONS.categories),
                                   {"default": ALL_CATEGORIES,
                                    "tooltip": "Filter random expression picks to this category."}),
                "expression_strength": ("FLOAT", {
                    "default": EXPRESSION_STRENGTH_DEFAULT,
                    "min": SUB_STRENGTH_MIN, "max": SUB_STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Attention weight for the expression fragment. 1.0 = no change."}),

                "pose": (opts(_POSES.items, RANDOM_POSE),
                         {"default": RANDOM_POSE,
                          "tooltip": "Pose preset."}),
                "pose_cat": (cat_opts(_POSES.categories),
                             {"default": ALL_CATEGORIES,
                             "tooltip": "Filter random pose picks to this category."}),
                "pose_strength": ("FLOAT", {
                    "default": POSE_STRENGTH_DEFAULT,
                    "min": SUB_STRENGTH_MIN, "max": SUB_STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Attention weight for the pose fragment. 1.0 = no change."}),

                "delimiter": ("STRING", {
                    "default": DELIMITER_DEFAULT, "multiline": False,
                    "tooltip": "String placed between the three fragments in the output.",
                }),
            },
            "optional": {
                "seed": ("INT", {
                    "default": 0, "min": 0, "max": SEED_MAX,
                    "tooltip": "Random mode rolls a fresh seed on every Run; Fixed mode locks this value. Same seed + same picks = same prompt.",
                }),
                "force_refresh": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Refresh", "label_off": "Cached",
                    "tooltip": "Reload characters.json / poses.json / expressions.json from disk on the next run.",
                }),
            },
            "hidden": {
                # Full editor state — mirrors SceneState from scene_maker_pro.
                "CharacterState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("full_prompt", "character_only", "expression_only", "pose_only", "debug")
    OUTPUT_TOOLTIPS = (
        "Character + expression + pose joined by delimiter.",
        "Character fragment alone, weighted.",
        "Expression fragment alone, weighted.",
        "Pose fragment alone, weighted.",
        "Resolved names: 'C:<name> | E:<name> | P:<name> | Seed:<n|auto>'.",
    )
    FUNCTION = "create_goddess"  # kept for wire-compat (frozen workflow slot)
    CATEGORY = "👑 Boss Nodes/🎭 Character"

    @classmethod
    def IS_CHANGED(cls, CharacterState: str, **kwargs):
        # Re-execute whenever the JS-side state changes. Random mode writes
        # a fresh run-seed on the JS side via the graphToPrompt wrapper.
        return CharacterState

    def create_goddess(self, character, character_cat, character_strength,
                       expression, expression_cat, expression_strength,
                       pose, pose_cat, pose_strength,
                       delimiter=DELIMITER_DEFAULT,
                       seed=0, force_refresh=False, CharacterState="{}"):

        if force_refresh:
            _load_all(force=True)

        # Per-call RNG so a node can't disturb the global random state.
        rng = random.Random()
        rng.seed(int(seed) if seed else int.from_bytes(os.urandom(8), "big"))

        c_key, c_text = _resolve(rng, character, _CHARACTERS.items,  _CHARACTERS.categories,  character_cat)
        e_key, e_text = _resolve(rng, expression, _EXPRESSIONS.items, _EXPRESSIONS.categories, expression_cat)
        p_key, p_text = _resolve(rng, pose,      _POSES.items,       _POSES.categories,       pose_cat)

        cs = _clamp_strength(character_strength, CHARACTER_STRENGTH_MIN, CHARACTER_STRENGTH_MAX, CHARACTER_STRENGTH_DEFAULT)
        es = _clamp_strength(expression_strength, SUB_STRENGTH_MIN, SUB_STRENGTH_MAX, EXPRESSION_STRENGTH_DEFAULT)
        ps = _clamp_strength(pose_strength,      SUB_STRENGTH_MIN, SUB_STRENGTH_MAX, POSE_STRENGTH_DEFAULT)

        cw = _apply_weight(c_text, cs)
        ew = _apply_weight(e_text, es)
        pw = _apply_weight(p_text, ps)

        parts = [x for x in [cw, ew, pw] if x]
        full = delimiter.join(parts) if parts else ""

        debug = f"C:{c_key or 'None'} | E:{e_key or 'None'} | P:{p_key or 'None'} | Seed:{seed if seed else 'auto'}"

        return (full, cw, ew, pw, debug)


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/char_boss/data")
    async def get_char_data(request):
        try:
            _load_all()
            char_flat, char_cats = _collection_payload(_CHARACTERS.items, _CHARACTERS.categories)
            pose_flat, pose_cats = _collection_payload(_POSES.items, _POSES.categories)
            exp_flat,  exp_cats  = _collection_payload(_EXPRESSIONS.items, _EXPRESSIONS.categories)
            return web.json_response({
                "characters": char_flat,
                "poses": pose_flat,
                "expressions": exp_flat,
                "characterCategories": char_cats,
                "poseCategories": pose_cats,
                "expressionCategories": exp_cats,
                "delimiterDefault": DELIMITER_DEFAULT,
                "strengthRange": {
                    "character": {"min": CHARACTER_STRENGTH_MIN, "max": CHARACTER_STRENGTH_MAX, "step": STRENGTH_STEP,
                                  "default": CHARACTER_STRENGTH_DEFAULT},
                    "sub":       {"min": SUB_STRENGTH_MIN,       "max": SUB_STRENGTH_MAX,       "step": STRENGTH_STEP,
                                  "defaults": {"expression": EXPRESSION_STRENGTH_DEFAULT, "pose": POSE_STRENGTH_DEFAULT}},
                },
                "randomSentinels": {
                    "character":  RANDOM_CHARACTER,
                    "expression": RANDOM_EXPRESSION,
                    "pose":       RANDOM_POSE,
                },
                "noneSentinel": NONE_SENTINEL,
                "allCategories": ALL_CATEGORIES,
            })
        except Exception as e:
            _log(f"/char_boss/data failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/char_boss/refresh")
    async def refresh_char_data(request):
        try:
            _load_all(force=True)
            return web.json_response({
                "characters": len(_CHARACTERS.items),
                "poses": len(_POSES.items),
                "expressions": len(_EXPRESSIONS.items),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ───────────────────────────────────────────────────
# Mapping key is intentionally preserved as "UltimateCharacterBuilderPRO" so
# existing workflows that reference this node keep loading unchanged.

NODE_CLASS_MAPPINGS = {
    "UltimateCharacterBuilderPRO": UltimateCharacterBuilderPRO,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "UltimateCharacterBuilderPRO": "Ultimate Character Builder Pro Boss",
}

__all__ = [
    "UltimateCharacterBuilderPRO",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

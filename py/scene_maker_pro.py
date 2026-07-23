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
import re
from pathlib import Path

from utils.constants import SEED_MAX, ALL_CATEGORIES, DELIMITER_DEFAULT
from utils.prompt_utils import apply_weight, clamp_strength
from utils.logging_utils import make_logger
from utils.json_utils import sanitize_entries, sanitize_categories
from utils.cache_utils import Collection

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent

# Sentinel values for the per-collection combos.
RANDOM_SENTINEL = "Random"
NONE_SENTINEL = "None"

# Strength bounds (shared by Python + JS) — match v4.0 ranges exactly.
# scene_maker uses 2.5 max (higher than the common 2.0 default).
STRENGTH_MIN = 0.0
STRENGTH_MAX = 2.5
STRENGTH_STEP = 0.05


# ── Per-collection library cache ───────────────────────────────────────────

_GIRLS = Collection("girls.json", "girls", "SceneMakerPro")
_MALES = Collection("males.json", "males", "SceneMakerPro")
_SCENES = Collection("scenes.json", "scenes", "SceneMakerPro")


_log = make_logger("SceneMakerPro")



def _load_all(force: bool = False) -> None:
    _GIRLS.load(force)
    _MALES.load(force)
    _SCENES.load(force)


# ── Wildcard resolution ──────────────────────────────────────────────────────
# Re-exported from shared utils. _RESERVED_PLACEHOLDERS kept here since
# it's specific to scene_maker's {girl}/{male} substitution system.
from utils.prompt_utils import resolve_wildcards  # noqa: F401

# {girl}/{girls}/{male}/{males} are scene placeholders, not wildcard groups -
# they must survive resolve_wildcards untouched so _substitute_placeholders
# can still find them afterward.
_RESERVED_PLACEHOLDERS = {"girl", "girls", "male", "males"}


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

        # Resolve {a|b|c} wildcard groups embedded in each fragment. Shares
        # `rng` with the pool-selection above, so a fixed seed reproduces
        # the girl/male/scene choice AND every wildcard pick, in one
        # deterministic sequence. {girl}/{male}/etc. placeholders in
        # scene_text are protected and pass through untouched.
        girl_text = resolve_wildcards(girl_text, rng, reserved=_RESERVED_PLACEHOLDERS)
        male_text = resolve_wildcards(male_text, rng, reserved=_RESERVED_PLACEHOLDERS)
        scene_text = resolve_wildcards(scene_text, rng, reserved=_RESERVED_PLACEHOLDERS)

        girl_w = clamp_strength(girl_w, STRENGTH_MIN, STRENGTH_MAX, 1.0)
        male_w = clamp_strength(male_w, STRENGTH_MIN, STRENGTH_MAX, 1.0)
        scene_w = clamp_strength(scene_w, STRENGTH_MIN, STRENGTH_MAX, 1.0)

        # Weight-then-substitute (user decision: weight before substitute).
        weighted_girl = apply_weight(girl_text, girl_w)
        weighted_male = apply_weight(male_text, male_w)
        weighted_scene = apply_weight(scene_text, scene_w)
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

    @routes.post("/scene_boss/save")
    async def save_scene_data(request):
        """Write a single collection (girls/males/scenes) back to disk."""
        import traceback
        try:
            body = await request.json()
            lib_type = body.get("type")  # "girls", "males", or "scenes"
            items = body.get("items", {})
            categories = body.get("categories", {})

            coll_map = {"girls": _GIRLS, "males": _MALES, "scenes": _SCENES}
            coll = coll_map.get(lib_type)
            if coll is None:
                return web.json_response(
                    {"error": f"Unknown type: {lib_type}"}, status=400,
                )

            coll.items = items
            coll.categories = categories
            coll.save()
            return web.json_response({
                "ok": True,
                "type": lib_type,
                "count": len(items),
            })
        except Exception as e:
            tb = traceback.format_exc()
            print(f"[SceneMakerPro] save error: {e}\n{tb}")
            return web.json_response({"error": str(e)}, status=500)


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
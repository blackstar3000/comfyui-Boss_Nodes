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

import aiohttp
import ipaddress
import json
import os
import random
import socket
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from utils.constants import SEED_MAX, ALL_CATEGORIES, DELIMITER_DEFAULT
from utils.prompt_utils import apply_weight, clamp_strength
from utils.logging_utils import make_logger
from utils.json_utils import sanitize_entries, sanitize_categories
from utils.cache_utils import Collection

# ── Proxy SSRF protection ───────────────────────────────────────────────────
_PROXY_MAX_BYTES = 5 * 1024 * 1024  # 5 MB max response

def _is_safe_proxy_url(url: str) -> str | None:
    """Return None if URL is safe to fetch, else an error reason string."""
    try:
        parsed = urlparse(url)
    except Exception:
        return "Malformed URL"
    if parsed.hostname is None:
        return "No hostname"
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
        for family, _, _, _, sockaddr in infos:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return f"Blocked internal address: {ip}"
    except (socket.gaierror, ValueError):
        pass
    return None

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


# ── Per-collection library cache ───────────────────────────────────────────

_CHARACTERS  = Collection("characters.json",  "characters", "UltimateCharacterBuilderPro")
_POSES       = Collection("poses.json",        "poses", "UltimateCharacterBuilderPro")
_EXPRESSIONS = Collection("expressions.json",  "expressions", "UltimateCharacterBuilderPro")

_CHAR_PREVIEWS = {}
def _load_char_previews():
    global _CHAR_PREVIEWS
    p = os.path.join(os.path.dirname(__file__), "character_previews.json")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            _CHAR_PREVIEWS = json.load(f)
    else:
        _CHAR_PREVIEWS = {}

_load_char_previews()

_log = make_logger("UltimateCharacterBuilderPro")



def _load_all(force: bool = False) -> None:
    _CHARACTERS.load(force)
    _POSES.load(force)
    _EXPRESSIONS.load(force)


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

        cs = clamp_strength(character_strength, CHARACTER_STRENGTH_MIN, CHARACTER_STRENGTH_MAX, CHARACTER_STRENGTH_DEFAULT)
        es = clamp_strength(expression_strength, SUB_STRENGTH_MIN, SUB_STRENGTH_MAX, EXPRESSION_STRENGTH_DEFAULT)
        ps = clamp_strength(pose_strength,      SUB_STRENGTH_MIN, SUB_STRENGTH_MAX, POSE_STRENGTH_DEFAULT)

        cw = apply_weight(c_text, cs)
        ew = apply_weight(e_text, es)
        pw = apply_weight(p_text, ps)

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
                "character_previews": _CHAR_PREVIEWS,
            })
        except Exception as e:
            _log(f"/char_boss/data failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/char_boss/refresh")
    async def refresh_char_data(request):
        try:
            _load_all(force=True)
            _load_char_previews()
            return web.json_response({
                "characters": len(_CHARACTERS.items),
                "poses": len(_POSES.items),
                "expressions": len(_EXPRESSIONS.items),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/char_boss/save")
    async def save_char_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            name = body.get("name", "").strip()
            prompt = body.get("prompt", "").strip()
            categories = body.get("categories", [])
            custom_preview = body.get("custom_preview", "").strip()

            if lib_type not in ("characters", "expressions", "poses"):
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            if not prompt:
                return web.json_response({"error": "Prompt required"}, status=400)

            coll_map = {
                "characters": _CHARACTERS,
                "expressions": _EXPRESSIONS,
                "poses": _POSES,
            }
            coll = coll_map[lib_type]

            existing = coll.items.get(name)
            is_new = existing is None

            if is_new:
                entry = {"prompt": prompt, "custom_preview": custom_preview}
            else:
                old_preview = ""
                if isinstance(existing, dict):
                    old_preview = existing.get("custom_preview", "")
                entry = {
                    "prompt": prompt,
                    "custom_preview": custom_preview or old_preview,
                }

            coll.items[name] = entry

            if categories:
                for cat, members in coll.categories.items():
                    if cat == "All":
                        continue
                    if name not in members:
                        members.append(name)

            coll.save()

            return web.json_response({
                "name": name,
                "prompt": prompt,
                "categories": categories,
                "custom_preview": entry.get("custom_preview", ""),
                "is_new": is_new,
            })
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/char_boss/delete")
    async def delete_char_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            name = body.get("name", "").strip()

            if lib_type not in ("characters", "expressions", "poses"):
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)

            coll_map = {
                "characters": _CHARACTERS,
                "expressions": _EXPRESSIONS,
                "poses": _POSES,
            }
            coll = coll_map[lib_type]

            if name not in coll.items:
                return web.json_response({"error": "Entry not found"}, status=404)

            del coll.items[name]

            for cat, members in coll.categories.items():
                if name in members:
                    members.remove(name)

            coll.save()

            return web.json_response({"name": name, "deleted": True})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.get("/char_boss/proxy_image")
    async def proxy_image(request):
        url = request.query.get("url", "").strip()
        if not url or not url.startswith(("http://", "https://")):
            return web.json_response({"error": "Invalid URL"}, status=400)
        block_reason = _is_safe_proxy_url(url)
        if block_reason:
            return web.json_response({"error": block_reason}, status=400)
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; BossNodes/1.0)",
                "Referer": "https://danbooru.donmai.us/",
            }
            timeout = aiohttp.ClientTimeout(total=10)
            conn = aiohttp.TCPConnector(ssl=False)
            async with aiohttp.ClientSession(connector=conn) as session:
                async with session.get(
                    url, headers=headers, timeout=timeout,
                    max_redirects=3, allow_redirects=True,
                ) as resp:
                    if resp.status != 200:
                        return web.json_response({"error": f"Upstream {resp.status}"}, status=502)
                    data = await resp.read()
                    if len(data) > _PROXY_MAX_BYTES:
                        return web.json_response({"error": "Response too large"}, status=502)
                    content_type = resp.content_type or "image/jpeg"
                    return web.Response(body=data, content_type=content_type)
        except Exception:
            return web.json_response({"error": "Proxy fetch failed"}, status=502)


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

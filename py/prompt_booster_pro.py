"""Prompt Booster PRO Boss — merge of `prompt_quality_booster.py` (positive
quality levels) and `negative_quality_booster.py` (negative preset/level
libraries) into one node that emits both weighted prompt fragments.

Mirrors the Pixaroma "stateful UI" pattern (comfyui-pixaroma/nodes/node_seed.py)
shared by the other seven Boss Nodes rebuilds:
- One hidden `BoosterState` STRING input carries all editor settings.
- `IS_CHANGED` returns the serialized state so the cache invalidates
  only when state actually changes.
- All interactive UI lives in `js/prompt_booster_pro/index.js`.
- Two libraries load from `quality_boosts.json` (flat) and
  `negative_boosts.json` (nested `preset -> level -> text`) with
  mtime-based hot reload. On any missing file: warn and leave that
  collection empty (no auto-creation — matches `scene_maker_pro` /
  `prompt_master_library_pro`).
- Four weight formats copied verbatim from
  `py/prompt_master_library_pro.py:_apply_weight`.
"""

import json
import os
import random
from datetime import datetime
from pathlib import Path

from utils.constants import STRENGTH_MIN, STRENGTH_MAX, STRENGTH_DEFAULT, STRENGTH_STEP, WEIGHT_FORMAT_KEYS, WEIGHT_FORMAT_LABELS, WEIGHT_FORMAT_DEFAULT
from utils.prompt_utils import apply_weight
from utils.logging_utils import make_logger
from utils.json_utils import sanitize_entries
from utils.cache_utils import Collection

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent

QUALITY_FILE   = BASE_DIR / "quality_boosts.json"
NEGATIVES_FILE = BASE_DIR / "negative_boosts.json"

# ── Defaults for the editor (Python + JS) ──────────────────────────────────
POSITIVE_LEVEL_DEFAULT  = "god tier"
NEGATIVE_PRESET_DEFAULT = "nsfw beast"
NEGATIVE_LEVEL_DEFAULT  = "hardcore"


# ── Per-collection library cache ───────────────────────────────────────────

class _Collection(Collection):
    """One library (quality / negatives) with hot reload."""

    def __init__(self, filename: str, kind: str):
        super().__init__(filename, kind, "PromptBoosterPro")
        self.kind = kind  # 'quality' or 'negatives'
        self.levels: list[str] = []  # negatives only — union of all level names across presets

    def _process_data(self, data: dict) -> bool:
        """Process loaded JSON data for quality or negatives."""
        if self.kind == "quality":
            if not isinstance(data, dict):
                self._log(f"{self.filename} root is not an object — skipping.")
                return False
            self.items = _sanitize_quality(data, self.filename)
            self.levels = []  # quality has no levels
        else:  # negatives
            items = _sanitize_negatives(data, self.filename)
            self.items = items
            # Compute the union of all level names so the native combo can
            # accept any value the JS sends (matches camera_style_mixer's
            # approach for cross-collection combos).
            all_levels: set[str] = set()
            for lvls in items.values():
                all_levels.update(lvls.keys())
            self.levels = sorted(all_levels)
        return True

    def load(self, force: bool = False) -> "_Collection":
        """Hot-reload the collection's JSON file."""
        super().load(force)
        if self.kind == "quality":
            self._log(f"Loaded {self.filename}: {len(self.items)} levels")
        else:
            total = sum(len(v) for v in self.items.values())
            self._log(f"Loaded {self.filename}: {len(self.items)} presets / {total} levels")
        return self


_QUALITY   = _Collection("quality_boosts.json",  "quality")
_NEGATIVES = _Collection("negative_boosts.json",  "negatives")


_log = make_logger("PromptBoosterPro")


def _sanitize_quality(raw: dict, filename: str) -> dict[str, str]:
    """Keep only entries with non-empty string values."""
    clean: dict[str, str] = {}
    for k, v in raw.items():
        if isinstance(v, str) and v.strip():
            clean[k] = v.strip()
        else:
            _log(f"  Skipped quality entry '{k}': expected non-empty string, got {type(v).__name__}")
    return clean


def _sanitize_negatives(raw, filename: str) -> dict[str, dict[str, str]]:
    """Normalize the negative library to `{preset: {level: text}}`. Accept
    list-of-strings (flattened to one default preset) and flat dicts too."""
    if isinstance(raw, list):
        raw = {"default": {f"level_{i+1}": item for i, item in enumerate(raw)
                            if isinstance(item, str) and item.strip()}}
    if not isinstance(raw, dict):
        _log(f"  {filename} root is not an object — skipping")
        return {}
    clean: dict[str, dict[str, str]] = {}
    for preset, levels in raw.items():
        if not isinstance(levels, dict):
            _log(f"  Negative preset '{preset}' skipped: expected object of levels")
            continue
        valid = {k: v.strip() for k, v in levels.items() if isinstance(v, str) and v.strip()}
        if not valid:
            continue
        clean[preset] = valid
    return clean


def _load_all(force: bool = False) -> None:
    _QUALITY.load(force)
    _NEGATIVES.load(force)


# ── Weight + data helpers ──────────────────────────────────────────────────

def _resolve_positive(level: str, custom: str) -> str:
    """Positive: custom override wins, else look up the level."""
    if custom and custom.strip():
        return custom.strip()
    return _QUALITY.items.get(level, "")


def _resolve_negative(preset: str, level: str, custom: str) -> str:
    """Negative: preset/level lookup, then append custom if non-empty."""
    base = _NEGATIVES.items.get(preset, {}).get(level, "")
    extra = custom.strip() if custom else ""
    if base and extra:
        return f"{base}, {extra}"
    return base or extra


# ── HTTP API payload helper ────────────────────────────────────────────────

def _data_payload() -> dict:
    """Shape the libraries + format registry for the JS editor's HTTP fetch."""
    presets = sorted(_NEGATIVES.items.keys())
    default_preset = NEGATIVE_PRESET_DEFAULT if NEGATIVE_PRESET_DEFAULT in presets else (presets[0] if presets else "")
    default_levels = sorted(_NEGATIVES.items.get(default_preset, {}).keys())
    default_level = NEGATIVE_LEVEL_DEFAULT if NEGATIVE_LEVEL_DEFAULT in default_levels else (default_levels[0] if default_levels else "")

    return {
        "quality":  _QUALITY.items,
        "negatives": _NEGATIVES.items,
        "qualityLevels": sorted(_QUALITY.items.keys()),
        "negativePresets": presets,
        "negativeLevelsUnion": _NEGATIVES.levels,   # for the native combo
        "positiveDefault": {
            "level":  POSITIVE_LEVEL_DEFAULT if POSITIVE_LEVEL_DEFAULT in _QUALITY.items else (sorted(_QUALITY.items.keys())[0] if _QUALITY.items else ""),
        },
        "negativeDefault": {"preset": default_preset, "level": default_level},
        "weightFormats": [{"key": k, "label": WEIGHT_FORMAT_LABELS[k]} for k in WEIGHT_FORMAT_KEYS],
        "weightFormatDefault": WEIGHT_FORMAT_DEFAULT,
        "strengthRange": {
            "min": STRENGTH_MIN, "max": STRENGTH_MAX, "step": STRENGTH_STEP,
            "default": STRENGTH_DEFAULT,
        },
    }


# ── Node class ──────────────────────────────────────────────────────────────

class PromptBoosterPRO:
    DESCRIPTION = (
        "Prompt Booster PRO Boss - merge of Quality Booster and Negative "
        "Booster. Pick a positive level + a negative preset/level, drag "
        "the strengths, optionally override with custom text on either "
        "side, choose a weight format (comfyui / parentheses / multiply / "
        "none), and read two weighted STRING outputs: positive_prompt and "
        "negative_prompt. Click Open Editor for the live preview."
    )

    @classmethod
    def INPUT_TYPES(cls):
        _load_all()

        quality_levels = sorted(_QUALITY.items.keys())
        default_quality = POSITIVE_LEVEL_DEFAULT if POSITIVE_LEVEL_DEFAULT in quality_levels else (quality_levels[0] if quality_levels else "")

        negative_presets = sorted(_NEGATIVES.items.keys())
        default_preset = NEGATIVE_PRESET_DEFAULT if NEGATIVE_PRESET_DEFAULT in negative_presets else (negative_presets[0] if negative_presets else "")
        # Use the union of all levels across presets so the native combo
        # accepts any value the JS sends. The JS modal only displays the
        # levels valid for the chosen preset, but the wire has to be
        # valid regardless of which preset is active.
        negative_levels_combo = _NEGATIVES.levels
        default_levels_for_preset = sorted(_NEGATIVES.items.get(default_preset, {}).keys())
        default_level = NEGATIVE_LEVEL_DEFAULT if NEGATIVE_LEVEL_DEFAULT in default_levels_for_preset else (default_levels_for_preset[0] if default_levels_for_preset else (negative_levels_combo[0] if negative_levels_combo else ""))

        return {
            "required": {
                "enable": ("BOOLEAN", {
                    "default": True,
                    "label_on": "⚡ ON", "label_off": "⛔ OFF",
                    "tooltip": "Master switch. When off, both outputs are empty.",
                }),
                "positive_level": (quality_levels, {
                    "default": default_quality,
                    "tooltip": "Quality level preset. Overridden by positive_custom when non-empty.",
                }),
                "positive_strength": ("FLOAT", {
                    "default": STRENGTH_DEFAULT,
                    "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                    "step": STRENGTH_STEP,
                    "tooltip": "Attention weight for the positive fragment. 1.0 = no change.",
                }),
                "negative_preset": (negative_presets, {
                    "default": default_preset,
                    "tooltip": "Negative preset (group of related levels).",
                }),
                "negative_level": (negative_levels_combo, {
                    "default": default_level,
                    "tooltip": "Negative level within the chosen preset. The JS editor only shows levels valid for the active preset; the wire accepts any of them.",
                }),
                "negative_strength": ("FLOAT", {
                    "default": STRENGTH_DEFAULT,
                    "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                    "step": STRENGTH_STEP,
                    "tooltip": "Attention weight for the negative fragment. 1.0 = no change.",
                }),
                "weight_format": (WEIGHT_FORMAT_KEYS, {
                    "default": WEIGHT_FORMAT_DEFAULT,
                    "tooltip": "How to apply the strength value: comfyui, parentheses, multiply, or none.",
                }),
            },
            "optional": {
                "positive_custom": ("STRING", {
                    "multiline": True, "default": "",
                    "placeholder": "Override positive prompt. When non-empty, replaces positive_level.",
                    "tooltip": "Custom positive prompt. When non-empty, replaces the positive_level lookup.",
                }),
                "negative_custom": ("STRING", {
                    "multiline": True, "default": "",
                    "placeholder": "Extra negatives appended after the preset/level base.",
                    "tooltip": "Extra negatives appended after the negative preset/level base.",
                }),
            },
            "hidden": {
                # Full editor state — mirrors SceneState from scene_maker_pro.
                "BoosterState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive_prompt", "negative_prompt")
    OUTPUT_TOOLTIPS = (
        "Weighted positive prompt.",
        "Weighted negative prompt (preset/level base + custom append).",
    )
    FUNCTION = "boost"
    CATEGORY = "🌟 Pro Tools/Prompting"

    @classmethod
    def IS_CHANGED(cls, BoosterState: str, **kwargs):
        return BoosterState

    def boost(self, enable=True,
              positive_level="", positive_strength=STRENGTH_DEFAULT,
              negative_preset="", negative_level="", negative_strength=STRENGTH_DEFAULT,
              weight_format=WEIGHT_FORMAT_DEFAULT,
              positive_custom="", negative_custom="",
              BoosterState="{}"):

        if not enable:
            return ("", "")

        pos_text = _resolve_positive(positive_level, positive_custom)
        neg_text = _resolve_negative(negative_preset, negative_level, negative_custom)

        pos_final = apply_weight(pos_text, float(positive_strength), weight_format)
        neg_final = apply_weight(neg_text, float(negative_strength), weight_format)

        return (pos_final, neg_final)


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/prompt_booster_pro/data")
    async def get_booster_data(request):
        try:
            _load_all()
            return web.json_response(_data_payload())
        except Exception as e:
            _log(f"/prompt_booster_pro/data failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/prompt_booster_pro/refresh")
    async def refresh_booster_data(request):
        try:
            _load_all(force=True)
            return web.json_response({
                "quality":  len(_QUALITY.items),
                "negatives": len(_NEGATIVES.items),
                "negativeLevelsUnion": len(_NEGATIVES.levels),
            })
        except Exception as e:
            _log(f"/prompt_booster_pro/refresh failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ───────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "PromptBoosterPRO": PromptBoosterPRO,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptBoosterPRO": "⚡ Prompt Booster PRO",
}

__all__ = [
    "PromptBoosterPRO",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

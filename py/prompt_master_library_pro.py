"""Prompt Master Library Pro Boss — pick a light + theme + style from three
categorized libraries, weight any of the four formats, save/load favorites,
auto-derive a style-aware negative prompt.

Mirrors the rebuilt `py/camera_style_mixer.py` + `py/scene_maker_pro.py` and
the Pixaroma "stateful UI" pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `MasterState` STRING input carries the editor settings so the
  modal can read/write them through one channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only
  when state actually changes.
- All interactive UI lives in `js/prompt_master_library_pro/index.js`.
- The libraries load from `lights.json` / `themes.json` / `styles.json` with
  mtime-based hot reload.
- Favorites live in `PromptMaster_favorites.json` and are read with
  backwards-compat for the v3.0 flat-key schema.
"""

import json
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Any

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent

LIGHTS_FILE    = BASE_DIR / "lights.json"
THEMES_FILE    = BASE_DIR / "themes.json"
STYLES_FILE    = BASE_DIR / "styles.json"
FAVORITES_FILE = BASE_DIR / "PromptMaster_favorites.json"

# ── Sentinel values for the per-collection combos ──────────────────────────
RANDOM_LIGHT = "__RANDOM_LIGHT__"
RANDOM_THEME = "__RANDOM_THEME__"
RANDOM_STYLE = "__RANDOM_STYLE__"
NONE_SENTINEL = "__NONE__"

# ── Weight format registry ──────────────────────────────────────────────────
WEIGHT_FORMAT_KEYS = ["comfyui", "parentheses", "multiply", "none"]
WEIGHT_FORMAT_LABELS = {
    "comfyui":     "(text:1.30) — ComfyUI / A1111 standard",
    "parentheses": "((text))    — Stacked parentheses",
    "multiply":    "text * 1.30 — Multiply style",
    "none":        "none        — No weighting",
}
WEIGHT_FORMAT_DEFAULT = "comfyui"

# ── Strength bounds (shared by Python + JS) ────────────────────────────────
STRENGTH_MIN = 0.0
STRENGTH_MAX = 2.0
STRENGTH_DEFAULT = 1.0
STRENGTH_STEP = 0.05

SEED_MAX = 0xFFFFFFFFFFFFFFFF  # match ComfyUI's seed widget bound
SEPARATOR_DEFAULT = ", "
NEWLINES_DEFAULT = False

NEGATIVE_STRENGTH_DEFAULT = 1.0
NEGATIVE_TEXT_DEFAULT = ""

# Favorites default name for the wire-compatible widget.
FAVORITE_NAME_DEFAULT = "My Combo"

# Names that should never appear in the favorites list. These are
# values that leak in from stale v3.0 workflow saves (a `load_favorite`
# boolean literal like True/False) or from a default `favorite_name`
# widget value that got wired into the name field. Filter them on read.
_JUNK_FAVORITE_NAMES = frozenset({
    "", "my combo", "true", "false", "none", "random",
    "random light", "random theme", "random style",
})


def _is_junk_favorite_name(name) -> bool:
    """True when a favorite `name` is clearly a stale/default value
    leaked from a v3.0 wire rather than something the user typed."""
    if not isinstance(name, str):
        return True
    stripped = name.strip()
    if not stripped:
        return True
    if stripped.lower() in _JUNK_FAVORITE_NAMES:
        return True
    # Pure-numeric (e.g. "1.2", "1.0") — these come from a strength
    # widget getting written into the name slot by stale wires.
    try:
        float(stripped)
        return True
    except (TypeError, ValueError):
        pass
    return False


# ── Library cache ───────────────────────────────────────────────────────────

class _LibraryState:
    """Parsed + validated library data with mtime tracking. Mirrors the
    other four rebuilt nodes."""


def _log(msg: str) -> None:
    print(f"[PromptMasterLibraryPro] {msg}")


# — Sanitization helpers (kept from v3.0 to preserve flat-or-categorized
# compatibility) —

def _sanitize_library(raw: Any, filename: str) -> dict[str, dict[str, str]]:
    """Normalize a loaded JSON library into `{category: {name: text}}`.
    Handles both flat dicts (`{name: text}`) and categorized (`{cat: {name: text}}`)
    shapes. Warns on bad entries."""
    if not isinstance(raw, dict):
        _log(f"{filename}: root must be a dict, got {type(raw).__name__}")
        return {}

    is_categorized = any(isinstance(v, dict) for v in raw.values())

    if not is_categorized:
        flat: dict[str, str] = {}
        for k, v in raw.items():
            if isinstance(v, str) and v.strip():
                flat[k] = v.strip()
            else:
                _log(f"  {filename}: skipping flat entry '{k}' — not a string")
        return {"Uncategorized": flat} if flat else {}

    result: dict[str, dict[str, str]] = {}
    for cat, items in raw.items():
        if not isinstance(items, dict):
            _log(f"  {filename}: category '{cat}' is not a dict — skipped")
            continue
        clean: dict[str, str] = {}
        for name, text in items.items():
            if isinstance(text, str) and text.strip():
                clean[name] = text.strip()
            else:
                _log(f"  {filename}: '{cat}/{name}' skipped — not a non-empty string")
        if clean:
            result[cat] = clean
    return result


def _fallback(key: str) -> dict[str, dict[str, str]]:
    """Tiny safety net if a JSON file is missing or broken."""
    defaults = {
        "lights": {"Natural": {"Golden Hour": "golden hour lighting, warm sunlight, long shadows"}},
        "themes": {"Fantasy":  {"High Fantasy": "epic fantasy setting, magical atmosphere"}},
        "styles": {"Digital":  {"Concept Art":  "concept art, matte painting, professional illustration"}},
    }
    return defaults.get(key, {"Uncategorized": {"Default": ""}})


# — Per-library state with mtime tracking —

_LIBS: dict[str, _LibraryState] = {}
_MTIMES: dict[str, float] = {}

_FILES = {
    "lights": LIGHTS_FILE,
    "themes": THEMES_FILE,
    "styles": STYLES_FILE,
}


def _load_library(key: str, force: bool = False) -> dict[str, dict[str, str]]:
    """Hot-reload one library JSON. Returns the cached dict."""
    filename = _FILES[key].name
    path = _FILES[key]

    if not force and key in _LIBS and _LIBS[key]:
        try:
            if os.path.getmtime(path) == _MTIMES.get(key, 0.0):
                return _LIBS[key]
        except OSError:
            pass

    if not path.exists():
        _log(f"{filename} not found — using built-in fallback for {key}.")
        if key not in _LIBS or not _LIBS[key]:
            _LIBS[key] = _fallback(key)
        return _LIBS[key]

    try:
        mtime = os.path.getmtime(path)
    except OSError as e:
        _log(f"Cannot stat {filename}: {e}")
        return _LIBS.get(key) or _fallback(key)

    try:
        with path.open("r", encoding="utf-8") as f:
            raw = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"Error reading {filename}: {e}")
        return _LIBS.get(key) or _fallback(key)

    data = _sanitize_library(raw, filename)
    if not data:
        _log(f"{filename} produced no usable entries — using fallback.")
        data = _fallback(key)

    _LIBS[key] = data
    _MTIMES[key] = mtime
    _log(f"Loaded {filename}: {sum(len(v) for v in data.values())} entries across {len(data)} categories")
    return data


def _load_all(force: bool = False) -> None:
    _load_library("lights", force)
    _load_library("themes", force)
    _load_library("styles", force)


def _library_payload(key: str) -> tuple[dict, list[str]]:
    """Return (flat_items, sorted_category_names). Edges out the editor."""
    data = _load_library(key)
    flat: dict[str, str] = {}
    for cat in sorted(data):
        for name in sorted(data[cat]):
            flat[f"{cat} → {name}"] = data[cat][name]
    return flat, sorted(data.keys())


# ── Resolved selection value object (kept from v3.0) ───────────────────────

class _Selection:
    """Holds a resolved category/name pair and the raw prompt text."""
    __slots__ = ("category", "name", "text", "is_random")

    def __init__(self, category: str, name: str, text: str, is_random: bool = False):
        self.category = category
        self.name = name
        self.text = text
        self.is_random = is_random

    @property
    def display_name(self) -> str:
        suffix = " (random)" if self.is_random else ""
        if self.name:
            return f"{self.category} → {self.name}{suffix}"
        return "—"

    @classmethod
    def empty(cls) -> "_Selection":
        return cls("", "", "")


# ── Apply weight (4 formats) ────────────────────────────────────────────────

def _apply_weight(text: str, strength: float, fmt: str) -> str:
    """Apply attention weighting to prompt text. Returns '' if text is empty."""
    if not text or (strength is None) or strength < 0.01:
        return ""
    s = float(strength)

    if fmt == "none":
        return text
    if fmt == "comfyui":
        return text if abs(s - 1.0) < 1e-4 else f"({text}:{s:.2f})"
    if fmt == "parentheses":
        if abs(s - 1.0) < 1e-4:
            return text
        layers = max(1, min(5, int(round(abs(s - 1.0) / 0.1))))
        if s > 1.0:
            return "(" * layers + text + ")" * layers
        return "[" * layers + text + "]" * layers
    if fmt == "multiply":
        return f"{text} * {s:.2f}"
    return text  # Unknown format — pass through


# ── Resolve selection ──────────────────────────────────────────────────────

def _resolve(
    rng: random.Random,
    choice: str,
    data: dict[str, dict[str, str]],
    label: str,
) -> _Selection:
    """Convert a dropdown value to a _Selection. Handles random sentinels
    (per-library), none sentinel, and 'Cat → Name' strings."""
    if choice == NONE_SENTINEL:
        return _Selection.empty()

    if choice.startswith("__RANDOM_"):
        pool = [
            (cat, name)
            for cat, items in data.items()
            for name in items
        ]
        if not pool:
            _log(f"Empty pool for {label} random — skipping.")
            return _Selection.empty()
        cat, name = rng.choice(pool)
        return _Selection(cat, name, data[cat][name], is_random=True)

    if " → " in choice:
        cat, name = choice.split(" → ", 1)
        if cat in data and name in data[cat]:
            return _Selection(cat, name, data[cat][name])
        _log(f"'{choice}' not found in {label} library — skipping.")
        return _Selection.empty()

    _log(f"Unrecognized {label} choice format: '{choice}'")
    return _Selection.empty()


# ── Auto-negative generation (kept from v3.0) ──────────────────────────────

_NEGATIVE_RULES: list[tuple[list[str], str]] = [
    (["anime", "manga", "kawaii", "pixel art", "retro game", "retro arcade"],
     "realistic, photography, photorealistic, 3d render, deformed, low contrast"),
    (["photo", "cinematic", "film", "hdr", "glamour", "long exposure", "tilt shift"],
     "drawing, painting, cartoon, anime, sketch, illustration, low quality, blurry"),
    (["digital art", "concept art", "matte painting"],
     "photo, photography, realistic, photorealistic, ugly, deformed"),
    (["watercolor", "impressionist", "pointillism", "expressionist"],
     "photo, realistic, digital art, vector, sharp outlines, deformed, noisy"),
    (["pop art", "psychedelic", "graffiti"],
     "realistic, photorealistic, low contrast, muted colors, photo, deformed"),
    (["origami", "papercraft", "kirigami", "papercut", "paper mache"],
     "3d render, realistic, photo, textured noise, blur, deformed, painting"),
    (["pixel art", "lowpoly", "retro arcade", "retro game"],
     "smooth shading, realistic, high resolution, photo, 3d, blurry"),
    (["cyberpunk", "neonpunk", "vaporwave", "biomechanical", "sci fi", "futuristic"],
     "natural lighting, rustic, historical, low tech, deformed, painting"),
    (["line art", "minimalist", "monochrome", "silhouette"],
     "colorful, textured, realistic, photo, noise, blurry, complex background"),
    (["stained glass", "zentangle", "typography"],
     "photo, realistic, 3d, deformed, blurry, noisy"),
    (["steampunk", "gothic", "horror", "macabre", "lovecraftian"],
     "bright colors, cartoon, kawaii, cute, deformed, low contrast"),
    (["comic book", "comic", "manga panel"],
     "realistic, photo, 3d render, deformed, blurry, low quality"),
]
_DEFAULT_NEGATIVE = "blurry, deformed, ugly, low quality, noise, artifact"


def _generate_auto_negative(sel: _Selection) -> str:
    """Generate a style-aware negative prompt from a resolved style selection."""
    if not sel.name:
        return ""
    s = f"{sel.category} {sel.name}".lower()
    for keywords, negative in _NEGATIVE_RULES:
        if any(k in s for k in keywords):
            return negative
    return _DEFAULT_NEGATIVE


# ── Favorites I/O (with backwards-compat for the v3.0 flat-key schema) ─────

def _read_favorites() -> list[dict]:
    """Read favorites from disk. Accepts both new (light_choice/...) and v3.0
    (light/theme/style flat strings + combined_prompt + timestamp) schema.
    Returns a normalized list. Returns [] when the file is missing."""
    if not FAVORITES_FILE.exists():
        return []
    try:
        with FAVORITES_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
    except (json.JSONDecodeError, OSError) as e:
        _log(f"Error reading favorites: {e}")
        return []

    out: list[dict] = []
    had_junk = False
    seen_names: set[str] = set()
    for entry in data:
        if not isinstance(entry, dict):
            had_junk = True
            continue
        name = entry.get("name", "")
        if _is_junk_favorite_name(name):
            had_junk = True
            continue
        # De-dup on name so the COMBO list never has the same name twice.
        if name in seen_names:
            had_junk = True
            continue
        seen_names.add(name)
        # New schema → use as-is (after falling back to defaults for missing keys).
        light = entry.get("light_choice") or entry.get("light") or RANDOM_LIGHT
        theme = entry.get("theme_choice") or entry.get("theme") or RANDOM_THEME
        style = entry.get("style_choice") or entry.get("style") or RANDOM_STYLE
        try:
            light_s = float(entry.get("light_strength", STRENGTH_DEFAULT))
            theme_s = float(entry.get("theme_strength", STRENGTH_DEFAULT))
            style_s = float(entry.get("style_strength", STRENGTH_DEFAULT))
        except (TypeError, ValueError):
            light_s = theme_s = style_s = STRENGTH_DEFAULT
        saved_at = entry.get("saved_at") or entry.get("timestamp") or None
        out.append({
            "name":           name,
            "light_choice":   light,
            "theme_choice":   theme,
            "style_choice":   style,
            "light_strength": light_s,
            "theme_strength": theme_s,
            "style_strength": style_s,
            "saved_at":       saved_at,
        })

    # One-time scrub: rewrite the disk file with junk names removed so
    # subsequent INPUT_TYPES calls don't keep surfacing stale entries.
    if had_junk:
        try:
            with FAVORITES_FILE.open("w", encoding="utf-8") as f:
                json.dump(out, f, indent=2, ensure_ascii=False)
            _log("Cleaned junk entries from PromptMaster_favorites.json")
        except OSError as e:
            _log(f"Failed to scrub favorites: {e}")
    return out


def _read_favorite_names() -> list[str]:
    return [f["name"] for f in _read_favorites()]


def _write_favorites(favs: list[dict]) -> None:
    """Persist favorites in the new normalized schema.

    Safety net: refuse to overwrite a non-empty existing file with an
    empty list — this guards against any future code path accidentally
    wiping the user's saved favorites.
    """
    if not favs:
        existing = _read_favorites()
        if existing:
            _log("Refusing to overwrite non-empty favorites file with []")
            return
    try:
        with FAVORITES_FILE.open("w", encoding="utf-8") as f:
            json.dump(favs, f, indent=2, ensure_ascii=False)
    except OSError as e:
        _log(f"Failed to write favorites: {e}")


def _add_favorite(name: str, light: str, theme: str, style: str,
                  light_s: float, theme_s: float, style_s: float) -> list[dict]:
    if _is_junk_favorite_name(name):
        _log(f"Refusing to save junk favorite name: {name!r}")
        return _read_favorites()
    favs = _read_favorites()
    favs = [f for f in favs if f.get("name") != name]
    favs.append({
        "name":           name,
        "light_choice":   light,
        "theme_choice":   theme,
        "style_choice":   style,
        "light_strength": float(light_s),
        "theme_strength": float(theme_s),
        "style_strength": float(style_s),
        "saved_at":       datetime.now().isoformat(),
    })
    _write_favorites(favs)
    return favs


def _delete_favorite(name: str) -> list[dict]:
    favs = _read_favorites()
    favs = [f for f in favs if f.get("name") != name]
    _write_favorites(favs)
    return favs


# ── Misc helpers ───────────────────────────────────────────────────────────

def _clamp_strength(s, fallback: float = STRENGTH_DEFAULT) -> float:
    try:
        v = float(s)
    except (TypeError, ValueError):
        return fallback
    return max(STRENGTH_MIN, min(STRENGTH_MAX, v))


def _bool(v) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes", "on")
    return False


# ── Node class ──────────────────────────────────────────────────────────────

class PromptMasterLibraryPro:
    DESCRIPTION = (
        "Prompt Master Library Pro Boss - pick a light + theme + style from "
        "three categorized libraries (lights.json 10 cats / themes.json 15 "
        "cats / styles.json 47 cats). Click Open Editor to choose each, drag "
        "each strength slider (0 = omit, 1.0 = normal, 1.3+ = bold), pick a "
        "weight format (ComfyUI / stacked parentheses / multiply / none), "
        "toggle newlines, edit the auto-negative strength + extra negatives, "
        "and pick a Random or Fixed seed. Save and load favorites from the "
        "in-editor Favorites panel.\n\n"
        "Returns 8 STRING outputs: combined (positive prompt), light_prompt, "
        "theme_prompt, style_prompt (each fragment alone, weighted), "
        "light_name, theme_name, style_name (resolved display name), and "
        "negative (auto-generated style-aware + your extra negatives, weighted)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        # Always load so the COMBO lists reflect the current JSON files
        # (force_refresh on the previous run already busted the cache).
        _load_all()

        lights, _ = _library_payload("lights")
        themes, _ = _library_payload("themes")
        styles, _ = _library_payload("styles")

        def entry_list(flat: dict, random_sentinel: str) -> list[str]:
            return [random_sentinel, NONE_SENTINEL] + sorted(flat.keys())

        return {
            "required": {
                "light":  (entry_list(lights, RANDOM_LIGHT),
                           {"default": RANDOM_LIGHT,
                            "tooltip": "Lighting preset. Random samples across all categories."}),
                "theme":  (entry_list(themes, RANDOM_THEME),
                           {"default": RANDOM_THEME,
                            "tooltip": "Scene/world theme preset."}),
                "style":  (entry_list(styles, RANDOM_STYLE),
                           {"default": RANDOM_STYLE,
                            "tooltip": "Art style or medium preset."}),
                "light_strength":  ("FLOAT", {
                    "default": STRENGTH_DEFAULT, "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Attention weight for the light fragment. 1.0 = no change.",
                }),
                "theme_strength":  ("FLOAT", {
                    "default": STRENGTH_DEFAULT, "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Attention weight for the theme fragment. 1.0 = no change.",
                }),
                "style_strength":  ("FLOAT", {
                    "default": STRENGTH_DEFAULT, "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Attention weight for the style fragment. 1.0 = no change.",
                }),
            },
            "optional": {
                "seed": ("INT", {
                    "default": -1, "min": -1, "max": SEED_MAX,
                    "tooltip": "-1 = random each run. 0 or higher = deterministic.",
                }),
                "separator": ("STRING", {
                    "default": SEPARATOR_DEFAULT, "multiline": False,
                    "tooltip": "String placed between prompt parts (ignored when newlines=True).",
                }),
                "newlines": ("BOOLEAN", {
                    "default": NEWLINES_DEFAULT,
                    "label_on": "Separate by newlines",
                    "label_off": "Separate by delimiter",
                    "tooltip": "ON = join parts with '\\n'. OFF = join with `separator`.",
                }),
                "weight_format": (WEIGHT_FORMAT_KEYS, {
                    "default": WEIGHT_FORMAT_DEFAULT,
                    "tooltip": "\n".join(f"{k}: {v}" for k, v in WEIGHT_FORMAT_LABELS.items()),
                }),
                "force_refresh": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Refresh", "label_off": "Cached",
                    "tooltip": "Reload lights.json / themes.json / styles.json from disk on the next run.",
                }),

                # Favorites are managed entirely through the in-editor panel +
                # the /master_boss/favorites HTTP routes. They are no longer
                # exposed as wire widgets because stale workflow saves of
                # those widgets (different shape than the editor's text input)
                # caused "Value not in list" errors when reloading old
                # workflows. The editor modal's Save/Delete/Load are the
                # only entry points.

                # Negative prompt — kept on the wire for the same reason.
                "negative_strength": ("FLOAT", {
                    "default": NEGATIVE_STRENGTH_DEFAULT, "min": STRENGTH_MIN, "max": STRENGTH_MAX,
                    "step": STRENGTH_STEP, "display": "slider",
                    "tooltip": "Weight applied to the auto-generated negative prompt.",
                }),
                "negative_text": ("STRING", {
                    "default": NEGATIVE_TEXT_DEFAULT, "multiline": True,
                    "placeholder": "Extra negatives: blurry, deformed, ugly...",
                    "tooltip": "Appended to the auto-generated negative. Can be left blank.",
                }),
            },
            "hidden": {
                # Mirrors CameraState / SceneState: full editor state.
                "MasterState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING",
                    "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("combined", "light_prompt", "theme_prompt", "style_prompt",
                    "light_name", "theme_name", "style_name", "negative")
    OUTPUT_TOOLTIPS = (
        "Light + Theme + Style joined by separator (or newlines).",
        "Light fragment, weighted by light_strength.",
        "Theme fragment, weighted by theme_strength.",
        "Style fragment, weighted by style_strength.",
        "Resolved light display name (or 'None' / 'Random').",
        "Resolved theme display name (or 'None' / 'Random').",
        "Resolved style display name (or 'None' / 'Random').",
        "Style-aware auto-negative + your extra negatives, weighted.",
    )
    FUNCTION = "go"
    CATEGORY = "👑 Boss Nodes/✨ Prompting"

    @classmethod
    def IS_CHANGED(cls, MasterState: str, **kwargs):
        # Re-execute whenever the JS-side state changes. Random mode writes
        # a fresh run-seed on the JS side via the graphToPrompt wrapper.
        return MasterState

    def go(self, light, theme, style,
           light_strength=STRENGTH_DEFAULT, theme_strength=STRENGTH_DEFAULT,
           style_strength=STRENGTH_DEFAULT,
           seed=-1, separator=SEPARATOR_DEFAULT, newlines=False,
           weight_format=WEIGHT_FORMAT_DEFAULT, show_preview=True,
           force_refresh=False, MasterState="{}",
           negative_strength=NEGATIVE_STRENGTH_DEFAULT,
           negative_text=NEGATIVE_TEXT_DEFAULT,
           **kwargs):
        # `show_preview` is intentionally kept in the wire signature for
        # backwards compatibility; the rebuild never uses it (preview moved
        # into the editor modal).
        del show_preview

        # Favorites are no longer exposed as wire widgets — those kwargs
        # (load_favorite, delete_favorite, favorite_name, save_to_favorites,
        # confirm_delete) used to leak in from stale v3.0 workflows and
        # trigger "Value not in list" errors at workflow load. The in-editor
        # Favorites panel is the only entry point. Ignore any leftovers.
        kwargs.pop("load_favorite", None)
        kwargs.pop("delete_favorite", None)
        kwargs.pop("favorite_name", None)
        kwargs.pop("save_to_favorites", None)
        kwargs.pop("confirm_delete", None)
        if kwargs:
            _log(f"Ignoring unknown wire kwargs: {sorted(kwargs.keys())}")

        if force_refresh:
            _load_all(force=True)
        lights = _LIBS.get("lights") or _load_library("lights")
        themes = _LIBS.get("themes") or _load_library("themes")
        styles = _LIBS.get("styles") or _load_library("styles")

        # Per-call RNG so a node can't disturb the global random state.
        rng = random.Random()
        try:
            s = int(seed)
        except (TypeError, ValueError):
            s = -1
        if s >= 0:
            rng.seed(s)
        else:
            rng.seed(int(datetime.now().timestamp() * 1e6))

        # Favorites are loaded + saved exclusively through the in-editor
        # modal / HTTP routes. The wire widgets that used to drive these
        # actions have been removed to avoid stale-workflow "Value not in
        # list" errors, so there is nothing to act on here at run time.

        # Resolve + weight.
        l_sel = _resolve(rng, light, lights, "light")
        t_sel = _resolve(rng, theme, themes, "theme")
        s_sel = _resolve(rng, style, styles, "style")

        light_strength  = _clamp_strength(light_strength)
        theme_strength  = _clamp_strength(theme_strength)
        style_strength  = _clamp_strength(style_strength)

        l_prompt = _apply_weight(l_sel.text, light_strength, weight_format)
        t_prompt = _apply_weight(t_sel.text, theme_strength, weight_format)
        s_prompt = _apply_weight(s_sel.text, style_strength, weight_format)

        parts = [p for p in [l_prompt, t_prompt, s_prompt] if p]
        join_str = "\n" if newlines else separator
        combined = join_str.join(parts) if parts else ""

        # Auto-negative.
        auto_neg = _generate_auto_negative(s_sel)
        extra_neg = (negative_text or "").strip()
        if auto_neg and extra_neg:
            raw_neg = f"{auto_neg}, {extra_neg}"
        elif auto_neg or extra_neg:
            raw_neg = auto_neg or extra_neg
        else:
            raw_neg = ""

        negative_strength = _clamp_strength(negative_strength)
        full_negative = _apply_weight(raw_neg, negative_strength, weight_format)

        # Favorites are saved through the in-editor Favorites panel
        # (HTTP-backed). The wire-level save widget was removed to
        # eliminate stale-workflow crashes; nothing to do here.

        return (
            combined,
            l_prompt, t_prompt, s_prompt,
            l_sel.display_name, t_sel.display_name, s_sel.display_name,
            full_negative or "",
        )


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/master_boss/data")
    async def get_master_data(request):
        try:
            _load_all()
            lights_flat, light_cats = _library_payload("lights")
            themes_flat, theme_cats = _library_payload("themes")
            styles_flat, style_cats = _library_payload("styles")
            return web.json_response({
                "lights": lights_flat, "themes": themes_flat, "styles": styles_flat,
                "lightCategories": light_cats,
                "themeCategories": theme_cats,
                "styleCategories": style_cats,
                "weightFormats": [
                    {"key": k, "label": WEIGHT_FORMAT_LABELS[k]}
                    for k in WEIGHT_FORMAT_KEYS
                ],
                "separatorDefault": SEPARATOR_DEFAULT,
                "newlinesDefault": NEWLINES_DEFAULT,
                "strengthRange": {"min": STRENGTH_MIN, "max": STRENGTH_MAX, "step": STRENGTH_STEP},
                "negativeDefaults": {"strength": NEGATIVE_STRENGTH_DEFAULT, "text": NEGATIVE_TEXT_DEFAULT},
                "favoriteCount": len(_read_favorites()),
                "randomSentinels": {
                    "light": RANDOM_LIGHT, "theme": RANDOM_THEME, "style": RANDOM_STYLE,
                },
                "noneSentinel": NONE_SENTINEL,
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.get("/master_boss/favorites")
    async def get_favorites(request):
        try:
            return web.json_response({"favorites": _read_favorites()})
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/master_boss/favorites/save")
    async def save_favorite(request):
        try:
            payload = await request.json()
            name = (payload.get("name") or "").strip()
            if not name:
                return web.json_response({"error": "Missing name"}, status=400)
            favs = _add_favorite(
                name,
                payload.get("light") or RANDOM_LIGHT,
                payload.get("theme") or RANDOM_THEME,
                payload.get("style") or RANDOM_STYLE,
                float(payload.get("light_strength", STRENGTH_DEFAULT)),
                float(payload.get("theme_strength", STRENGTH_DEFAULT)),
                float(payload.get("style_strength", STRENGTH_DEFAULT)),
            )
            return web.json_response({"favorites": favs})
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/master_boss/favorites/delete")
    async def delete_favorite(request):
        try:
            payload = await request.json()
            name = (payload.get("name") or "").strip()
            if not name:
                return web.json_response({"error": "Missing name"}, status=400)
            favs = _delete_favorite(name)
            return web.json_response({"favorites": favs})
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/master_boss/refresh")
    async def refresh_master_data(request):
        try:
            _load_all(force=True)
            return web.json_response({
                "lights": sum(len(v) for v in (_LIBS.get("lights") or {}).values()),
                "themes": sum(len(v) for v in (_LIBS.get("themes") or {}).values()),
                "styles": sum(len(v) for v in (_LIBS.get("styles") or {}).values()),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ───────────────────────────────────────────────────
# Mapping key is intentionally preserved as "PromptMasterLibraryPro" so
# existing workflows that reference this node keep loading unchanged.

NODE_CLASS_MAPPINGS = {
    "PromptMasterLibraryPro": PromptMasterLibraryPro,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptMasterLibraryPro": "Prompt Master Library Pro Boss",
}

__all__ = [
    "PromptMasterLibraryPro",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

"""Lens Library Pro Boss — pick a camera brand, body, and lens from lens.json,
choose an output mode, optionally add parsed focal/aperture/bokeh tags.

Mirrors the rebuilt `py/camera_style_mixer.py` and the Pixaroma "stateful UI"
pattern (comfyui-pixaroma/nodes/node_seed.py):
- One hidden `LensState` STRING input carries the editor settings so the
  modal can read/write them through one channel.
- `IS_CHANGED` returns the serialized state so the cache invalidates only
  when state actually changes.
- All interactive UI lives in `js/prompt_lens_library/index.js`.
- The library loads from `lens.json` with mtime-based hot reload.
"""

import json
import os
import random
import re
from datetime import datetime
from pathlib import Path
from typing import Any

# ── File paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
LENS_FILE = BASE_DIR / "lens.json"

# ── Mode registry ───────────────────────────────────────────────────────────
MODE_KEYS = [
    "manual select",
    "random full setup",
    "random lens only",
    "full phrase",
    "camera + lens",
    "lens only",
]
MODE_DEFAULT = "manual select"

MODE_TOOLTIPS = (
    "• manual select: Pick everything yourself\n"
    "• random full setup: Random brand + model + lens (outputs full phrase)\n"
    "• random lens only: Random lens only (outputs lens only)\n"
    "• full phrase: Long professional prompt\n"
    "• camera + lens: Short format\n"
    "• lens only: Just the lens + effects"
)

RANDOM_BRAND = "__RANDOM_BRAND__"
SEED_MAX = 0xFFFFFFFFFFFFFFFF


# ── Library cache ───────────────────────────────────────────────────────────

class _LensLibrary:
    """Parsed lens.json with mtime tracking."""

    def __init__(self):
        self.brands: list[str] = []
        self.models_by_brand: dict[str, list[str]] = {}
        self.lenses_by_brand: dict[str, list[str]] = {}
        self.raw: list[dict[str, Any]] = []
        self.mtime: float | None = None

    def is_empty(self) -> bool:
        return not self.raw


_LIB = _LensLibrary()


def _log(msg: str) -> None:
    print(f"[PromptLensLibraryPro] {msg}")


def _sanitize_brand_entry(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    brand = item.get("brand")
    if not isinstance(brand, str) or not brand.strip():
        return None
    models = item.get("popular_camera_models", [])
    lenses = item.get("popular_lenses", [])
    if not isinstance(models, list):
        models = []
    if not isinstance(lenses, list):
        lenses = []
    clean_models = sorted({m for m in models if isinstance(m, str) and m.strip()})
    clean_lenses = sorted({l for l in lenses if isinstance(l, str) and l.strip()})
    return {
        "brand": brand.strip(),
        "popular_camera_models": clean_models,
        "popular_lenses": clean_lenses,
    }


def _load_library(force: bool = False) -> _LensLibrary:
    """Hot-reload lens.json. Returns the populated `_LensLibrary`."""
    if not force and _LIB.mtime is not None and _LIB.raw:
        try:
            if os.path.getmtime(LENS_FILE) == _LIB.mtime:
                return _LIB
        except OSError:
            pass

    if not LENS_FILE.exists():
        _log(f"File not found: {LENS_FILE.name} — node will return an error prompt.")
        return _LIB

    try:
        mtime = os.path.getmtime(LENS_FILE)
    except OSError as e:
        _log(f"Cannot stat {LENS_FILE.name}: {e}")
        return _LIB

    try:
        with LENS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"Error reading {LENS_FILE.name}: {e}")
        return _LIB

    if not isinstance(data, list):
        _log(f"{LENS_FILE.name}: root must be a list, got {type(data).__name__}")
        return _LIB

    entries: list[dict[str, Any]] = []
    for item in data:
        clean = _sanitize_brand_entry(item)
        if clean:
            entries.append(clean)

    _LIB.raw = entries
    _LIB.brands = [e["brand"] for e in entries]
    _LIB.models_by_brand = {e["brand"]: e["popular_camera_models"] for e in entries}
    _LIB.lenses_by_brand = {e["brand"]: e["popular_lenses"] for e in entries}
    _LIB.mtime = mtime

    model_count = sum(len(v) for v in _LIB.models_by_brand.values())
    lens_count = sum(len(v) for v in _LIB.lenses_by_brand.values())
    _log(f"Loaded {LENS_FILE.name}: {len(_LIB.brands)} brands, {model_count} models, {lens_count} lenses")
    return _LIB


def _all_models(lib: _LensLibrary) -> list[str]:
    out: set[str] = set()
    for models in lib.models_by_brand.values():
        out.update(models)
    return sorted(out)


def _all_lenses(lib: _LensLibrary) -> list[str]:
    out: set[str] = set()
    for lenses in lib.lenses_by_brand.values():
        out.update(lenses)
    return sorted(out)


def _data_payload(lib: _LensLibrary) -> dict:
    brands = lib.brands or ["No Data"]
    default_brand = brands[0]
    default_models = lib.models_by_brand.get(default_brand, [])
    default_lenses = lib.lenses_by_brand.get(default_brand, [])
    return {
        "brands": brands,
        "modelsByBrand": lib.models_by_brand,
        "lensesByBrand": lib.lenses_by_brand,
        "modes": MODE_KEYS,
        "modeTooltips": MODE_TOOLTIPS,
        "defaults": {
            "mode": MODE_DEFAULT,
            "brand": default_brand,
            "cameraModel": default_models[0] if default_models else "Generic Camera",
            "lens": default_lenses[0] if default_lenses else "Generic Lens",
            "addFocalAperture": True,
        },
        "randomBrandSentinel": RANDOM_BRAND,
    }


# ── Focal / aperture parsing (kept from v1) ────────────────────────────────

def _parse_focal_aperture(lens: str) -> tuple[str, str, str]:
    """Return (focal_text, aperture_text, dof_text) for a lens name string."""
    focal_match = re.search(r"(\d+)(?:-|–|\s)?(\d*)mm", lens, re.IGNORECASE)
    aperture_match = re.search(r"f[/\s]?([0-9.]+)", lens, re.IGNORECASE)

    focal_text = ""
    aperture_text = ""
    dof_text = ""

    if focal_match:
        start = focal_match.group(1)
        end = focal_match.group(2)
        if end:
            if int(end) > int(start):
                focal_text = f"{start}-{end}mm zoom"
            else:
                focal_text = f"{start}mm prime"
        else:
            focal_text = f"{start}mm lens"

    if aperture_match:
        try:
            ap = float(aperture_match.group(1))
            aperture_text = f"f/{ap:.1f}" if ap < 10 else f"f/{ap:.0f}"
            if ap <= 1.8:
                dof_text = "shallow depth of field, beautiful bokeh"
            elif ap <= 2.8:
                dof_text = "creamy bokeh, smooth background blur"
            else:
                dof_text = "deep depth of field"
        except ValueError:
            pass

    return focal_text, aperture_text, dof_text


def _focal_aperture_tag(lens: str, add_focal_aperture: bool) -> str:
    focal_text, aperture_text, dof_text = _parse_focal_aperture(lens)
    tech_parts = [p for p in [focal_text, aperture_text, dof_text] if p]
    if tech_parts and add_focal_aperture:
        return " " + ", ".join(tech_parts)
    return ""


# ── Prompt construction (kept from v1) ───────────────────────────────────

def _output_style(mode: str) -> str:
    if mode == "random full setup":
        return "full phrase"
    if mode == "random lens only":
        return "lens only"
    return mode


def _build_prompt(
    output_style: str,
    brand: str,
    camera_model: str,
    lens: str,
    add_focal_aperture: bool,
) -> str:
    tag = _focal_aperture_tag(lens, add_focal_aperture)
    if output_style == "full phrase":
        return (
            f"professional photography, shot on {brand} {camera_model} with "
            f"{lens}{tag}, 8k hdr, sharp focus, cinematic lighting, highly detailed"
        )
    if output_style == "camera + lens":
        return f"{brand} {camera_model} + {lens}{tag}"
    if output_style == "lens only":
        return f"{lens}{tag}"
    # manual select (and any other fallback)
    return (
        f"photographed with {brand} {camera_model}, shot on {lens}{tag}, "
        f"professional photo, sharp focus"
    )


# ── Selection resolution ───────────────────────────────────────────────────

def _resolve_selection(
    rng: random.Random,
    lib: _LensLibrary,
    mode: str,
    brand: str,
    camera_model: str,
    lens: str,
) -> tuple[str, str, str]:
    if not lib.raw:
        return "Unknown", "Unknown Camera", "Unknown Lens"

    if mode in ("random full setup", "random lens only"):
        selected = rng.choice(lib.raw)
        brand = selected.get("brand", "Unknown")
        models = selected.get("popular_camera_models", [])
        lenses = selected.get("popular_lenses", [])
        camera_model = rng.choice(models) if models else "Unknown Camera"
        lens = rng.choice(lenses) if lenses else "Unknown Lens"
        return brand, camera_model, lens

    brand_data = next((item for item in lib.raw if item.get("brand") == brand), None)
    if not brand_data:
        brand_data = lib.raw[0]
        brand = brand_data.get("brand", "Unknown")

    models = brand_data.get("popular_camera_models", [])
    lenses = brand_data.get("popular_lenses", [])

    if camera_model not in models:
        camera_model = models[0] if models else "Generic Camera"
    if lens not in lenses:
        lens = lenses[0] if lenses else "Generic Lens"

    return brand, camera_model, lens


def _bool(v) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes", "on")
    return False


# ── Node class ──────────────────────────────────────────────────────────────

class PromptLensLibraryPro:
    DESCRIPTION = (
        "Lens Library Pro Boss — pick a camera brand, body, and lens from "
        "lens.json, choose an output mode (manual, random, full phrase, "
        "camera + lens, lens only), toggle focal/aperture/bokeh tags, and "
        "pick a Random or Fixed seed for reproducible random picks. Click "
        "Open Editor for the live preview.\n\n"
        "Returns prompt_text (the constructed photography prompt) and "
        "debug_info (mode, resolved selections, seed)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        lib = _load_library()
        brands = lib.brands if lib.brands else ["No Data"]
        all_models = _all_models(lib) if lib.raw else ["No Models"]
        all_lenses = _all_lenses(lib) if lib.raw else ["No Lenses"]
        brand_list = [RANDOM_BRAND] + brands

        default_brand = brands[0] if brands else "No Data"
        default_models = lib.models_by_brand.get(default_brand, [])
        default_lenses = lib.lenses_by_brand.get(default_brand, [])

        return {
            "required": {
                "mode": (
                    MODE_KEYS,
                    {
                        "default": MODE_DEFAULT,
                        "tooltip": MODE_TOOLTIPS,
                    },
                ),
                "brand": (
                    brand_list,
                    {
                        "default": default_brand,
                        "tooltip": "Camera brand. Auto-corrects mismatches.",
                    },
                ),
                "camera_model": (
                    all_models if all_models else ["No Models"],
                    {
                        "default": default_models[0] if default_models else "Generic Camera",
                        "tooltip": "Camera body (auto-corrected if mismatch).",
                    },
                ),
                "lens": (
                    all_lenses if all_lenses else ["No Lenses"],
                    {
                        "default": default_lenses[0] if default_lenses else "Generic Lens",
                        "tooltip": "Lens model (auto-corrected if mismatch).",
                    },
                ),
                "add_focal_aperture": (
                    "BOOLEAN",
                    {
                        "default": True,
                        "tooltip": "Adds realistic tags like focal length, f-stop, and bokeh.",
                    },
                ),
            },
            "optional": {
                "seed": (
                    "INT",
                    {
                        "default": -1,
                        "min": -1,
                        "max": SEED_MAX,
                        "tooltip": (
                            "-1 = random each run\n"
                            "0 or higher = deterministic (same seed → same random pick)"
                        ),
                    },
                ),
                "force_refresh": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "label_on": "Refresh",
                        "label_off": "Cached",
                        "tooltip": "Force re-reading lens.json from disk on the next run.",
                    },
                ),
            },
            "hidden": {
                "LensState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("prompt_text", "debug_info")
    OUTPUT_TOOLTIPS = (
        "Constructed photography prompt for the selected mode and gear.",
        "Debug summary: mode, output style, brand, camera, lens, seed.",
    )
    FUNCTION = "apply"
    CATEGORY = "👑 Boss Nodes/📷 Camera"

    @classmethod
    def IS_CHANGED(cls, LensState: str, **kwargs):
        return LensState

    def apply(
        self,
        mode,
        brand=None,
        camera_model=None,
        lens=None,
        add_focal_aperture=True,
        seed=-1,
        force_refresh=False,
        LensState="{}",
        **kwargs,
    ):
        if kwargs:
            _log(f"Ignoring unknown wire kwargs: {sorted(kwargs.keys())}")

        lib = _load_library(force=force_refresh)
        if not lib.raw:
            return ("[Error: No valid data in lens.json]", "error")

        rng = random.Random()
        try:
            s = int(seed)
        except (TypeError, ValueError):
            s = -1
        if s >= 0:
            rng.seed(s)
        else:
            rng.seed(int(datetime.now().timestamp() * 1e6))

        brand, camera_model, lens = _resolve_selection(
            rng, lib, mode, brand, camera_model, lens,
        )

        style = _output_style(mode)
        text = _build_prompt(style, brand, camera_model, lens, _bool(add_focal_aperture))

        debug = (
            f"Mode: {mode} → Output style: {style} | "
            f"Brand: {brand} | Camera: {camera_model} | Lens: {lens} | Seed: {s}"
        )
        return (text, debug)


# ── HTTP API routes ─────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/lens_boss/data")
    async def get_lens_data(request):
        try:
            lib = _load_library()
            return web.json_response(_data_payload(lib))
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/lens_boss/refresh")
    async def refresh_lens_data(request):
        try:
            lib = _load_library(force=True)
            return web.json_response({
                "brandCount": len(lib.brands),
                "modelCount": sum(len(v) for v in lib.models_by_brand.values()),
                "lensCount": sum(len(v) for v in lib.lenses_by_brand.values()),
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ───────────────────────────────────────────────────
# Mapping key preserved as "PromptLensLibraryPro" for existing workflows.

NODE_CLASS_MAPPINGS = {
    "PromptLensLibraryPro": PromptLensLibraryPro,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptLensLibraryPro": "Lens Library Pro Boss",
}

__all__ = [
    "PromptLensLibraryPro",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

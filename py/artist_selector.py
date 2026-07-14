"""Artist Selector Boss — searchable artist selection with favorites + history.

Mirrors the Pixaroma "stateful UI" pattern (see comfyui-pixaroma/nodes/node_seed.py):
- A single hidden `ArtistState` STRING input carries the JS-side selection so
  round-trip through workflow save/load works without touching the visible
  `selection` widget.
- `IS_CHANGED` returns the serialized state so the cache invalidates only when
  state actually changes (mirrors Pixaroma Seed IS_CHANGED).
- The on-node UI lives entirely in `js/artist_selector/index.js`.
"""

import json
import random
from pathlib import Path

from utils.prompt_utils import to_bool
from utils.json_utils import load_json, save_json

# ── File paths ──────────────────────────────────────────────────────────────
# Sibling data files (artists.json / favorites.json / history.json) live next
# to this module so existing users keep their data after the rebuild.
BASE_DIR = Path(__file__).parent
ARTISTS_FILE = BASE_DIR / "artists.json"
FAVORITES_FILE = BASE_DIR / "favorites.json"
HISTORY_FILE = BASE_DIR / "history.json"

# ── Output / sort modes (strings — keep the exact labels the old node used,
# so the `output_mode` / `sort_mode` widgets in existing workflows still match)
OUTPUT_MODES = ["Prompt", "Names", "Both"]
SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent"]

HISTORY_LIMIT = 50
MAX_ARTISTS_DEFAULT = 3
MAX_ARTISTS_MIN = 1
MAX_ARTISTS_MAX = 100

# Module-level cache for the artist database (re-loaded when force_refresh=True
# or favorites/history change via the API routes).
_db_cache = None


def _get_database(force_refresh: bool = False):
    """Load and cache the artist database. Returns (library, favorites, history)."""
    global _db_cache
    if force_refresh or _db_cache is None:
        raw_artists = load_json(ARTISTS_FILE, {})
        library = raw_artists.get("artists", {}) if isinstance(raw_artists, dict) else {}

        favorites = load_json(FAVORITES_FILE, [])
        if not isinstance(favorites, list):
            favorites = []

        history = load_json(HISTORY_FILE, [])
        if not isinstance(history, list):
            history = []

        _db_cache = (library, favorites, history)
    return _db_cache


def _set_favorites(favorites: list):
    """Update cache + persist. Used by the /wai_artist/toggle_favorite route."""
    global _db_cache
    library, _, history = _get_database(force_refresh=False)
    _db_cache = (library, list(favorites), history)
    save_json(FAVORITES_FILE, favorites)


# ── Sort / format helpers ───────────────────────────────────────────────────

def _sort_names(names, sort_mode: str, favorites, history):
    if sort_mode == "A-Z":
        return sorted(names, key=str.casefold)
    if sort_mode == "Z-A":
        return sorted(names, key=str.casefold, reverse=True)
    if sort_mode == "Favorites":
        fav_set = set(favorites)
        return sorted(names, key=lambda n: (n not in fav_set, n.casefold()))
    if sort_mode == "Recent":
        def key(n):
            try:
                return (history.index(n), "")
            except ValueError:
                return (len(history), n.casefold())
        return sorted(names, key=key)
    return names


def _format_output(names, output_mode: str, library):
    if output_mode == "Names":
        joined = ", ".join(names)
        return joined, joined
    if output_mode == "Both":
        combined = [f"{n}, {library.get(n, '')}" for n in names]
        return ", ".join(combined), ", ".join(names)
    # Prompt
    return ", ".join(library.get(n, n) for n in names), ", ".join(names)


def _coerce_int(value, fallback, minimum, maximum):
    try:
        n = int(value)
    except Exception:
        return fallback
    return max(minimum, min(maximum, n))


def _state_overrides(
    ArtistState,
    selection,
    max_artists,
    randomize,
    favorites_only,
    output_mode,
    sort_mode,
    force_refresh,
):
    """Return execution settings, preferring the JS editor state when present."""
    try:
        state = json.loads(ArtistState) if isinstance(ArtistState, str) else {}
    except Exception:
        state = {}
    if not isinstance(state, dict):
        state = {}

    selected_names = state.get("selectedNames")
    if isinstance(selected_names, list):
        selection = ", ".join(n for n in selected_names if isinstance(n, str))

    if "maxArtists" in state:
        max_artists = _coerce_int(
            state.get("maxArtists"),
            max_artists,
            MAX_ARTISTS_MIN,
            MAX_ARTISTS_MAX,
        )
    else:
        max_artists = _coerce_int(
            max_artists,
            MAX_ARTISTS_DEFAULT,
            MAX_ARTISTS_MIN,
            MAX_ARTISTS_MAX,
        )

    if "randomize" in state:
        randomize = to_bool(state.get("randomize"), randomize)
    if "favoritesOnly" in state:
        favorites_only = to_bool(state.get("favoritesOnly"), favorites_only)
    if state.get("outputMode") in OUTPUT_MODES:
        output_mode = state.get("outputMode")
    if state.get("sortMode") in SORT_MODES:
        sort_mode = state.get("sortMode")
    if "forceRefresh" in state:
        force_refresh = to_bool(state.get("forceRefresh"), force_refresh)

    return (
        selection,
        max_artists,
        randomize,
        favorites_only,
        output_mode,
        sort_mode,
        force_refresh,
    )


# ── Node class ──────────────────────────────────────────────────────────────

class BossArtistSelector:
    DESCRIPTION = (
        "Artist Selector Boss - searchable artist selection for ComfyUI "
        "prompts. Click Browse Artists to open a fullscreen library with "
        "search, All / Favorites / Recent tabs, sort modes (A-Z, Z-A, "
        "Favorites, Recent), and one-click star-favoriting.\n\n"
        "Selections appear as removable chips on the node. Toggle Random to "
        "sample N artists from the library (or favorites) on every run, "
        "pick an Output mode (Prompt / Names / Both), and the chosen prompt "
        "fragment flows out as a STRING.\n\n"
        "Favorites and recent history persist on disk next to the node "
        "(favorites.json / history.json). All interactive UI lives in the "
        "JS frontend; the only Python input is a hidden state string "
        "injected at execution time."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "selection": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": True,
                        "tooltip": (
                            "Comma-separated artist names. Usually you don't type "
                            "here directly - click Browse Artists and pick from the "
                            "library. The chips on the node mirror this field."
                        ),
                    },
                ),
                "max_artists": (
                    "INT",
                    {
                        "default": MAX_ARTISTS_DEFAULT,
                        "min": MAX_ARTISTS_MIN,
                        "max": MAX_ARTISTS_MAX,
                        "step": 1,
                        "tooltip": (
                            "Maximum number of artists to include in the output. "
                            "When Random is on, this many artists are sampled from "
                            "the pool."
                        ),
                    },
                ),
                "randomize": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "label_on": "Random",
                        "label_off": "Manual",
                        "tooltip": (
                            "When ON, ignore the typed selection and sample N "
                            "artists from the library (or favorites, if "
                            "favorites_only is on) every run. When OFF, the typed "
                            "selection is used as-is."
                        ),
                    },
                ),
                "favorites_only": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "label_on": "Favorites",
                        "label_off": "All Artists",
                        "tooltip": (
                            "Restrict the random pool to favorited artists. "
                            "Ignored when Random is off."
                        ),
                    },
                ),
                "output_mode": (
                    OUTPUT_MODES,
                    {
                        "default": "Prompt",
                        "tooltip": (
                            "Prompt = 'by <artist>' fragments (matches the WAI "
                            "library format). Names = the artist names only. "
                            "Both = 'name, by <artist>' pairs joined together."
                        ),
                    },
                ),
                "sort_mode": (
                    SORT_MODES,
                    {
                        "default": "A-Z",
                        "tooltip": (
                            "Order of the output list. Favorites groups starred "
                            "artists first; Recent uses the on-disk history.json."
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
                            "Reload artists.json from disk on the next run. "
                            "Useful after editing the library file by hand."
                        ),
                    },
                ),
            },
            "hidden": {
                "ArtistState": ("STRING", {"default": "{}"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "INT")
    RETURN_NAMES = ("artist_prompt", "artist_names", "artist_count")
    OUTPUT_TOOLTIPS = (
        "The formatted artist fragment (Prompt / Names / Both). Wire into a CLIPTextEncode.",
        "The artist names as a comma-separated string, format-independent.",
        "The number of artists included in the output.",
    )
    FUNCTION = "select"
    CATEGORY = "👑 Boss Nodes/🎨 Artist"

    @classmethod
    def IS_CHANGED(cls, ArtistState: str, **kwargs):
        # Re-execute whenever the JS-side state changes (Pattern #9). Random
        # mode writes a fresh nonce per-run on the JS side, so identical
        # non-random state caches like ComfyUI's native seed node.
        return ArtistState

    def select(self, selection, max_artists, randomize, favorites_only,
               output_mode, sort_mode, force_refresh, ArtistState="{}"):
        (
            selection,
            max_artists,
            randomize,
            favorites_only,
            output_mode,
            sort_mode,
            force_refresh,
        ) = _state_overrides(
            ArtistState,
            selection,
            max_artists,
            randomize,
            favorites_only,
            output_mode,
            sort_mode,
            force_refresh,
        )

        try:
            library, favorites, history = _get_database(force_refresh=force_refresh)
        except Exception:
            return ("", "", 0)

        selected = []

        if randomize:
            pool = [n for n in (favorites if favorites_only else list(library.keys()))]
            if pool:
                count = min(max_artists, len(pool))
                selected = random.sample(pool, count)
        else:
            if selection and selection.strip():
                raw = [n.strip() for n in selection.split(",")]
                selected = [n for n in raw if n and n in library][:max_artists]

        if not selected:
            return ("", "", 0)

        # Update on-disk history (most-recent first, deduped, capped).
        for name in reversed(selected):
            while name in history:
                history.remove(name)
            history.insert(0, name)
        del history[HISTORY_LIMIT:]
        if save_json(HISTORY_FILE, history):
            global _db_cache
            if _db_cache is not None:
                lib, fav, _ = _db_cache
                _db_cache = (lib, fav, history)

        sorted_names = _sort_names(selected, sort_mode, favorites, history)
        prompt, names = _format_output(sorted_names, output_mode, library)
        return (prompt, names, len(sorted_names))


# ── HTTP API routes (favorites toggle + initial data fetch) ────────────────
# Kept exactly as before so the existing on-disk favorites.json format and
# the existing /wai_artist/* URLs keep working with no migration.

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return  # ComfyUI PromptServer not available; routes are optional.

    routes = PromptServer.instance.routes

    @routes.get("/wai_artist/data")
    async def get_artists_data(request):
        try:
            library, favorites, history = _get_database(force_refresh=False)
            return web.json_response({
                "library": library,
                "favorites": favorites,
                "history": history,
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/wai_artist/toggle_favorite")
    async def toggle_favorite(request):
        try:
            data = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "Invalid JSON body"}, status=400)

        artist_name = (data.get("name") or "").strip()
        if not artist_name:
            return web.json_response({"error": "Artist name required"}, status=400)

        try:
            favorites = load_json(FAVORITES_FILE, [])
            if not isinstance(favorites, list):
                favorites = []

            if artist_name in favorites:
                favorites.remove(artist_name)
                action = "removed from"
            else:
                favorites.append(artist_name)
                action = "added to"

            save_json(FAVORITES_FILE, favorites)
            _set_favorites(favorites)

            return web.json_response({
                "favorites": favorites,
                "action": action,
                "artist": artist_name,
            })
        except Exception:
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()


# ── ComfyUI registration ────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "BossArtistSelector": BossArtistSelector,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BossArtistSelector": "Artist Selector Boss",
}

__all__ = [
    "BossArtistSelector",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]

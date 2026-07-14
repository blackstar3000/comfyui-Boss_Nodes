"""Shared constants for the Boss Nodes ComfyUI custom node pack.

This module centralizes constants that are duplicated across multiple
node modules. Each node should import from here instead of redefining
the same values locally.

Constants:
    SEED_MAX              -- Maximum seed value for INT seed widgets
    STRENGTH_MIN          -- Minimum strength/weight value (0.0)
    STRENGTH_MAX          -- Maximum strength/weight value (2.0)
    STRENGTH_STEP         -- Step increment for strength sliders
    STRENGTH_DEFAULT      -- Default strength value (1.0)
    WEIGHT_FORMAT_KEYS    -- Internal keys for weight format dropdowns
    WEIGHT_FORMAT_LABELS  -- Display labels for weight format dropdowns
    WEIGHT_FORMAT_DEFAULT -- Default weight format key ("comfyui")
"""

# ── Seed ─────────────────────────────────────────────────────────────────────
# Matches ComfyUI's seed widget bound. Used by all nodes with seed inputs.
SEED_MAX = 0xFFFFFFFFFFFFFFFF

# ── Strength / weight bounds ─────────────────────────────────────────────────
# Common defaults used by most nodes. Node-specific overrides (e.g. 2.5 max)
# should remain local to those modules.
STRENGTH_MIN = 0.0
STRENGTH_MAX = 2.0
STRENGTH_STEP = 0.05
STRENGTH_DEFAULT = 1.0

# ── Weight format registry ──────────────────────────────────────────────────
# Shared by nodes that offer a weight format dropdown (prompt_master_library,
# prompt_booster_pro, camera_style_mixer).
WEIGHT_FORMAT_KEYS = ["comfyui", "parentheses", "multiply", "none"]
WEIGHT_FORMAT_LABELS = {
    "comfyui":     "(text:1.30) — ComfyUI / A1111 standard",
    "parentheses": "((text))    — Stacked parentheses",
    "multiply":    "text * 1.30 — Multiply style",
    "none":        "none        — No weighting",
}
WEIGHT_FORMAT_DEFAULT = "comfyui"

# ── Common UI constants ─────────────────────────────────────────────────────
# Shared across nodes that offer category filtering + random/sentinel combos.
ALL_CATEGORIES = "All"
DELIMITER_DEFAULT = ", "
RANDOM_STYLE = "__RANDOM_STYLE__"

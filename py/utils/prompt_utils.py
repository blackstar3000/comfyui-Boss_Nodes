"""Shared prompt formatting utilities for the Boss Nodes ComfyUI custom node pack.

This module contains extracted helper functions for prompt weighting,
strength clamping, and boolean parsing that were previously duplicated
across multiple node modules.

Functions:
    apply_weight(text, strength, fmt) -- Apply attention weighting to prompt text
    clamp_strength(value, min, max, default) -- Clamp a strength value
    to_bool(value, fallback) -- Parse a value as boolean
"""

from utils.constants import STRENGTH_MIN, STRENGTH_MAX, STRENGTH_DEFAULT


def apply_weight(text: str, strength: float, fmt: str = "comfyui") -> str:
    """Apply attention weighting to prompt text.

    Supported formats:
        "comfyui"     -- (text:1.30) standard ComfyUI / A1111
        "parentheses" -- ((text)) stacked parentheses (up to 5 layers)
        "multiply"    -- text * 1.30 multiply style
        "deemphasis"  -- [text] de-emphasis brackets
        "none"        -- text (no wrapping)

    Returns '' if text is empty or strength is effectively zero.
    Unknown formats pass through unchanged.
    """
    if not text or strength is None or strength < 0.01:
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

    if fmt == "deemphasis":
        return f"[{text}]"

    return text  # Unknown format — pass through unchanged


def clamp_strength(
    value,
    minimum: float = STRENGTH_MIN,
    maximum: float = STRENGTH_MAX,
    default: float = STRENGTH_DEFAULT,
) -> float:
    """Clamp a strength/weight value to [minimum, maximum].

    Attempts to convert value to float. On failure, returns default.
    """
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, v))


def to_bool(value, fallback: bool = False) -> bool:
    """Parse a value as boolean.

    Accepts:
        bool    -- returned as-is
        int/float -- bool(v) (0 = False, non-zero = True)
        str     -- True if lowercased stripped value is in
                   {"true", "1", "yes", "on"}
        other   -- returns fallback
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes", "on")
    return fallback

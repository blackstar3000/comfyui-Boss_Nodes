"""Shared JSON file I/O utilities for the Boss Nodes ComfyUI custom node pack.

This module contains extracted helper functions for reading and writing
JSON files with backup support, previously duplicated across multiple
node modules.

Functions:
    load_json(path, default) -- Load JSON from disk with fallback
    save_json(path, data) -- Save JSON with backup
    sanitize_entries(raw) -- Keep only entries with non-empty string values
    sanitize_categories(cats, valid_keys) -- Validate category lists
"""

import json
from pathlib import Path


def load_json(path: Path, default=None):
    """Load JSON from disk with fallback.

    Args:
        path: Path to the JSON file
        default: Value to return if file not found or parse error

    Returns:
        Parsed JSON data, or default on error
    """
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, Exception):
        return default


def save_json(path: Path, data, backup: bool = True) -> bool:
    """Save JSON to disk with optional backup.

    Args:
        path: Path to the JSON file
        data: Data to serialize
        backup: If True, create .bak backup before overwriting

    Returns:
        True on success, False on error
    """
    try:
        if backup and path.exists():
            path.with_suffix(path.suffix + ".bak").write_text(
                path.read_text(encoding="utf-8"), encoding="utf-8"
            )
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


def sanitize_entries(raw: dict) -> dict[str, str]:
    """Keep only entries with non-empty string values.

    Args:
        raw: Dictionary of entries to sanitize

    Returns:
        Cleaned dictionary with only valid string entries
    """
    clean: dict[str, str] = {}
    for k, v in raw.items():
        if isinstance(v, str) and v.strip():
            clean[k] = v.strip()
    return clean


def sanitize_categories(cats: dict, valid_keys: set) -> dict[str, list[str]]:
    """Validate category lists against known keys.

    Args:
        cats: Dictionary of category names to item lists
        valid_keys: Set of valid item keys

    Returns:
        Cleaned dictionary with only valid references
    """
    clean: dict[str, list[str]] = {}
    for cat_name, items in cats.items():
        if not isinstance(items, list):
            continue
        valid = [x for x in items if x in valid_keys]
        if valid:
            clean[cat_name] = valid
    return clean

"""Shared cache utilities for the Boss Nodes ComfyUI custom node pack.

This module contains base classes for JSON library caching with
mtime-based hot-reload, previously duplicated across multiple node modules.

Classes:
    Collection -- A single JSON library collection (items + categories + mtime)
"""

import json
import os
from pathlib import Path

from utils.logging_utils import make_logger
from utils.json_utils import sanitize_entries, sanitize_categories


class Collection:
    """Base class for a JSON library collection with hot-reload support.

    Attributes:
        filename: Name of the JSON file
        data_key: Key in the JSON file containing the items dict
        items: Dictionary of items loaded from the JSON file
        categories: Dictionary of category lists
        mtime: Last modification time of the JSON file (for hot-reload)

    Subclasses can override `_process_data()` to customize how data is processed.
    """

    def __init__(self, filename: str, data_key: str, log_prefix: str = "Collection"):
        self.filename = filename
        self.data_key = data_key
        self.items: dict[str, str] = {}
        self.categories: dict[str, list[str]] = {}
        self.mtime: float | None = None
        self._log = make_logger(log_prefix)

    @property
    def path(self) -> Path:
        """Return the full path to the JSON file."""
        return Path(__file__).parent.parent / self.filename

    def is_empty(self) -> bool:
        """Return True if the collection has no items."""
        return not self.items

    def _process_data(self, data: dict) -> bool:
        """Process loaded JSON data. Returns True on success.

        Override this method in subclasses to customize processing.
        Default implementation extracts items and categories using data_key.
        """
        if not isinstance(data, dict):
            self._log(f"{self.filename} root is not an object — skipping.")
            return False

        raw_items = data.get(self.data_key)
        if not isinstance(raw_items, dict):
            self._log(f"{self.filename} has no '{self.data_key}' object — skipping.")
            return False

        self.items = sanitize_entries(raw_items)
        self.categories = sanitize_categories(
            data.get("categories", {}), set(self.items.keys())
        )
        return True

    def load(self, force: bool = False) -> "Collection":
        """Hot-reload the collection's JSON file.

        Reads from disk only when the file's mtime changes (or force=True).
        On any parse error, leaves the previous cache intact and logs a warning.
        """
        if not force and self.mtime is not None and self.items:
            try:
                if os.path.getmtime(self.path) == self.mtime:
                    return self
            except OSError:
                pass  # fall through to the full load below

        if not self.path.exists():
            self._log(f"File not found: {self.filename} — that collection will be empty.")
            return self

        try:
            mtime = os.path.getmtime(self.path)
        except OSError as e:
            self._log(f"Cannot stat {self.filename}: {e}")
            return self

        try:
            with self.path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            self._log(f"Error reading {self.filename}: {e}")
            return self

        if not self._process_data(data):
            return self

        self.mtime = mtime
        self._log(
            f"Loaded {self.filename}: {len(self.items)} items, "
            f"{len(self.categories)} categories"
        )
        return self

    def save(self):
        """Write the current items + categories back to disk and bust mtime cache."""
        data = {self.data_key: self.items, "categories": self.categories}
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        self.mtime = os.path.getmtime(self.path)

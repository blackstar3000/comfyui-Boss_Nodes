import json
import os
from pathlib import Path
from typing import Any


class ConfigLoader:
    """Load and hot-reload JSON config files."""

    def __init__(self, config_dir: str | Path):
        self.config_dir = Path(config_dir)
        self._mtimes: dict[str, float] = {}
        self._cache: dict[str, Any] = {}

    def get(self, filename: str) -> Any:
        """Get config data, reloading if file changed."""
        filepath = self.config_dir / filename

        if not filepath.exists():
            return self._cache.get(filename)

        mtime = filepath.stat().st_mtime

        if filename not in self._cache or mtime != self._mtimes.get(filename):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    self._cache[filename] = json.load(f)
                self._mtimes[filename] = mtime
            except (json.JSONDecodeError, IOError):
                # ponytail: return stale cache on error
                pass

        return self._cache.get(filename)

    def get_categories(self) -> dict[str, list[str]]:
        """Get category keywords."""
        return self.get("categories.json") or {}

    def get_conflicts(self) -> list[list[str]]:
        """Get antonym pairs."""
        return self.get("conflicts.json") or []

    def get_defaults(self) -> dict:
        """Get default settings."""
        return self.get("defaults.json") or {}

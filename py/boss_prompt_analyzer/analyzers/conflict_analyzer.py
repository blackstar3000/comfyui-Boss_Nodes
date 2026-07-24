from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class ConflictAnalyzer(BaseAnalyzer):
    """Detect conflicting concepts (antonyms)."""

    def __init__(self, conflicts: list[list[str]] | None = None):
        self.conflicts = conflicts or []

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        all_words = set()
        for chunk in context.chunks:
            for word in chunk:
                all_words.add(str(word).lower())

        conflicts_found = []

        for conflict_group in self.conflicts:
            present = [w for w in conflict_group if w.lower() in all_words]
            if len(present) >= 2:
                conflicts_found.append({
                    "concepts": present,
                    "severity": "major" if len(present) > 2 else "minor",
                    "warning": f"Potential conflict: {' vs '.join(present)}",
                })

        result.conflict_info = conflicts_found

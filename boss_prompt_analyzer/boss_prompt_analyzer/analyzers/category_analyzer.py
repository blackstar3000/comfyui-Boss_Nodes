from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class CategoryAnalyzer(BaseAnalyzer):
    """Classify concepts into categories."""

    def __init__(self, categories: dict[str, list[str]] | None = None):
        self.categories = categories or {}

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        all_words = []
        for chunk in context.chunks:
            all_words.extend(str(w).lower() for w in chunk)

        total = len(all_words) if all_words else 1
        category_counts = {}

        for category, keywords in self.categories.items():
            count = sum(1 for word in all_words if word in keywords)
            category_counts[category] = count

        category_info = {}
        for category, count in category_counts.items():
            percentage = (count / total * 100) if total > 0 else 0
            bars = "█" * int(percentage / 5) + "░" * (20 - int(percentage / 5))
            category_info[category] = {
                "count": count,
                "percentage": round(percentage, 1),
                "bar": bars,
            }

        result.category_info = category_info

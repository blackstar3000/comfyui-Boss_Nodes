from __future__ import annotations
from collections import Counter
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class RepeatAnalyzer(BaseAnalyzer):
    """Detect repeated concepts across chunks."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        all_words = []
        for chunk in context.chunks:
            all_words.extend(chunk)

        word_counts = Counter(all_words)

        repeats = []
        for word, count in word_counts.most_common():
            if count > 1:
                repeats.append({
                    "concept": str(word),
                    "count": count,
                    "status": f"appears {count}×",
                })

        result.repeat_info = repeats
        result.statistics["repeated_count"] = len(repeats)

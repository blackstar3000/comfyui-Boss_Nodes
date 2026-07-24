from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class SuggestionEngine(BaseAnalyzer):
    """Generate actionable suggestions. MUST run last."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        suggestions = []

        # Suggest moving important terms to earlier chunks
        if result.chunk_info and len(result.chunk_info) > 1:
            quality_terms = ["masterpiece", "best quality", "8k", "ultra detailed"]
            for i, chunk in enumerate(result.chunk_info):
                preview = chunk.get("preview", "").lower()
                for term in quality_terms:
                    if term in preview and i > 0:
                        suggestions.append(
                            f'Move "{term}" to BREAK 1 for stronger emphasis'
                        )

        # Suggest merging underweighted chunks
        if result.chunk_info:
            underweighted = [
                c for c in result.chunk_info
                if c["token_count"] < 20 and c["index"] > 0
            ]
            if len(underweighted) >= 2:
                indices = [str(c["index"] + 1) for c in underweighted]
                suggestions.append(
                    f"Consider merging BREAK {', '.join(indices)} (both underweighted)"
                )

        # Suggest removing excessive repeats
        for repeat in result.repeat_info:
            if repeat["count"] > 3:
                suggestions.append(
                    f'Remove repeated "{repeat["concept"]}" ({repeat["count"]} occurrences)'
                )

        # Suggest addressing conflicts
        for conflict in result.conflict_info:
            concepts = conflict.get("concepts", [])
            if len(concepts) >= 2:
                suggestions.append(
                    f'Resolve conflict: {" vs ".join(concepts)}'
                )

        result.suggestions = suggestions

from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class HealthAnalyzer(BaseAnalyzer):
    """Calculate weighted prompt health score."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        score = 5  # Start at 5 stars
        issues = []

        # Check overflow
        overflow_chunks = result.token_info.get("overflow_chunks", [])
        if len(overflow_chunks) == 1:
            score -= 2
            issues.append("Overflow in 1 chunk")
        elif len(overflow_chunks) > 1:
            score -= 3
            issues.append(f"Overflow in {len(overflow_chunks)} chunks")

        # Check conflicts
        major_conflicts = [
            c for c in result.conflict_info if c.get("severity") == "major"
        ]
        minor_conflicts = [
            c for c in result.conflict_info if c.get("severity") == "minor"
        ]
        if major_conflicts:
            score -= 2
            issues.append(f"{len(major_conflicts)} major conflicts")
        if minor_conflicts:
            score -= 1
            issues.append(f"{len(minor_conflicts)} minor conflicts")

        # Check repeats
        repeat_count = result.statistics.get("repeated_count", 0)
        if repeat_count > 3:
            score -= 1
            issues.append(f"{repeat_count} repeated tags")

        # Check chunk balance
        if result.chunk_info:
            counts = [c["token_count"] for c in result.chunk_info]
            if counts:
                max_count = max(counts)
                min_count = min(counts)
                if max_count > 0 and min_count > 0:
                    ratio = max_count / min_count
                    if ratio > 3:
                        score -= 1
                        issues.append("Very uneven chunks")

        # Clamp score
        score = max(1, min(5, score))

        # Generate star string
        stars = "\u2605" * score + "\u2606" * (5 - score)

        # Calculate metrics
        total_tokens = result.token_info.get("total_tokens", 0)
        chunk_limit = result.token_info.get("chunk_limit", 77)
        chunk_count = result.token_info.get("chunk_count", 1)
        usage_pct = (total_tokens / (chunk_limit * chunk_count) * 100) if chunk_count > 0 else 0

        result.health_info = {
            "score": score,
            "stars": stars,
            "issues": issues,
            "metrics": {
                "token_usage_pct": round(usage_pct, 1),
                "chunk_balance": "Excellent" if not issues else "Needs attention",
                "repeated_tags": repeat_count,
                "conflicts": len(result.conflict_info),
                "overflow": len(overflow_chunks),
            },
        }

from __future__ import annotations
import re
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class ChunkAnalyzer(BaseAnalyzer):
    """Analyze chunk breakdown and emphasis estimate."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        chunk_info = []

        for i, chunk in enumerate(context.chunks):
            token_count = len(chunk)
            limit = context.chunk_limit
            percentage = (token_count / limit * 100) if limit > 0 else 0

            # Status
            if token_count <= 60:
                status = "✓ Good"
            elif token_count <= 70:
                status = "⚠ Getting Full"
            elif token_count <= 77:
                status = "🟠 Nearly Full"
            else:
                status = "🔴 Overflow"

            # Priority stars (heuristic based on position)
            if i == 0:
                priority = "★★★★★"
                priority_label = "first, strongest attention"
            elif i == 1:
                priority = "★★★★☆"
                priority_label = ""
            elif i == 2:
                priority = "★★★☆☆"
                priority_label = ""
            elif i == 3:
                priority = "★★☆☆☆"
                priority_label = ""
            else:
                priority = "★☆☆☆☆"
                priority_label = ""

            # Get text preview from raw prompt
            preview = self._get_chunk_preview(context.prompt, i)

            chunk_info.append({
                "index": i,
                "token_count": token_count,
                "percentage": percentage,
                "status": status,
                "priority": priority,
                "priority_label": priority_label,
                "preview": preview,
            })

        result.chunk_info = chunk_info

    def _get_chunk_preview(self, prompt: str, chunk_index: int) -> str:
        """Extract text preview for a chunk from raw prompt."""
        parts = re.split(r"\bBREAK\b", prompt, flags=re.IGNORECASE)
        if chunk_index < len(parts):
            text = parts[chunk_index].strip()
            # Truncate for preview
            if len(text) > 200:
                text = text[:200] + "..."
            return text
        return ""

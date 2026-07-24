from __future__ import annotations
import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .analysis_result import AnalysisResult


class ReportBuilder:
    """Build reports in text, markdown, or JSON format."""

    def build(self, result: AnalysisResult, format: str = "text") -> str:
        if format == "json":
            return self._build_json(result)
        elif format == "markdown":
            return self._build_markdown(result)
        else:
            return self._build_text(result)

    def _build_text(self, result: AnalysisResult) -> str:
        lines = []
        lines.append("═" * 55)
        lines.append("           BOSS PROMPT ANALYZER PRO")
        lines.append("═" * 55)
        lines.append("")

        # Core Analysis
        lines.append("═" * 55)
        lines.append("  CORE ANALYSIS (Exact)")
        lines.append("═" * 55)
        lines.append("")

        # Model info
        lines.append("Model Info")
        lines.append(f"  Tokenizer      {result.token_info.get('tokenizer_name', 'unknown')}")
        lines.append(f"  Detected Size  {result.token_info.get('chunk_limit', 77)} tokens")
        lines.append(f"  Total Tokens   {result.token_info.get('total_tokens', 0)}")
        lines.append(f"  BREAK Count    {result.token_info.get('chunk_count', 0) - 1}")
        lines.append("")

        # Chunks
        for chunk in result.chunk_info:
            lines.append(f"─── BREAK {chunk['index'] + 1} ─── {chunk['token_count']} tokens {chunk['status']} ───")
            lines.append(f"  {chunk['preview'][:100]}...")
            lines.append("")

        # Statistics
        lines.append("═" * 55)
        lines.append("  STATISTICS")
        lines.append("═" * 55)
        lines.append(f"  Unique Concepts    {result.statistics.get('unique_concepts', 0)}")
        lines.append(f"  Repeated           {result.statistics.get('repeated_count', 0)}")
        lines.append("")

        # Heuristic Analysis
        lines.append("═" * 55)
        lines.append("  INTELLIGENT ANALYSIS (Heuristic)")
        lines.append("═" * 55)
        lines.append("  Note: These are heuristic recommendations and may vary")
        lines.append("  by model, checkpoint, CLIP implementation, and workflow.")
        lines.append("")

        # Priority
        lines.append("─── PROMPT EMPHASIS ESTIMATE ───")
        for chunk in result.chunk_info:
            label = f"  ({chunk['priority_label']})" if chunk['priority_label'] else ""
            lines.append(f"  BREAK {chunk['index'] + 1}  {chunk['priority']}{label}")
        lines.append("")

        # Categories
        if result.category_info:
            lines.append("─── CATEGORY BREAKDOWN ───")
            for cat, info in result.category_info.items():
                lines.append(f"  {cat:<12} {info['percentage']:>5.1f}%  {info['bar']}")
            lines.append("")

        # Suggestions
        if result.suggestions:
            lines.append("═" * 55)
            lines.append("  SUGGESTIONS")
            lines.append("═" * 55)
            for suggestion in result.suggestions:
                lines.append(f"  → {suggestion}")
            lines.append("")

        # Health
        lines.append("═" * 55)
        lines.append("  PROMPT HEALTH")
        lines.append("═" * 55)
        lines.append(f"  {result.health_info.get('stars', '★★★★★')}")
        lines.append("")
        metrics = result.health_info.get("metrics", {})
        lines.append(f"  Token Usage      {metrics.get('token_usage_pct', 0)}%  Good")
        lines.append(f"  Chunk Balance    {metrics.get('chunk_balance', 'Unknown')}")
        lines.append(f"  Repeated Tags    {metrics.get('repeated_tags', 0)}")
        lines.append(f"  Conflicts        {metrics.get('conflicts', 0)} found")
        lines.append(f"  Overflow         {metrics.get('overflow', 0)}")
        lines.append("")

        # Warnings
        if result.warnings:
            lines.append("═" * 55)
            lines.append("  WARNINGS")
            lines.append("═" * 55)
            for warning in result.warnings:
                lines.append(f"  ⚠ {warning}")
            lines.append("")

        return "\n".join(lines)

    def _build_json(self, result: AnalysisResult) -> str:
        """Build JSON report."""
        data = {
            "token_info": result.token_info,
            "chunk_info": result.chunk_info,
            "statistics": result.statistics,
            "repeat_info": result.repeat_info,
            "conflict_info": result.conflict_info,
            "category_info": result.category_info,
            "health_info": result.health_info,
            "suggestions": result.suggestions,
            "warnings": result.warnings,
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _build_markdown(self, result: AnalysisResult) -> str:
        """Build markdown report."""
        lines = []
        lines.append("# Boss Prompt Analyzer PRO\n")

        lines.append("## Core Analysis\n")
        lines.append(f"- **Tokenizer:** {result.token_info.get('tokenizer_name', 'unknown')}")
        lines.append(f"- **Total Tokens:** {result.token_info.get('total_tokens', 0)}")
        lines.append(f"- **Chunks:** {result.token_info.get('chunk_count', 0)}")
        lines.append("")

        lines.append("## Chunks\n")
        for chunk in result.chunk_info:
            lines.append(f"### BREAK {chunk['index'] + 1} — {chunk['token_count']} tokens {chunk['status']}\n")
            lines.append(f"```\n{chunk['preview'][:200]}\n```\n")

        lines.append("## Health\n")
        lines.append(f"**{result.health_info.get('stars', '★★★★★')}**\n")

        if result.suggestions:
            lines.append("## Suggestions\n")
            for s in result.suggestions:
                lines.append(f"- {s}")

        return "\n".join(lines)

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class AnalysisResult:
    """Structured result from all analyzers."""
    # Core analysis (exact)
    token_info: dict = field(default_factory=dict)
    chunk_info: list = field(default_factory=list)
    statistics: dict = field(default_factory=dict)
    effective_prompt: str = ""

    # Heuristic analysis
    repeat_info: list = field(default_factory=list)
    conflict_info: list = field(default_factory=list)
    category_info: dict = field(default_factory=dict)
    health_info: dict = field(default_factory=dict)
    suggestions: list = field(default_factory=list)

    # Metadata
    warnings: list = field(default_factory=list)

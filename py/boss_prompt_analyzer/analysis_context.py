from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class AnalysisContext:
    """Shared context passed through all analyzers."""
    prompt: str
    clip: Optional[Any] = None
    show_token_ids: bool = False

    # Populated by TokenAnalyzer
    tokens: list = field(default_factory=list)
    chunks: list = field(default_factory=list)
    tokenizer_name: str = "unknown"
    total_tokens: int = 0
    chunk_limit: int = 77

    # Warnings from failed analyzers
    warnings: list = field(default_factory=list)

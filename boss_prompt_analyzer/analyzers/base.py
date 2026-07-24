from __future__ import annotations
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class BaseAnalyzer(ABC):
    """Interface for all analyzers."""

    @abstractmethod
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        """Analyze the prompt and populate result fields.

        Args:
            context: Shared analysis context with tokens and chunks
            result: Result object to populate with findings

        Raises:
            Exception: On failure (caught by AnalyzerManager)
        """
        ...

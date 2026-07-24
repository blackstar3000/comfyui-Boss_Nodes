from __future__ import annotations
from typing import TYPE_CHECKING

from .analyzers import (
    TokenAnalyzer,
    ChunkAnalyzer,
    RepeatAnalyzer,
    ConflictAnalyzer,
    CategoryAnalyzer,
    HealthAnalyzer,
    SuggestionEngine,
)
from .config._hot_reload import ConfigLoader

if TYPE_CHECKING:
    from .analysis_context import AnalysisContext
    from .analysis_result import AnalysisResult


class AnalyzerManager:
    """Run all analyzers with error isolation."""

    def __init__(self, config_loader: ConfigLoader):
        self.config_loader = config_loader
        self._build_analyzers()

    def _build_analyzers(self) -> None:
        """Initialize analyzers with config."""
        categories = self.config_loader.get_categories()
        conflicts = self.config_loader.get_conflicts()

        # Order matters: SuggestionEngine must be last
        self.analyzers = [
            TokenAnalyzer(),
            ChunkAnalyzer(),
            RepeatAnalyzer(),
            ConflictAnalyzer(conflicts),
            CategoryAnalyzer(categories),
            HealthAnalyzer(),
            SuggestionEngine(),  # LAST - depends on others
        ]

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        """Run all analyzers with error isolation."""
        # Reload config (hot reload)
        self._build_analyzers()

        for analyzer in self.analyzers:
            try:
                analyzer.analyze(context, result)
            except Exception as e:
                context.warnings.append(
                    f"{analyzer.__class__.__name__} failed: {e}"
                )
                continue

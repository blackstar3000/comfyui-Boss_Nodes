from __future__ import annotations
import os
import re
from typing import Optional

from .analysis_context import AnalysisContext
from .analysis_result import AnalysisResult
from .analyzer_manager import AnalyzerManager
from .report_builder import ReportBuilder
from .config._hot_reload import ConfigLoader

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")


class BossPromptAnalyzerPRO:
    """Prompt diagnostics and optimization node."""

    def __init__(self):
        self.config_loader = ConfigLoader(CONFIG_DIR)
        self.manager = AnalyzerManager(self.config_loader)
        self.report_builder = ReportBuilder()

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "clip": ("CLIP",),
                "show_token_ids": ("BOOLEAN", {"default": False}),
                "export_format": (["text", "markdown", "json"], {"default": "text"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("analysis", "effective_prompt", "health_summary", "json_report")
    FUNCTION = "analyze"
    CATEGORY = "👑 Boss Nodes/🧵 Text"
    DESCRIPTION = "Prompt diagnostics, optimization, and health scoring."

    def analyze(
        self,
        prompt: str,
        clip: Optional[object] = None,
        show_token_ids: bool = False,
        export_format: str = "text",
    ):
        context = AnalysisContext(
            prompt=prompt,
            clip=clip,
            show_token_ids=show_token_ids,
        )

        result = AnalysisResult()

        self.manager.analyze(context, result)

        result.effective_prompt = self._build_effective_prompt(prompt)

        result.warnings = context.warnings

        analysis_text = self.report_builder.build(result, export_format)
        health_summary = self.report_builder.build(result, "text")
        json_report = self.report_builder.build(result, "json")

        return (analysis_text, result.effective_prompt, health_summary, json_report)

    def _build_effective_prompt(self, prompt: str) -> str:
        """Strip weights from prompt for comparison."""
        result = re.sub(r"\(([^)]+):[0-9.]+\)", r"\1", prompt)
        result = re.sub(r"\(\(([^)]+)\)\)", r"\1", result)
        result = re.sub(r"\[([^\]]+)\]", r"\1", result)
        return result

from __future__ import annotations
import re
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class TokenAnalyzer(BaseAnalyzer):
    """Tokenize prompt and detect overflow."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        if context.clip is not None:
            self._tokenize_with_clip(context)
        else:
            self._tokenize_without_clip(context)

        overflow_chunks = [
            i for i, chunk in enumerate(context.chunks)
            if len(chunk) > context.chunk_limit
        ]

        result.token_info = {
            "total_tokens": context.total_tokens,
            "chunk_count": len(context.chunks),
            "chunk_limit": context.chunk_limit,
            "tokenizer_name": context.tokenizer_name,
            "overflow_chunks": overflow_chunks,
            "has_clip": context.clip is not None,
        }

    def _tokenize_with_clip(self, context: AnalysisContext) -> None:
        tokens = context.clip.tokenize(context.prompt)

        if hasattr(context.clip, "tokenizer"):
            tokenizer = context.clip.tokenizer
            if hasattr(tokenizer, "model"):
                context.tokenizer_name = tokenizer.model
            else:
                context.tokenizer_name = "CLIP"
        else:
            context.tokenizer_name = "CLIP"

        for key in tokens:
            token_tensor = tokens[key]
            if token_tensor is not None and len(token_tensor.shape) >= 2:
                max_len = token_tensor.shape[-1]
                context.chunk_limit = max_len

                flat = token_tensor.reshape(-1, max_len)
                for chunk_tensor in flat:
                    chunk_tokens = [
                        t.item() for t in chunk_tensor
                        if t.item() not in (0, 49407)
                    ]
                    if chunk_tokens:
                        context.chunks.append(chunk_tokens)
                break

        context.total_tokens = sum(len(c) for c in context.chunks)
        context.tokens = context.chunks

    def _tokenize_without_clip(self, context: AnalysisContext) -> None:
        context.tokenizer_name = "text-estimate"
        context.chunk_limit = 77

        parts = re.split(r"\bBREAK\b", context.prompt, flags=re.IGNORECASE)

        for part in parts:
            part = part.strip()
            if not part:
                continue
            words = re.findall(r"\S+", part)
            context.chunks.append(words)
            context.tokens.append(words)

        context.total_tokens = sum(len(c) for c in context.chunks)

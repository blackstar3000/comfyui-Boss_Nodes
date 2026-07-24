"""Boss Prompt Analyzer PRO — Prompt diagnostics, optimization, and health scoring."""

import json
import os
import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, List, Dict


# ═══════════════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AnalysisContext:
    """Shared context passed through all analyzers."""
    prompt: str
    clip: Optional[Any] = None
    show_token_ids: bool = False
    tokens: list = field(default_factory=list)
    chunks: list = field(default_factory=list)
    tokenizer_name: str = "unknown"
    total_tokens: int = 0
    chunk_limit: int = 77
    warnings: list = field(default_factory=list)


@dataclass
class AnalysisResult:
    """Structured result from all analyzers."""
    token_info: dict = field(default_factory=dict)
    chunk_info: list = field(default_factory=list)
    statistics: dict = field(default_factory=dict)
    effective_prompt: str = ""
    repeat_info: list = field(default_factory=list)
    conflict_info: list = field(default_factory=list)
    category_info: dict = field(default_factory=dict)
    health_info: dict = field(default_factory=dict)
    suggestions: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Config Loader (hot reload)
# ═══════════════════════════════════════════════════════════════════════════════

class ConfigLoader:
    """Load and hot-reload JSON config files."""

    def __init__(self, config_dir):
        self.config_dir = Path(config_dir) if not isinstance(config_dir, Path) else config_dir
        self._mtimes = {}
        self._cache = {}

    def get(self, filename: str) -> Any:
        filepath = self.config_dir / filename
        if not filepath.exists():
            return self._cache.get(filename)
        mtime = filepath.stat().st_mtime
        if filename not in self._cache or mtime != self._mtimes.get(filename):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    self._cache[filename] = json.load(f)
                self._mtimes[filename] = mtime
            except (json.JSONDecodeError, IOError):
                pass
        return self._cache.get(filename)

    def get_categories(self) -> Dict[str, List[str]]:
        return self.get("categories.json") or {}

    def get_conflicts(self) -> List[List[str]]:
        return self.get("conflicts.json") or []


# ═══════════════════════════════════════════════════════════════════════════════
# Analyzers
# ═══════════════════════════════════════════════════════════════════════════════

class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        ...


class TokenAnalyzer(BaseAnalyzer):
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        if context.clip is not None:
            self._tokenize_with_clip(context)
        else:
            self._tokenize_without_clip(context)
        overflow_chunks = [i for i, c in enumerate(context.chunks) if len(c) > context.chunk_limit]
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
            tok = context.clip.tokenizer
            context.tokenizer_name = tok.model if hasattr(tok, "model") else "CLIP"
        else:
            context.tokenizer_name = "CLIP"
        for key in tokens:
            val = tokens[key]
            if val is None:
                continue
            # Handle both tensor and list returns
            if hasattr(val, "shape"):
                # It's a tensor
                if len(val.shape) >= 2:
                    max_len = val.shape[-1]
                    context.chunk_limit = max_len
                    for chunk_tensor in val.reshape(-1, max_len):
                        chunk_tokens = [t.item() for t in chunk_tensor if t.item() not in (0, 49407)]
                        if chunk_tokens:
                            context.chunks.append(chunk_tokens)
                    break
            elif isinstance(val, list):
                # It's a list of lists (batch of token arrays)
                if val and isinstance(val[0], list):
                    max_len = len(val[0])
                    context.chunk_limit = max_len
                    for chunk_list in val:
                        chunk_tokens = [t for t in chunk_list if t not in (0, 49407)]
                        if chunk_tokens:
                            context.chunks.append(chunk_tokens)
                    break
                elif val:
                    # Flat list of token IDs
                    context.chunk_limit = 77
                    chunk_tokens = [t for t in val if t not in (0, 49407)]
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


class ChunkAnalyzer(BaseAnalyzer):
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        chunk_info = []
        for i, chunk in enumerate(context.chunks):
            token_count = len(chunk)
            limit = context.chunk_limit
            percentage = (token_count / limit * 100) if limit > 0 else 0
            if token_count <= 60:
                status = "✓ Good"
            elif token_count <= 70:
                status = "⚠ Getting Full"
            elif token_count <= 77:
                status = "🟠 Nearly Full"
            else:
                status = "🔴 Overflow"
            if i == 0:
                priority, priority_label = "★★★★★", "first, strongest attention"
            elif i == 1:
                priority, priority_label = "★★★★☆", ""
            elif i == 2:
                priority, priority_label = "★★★☆☆", ""
            elif i == 3:
                priority, priority_label = "★★☆☆☆", ""
            else:
                priority, priority_label = "★☆☆☆☆", ""
            preview = self._get_preview(context.prompt, i)
            chunk_info.append({"index": i, "token_count": token_count, "percentage": percentage,
                               "status": status, "priority": priority, "priority_label": priority_label,
                               "preview": preview})
        result.chunk_info = chunk_info

    def _get_preview(self, prompt: str, idx: int) -> str:
        parts = re.split(r"\bBREAK\b", prompt, flags=re.IGNORECASE)
        if idx < len(parts):
            text = parts[idx].strip()
            return text[:200] + "..." if len(text) > 200 else text
        return ""


class RepeatAnalyzer(BaseAnalyzer):
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        all_words = [w for chunk in context.chunks for w in chunk]
        word_counts = Counter(all_words)
        repeats = [{"concept": str(w), "count": c, "status": f"appears {c}×"}
                   for w, c in word_counts.most_common() if c > 1]
        result.repeat_info = repeats
        result.statistics["repeated_count"] = len(repeats)


class ConflictAnalyzer(BaseAnalyzer):
    def __init__(self, conflicts: Optional[List[List[str]]] = None):
        self.conflicts = conflicts or []

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        all_words = {str(w).lower() for chunk in context.chunks for w in chunk}
        found = []
        for group in self.conflicts:
            present = [w for w in group if w.lower() in all_words]
            if len(present) >= 2:
                found.append({"concepts": present,
                              "severity": "major" if len(present) > 2 else "minor",
                              "warning": f"Potential conflict: {' vs '.join(present)}"})
        result.conflict_info = found


class CategoryAnalyzer(BaseAnalyzer):
    def __init__(self, categories: Optional[Dict[str, List[str]]] = None):
        self.categories = categories or {}

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        all_words = [str(w).lower() for chunk in context.chunks for w in chunk]
        total = len(all_words) or 1
        info = {}
        for cat, kws in self.categories.items():
            count = sum(1 for w in all_words if w in kws)
            pct = count / total * 100
            bars = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
            info[cat] = {"count": count, "percentage": round(pct, 1), "bar": bars}
        result.category_info = info


class HealthAnalyzer(BaseAnalyzer):
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        score, issues = 5, []
        overflow = result.token_info.get("overflow_chunks", [])
        if len(overflow) == 1:
            score -= 2; issues.append("Overflow in 1 chunk")
        elif len(overflow) > 1:
            score -= 3; issues.append(f"Overflow in {len(overflow)} chunks")
        major = [c for c in result.conflict_info if c.get("severity") == "major"]
        minor = [c for c in result.conflict_info if c.get("severity") == "minor"]
        if major:
            score -= 2; issues.append(f"{len(major)} major conflicts")
        if minor:
            score -= 1; issues.append(f"{len(minor)} minor conflicts")
        repeats = result.statistics.get("repeated_count", 0)
        if repeats > 3:
            score -= 1; issues.append(f"{repeats} repeated tags")
        if result.chunk_info:
            counts = [c["token_count"] for c in result.chunk_info]
            if counts and max(counts) > 0 and min(counts) > 0:
                if max(counts) / min(counts) > 3:
                    score -= 1; issues.append("Very uneven chunks")
        score = max(1, min(5, score))
        total_t = result.token_info.get("total_tokens", 0)
        chunk_lim = result.token_info.get("chunk_limit", 77)
        chunk_cnt = result.token_info.get("chunk_count", 1)
        usage = (total_t / (chunk_lim * chunk_cnt) * 100) if chunk_cnt > 0 else 0
        result.health_info = {
            "score": score, "stars": "★" * score + "☆" * (5 - score), "issues": issues,
            "metrics": {"token_usage_pct": round(usage, 1),
                        "chunk_balance": "Excellent" if not issues else "Needs attention",
                        "repeated_tags": repeats, "conflicts": len(result.conflict_info),
                        "overflow": len(overflow)},
        }


class SuggestionEngine(BaseAnalyzer):
    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        suggestions = []
        if result.chunk_info and len(result.chunk_info) > 1:
            quality = ["masterpiece", "best quality", "8k", "ultra detailed"]
            for i, chunk in enumerate(result.chunk_info):
                preview = chunk.get("preview", "").lower()
                for term in quality:
                    if term in preview and i > 0:
                        suggestions.append(f'Move "{term}" to BREAK 1 for stronger emphasis')
        if result.chunk_info:
            under = [c for c in result.chunk_info if c["token_count"] < 20 and c["index"] > 0]
            if len(under) >= 2:
                suggestions.append(f"Consider merging BREAK {', '.join(str(c['index']+1) for c in under)} (both underweighted)")
        for r in result.repeat_info:
            if r["count"] > 3:
                suggestions.append(f'Remove repeated "{r["concept"]}" ({r["count"]} occurrences)')
        for c in result.conflict_info:
            concepts = c.get("concepts", [])
            if len(concepts) >= 2:
                suggestions.append(f'Resolve conflict: {" vs ".join(concepts)}')
        result.suggestions = suggestions


# ═══════════════════════════════════════════════════════════════════════════════
# Analyzer Manager
# ═══════════════════════════════════════════════════════════════════════════════

class AnalyzerManager:
    def __init__(self, config_loader: ConfigLoader):
        self.config_loader = config_loader
        self._build()

    def _build(self) -> None:
        cats = self.config_loader.get_categories()
        confs = self.config_loader.get_conflicts()
        self.analyzers = [TokenAnalyzer(), ChunkAnalyzer(), RepeatAnalyzer(),
                          ConflictAnalyzer(confs), CategoryAnalyzer(cats),
                          HealthAnalyzer(), SuggestionEngine()]

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        self._build()
        for a in self.analyzers:
            try:
                a.analyze(context, result)
            except Exception as e:
                context.warnings.append(f"{a.__class__.__name__} failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# Report Builder
# ═══════════════════════════════════════════════════════════════════════════════

class ReportBuilder:
    def build(self, result: AnalysisResult, fmt: str = "text") -> str:
        if fmt == "json":
            return self._json(result)
        elif fmt == "markdown":
            return self._md(result)
        return self._text(result)

    def _text(self, r: AnalysisResult) -> str:
        L = []
        L.append("═" * 55); L.append("           BOSS PROMPT ANALYZER PRO"); L.append("═" * 55); L.append("")
        L.append("═" * 55); L.append("  CORE ANALYSIS (Exact)"); L.append("═" * 55); L.append("")
        L.append("Model Info")
        L.append(f"  Tokenizer      {r.token_info.get('tokenizer_name', 'unknown')}")
        L.append(f"  Detected Size  {r.token_info.get('chunk_limit', 77)} tokens")
        L.append(f"  Total Tokens   {r.token_info.get('total_tokens', 0)}")
        L.append(f"  BREAK Count    {r.token_info.get('chunk_count', 0) - 1}"); L.append("")
        for c in r.chunk_info:
            L.append(f"─── BREAK {c['index']+1} ─── {c['token_count']} tokens {c['status']} ───")
            L.append(f"  {c['preview'][:100]}..."); L.append("")
        L.append("═" * 55); L.append("  STATISTICS"); L.append("═" * 55)
        L.append(f"  Repeated           {r.statistics.get('repeated_count', 0)}"); L.append("")
        L.append("═" * 55); L.append("  INTELLIGENT ANALYSIS (Heuristic)"); L.append("═" * 55)
        L.append("  Note: Heuristic recommendations — may vary by model."); L.append("")
        L.append("─── PROMPT EMPHASIS ESTIMATE ───")
        for c in r.chunk_info:
            lbl = f"  ({c['priority_label']})" if c['priority_label'] else ""
            L.append(f"  BREAK {c['index']+1}  {c['priority']}{lbl}")
        L.append("")
        if r.category_info:
            L.append("─── CATEGORY BREAKDOWN ───")
            for cat, info in r.category_info.items():
                L.append(f"  {cat:<12} {info['percentage']:>5.1f}%  {info['bar']}")
            L.append("")
        if r.suggestions:
            L.append("═" * 55); L.append("  SUGGESTIONS"); L.append("═" * 55)
            for s in r.suggestions: L.append(f"  → {s}")
            L.append("")
        L.append("═" * 55); L.append("  PROMPT HEALTH"); L.append("═" * 55)
        L.append(f"  {r.health_info.get('stars', '★★★★★')}"); L.append("")
        m = r.health_info.get("metrics", {})
        L.append(f"  Token Usage      {m.get('token_usage_pct', 0)}%  Good")
        L.append(f"  Chunk Balance    {m.get('chunk_balance', 'Unknown')}")
        L.append(f"  Repeated Tags    {m.get('repeated_tags', 0)}")
        L.append(f"  Conflicts        {m.get('conflicts', 0)} found")
        L.append(f"  Overflow         {m.get('overflow', 0)}"); L.append("")
        if r.warnings:
            L.append("═" * 55); L.append("  WARNINGS"); L.append("═" * 55)
            for w in r.warnings: L.append(f"  ⚠ {w}")
            L.append("")
        return "\n".join(L)

    def _json(self, r: AnalysisResult) -> str:
        return json.dumps({"token_info": r.token_info, "chunk_info": r.chunk_info,
                           "statistics": r.statistics, "repeat_info": r.repeat_info,
                           "conflict_info": r.conflict_info, "category_info": r.category_info,
                           "health_info": r.health_info, "suggestions": r.suggestions,
                           "warnings": r.warnings}, indent=2, ensure_ascii=False)

    def _md(self, r: AnalysisResult) -> str:
        L = ["# Boss Prompt Analyzer PRO\n", "## Core Analysis\n"]
        L.append(f"- **Tokenizer:** {r.token_info.get('tokenizer_name', 'unknown')}")
        L.append(f"- **Total Tokens:** {r.token_info.get('total_tokens', 0)}")
        L.append(f"- **Chunks:** {r.token_info.get('chunk_count', 0)}\n")
        L.append("## Chunks\n")
        for c in r.chunk_info:
            L.append(f"### BREAK {c['index']+1} — {c['token_count']} tokens {c['status']}\n")
            L.append(f"```\n{c['preview'][:200]}\n```\n")
        L.append(f"## Health\n**{r.health_info.get('stars', '★★★★★')}**\n")
        if r.suggestions:
            L.append("## Suggestions\n")
            for s in r.suggestions: L.append(f"- {s}")
        return "\n".join(L)


# ═══════════════════════════════════════════════════════════════════════════════
# ComfyUI Node
# ═══════════════════════════════════════════════════════════════════════════════

BASE_DIR = Path(__file__).parent
CONFIG_DIR = BASE_DIR / "config"

# Default categories (used if config file missing)
DEFAULT_CATEGORIES = {
    "Character": ["1girl", "1boy", "solo", "hair", "eyes", "face", "body", "skin", "breasts", "thighs", "lips"],
    "Outfit": ["outfit", "dress", "shirt", "pants", "sneakers", "boots", "hat", "socks", "gloves", "bodysuit"],
    "Pose": ["standing", "sitting", "lying", "kneeling", "pose", "looking at viewer", "full body", "upper body"],
    "Lighting": ["lighting", "sunlight", "moonlight", "shadow", "glow", "backlight", "dappled", "mottled"],
    "Style": ["masterpiece", "best quality", "realistic", "anime", "painting", "8k", "ultra detailed", "photorealistic"],
    "Background": ["forest", "city", "sky", "indoor", "outdoor", "background", "wall", "trees", "moon", "fog"],
}

DEFAULT_CONFLICTS = [
    ["blonde", "black hair", "brunette", "redhead"],
    ["day", "night", "dark", "bright"],
    ["standing", "sitting", "lying", "kneeling"],
    ["smile", "frown", "crying", "laughing"],
    ["indoors", "outdoors", "inside", "outside"],
    ["realistic", "anime", "cartoon", "painting"],
]


class BossPromptAnalyzerPRO:
    """Prompt diagnostics and optimization node."""

    def __init__(self):
        if CONFIG_DIR.exists():
            self.config_loader = ConfigLoader(CONFIG_DIR)
        else:
            self.config_loader = None
        self.manager = None
        self.report_builder = ReportBuilder()

    def _ensure_manager(self):
        if self.manager is None:
            if self.config_loader:
                self.manager = AnalyzerManager(self.config_loader)
            else:
                # Create a no-config manager with defaults
                self.manager = _DefaultAnalyzerManager()

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "clip": ("CLIP",),
                "show_token_ids": ("BOOLEAN", {"default": False}),
                "auto_fix": ("BOOLEAN", {"default": False}),
                "export_format": (["text", "markdown", "json"], {"default": "text"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("analysis", "effective_prompt", "health_summary", "json_report")
    FUNCTION = "analyze"
    CATEGORY = "👑 Boss Nodes/🧵 Text"
    DESCRIPTION = "Prompt diagnostics, optimization, and health scoring."

    def analyze(self, prompt: str, clip: Optional[object] = None,
                show_token_ids: bool = False, auto_fix: bool = False,
                export_format: str = "text"):
        self._ensure_manager()

        # Auto-fix if requested
        if auto_fix:
            prompt = self._auto_fix_prompt(prompt)

        context = AnalysisContext(prompt=prompt, clip=clip, show_token_ids=show_token_ids)
        result = AnalysisResult()
        self.manager.analyze(context, result)
        result.effective_prompt = self._strip_weights(prompt)
        result.warnings = context.warnings
        analysis = self.report_builder.build(result, export_format)
        health = self.report_builder.build(result, "text")
        json_rpt = self.report_builder.build(result, "json")
        return (analysis, result.effective_prompt, health, json_rpt)

    def _auto_fix_prompt(self, prompt: str) -> str:
        """Auto-fix prompt: dedupe, add BREAKs, balance chunks."""
        # Step 1: Strip weights for dedup analysis
        clean = self._strip_weights(prompt)

        # Step 2: Split by existing BREAKs
        parts = re.split(r"\bBREAK\b", clean, flags=re.IGNORECASE)
        parts = [p.strip() for p in parts if p.strip()]

        # Step 3: Flatten to individual tags, dedupe
        seen = set()
        unique_tags = []
        for part in parts:
            tags = [t.strip() for t in re.split(r",", part) if t.strip()]
            for tag in tags:
                tag_lower = tag.lower().strip()
                if tag_lower not in seen:
                    seen.add(tag_lower)
                    unique_tags.append(tag)

        # Step 4: Split into chunks of ~60 tokens (safe under 77)
        TARGET = 60
        chunks = []
        current_chunk = []
        current_count = 0

        for tag in unique_tags:
            # Estimate tokens: ~1 per word + commas
            tag_tokens = len(tag.split()) + 1
            if current_count + tag_tokens > TARGET and current_chunk:
                chunks.append(", ".join(current_chunk))
                current_chunk = [tag]
                current_count = tag_tokens
            else:
                current_chunk.append(tag)
                current_count += tag_tokens

        if current_chunk:
            chunks.append(", ".join(current_chunk))

        # Step 5: Rejoin with BREAKs
        if len(chunks) > 1:
            return " BREAK ".join(chunks)
        return chunks[0] if chunks else prompt

    def _strip_weights(self, prompt: str) -> str:
        r = re.sub(r"\(([^)]+):[0-9.]+\)", r"\1", prompt)
        r = re.sub(r"\(\(([^)]+)\)\)", r"\1", r)
        r = re.sub(r"\[([^\]]+)\]", r"\1", r)
        return r


class _DefaultAnalyzerManager:
    """Manager with embedded defaults (no config file needed)."""
    def __init__(self):
        self.analyzers = [TokenAnalyzer(), ChunkAnalyzer(), RepeatAnalyzer(),
                          ConflictAnalyzer(DEFAULT_CONFLICTS), CategoryAnalyzer(DEFAULT_CATEGORIES),
                          HealthAnalyzer(), SuggestionEngine()]

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        for a in self.analyzers:
            try:
                a.analyze(context, result)
            except Exception as e:
                context.warnings.append(f"{a.__class__.__name__} failed: {e}")


# ComfyUI registration
NODE_CLASS_MAPPINGS = {"BossPromptAnalyzerPRO": BossPromptAnalyzerPRO}
NODE_DISPLAY_NAME_MAPPINGS = {"BossPromptAnalyzerPRO": "👑 Boss Prompt Analyzer PRO"}

# Boss Prompt Analyzer PRO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prompt diagnostics and optimization node that tokenizes prompts with CLIP, analyzes chunk distribution, detects conflicts/repeats, and provides actionable suggestions.

**Architecture:** Plugin-based analyzer system with shared AnalysisContext, AnalysisResult, and separate ReportBuilder for text/markdown/json output. Each analyzer is a focused module that implements `BaseAnalyzer.analyze()`. Config hot-reload via mtime checking.

**Tech Stack:** Python 3.10+, ComfyUI CLIP API, JSON config files

## Global Constraints

- Node class: `BossPromptAnalyzerPRO`
- Category: `👑 Boss Nodes/🧵 Text`
- CLIP input is optional — node works without it (limited analysis)
- Never tokenize twice — reuse `context.tokens` across analyzers
- Error isolation — one failing analyzer doesn't kill the node
- Config hot reload — edit JSON without restarting ComfyUI
- SuggestionEngine runs last (depends on other analyzers)

---

## File Structure

```
boss_prompt_analyzer/
├── boss_prompt_analyzer.py      # Main ComfyUI node class
├── analysis_context.py          # AnalysisContext dataclass
├── analysis_result.py           # AnalysisResult dataclass
├── analyzer_manager.py          # Plugin runner
├── report_builder.py            # Text / Markdown / JSON rendering
├── analyzers/
│   ├── __init__.py              # Re-exports all analyzers
│   ├── base.py                  # BaseAnalyzer interface
│   ├── token_analyzer.py        # Token counts, overflow detection
│   ├── chunk_analyzer.py        # Chunk breakdown, emphasis estimate
│   ├── repeat_analyzer.py       # Duplicate concept detection
│   ├── conflict_analyzer.py     # Antonym/concept conflict detection
│   ├── category_analyzer.py     # Keyword → category mapping
│   ├── health_analyzer.py       # Weighted health score
│   └── suggestion_engine.py     # Actionable recommendations (LAST)
└── config/
    ├── categories.json          # Pluggable category keywords
    ├── conflicts.json           # Antonym pairs
    ├── defaults.json            # Version + default settings
    └── _hot_reload.py           # File watcher for config changes
```

---

### Task 1: Create directory structure and config files

**Files:**
- Create: `boss_prompt_analyzer/__init__.py` (empty)
- Create: `boss_prompt_analyzer/analyzers/__init__.py`
- Create: `boss_prompt_analyzer/config/categories.json`
- Create: `boss_prompt_analyzer/config/conflicts.json`
- Create: `boss_prompt_analyzer/config/defaults.json`

**Interfaces:** None — standalone setup

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p boss_prompt_analyzer/analyzers
mkdir -p boss_prompt_analyzer/config
```

- [ ] **Step 2: Create `boss_prompt_analyzer/__init__.py`**

```python
# Boss Prompt Analyzer PRO
```

- [ ] **Step 3: Create `boss_prompt_analyzer/analyzers/__init__.py`**

```python
from .base import BaseAnalyzer
from .token_analyzer import TokenAnalyzer
from .chunk_analyzer import ChunkAnalyzer
from .repeat_analyzer import RepeatAnalyzer
from .conflict_analyzer import ConflictAnalyzer
from .category_analyzer import CategoryAnalyzer
from .health_analyzer import HealthAnalyzer
from .suggestion_engine import SuggestionEngine

__all__ = [
    "BaseAnalyzer",
    "TokenAnalyzer",
    "ChunkAnalyzer",
    "RepeatAnalyzer",
    "ConflictAnalyzer",
    "CategoryAnalyzer",
    "HealthAnalyzer",
    "SuggestionEngine",
]
```

- [ ] **Step 4: Create `boss_prompt_analyzer/config/categories.json`**

```json
{
  "Character": ["1girl", "1boy", "solo", "hair", "eyes", "face", "body", "skin", "breasts", "thighs", "lips"],
  "Outfit": ["outfit", "dress", "shirt", "pants", "sneakers", "boots", "hat", "socks", "gloves", "bodysuit"],
  "Pose": ["standing", "sitting", "lying", "kneeling", "pose", "looking at viewer", "full body", "upper body"],
  "Lighting": ["lighting", "sunlight", "moonlight", "shadow", "glow", "backlight", "dappled", "mottled"],
  "Style": ["masterpiece", "best quality", "realistic", "anime", "painting", "8k", "ultra detailed", "photorealistic"],
  "Background": ["forest", "city", "sky", "indoor", "outdoor", "background", "wall", "trees", "moon", "fog"]
}
```

- [ ] **Step 5: Create `boss_prompt_analyzer/config/conflicts.json`**

```json
[
  ["blonde", "black hair", "brunette", "redhead"],
  ["day", "night", "dark", "bright"],
  ["standing", "sitting", "lying", "kneeling"],
  ["smile", "frown", "crying", "laughing"],
  ["indoors", "outdoors", "inside", "outside"],
  ["realistic", "anime", "cartoon", "painting"]
]
```

- [ ] **Step 6: Create `boss_prompt_analyzer/config/defaults.json`**

```json
{
  "version": 1,
  "categories_version": 1,
  "conflicts_version": 1,
  "default_chunk_limit": 77,
  "default_export_format": "text"
}
```

- [ ] **Step 7: Commit**

```bash
git add boss_prompt_analyzer/
git commit -m "feat: create boss_prompt_analyzer directory structure and config files"
```

---

### Task 2: Create AnalysisContext and AnalysisResult dataclasses

**Files:**
- Create: `boss_prompt_analyzer/analysis_context.py`
- Create: `boss_prompt_analyzer/analysis_result.py`

**Interfaces:**
- Consumes: None (standalone data structures)
- Produces: `AnalysisContext`, `AnalysisResult` used by all analyzers

- [ ] **Step 1: Create `boss_prompt_analyzer/analysis_context.py`**

```python
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
```

- [ ] **Step 2: Create `boss_prompt_analyzer/analysis_result.py`**

```python
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
```

- [ ] **Step 3: Commit**

```bash
git add boss_prompt_analyzer/analysis_context.py boss_prompt_analyzer/analysis_result.py
git commit -m "feat: add AnalysisContext and AnalysisResult dataclasses"
```

---

### Task 3: Create BaseAnalyzer interface and config hot reload

**Files:**
- Create: `boss_prompt_analyzer/analyzers/base.py`
- Create: `boss_prompt_analyzer/config/_hot_reload.py`

**Interfaces:**
- Consumes: `AnalysisContext`, `AnalysisResult`
- Produces: `BaseAnalyzer` interface used by all analyzers

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/base.py`**

```python
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
```

- [ ] **Step 2: Create `boss_prompt_analyzer/config/_hot_reload.py`**

```python
import json
import os
from pathlib import Path
from typing import Any


class ConfigLoader:
    """Load and hot-reload JSON config files."""

    def __init__(self, config_dir: str | Path):
        self.config_dir = Path(config_dir)
        self._mtimes: dict[str, float] = {}
        self._cache: dict[str, Any] = {}

    def get(self, filename: str) -> Any:
        """Get config data, reloading if file changed."""
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
                # Return cached version on error
                pass
        
        return self._cache.get(filename)

    def get_categories(self) -> dict[str, list[str]]:
        """Get category keywords."""
        return self.get("categories.json") or {}

    def get_conflicts(self) -> list[list[str]]:
        """Get antonym pairs."""
        return self.get("conflicts.json") or []

    def get_defaults(self) -> dict:
        """Get default settings."""
        return self.get("defaults.json") or {}
```

- [ ] **Step 3: Commit**

```bash
git add boss_prompt_analyzer/analyzers/base.py boss_prompt_analyzer/config/_hot_reload.py
git commit -m "feat: add BaseAnalyzer interface and ConfigLoader with hot reload"
```

---

### Task 4: Implement TokenAnalyzer

**Files:**
- Create: `boss_prompt_analyzer/analyzers/token_analyzer.py`

**Interfaces:**
- Consumes: `AnalysisContext` (prompt, clip, show_token_ids)
- Produces: `context.tokens`, `context.chunks`, `context.total_tokens`, `context.chunk_limit`, `context.tokenizer_name`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/token_analyzer.py`**

```python
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

        # Detect overflow
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
        """Use actual CLIP tokenizer."""
        tokens = context.clip.tokenize(context.prompt)
        
        # Get tokenizer name
        if hasattr(context.clip, "tokenizer"):
            tokenizer = context.clip.tokenizer
            if hasattr(tokenizer, "model"):
                context.tokenizer_name = tokenizer.model
            else:
                context.tokenizer_name = "CLIP"
        else:
            context.tokenizer_name = "CLIP"

        # Extract token tensors
        # ComfyUI returns dict with keys like "l", "g", "t5xxl"
        # We use the first available
        for key in tokens:
            token_tensor = tokens[key]
            if token_tensor is not None and len(token_tensor.shape) >= 2:
                # Split by max_length (77) to get chunks
                max_len = token_tensor.shape[-1]
                context.chunk_limit = max_len
                
                # Reshape to chunks of max_len
                flat = token_tensor.reshape(-1, max_len)
                for chunk_tensor in flat:
                    # Filter out padding tokens (0) and end tokens (49407 for CLIP)
                    chunk_tokens = [
                        t.item() for t in chunk_tensor
                        if t.item() not in (0, 49407)
                    ]
                    if chunk_tokens:
                        context.chunks.append(chunk_tokens)
                break

        context.total_tokens = sum(len(c) for c in context.chunks)

        # Store raw tokens if requested
        if context.show_token_ids:
            context.tokens = context.chunks
        else:
            # Store decoded text per token (approximate)
            context.tokens = context.chunks

    def _tokenize_without_clip(self, """Fallback text-based estimation."""
        context: AnalysisContext,
    ) -> None:
        """Estimate tokens without CLIP."""
        context.tokenizer_name = "text-estimate"
        context.chunk_limit = 77

        # Split by BREAK
        parts = re.split(r"\bBREAK\b", context.prompt, flags=re.IGNORECASE)

        for part in parts:
            part = part.strip()
            if not part:
                continue
            # Rough estimate: ~1 token per word + commas
            words = re.findall(r"\S+", part)
            # Estimate token count (very rough)
            estimated = len(words) + part.count(",")
            context.chunks.append(words)
            context.tokens.append(words)

        context.total_tokens = sum(len(c) for c in context.chunks)
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/token_analyzer.py
git commit -m "feat: add TokenAnalyzer with CLIP and fallback tokenization"
```

---

### Task 5: Implement ChunkAnalyzer

**Files:**
- Create: `boss_prompt_analyzer/analyzers/chunk_analyzer.py`

**Interfaces:**
- Consumes: `context.chunks`, `context.chunk_limit`, `context.prompt`
- Produces: `result.chunk_info`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/chunk_analyzer.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/chunk_analyzer.py
git commit -m "feat: add ChunkAnalyzer with priority stars and status"
```

---

### Task 6: Implement RepeatAnalyzer

**Files:**
- Create: `boss_prompt_analyzer/analyzers/repeat_analyzer.py`

**Interfaces:**
- Consumes: `context.chunks`
- Produces: `result.repeat_info`, `result.statistics["repeated_count"]`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/repeat_analyzer.py`**

```python
from __future__ import annotations
from collections import Counter
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class RepeatAnalyzer(BaseAnalyzer):
    """Detect repeated concepts across chunks."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        # Flatten all chunks into word list
        all_words = []
        for chunk in context.chunks:
            # chunk is list of token IDs or words
            all_words.extend(chunk)

        # Count occurrences
        word_counts = Counter(all_words)

        # Find repeats (appear more than once)
        repeats = []
        for word, count in word_counts.most_common():
            if count > 1:
                repeats.append({
                    "concept": str(word),
                    "count": count,
                    "status": f"appears {count}×",
                })

        result.repeat_info = repeats
        result.statistics["repeated_count"] = len(repeats)
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/repeat_analyzer.py
git commit -m "feat: add RepeatAnalyzer for duplicate detection"
```

---

### Task 7: Implement ConflictAnalyzer

**Files:**
- Create: `boss_prompt_analyzer/analyzers/conflict_analyzer.py`

**Interfaces:**
- Consumes: `context.chunks`, config `conflicts.json`
- Produces: `result.conflict_info`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/conflict_analyzer.py`**

```python
from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class ConflictAnalyzer(BaseAnalyzer):
    """Detect conflicting concepts (antonyms)."""

    def __init__(self, conflicts: list[list[str]] | None = None):
        self.conflicts = conflicts or []

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        # Flatten all chunks to text
        all_words = set()
        for chunk in context.chunks:
            for word in chunk:
                all_words.add(str(word).lower())

        conflicts_found = []

        for conflict_group in self.conflicts:
            # Check if any two words from this group are present
            present = [w for w in conflict_group if w.lower() in all_words]
            if len(present) >= 2:
                conflicts_found.append({
                    "concepts": present,
                    "severity": "major" if len(present) > 2 else "minor",
                    "warning": f"Potential conflict: {' vs '.join(present)}",
                })

        result.conflict_info = conflicts_found
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/conflict_analyzer.py
git commit -m "feat: add ConflictAnalyzer for antonym detection"
```

---

### Task 8: Implement CategoryAnalyzer

**Files:**
- Create: `boss_prompt_analyzer/analyzers/category_analyzer.py`

**Interfaces:**
- Consumes: `context.chunks`, config `categories.json`
- Produces: `result.category_info`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/category_analyzer.py`**

```python
from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class CategoryAnalyzer(BaseAnalyzer):
    """Classify concepts into categories."""

    def __init__(self, categories: dict[str, list[str]] | None = None):
        self.categories = categories or {}

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        # Flatten all chunks to words
        all_words = []
        for chunk in context.chunks:
            all_words.extend(str(w).lower() for w in chunk)

        total = len(all_words) if all_words else 1
        category_counts = {}

        for category, keywords in self.categories.items():
            count = sum(1 for word in all_words if word in keywords)
            category_counts[category] = count

        # Convert to percentages
        category_info = {}
        for category, count in category_counts.items():
            percentage = (count / total * 100) if total > 0 else 0
            bars = "█" * int(percentage / 5) + "░" * (20 - int(percentage / 5))
            category_info[category] = {
                "count": count,
                "percentage": round(percentage, 1),
                "bar": bars,
            }

        result.category_info = category_info
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/category_analyzer.py
git commit -m "feat: add CategoryAnalyzer for keyword classification"
```

---

### Task 9: Implement HealthAnalyzer

**Files:**
- Create: `boss_prompt_analyzer/analyzers/health_analyzer.py`

**Interfaces:**
- Consumes: `result.token_info`, `result.chunk_info`, `result.repeat_info`, `result.conflict_info`
- Produces: `result.health_info`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/health_analyzer.py`**

```python
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
        stars = "★" * score + "☆" * (5 - score)

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
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/health_analyzer.py
git commit -m "feat: add HealthAnalyzer with weighted scoring"
```

---

### Task 10: Implement SuggestionEngine

**Files:**
- Create: `boss_prompt_analyzer/analyzers/suggestion_engine.py`

**Interfaces:**
- Consumes: All previous analyzer results (MUST run last)
- Produces: `result.suggestions`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzers/suggestion_engine.py`**

```python
from __future__ import annotations
from typing import TYPE_CHECKING

from .base import BaseAnalyzer

if TYPE_CHECKING:
    from ..analysis_context import AnalysisContext
    from ..analysis_result import AnalysisResult


class SuggestionEngine(BaseAnalyzer):
    """Generate actionable suggestions. MUST run last."""

    def analyze(self, context: AnalysisContext, result: AnalysisResult) -> None:
        suggestions = []

        # Suggest moving important terms to earlier chunks
        if result.chunk_info and len(result.chunk_info) > 1:
            # Check if quality tags are in later chunks
            quality_terms = ["masterpiece", "best quality", "8k", "ultra detailed"]
            for i, chunk in enumerate(result.chunk_info):
                preview = chunk.get("preview", "").lower()
                for term in quality_terms:
                    if term in preview and i > 0:
                        suggestions.append(
                            f'Move "{term}" to BREAK 1 for stronger emphasis'
                        )

        # Suggest merging underweighted chunks
        if result.chunk_info:
            underweighted = [
                c for c in result.chunk_info
                if c["token_count"] < 20 and c["index"] > 0
            ]
            if len(underweighted) >= 2:
                indices = [str(c["index"] + 1) for c in underweighted]
                suggestions.append(
                    f"Consider merging BREAK {', '.join(indices)} (both underweighted)"
                )

        # Suggest removing excessive repeats
        for repeat in result.repeat_info:
            if repeat["count"] > 3:
                suggestions.append(
                    f'Remove repeated "{repeat["concept"]}" ({repeat["count"]} occurrences)'
                )

        # Suggest addressing conflicts
        for conflict in result.conflict_info:
            concepts = conflict.get("concepts", [])
            if len(concepts) >= 2:
                suggestions.append(
                    f'Resolve conflict: {" vs ".join(concepts)}'
                )

        result.suggestions = suggestions
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzers/suggestion_engine.py
git commit -m "feat: add SuggestionEngine for actionable recommendations"
```

---

### Task 11: Implement AnalyzerManager

**Files:**
- Create: `boss_prompt_analyzer/analyzer_manager.py`

**Interfaces:**
- Consumes: All analyzers, `AnalysisContext`, `AnalysisResult`
- Produces: Populated `AnalysisResult`

- [ ] **Step 1: Create `boss_prompt_analyzer/analyzer_manager.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/analyzer_manager.py
git commit -m "feat: add AnalyzerManager with error isolation and hot reload"
```

---

### Task 12: Implement ReportBuilder

**Files:**
- Create: `boss_prompt_analyzer/report_builder.py`

**Interfaces:**
- Consumes: `AnalysisResult`, export format
- Produces: Formatted STRING outputs

- [ ] **Step 1: Create `boss_prompt_analyzer/report_builder.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add boss_prompt_analyzer/report_builder.py
git commit -m "feat: add ReportBuilder for text/markdown/JSON output"
```

---

### Task 13: Implement main node class

**Files:**
- Create: `boss_prompt_analyzer/boss_prompt_analyzer.py`

**Interfaces:**
- Consumes: All previous modules
- Produces: ComfyUI node class

- [ ] **Step 1: Create `boss_prompt_analyzer/boss_prompt_analyzer.py`**

```python
from __future__ import annotations
import os
from typing import Optional

from .analysis_context import AnalysisContext
from .analysis_result import AnalysisResult
from .analyzer_manager import AnalyzerManager
from .report_builder import ReportBuilder
from .config._hot_reload import ConfigLoader

# Config directory
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
        # Create context
        context = AnalysisContext(
            prompt=prompt,
            clip=clip,
            show_token_ids=show_token_ids,
        )

        # Create result
        result = AnalysisResult()

        # Run all analyzers
        self.manager.analyze(context, result)

        # Build effective prompt (strip weights)
        result.effective_prompt = self._build_effective_prompt(prompt)

        # Add warnings to result
        result.warnings = context.warnings

        # Build reports
        analysis_text = self.report_builder.build(result, export_format)
        health_summary = self.report_builder.build(result, "text")
        json_report = self.report_builder.build(result, "json")

        return (analysis_text, result.effective_prompt, health_summary, json_report)

    def _build_effective_prompt(self, prompt: str) -> str:
        """Strip weights from prompt for comparison."""
        import re
        # Remove (word:weight) → word
        result = re.sub(r"\(([^)]+):[0-9.]+\)", r"\1", prompt)
        # Remove ((word)) → word
        result = re.sub(r"\(\(([^)]+)\)\)", r"\1", result)
        # Remove [word] → word
        result = re.sub(r"\[([^\]]+)\]", r"\1", result)
        return result
```

- [ ] **Step 2: Register node in `__init__.py`**

Add to main `__init__.py`:

```python
# Boss Prompt Analyzer PRO
try:
    from boss_prompt_analyzer.boss_prompt_analyzer import BossPromptAnalyzerPRO
    NODE_CLASS_MAPPINGS["BossPromptAnalyzerPRO"] = BossPromptAnalyzerPRO
    NODE_DISPLAY_NAME_MAPPINGS["BossPromptAnalyzerPRO"] = "👑 Boss Prompt Analyzer PRO"
except Exception as e:
    print(f"Failed to load BossPromptAnalyzerPRO: {e}")
```

- [ ] **Step 3: Commit**

```bash
git add boss_prompt_analyzer/boss_prompt_analyzer.py __init__.py
git commit -m "feat: add BossPromptAnalyzerPRO main node class"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run node registration test**

```bash
cd F:\ComfyUI
python -c "from custom_nodes.comfyui-Boss_Nodes.boss_prompt_analyzer.boss_prompt_analyzer import BossPromptAnalyzerPRO; print('OK')"
```

- [ ] **Step 2: Test with sample prompt**

```python
from boss_prompt_analyzer.boss_prompt_analyzer import BossPromptAnalyzerPRO

node = BossPromptAnalyzerPRO()
result = node.analyze(
    prompt="1girl, solo, blonde hair, blue eyes, masterpiece, (dark:0.5), BREAK city, night",
    clip=None,
    show_token_ids=False,
    export_format="text",
)
print(result[0])  # analysis text
```

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: Boss Prompt Analyzer PRO complete"
```

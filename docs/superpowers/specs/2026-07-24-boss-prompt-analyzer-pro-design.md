# Boss Prompt Analyzer PRO — Design Spec

**Date:** 2026-07-24
**Status:** Approved
**Rating:** 10/10

## Purpose

A prompt diagnostics and optimization node for ComfyUI that tokenizes prompts with the actual CLIP model, analyzes chunk distribution, detects conflicts/repeats, and provides actionable suggestions. Serves as the foundation for a reusable Boss Analysis Framework.

## Node Signature

```python
class BossPromptAnalyzerPRO:
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
```

## Behavior

| `clip` connected | Behavior |
|------------------|----------|
| Yes | Full analysis with actual tokenizer, exact token IDs |
| No | Limited analysis — text-based estimation, no token IDs, heuristic chunk splitting |

## Architecture

```
boss_prompt_analyzer/
├── boss_prompt_analyzer.py      # Main node
├── analysis_context.py          # AnalysisContext dataclass
├── analysis_result.py           # AnalysisResult dataclass
├── analyzer_manager.py          # Plugin runner
├── report_builder.py            # Text / Markdown / JSON rendering
├── analyzers/
│   ├── __init__.py
│   ├── base.py                  # BaseAnalyzer interface
│   ├── token_analyzer.py        # Token counts, overflow
│   ├── chunk_analyzer.py        # Chunk breakdown
│   ├── repeat_analyzer.py       # Duplicate detection
│   ├── conflict_analyzer.py     # Antonym detection
│   ├── category_analyzer.py     # Keyword → category mapping
│   ├── health_analyzer.py       # Weighted health score
│   └── suggestion_engine.py     # Actionable recommendations (LAST)
└── config/
    ├── categories.json          # Pluggable categories
    ├── conflicts.json           # Antonym pairs
    ├── defaults.json            # Version + default settings
    └── _hot_reload.py           # File watcher for config changes
```

## Data Flow

```
prompt + clip (optional)
        ↓
  AnalysisContext
        ↓
  AnalyzerManager
  ├── TokenAnalyzer      → context.tokens, context.chunks
  ├── ChunkAnalyzer      → uses context.tokens
  ├── RepeatAnalyzer     → uses context.tokens
  ├── ConflictAnalyzer   → uses context.chunks
  ├── CategoryAnalyzer   → uses context.chunks
  ├── HealthAnalyzer     → uses all above
  └── SuggestionEngine   → uses all above (LAST)
        ↓
  AnalysisResult
        ↓
  ReportBuilder
  ├── TextReport
  ├── MarkdownReport
  └── JsonReport
        ↓
  STRING outputs
```

## Core Principles

1. **AnalysisContext** — shared typed object, not magic dict
2. **AnalysisResult** — structured data object
3. **ReportBuilder** — separate from analyzers (text/markdown/json/future UI)
4. **Tokenize once** — every analyzer reuses `context.tokens`
5. **Error isolation** — one failing analyzer doesn't kill the node
6. **Config hot reload** — edit JSON without restarting ComfyUI
7. **SuggestionEngine last** — depends on other analyzers
8. **Plugin architecture** — one-line additions for new analyzers

## Health Score Weights

| Issue | Penalty |
|-------|--------:|
| Overflow (1 chunk) | -2 |
| Multiple overflow chunks | -3 |
| Major conflicts (day/night) | -2 |
| Minor conflicts (smile/frown) | -1 |
| Many repeats (>3) | -1 |
| Very uneven chunks | -1 |
| All weight in one chunk | -1 |

## Config Files

### categories.json
```json
{
  "Character": ["1girl", "1boy", "solo", "hair", "eyes", "face", "body", "skin"],
  "Outfit": ["outfit", "dress", "shirt", "pants", "sneakers", "boots", "hat"],
  "Pose": ["standing", "sitting", "lying", "kneeling", "pose", "looking at"],
  "Lighting": ["lighting", "sunlight", "moonlight", "shadow", "glow", "backlight"],
  "Style": ["masterpiece", "best quality", "realistic", "anime", "painting", "8k"],
  "Background": ["forest", "city", "sky", "indoor", "outdoor", "background", "wall"]
}
```

### conflicts.json
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

### defaults.json
```json
{
  "version": 1,
  "categories_version": 1,
  "conflicts_version": 1,
  "default_chunk_limit": 77,
  "default_export_format": "text"
}
```

## Future Expansion Hooks

```
Future Analyzers (one-line additions):
├── EmotionAnalyzer
├── DanbooruTagValidator
├── ModelSpecificTips
├── BatchComparisonMode
├── HistoryTracker
├── LoRAUsageAnalysis
└── PromptOptimizer
```

## Future UI

```
┌─────────────────────────────┐
███████████░░░░░░░  Chunk 1  52/77
████████░░░░░░░░░  Chunk 2  38/77
██████░░░░░░░░░░░  Chunk 3  28/77
█████░░░░░░░░░░░░  Chunk 4  24/77
─────────────────────────────┐
Prompt Health  ★★★★☆
─────────────────────────────┐
Suggestions
• Move masterpiece earlier
• Remove duplicate blue
• Merge last chunks
└─────────────────────────────┘
```

## Implementation Notes

- Use ComfyUI's `clip.tokenize()` for actual tokenization
- Never tokenize twice — reuse `context.tokens` across analyzers
- Config hot reload via mtime checking
- Error isolation per analyzer with warning collection
- SuggestionEngine must run last (depends on other analyzers)

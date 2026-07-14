"""Shared utilities for the Boss Nodes ComfyUI custom node pack.

This package contains extracted helper functions to reduce code duplication
across the 26 Python modules in the Boss Nodes project.

Modules:
    constants    -- Shared constants (SEED_MAX, STRENGTH_*, WEIGHT_FORMAT_*)
    prompt_utils -- Prompt weighting, clamping, boolean parsing
    validation   -- Input sanitization and validation helpers
    json_utils   -- Atomic JSON file I/O with backup support
    logging_utils -- Prefixed logging factory
    cache_utils  -- Shared cache classes for JSON library hot-reload
    file_utils   -- File path helpers
    ui_utils     -- HTML preview generation helpers
"""

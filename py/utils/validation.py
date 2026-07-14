"""Shared input validation utilities for the Boss Nodes ComfyUI custom node pack.

This module contains extracted helper functions for validating and
sanitizing node inputs that were previously duplicated across multiple
node modules.

Functions:
    sanitize_entries(raw) -- Validate library entries (name: text dicts)
    sanitize_categories(raw, valid_keys) -- Validate category lists
    validate_name(name, max_length) -- Validate a user-provided name
"""

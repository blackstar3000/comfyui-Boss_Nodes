# Task 2 Report: Update `_load_library()` normalization

## Changes

Added `_normalize_entries()` function inside `_load_library()` that converts legacy string values to objects with `{name, prompt, description, favorite, preview}` structure, and fills missing fields via `setdefault` for existing dict entries.

Replaced `sanitize_entries()` calls with `_normalize_entries()` calls.

## Commit

`7dc9f07` feat(camera): normalize legacy string values to objects in _load_library

## Compile Check

Passed (`py_compile.compile` → OK)

## Concerns

**Downstream breakage:** `_resolve()` returns `data.get(choice)` which now yields a `dict` instead of a `str`. `apply_weight()` expects a string — this will break the prompt building pipeline. This is expected to be addressed in a later task but should be noted.

`_to_slug()` (Task 1) is not used in this task's code — the brief mentions it as a dependency but the normalization doesn't call it yet.

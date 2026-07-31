# Task 1 Report: Python `_BoosterLibrary` helper class

## What was implemented

- Added `_FILES` dict mapping collection keys to file paths (needed by `_write_json`)
- Added `_BoosterLibrary` class with 6 methods:
  - `load(key, force)` — delegates to `_Collection.load()` and returns items
  - `save_entry(key, name, text, category)` — flat set for quality, nested set for negatives
  - `delete_entry(key, name, category)` — pops entry, cleans empty presets
  - `list_entries(key)` — returns current data
  - `_count(key, data)` — counts entries (len for quality, sum of nested values for negatives)
  - `_write_json(key, data)` — atomic write via tempfile + `os.replace`
- Added `_library = _BoosterLibrary()` instance

## What was tested

- `py_compile` on `prompt_booster_pro.py` — clean, no output (success)

## Files changed

- `py/prompt_booster_pro.py` — inserted `_FILES`, `_BoosterLibrary` class, and `_library` instance after line 90, before `_log` definition

## Self-review findings

- The plan's Step 1 code referenced `_FILES[key]` but didn't include the `_FILES` dict definition. Added it — required for `_write_json` to locate the JSON files.
- No other issues. All imports (`json`, `os`, `tempfile`) were already available.

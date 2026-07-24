# Task 1 Report: Python — `_save_json()` + slug helpers

## Changes

- Added `import re` after existing imports in `py/camera_style_mixer.py`
- Added three helpers after `_log` declaration:
  - `_to_slug(name)` — normalizes name to slug format
  - `_unique_slug(slug, existing)` — ensures slug uniqueness with _2, _3 suffix
  - `_save_json(path, data)` — atomic JSON write via tmp + os.replace

## Verification

- Python compile check: **OK**
- All three functions follow exact spec from task brief

## Commit

`0523ff6` — feat(camera): add _save_json, _to_slug, _unique_slug helpers

## Concerns

None. Implementation matches spec exactly.

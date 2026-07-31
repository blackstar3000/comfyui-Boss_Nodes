# Prompt Booster PRO — Live Add/Edit/Delete System

## Goal

Add full CRUD support to the Prompt Booster PRO ComfyUI node so users can create, edit, duplicate, and delete boosters directly from the editor UI. Every change updates all views instantly — no refresh, restart, or reopen required.

## Current State

- **Python** (`py/prompt_booster_pro.py`): Two read-only collections loaded from JSON files via `_Collection` class. HTTP routes: `/prompt_booster_pro/data` (GET) and `/prompt_booster_pro/refresh` (POST). No save/delete routes.
- **JavaScript** (`js/prompt_booster_pro/index.js`): `BoosterEditor` class with modal UI. Fetches data, lets user pick levels and adjust strength/format. No CRUD operations.
- **Shared** (`js/boss_theme/index.js`): `CollectionController`, `CollectionEditorDialog`, `CollectionCRUDWidget` — proven CRUD components used by Prompt Master Library Pro and Camera Style Mixer.

## Data Structures

### Quality Boosters (`quality_boosts.json`)
Flat dict: `{ "name": "prompt text" }`
Example: `{ "masterpiece": "masterpiece, best quality, ultra-detailed" }`

### Negative Boosters (`negative_boosts.json`)
Nested dict: `{ "preset": { "level": "prompt text" } }`
Example: `{ "default": { "god tier": "lowres, bad anatomy, blurry..." } }`

## Architecture

### Python: `_BoosterLibrary` Helper Class

Isolates storage differences (flat vs nested) behind a uniform interface:

```python
class _BoosterLibrary:
    def load(self, key: str, force: bool = False) -> dict
    def save_entry(self, key: str, name: str, text: str, category: str = "") -> dict
    def delete_entry(self, key: str, name: str, category: str = "") -> dict
    def list_entries(self, key: str) -> dict
    def _write_json(self, key: str, data: dict) -> None  # atomic write via temp file
```

- Quality uses `category=""` (flat storage)
- Negatives uses `category=preset` (nested storage)
- Atomic writes: write to temp file, then replace original

### Python: HTTP Routes

```
POST /booster_boss/save    — Create or update entry
POST /booster_boss/delete  — Delete entry
POST /booster_boss/refresh — Force reload all collections
```

Request/response shapes mirror Prompt Master Library Pro exactly.

**Save request:**
```json
{
  "type": "quality" | "negatives",
  "name": "masterpiece",
  "prompt": "masterpiece, best quality...",
  "category": "" | "default"
}
```

**Delete request:**
```json
{
  "type": "quality" | "negatives",
  "name": "masterpiece",
  "category": "" | "default"
}
```

### JavaScript: Editor Changes

The editor modal becomes two-panel:

| Left Panel | Right Panel |
|------------|-------------|
| `CollectionCRUDWidget` (list + search + add/edit/delete/duplicate) | Strength sliders, weight format, custom text, live preview |

### CRUD Operations

1. **Add**: Opens `CollectionEditorDialog` → saves → auto-selects new entry → refreshes only affected dropdown
2. **Edit**: Opens `CollectionEditorDialog` pre-filled → saves → preserves selection, search, scroll
3. **Delete**: Confirmation dialog → removes → clears selection if deleted item was selected
4. **Duplicate**: Creates "{name} Copy" → opens rename dialog immediately
5. **Rename**: Opens `CollectionEditorDialog` with name field only

### UI State Preservation

After every CRUD action, preserve:
- Selected booster
- Selected category/preset
- Search text
- Scroll position
- Slider values
- Custom text overrides
- Weight format selections
- Preview state

### Live Preview

Typing in name/prompt fields updates preview on every keystroke. No Save required.

### Dropdown Refresh Strategy

- Editing a Quality booster → refresh only quality dropdown
- Editing a Negative booster → refresh only negative presets/levels dropdowns
- Never touch unrelated dropdowns

## Reuse

### From `boss_theme/index.js` (import as-is)
- `CollectionController` — HTTP CRUD wrapper
- `CollectionEditorDialog` — Add/edit dialog with name, prompt, description, favorite fields
- `CollectionCRUDWidget` — List with search, add, edit, delete, favorite toggle, context menu
- `BossDropdown` — Styled dropdown component

### From `prompt_master_library_pro.py` (mirror pattern)
- `_save_library_json()` — atomic write pattern
- `/master_boss/save` route — request/response shape
- `/master_boss/delete` route — request/response shape
- `/master_boss/refresh` route — force reload pattern

## Files Modified

1. `py/prompt_booster_pro.py` — Add `_BoosterLibrary` class, 3 HTTP routes
2. `js/prompt_booster_pro/index.js` — Import CRUD components, rebuild editor modal

## Files NOT Modified

- `js/boss_theme/index.js` — Reuse existing components, no changes needed
- `py/quality_boosts.json` — Schema unchanged
- `py/negative_boosts.json` — Schema unchanged
- Node class signature, inputs, outputs, return types — all unchanged

## Verification

1. Syntax check: `python -m py_compile py/prompt_booster_pro.py`
2. JS syntax: no errors in browser console
3. Manual test: Open editor → Add quality booster → appears in list → select → preview updates → Save → entry persists after reopen
4. Manual test: Delete booster → confirmation → removed from list → dropdown updates
5. Manual test: Duplicate → creates copy → rename → saves as new entry
6. Manual test: Edit existing entry → changes save → UI state preserved

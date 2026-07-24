# Camera Style Mixer CRUD — Shared Framework Design

## Overview

Add full CRUD (Add/Edit/Delete) to all three Camera Style Mixer collections (angles, framings, styles) using a reusable CRUD framework extracted into shared components. The framework will be usable by Character Builder and future libraries.

## Goals

1. Full CRUD for angles, framings, and styles — identical UX across all three
2. Reusable framework — no code duplication between collections or nodes
3. Future-proof data model — object-based JSON with extensible metadata
4. Backward compatibility — existing JSON files and workflows work without changes
5. Stable IDs — slug-based dictionary keys, display names stored in `.name`

## Data Model

### JSON Format

```json
{
  "camera_angles": {
    "dutch_angle": {
      "name": "Dutch Angle",
      "prompt": "dutch angle, tilted camera, dynamic tension",
      "description": "",
      "favorite": false,
      "preview": ""
    }
  },
  "camera_framings": {
    "close_up": {
      "name": "Close-Up",
      "prompt": "tight close-up, intense emotion, detailed face",
      "description": "",
      "favorite": false,
      "preview": ""
    }
  },
  "art_styles": {
    "greg_rutkowski": {
      "name": "Greg Rutkowski",
      "prompt": "greg rutkowski, epic fantasy, ultra detailed, dramatic lighting",
      "description": "",
      "favorite": false,
      "preview": ""
    }
  },
  "angle_categories": {
    "Most Dramatic": ["dutch_angle", "low_angle"]
  },
  "framing_categories": {
    "Intimate": ["close_up", "extreme_close_up"]
  },
  "style_categories": {
    "Best Artists": ["greg_rutkowski", "alphonse_mucha"]
  }
}
```

### Key Rules

- Dictionary key = slug (lowercase, underscores, stable ID)
- `.name` = display name (editable)
- `.prompt` = the prompt text sent to the model
- `.description` = optional notes (future use)
- `.favorite` = boolean for favorites filtering (future use)
- `.preview` = optional preview image URL (future use)
- Categories reference slugs, not names
- Renaming changes `.name` only — slug and category refs stay intact

### Backward Compatibility

`_load_library()` detects value type:
- **String** (legacy): normalized to `{"name": key, "prompt": value, "description": "", "favorite": false, "preview": ""}`
- **Object** (new): used as-is

Category references:
- **Name-based** (legacy): accepted, slug resolved at lookup time
- **Slug-based** (new): preferred

## Architecture

### Shared Components (JS)

All components live in `js/boss_theme/index.js`.

#### 1. CollectionModel

Data access layer for normalized collection objects.

```javascript
class CollectionModel {
  static normalize(rawData, type)
  // Converts legacy string values to objects
  // Returns {slug: {name, prompt, description, favorite, preview}}

  static toSlug(name, existingSlugs)
  // Generates stable ID: "Dutch Angle" → "dutch_angle"
  // Lowercase, spaces→underscores, strip non-alphanumeric
  // If slug already exists in existingSlugs: appends _2, _3, ... until unique
  // Returns the unique slug

  static validate(item, existingSlugs, excludeSlug)
  // Checks: name non-empty, prompt non-empty, name unique (case-insensitive),
  //   generated slug unique in existingSlugs (excluding excludeSlug if renaming)
  // Returns {ok: bool, error: string}

  static dedupe(items, existingSlug)
  // Ensures unique display names
}
```

#### 2. CollectionController

CRUD operations — talks to backend API.

```javascript
class CollectionController {
  constructor(baseUrl = "/camera_boss")

  async add(type, item, categories)
  // POST /camera_boss/save with no slug → backend generates unique slug
  // Backend checks slug uniqueness, appends _2/_3 if needed
  // Returns {ok, slug, error}

  async edit(type, slug, item, categories)
  // POST /camera_boss/save with slug → backend updates
  // Returns {ok, error}

  async delete(type, slug)
  // POST /camera_boss/delete
  // Returns {ok, error}

  async refresh()
  // POST /camera_boss/refresh → returns fresh library data
  // Returns {ok, data, error}
}
```

#### 3. CollectionCRUDWidget

Per-collection list with toolbar, edit/delete icons, context menu.

```javascript
class CollectionCRUDWidget {
  constructor({title, data, categories, selectedSlug, onAdd, onSelect, onEdit, onDelete})
  // Renders: search input + item list + Add button

  render() → HTMLElement
  // Each item row: name (click to select), edit icon, delete icon, favorite star
  // Keyboard: Enter to select, Delete to remove, arrow keys to navigate
  // Context menu: Edit, Delete, Toggle Favorite

  refresh(newData, newCategories)
  // Re-renders list with fresh data

  setSelected(slug)
  // Updates selection highlight
}
```

#### 4. CollectionEditorDialog

Modal for add/edit with validation.

```javascript
class CollectionEditorDialog {
  constructor({title, item, isEdit, onSave, onCancel})
  // Fields: Name (text), Prompt (textarea), Description (textarea), Favorite (toggle)

  open() → Promise<{name, prompt, description, favorite} | null>
  // Returns item on save, null on cancel
  // Keyboard: Ctrl+Enter to save, Escape to cancel
  // Validation: name required + unique, prompt required
}
```

### Backend API Changes (Python)

#### New Endpoints

```
POST /camera_boss/save    — {type, slug, name, prompt, description, favorite, categories}
POST /camera_boss/delete  — {type, slug}
```

#### `/camera_boss/save` Logic

1. Validate `type` is "angles" | "framings" | "styles"
2. Validate `name` and `prompt` non-empty
3. If `slug` provided and exists → update entry
4. If `slug` not provided → generate slug from name, ensure uniqueness (append _2/_3 if needed), add new entry
5. Update categories: add to selected, remove from unselected
6. Write JSON atomically (temp file → rename)
7. Return updated collection data + count + slug

#### `/camera_boss/delete` Logic

1. Validate `type` and `slug`
2. Remove entry from collection dict
3. Remove slug from all category lists
4. Write JSON atomically
5. Return updated collection data + count

#### `_save_json()` Helper

```python
def _save_json(path: Path, data: dict):
    """Atomic write: write to .tmp then os.rename."""
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)
```

#### `_load_library()` Changes

- Detect string vs object values during load
- Normalize strings to object format internally
- Build `slugMap` for each type (slug → display name)
- Return slug maps in `/camera_boss/data` response

### Frontend Integration (Camera Editor)

#### Editor Modal Changes

Each collection section gets a CRUD row below its list:

```
┌─ Angle ──────────────────────┐
│ [Search input]               │
│ ┌──────────────────────────┐ │
│ │ ✓ Dutch Angle        ✎ 🗑│ │
│ │   Low Angle          ✎ 🗑│ │
│ │   (random)               │ │
│ │   (none)                 │ │
│ └──────────────────────────┘ │
│ [＋ Add Angle]               │
│ [Angle Category ▾]           │
│ [Angle Strength ────●──]     │
└──────────────────────────────┘
```

#### State Changes

- Selection stores slug: `cameraAngle: "dutch_angle"`
- Header rendering resolves slug → display name via `lib.angleSlugMap[slug]`
- Legacy name-based state auto-migrated on load (if slug not found, try name match)

#### On Save/Edit/Delete

1. Controller calls backend
2. Backend returns updated collection
3. Editor calls `fetchData()` to refresh library
4. List re-renders with fresh data
5. Status bar shows "Saved" / "Deleted" briefly

## Migration

### One-time JSON Migration

Convert `camera_style_mixer.json` from name-based keys to slug-based keys. Both entries AND category lists are migrated in one shot.

```python
def to_slug(name: str) -> str:
    """Lowercase, spaces→underscores, strip non-alphanumeric."""
    import re
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    return slug or "entry"

def unique_slug(slug: str, existing: set) -> str:
    """Append _2, _3, ... until unique."""
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}_{n}" in existing:
        n += 1
    return f"{slug}_{n}"

def migrate_to_slugs(data: dict, entry_key: str, cat_key: str) -> dict:
    """Convert name-keyed entries and category refs to slug-based."""
    old_entries = data.get(entry_key, {})
    old_cats = data.get(cat_key, {})

    # Build name→slug mapping
    name_to_slug = {}
    used_slugs = set()
    for name in old_entries:
        slug = unique_slug(to_slug(name), used_slugs)
        used_slugs.add(slug)
        name_to_slug[name] = slug

    # Migrate entries
    new_entries = {}
    for name, value in old_entries.items():
        slug = name_to_slug[name]
        if isinstance(value, str):
            new_entries[slug] = {"name": name, "prompt": value, "description": "", "favorite": False, "preview": ""}
        else:
            value["name"] = name
            new_entries[slug] = value

    # Migrate category lists (name refs → slug refs)
    new_cats = {}
    for cat_name, members in old_cats.items():
        if not isinstance(members, list):
            continue
        new_cats[cat_name] = [name_to_slug.get(m, m) for m in members]

    data[entry_key] = new_entries
    data[cat_key] = new_cats
    return data
```

Run once on all three collection types, commit the migrated JSON.

## What Stays the Same

- Node class, inputs, outputs, hidden state — unchanged
- Category filtering, strength sliders, weight format — unchanged
- Hot-reload, seed system, graphToPrompt injection — unchanged
- All existing workflows load without modification

## Out of Scope

- `camera_lenses` and `quality_boosters` sections in the JSON — these are not used by the current node and are left as-is (legacy string format). They can be migrated to the CRUD framework in a future iteration if the node is extended to use them.
- Character Builder migration — Phase 3, not this PR

## Rollout

### Phase 1: Shared Framework (no visible changes)
- Extract components into `js/boss_theme/index.js`
- Python: add `_save_json()`, `/camera_boss/save`, `/camera_boss/delete`
- Python: update `_load_library()` for normalization

### Phase 2: Camera Style Mixer CRUD
- Update `CameraEditor` to use shared components
- Add CRUD rows to each collection section
- Migrate `camera_style_mixer.json` to slug-based keys
- Test: add/edit/delete angles, framings, styles

### Phase 3: Character Builder Migration (follow-up, not this PR)
- Replace Character Builder's inline CRUD with shared components
- Validates the framework works across nodes

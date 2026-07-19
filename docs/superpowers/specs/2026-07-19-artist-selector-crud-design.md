# Artist Selector CRUD + Sort Navigation

## Overview
Add CRUD operations (Add/Edit/Delete), a Refresh button, sub-modal forms, toast notifications, and alphabetical range navigation to the Artist Selector Editor.

## Components

### 1. Alphabetical Range Tabs
- **Location**: Fixed bar at the bottom of the artist list area
- **Ranges**: 41 tabs matching nax.moe's structure: `=(–Ak`, `Ak-Ao`, `Ao-Az`, `B(-Bu`, ..., `Yu-Zz`
- **Behavior**: Clicking a tab filters the list to artists whose names fall within that alphabetical range. Works alongside the existing sort dropdown (e.g., sort by A-Z then jump to "Se-Sh")
- **Reset**: "All" button clears the range filter
- **State**: Stored as `state.rangeFilter` (string or null)

### 2. CRUD Sidebar Section
- **Location**: New section in the sidebar below Categories, above the count
- **Buttons**:
  - `+ Add Artist` — opens the add sub-modal
  - `Refresh` — re-fetches `/wai_artist/data` and refreshes the list
  - `Edit` — appears when an artist is selected; opens edit sub-modal
  - `Delete` — appears when an artist is selected; shows confirmation toast

### 3. Add/Edit Sub-Modal
- **Overlay**: Appears on top of the editor modal (not a separate modal)
- **Fields**:
  - **Name** (text input, disabled on edit)
  - **Prompt** (multiline textarea)
  - **Categories** (multi-select chips from existing categories in `artist_categories.json`)
- **Buttons**: Save / Cancel
- **API**: `POST /wai_artist/save` with `{name, prompt, categories}`
- **On Save**: Updates `artists.json`, invalidates cache, re-fetches data, shows toast

### 4. Python Endpoint — `POST /wai_artist/save`
- **Request**: `{name: string, prompt: string, categories: string[]}`
- **Behavior**:
  1. Load `artists.json`
  2. If name exists, update prompt and categories
  3. If name is new, add entry with prompt, categories, and fetch post count from Danbooru API
  4. Save `artists.json`
  5. Invalidate `_db_cache`
  6. Return updated library entry
- **Post count fetch**: `GET https://danbooru.donmai.us/tags.json?search[name]={name}` → extract `post_count`

### 5. Delete Confirmation
- **Not a modal** — uses a toast with [Yes] [No] buttons
- **API**: `POST /wai_artist/delete` with `{name: string}`
- **Behavior**: Removes from `artists.json`, removes from favorites, invalidates cache

### 6. Toast Notifications
- **Location**: Bottom-right corner of the editor modal
- **Auto-dismiss**: 3 seconds for success, stays for errors
- **Types**: success (green), error (red), confirm (with action buttons)
- **Stacking**: Multiple toasts stack vertically

## Data Flow

```
User clicks + Add → Sub-modal opens → Fill form → Save
  → POST /wai_artist/save → Python updates artists.json
  → Python fetches post count from Danbooru → Returns updated entry
  → JS re-fetches /wai_artist/data → List refreshes → Toast shown

User selects artist → Click Edit → Sub-modal opens → Modify form → Save
  → POST /wai_artist/save → Python updates artists.json → Cache invalidated
  → JS re-fetches data → List refreshes → Toast shown

User selects artist → Click Delete → Confirmation toast
  → User clicks Yes → POST /wai_artist/delete → Python removes from artists.json
  → JS re-fetches data → List refreshes → Toast shown
```

## Files to Modify
- `js/artist_selector/index.js` — Add range tabs, CRUD buttons, sub-modal, toasts, API calls
- `py/artist_selector.py` — Add `POST /wai_artist/save` and `POST /wai_artist/delete` endpoints
- `py/artist_categories.json` — No changes needed (categories already loaded)

## Files to Create
- None (all changes in existing files)

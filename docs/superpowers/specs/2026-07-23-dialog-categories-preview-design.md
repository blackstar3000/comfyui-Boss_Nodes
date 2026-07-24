# Design: Category Selection + Preview Image in CollectionEditorDialog

## Goal

Add category assignment and preview image support to the shared `CollectionEditorDialog`, matching the patterns used by outfit_selector (toggle chips + inline "+" creation) and artist_selector (URL-based preview images).

## Layout

Two-column layout below the existing form fields (Name, Prompt, Description, Favorite):

```
┌────────────────────────────┬─────────────────────────────┐
│  CATEGORIES                │  PREVIEW IMAGE               │
│  ┌────────────────────┐   │  ┌───────────────────────┐  │
│  │ [Cat A] [Cat B]    │   │  │                       │  │
│  │ [Cat C]            │   │  │    (live preview)     │  │
│  └────────────────────┘   │  └───────────────────────┘  │
│  [__________] [+]          │  [URL input]                │
└────────────────────────────┴─────────────────────────────┘
```

- **Left column**: Category toggle chips + inline "New category" input + "+" button
- **Right column**: Live `<img>` preview + URL text input
- **List view**: Small thumbnail (`<img>`) next to each entry name in the CRUD lists

## Changes

### 1. `CollectionEditorDialog` (`js/boss_theme/index.js`)

**New constructor params** (all optional, backward-compatible):
- `categories` — `Object` `{ catName: [slug1, slug2] }` — available categories
- `selectedCategories` — `string[]` — currently selected category names
- `previewUrl` — `string` — current preview image URL

**New UI in `_build()`:**
- After the Favorite toggle, add a two-column flex container
- Left column: Category chips section
  - Render each category name as a toggle button (`.boss-dialog-cat-chip`)
  - Chip click toggles membership in a `Set`
  - Below chips: text input + "+" button for creating new categories
  - New category: adds to `allCats` array, creates empty entry in categories dict, auto-selects, re-renders chips
- Right column: Preview section
  - `<img>` element showing current preview (hidden if empty)
  - Text input for preview URL
  - Input `change` event updates the `<img>` src

**Save callback return:**
- `onSave({ slug, item, categories })` — `categories` is `string[]` of selected category names
- `item.preview` is set from the URL input value

### 2. `CameraEditor._addEntry` / `_editEntry` (`js/camera_style_mixer/index.js`)

**Pass to dialog:**
- `categories`: the relevant category dict (`angleCategories`, `framingCategories`, or `styleCategories`)
- `selectedCategories`: current categories for the entry (scanned from category dicts)
- `previewUrl`: `entry.preview || ""`

**Handle new categories in save callback:**
- If a category name doesn't exist in the library's category dict, create it as an empty list
- Add the new entry's slug to the selected categories
- Send `categories` array in the POST body (already supported by backend)

### 3. Entry list thumbnails (`js/camera_style_mixer/index.js`)

In `refreshList()`, for each non-sentinel entry:
- If `entry.preview` is a non-empty string, render a small `<img>` before the name
- Style: 24x24px, border-radius 4px, object-fit cover

### 4. CSS (`js/boss_theme/theme.css` or inline in `boss_theme/index.js`)

Add styles for:
- `.boss-dialog-cat-chips` — flex wrap container for chips
- `.boss-dialog-cat-chip` — toggle button (matches `.cat-chip` from artist_selector)
- `.boss-dialog-cat-chip.active` — selected state
- `.boss-dialog-preview-img` — max-width 200px, max-height 200px, border-radius 8px
- `.boss-dialog-two-col` — flex layout for the two-column section

### 5. Backend (`py/camera_style_mixer.py`)

No changes needed. The `/camera_boss/save` endpoint already:
- Accepts `categories` array in the POST body
- Handles category membership updates
- Has `preview` field in the entry data model

## Data flow

1. User clicks Edit/Add → dialog opens with current categories and preview
2. User toggles category chips, types new category name, enters preview URL
3. User clicks Save → `onSave` fires with `{ slug, item, categories }`
4. Callback sends POST to `/camera_boss/save` with `categories` array
5. Backend updates entry + category membership, writes to disk
6. Callback calls `fetchData()` → library refreshed → list re-rendered with thumbnails

## Backward compatibility

- All new params are optional — existing callers (artist_selector, outfit_selector, etc.) are unaffected
- If `categories` is not passed, the category section is not rendered
- If `previewUrl` is not passed, the preview section is not rendered
- Entry list thumbnails only appear if `entry.preview` exists

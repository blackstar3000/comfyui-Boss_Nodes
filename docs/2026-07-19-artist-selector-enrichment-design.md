# Artist Selector Editor Enrichment Design

**Date:** 2026-07-19
**Status:** Approved
**Scope:** Enrich Artist Selector Editor with preview images, popularity data, and style categories

---

## 1. Problem

The Artist Selector Editor has ~2,760 artists in a flat list with no way to know what an artist's style looks like before generating. Users must guess based on names alone. There is no way to filter by art style or sort by popularity.

## 2. Goals

- Show preview images for artists so users can see the style before selecting
- Add popularity data (post counts) to help users find well-established artists
- Add style category filters so users can find artists by art style
- Maintain 100% backward compatibility with existing workflows

## 3. Data Sources

### 3.1 Preview Images (nax.moe)

- **URL pattern:** `https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/{FILENAME}.jpg`
- **Scale:** ~1,200 artist entries across 41 pages
- **Access:** HTML scraping (no API available)
- **Data per entry:** artist tag name, image URL, upvote count, downvote count
- **Scrape URL:** `https://nax.moe/?gallery=danbooru-artist-tags-v4.5&sort=date&page={1..41}`
- **Special pages:** Top Votes (`page=-2`), Hot (`page=-3`), Hidden Gems (`page=-6`)

### 3.2 Post Counts (Danbooru API)

- **Endpoint:** `GET /tags.json?search[name]={name}&search[tag_category]=1`
- **Field:** `post_count`
- **Rate limit:** Batch 200 tags per request using `search[name_matches]=*` wildcard
- **Alternative:** Fetch all artist tags at once: `GET /tags.json?search[tag_category]=1&limit=200&search[order]=post_count` then match against our 2,760 names

### 3.3 Style Categories (manual curation)

- Categories are manually assigned per artist
- Initial set (~200 artists): Start with the most popular artists from Danbooru post counts
- Categories stored in `artists.json` alongside prompt text

## 4. Data Format Changes

### 4.1 `py/artists.json` (enriched format)

**Current:**
```json
{
  "artists": {
    "wlop": "by wlop",
    "makimio": "by makimio"
  }
}
```

**Proposed:**
```json
{
  "artists": {
    "wlop": {
      "prompt": "by wlop",
      "post_count": 398,
      "categories": ["realistic", "fantasy"]
    },
    "makimio": {
      "prompt": "by makimio",
      "post_count": 127,
      "categories": ["anime", "cute"]
    }
  }
}
```

**Backward compatibility:** Python code must handle BOTH formats via a helper function:

```python
def _get_artist_prompt(entry):
    """Return prompt text from artist entry (handles string or object format)."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return entry.get("prompt", "")
    return ""
```

This ensures old `artists.json` files (string values) and new files (object values) both work. The `library` dict passed to `_format_output` and `_sort_names` must be pre-processed through this helper to normalize values to strings.

### 4.2 `py/artist_previews.json` (new file)

```json
{
  "wlop": "https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/wlop.jpg",
  "makimio": "https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/makimio.jpg"
}
```

Only ~1,200 artists will have entries (those found on nax.moe).

### 4.3 `py/artist_categories.json` (new file)

```json
{
  "categories": [
    "realistic", "anime", "manga", "watercolor", "pixel_art",
    "3d", "sketch", "dark", "cute", "sexy", "fantasy",
    "scifi", "horror", "comedy", "slice_of_life"
  ],
  "artist_categories": {
    "wlop": ["realistic", "fantasy"],
    "makimio": ["anime", "cute"]
  }
}
```

This is an alternative to embedding categories in `artists.json`. Keeps `artists.json` simpler and allows category definitions to evolve independently.

## 5. Scraper Script

### 5.1 `py/fetch_artist_previews.py`

New script to scrape nax.moe for artist preview data.

**Functionality:**
- Fetch all 41 pages from nax.moe
- Parse HTML to extract: artist tag, image URL, upvotes, downvotes
- Save to `py/artist_previews.json`
- Support `--fast` mode (first 5 pages only for testing)
- Support `--resume` mode (skip already-fetched pages)
- Progress output

**Usage:**
```
python py/fetch_artist_previews.py           # Full scrape (~41 pages)
python py/fetch_artist_previews.py --fast    # Quick test (5 pages)
python py/fetch_artist_previews.py --resume  # Continue from last page
```

### 5.2 `py/fetch_artist_post_counts.py`

New script to fetch Danbooru post counts for all artists.

**Functionality:**
- Load all artist names from `artists.json`
- Batch-query Danbooru tags API (200 per request)
- Match tag names to our artist names
- Write post counts back into `artists.json`
- Support `--dry-run` mode (show what would be written)

**Usage:**
```
python py/fetch_artist_post_counts.py           # Fetch all
python py/fetch_artist_post_counts.py --dry-run # Preview only
```

### 5.3 `py/curate_categories.py`

Interactive script to assign categories to artists.

**Functionality:**
- Load artists sorted by post count (most popular first)
- Show top 5 artists without categories
- Prompt for category assignment (comma-separated)
- Save to `py/artist_categories.json`
- Track progress (skip already-categorized artists)

## 6. Backend Changes

### 6.1 `py/artist_selector.py` modifications

**New API endpoint:**
```
GET /wai_artist/previews
Response: { "wlop": "https://cdn...", ... }
```

**New API endpoint:**
```
GET /wai_artist/categories
Response: {
  "categories": ["realistic", "anime", ...],
  "artist_categories": { "wlop": ["realistic"], ... }
}
```

**Modified `/wai_artist/data` response:**
```json
{
  "library": { "wlop": "by wlop", ... },
  "favorites": [...],
  "history": [...],
  "previews": { "wlop": "https://cdn...", ... },
  "categories": ["realistic", "anime", ...],
  "artist_categories": { "wlop": ["realistic", "fantasy"] },
  "post_counts": { "wlop": 398, ... }
}
```

**Modified `_format_output`:** No changes needed — still reads prompt text from library.

**Modified `_get_database`:** Returns enriched data. Extracts `post_counts` dict from the enriched library format for sorting:

```python
def _get_artist_prompt(entry):
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return entry.get("prompt", "")
    return ""

def _get_artist_post_count(entry):
    if isinstance(entry, dict):
        return entry.get("post_count", 0)
    return 0

def _get_artist_categories(entry):
    if isinstance(entry, dict):
        return entry.get("categories", [])
    return []
```

**Modified `_sort_names`:** Add "Popular" sort mode that sorts by post count descending.

**New constant:**
```python
SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent", "Popular"]
CATEGORY_FILTERS = []  # Loaded from artist_categories.json
```

### 6.2 `_sort_names` update

Add case for `sort_mode == "Popular"`:
```python
if sort_mode == "Popular":
    return sorted(names, key=lambda n: -post_counts.get(n, 0))
```

### 6.3 `register_api_routes` additions

Add routes for `/wai_artist/previews` and `/wai_artist/categories`.

## 7. Frontend Changes

### 7.1 `js/artist_selector/index.js` modifications

**New constants:**
```javascript
const SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent", "Popular"];
```

**New state fields:**
```javascript
state.selectedCategories = []  // Array of active category filter names
```

**New method `buildCategorySection()`:**
- Horizontal scrollable row of category chips
- "All" chip resets to show all artists
- Clicking a category chip toggles it (multiple selection)
- Active chips get `boss-art-tab active` styling
- Categories loaded from API data

**Modified `refreshList()`:**
- After filtering by tab + search, also filter by `selectedCategories`
- If `selectedCategories` is empty, show all (no filtering)
- Show category tags as small text below artist name
- Show post count badge on right side of each item

**Modified `refreshList()` item rendering:**
```javascript
// Each item now:
// ┌──────┐ ★ artist_name              [123 posts]
// │ IMG  │   category1, category2
// └──────┘
```

- Thumbnail: 48x48px `<img>` element
- Fallback: gray placeholder div if no preview available
- Category tags: small muted text below name
- Post count: right-aligned badge

**Modified `buildSelectSection()`:**
- Sort dropdown now includes "Popular" option

**Modified `readState()` / `writeState()`:**
- Add `selectedCategories` to state serialization

**Modified `syncNativeWidgets()`:**
- No change needed (categories are editor-only, not native widgets)

### 7.2 CSS additions

```css
/* Category chips */
.boss-art-categories {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0;
}
.boss-art-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  background: var(--boss-bg-section);
  color: var(--boss-text-muted);
  border: 1px solid var(--boss-border-input);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.boss-art-chip.active {
  background: var(--boss-brand);
  color: #fff;
  border-color: var(--boss-brand);
}

/* Thumbnail */
.boss-art-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--boss-bg-section);
  flex-shrink: 0;
}

/* Post count badge */
.boss-art-posts {
  font-size: 11px;
  color: var(--boss-text-dim);
  white-space: nowrap;
}

/* Category tags below name */
.boss-art-cats {
  font-size: 10px;
  color: var(--boss-text-faint);
  margin-top: 2px;
}
```

## 8. Implementation Phases

### Phase 1: Data Collection Scripts
1. Create `py/fetch_artist_previews.py` (nax.moe scraper)
2. Create `py/fetch_artist_post_counts.py` (Danbooru post count fetcher)
3. Create `py/curate_categories.py` (interactive category assignment)
4. Run all three scripts to populate data files

### Phase 2: Backend Enrichment
1. Update `py/artists.json` format (backward-compatible)
2. Create `py/artist_previews.json` and `py/artist_categories.json`
3. Update `py/artist_selector.py`:
   - Modified `_get_database()` to load enriched data
   - Modified `_sort_names()` to support "Popular" sort
   - New API routes for previews and categories
   - Updated `/wai_artist/data` response

### Phase 3: Frontend Enrichment
1. Update `js/artist_selector/index.js`:
   - Add category filter chips section
   - Update `refreshList()` with thumbnails, categories, post counts
   - Add "Popular" to sort modes
   - Update state serialization for `selectedCategories`
2. Add new CSS for thumbnails, chips, badges

### Phase 4: Testing
1. Verify backward compatibility with old `artists.json`
2. Verify all sort modes work correctly
3. Verify category filtering works
4. Verify preview images load (or gracefully degrade for missing ones)
5. Verify workflow save/load preserves all state

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| nax.moe blocks scraping | Add User-Agent header, rate-limit requests (1 req/sec), save progress |
| Danbooru rate limits | Batch 200 tags per request, add delays between batches |
| Missing preview images | Graceful fallback: show gray placeholder |
| Large JSON files | `artists.json` grows ~3x (still <1MB). `artist_previews.json` ~200KB |
| Old workflow compatibility | Python handles both string and object format for artist entries |

## 10. Success Criteria

- [ ] Preview images appear for ~1,200 artists in the editor
- [ ] Post counts displayed for all 2,760 artists
- [ ] Category chips filter the artist list
- [ ] "Popular" sort mode orders by post count
- [ ] Existing workflows load without changes
- [ ] Favorites and history still work
- [ ] Random mode still works with filtered pools

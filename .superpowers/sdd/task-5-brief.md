# Task 5: Frontend enrichment (JS)

**Files:**
- Modify: `js/artist_selector/index.js`

**Interfaces:**
- Consumes: enriched `/wai_artist/data` response (previews, categories, post_counts)

## Key Requirements

1. **Update SORT_MODES**: Add "Popular" to the JS SORT_MODES constant
2. **Update state**: Add `selectedCategories` array to state serialization
3. **Add CSS**: Category chips, thumbnails, post count badges, category tags
4. **Add `buildCategorySection()`**: Horizontal scrollable row of category filter chips
5. **Update `filteredList()`**: Filter by selected categories
6. **Update `refreshList()`**: Render thumbnails, category tags, post count badges
7. **Add `createThumbPlaceholder()`**: Gray placeholder for missing thumbnails

## Steps

- [ ] **Step 1: Update SORT_MODES constant**

Find: `const SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent"];`
Replace with: `const SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent", "Popular"];`

- [ ] **Step 2: Update state functions for selectedCategories**

In `defaultStateFromWidgets`: Add `selectedCategories: []` to return object
In `readState`: Add `merged.selectedCategories = Array.isArray(obj.selectedCategories) ? obj.selectedCategories.filter(...) : [];`
In `writeState`: Add `selectedCategories: state.selectedCategories || [],` to the serialized object

- [ ] **Step 3: Add new CSS styles**

In `injectCSS()`, add styles for:
- `.boss-art-categories` — flex row with overflow-x auto
- `.boss-art-chip` — rounded chip buttons
- `.boss-art-chip.active` — active state with brand color
- `.boss-art-thumb` — 48x48px thumbnail image
- `.boss-art-thumb-placeholder` — gray placeholder div
- `.boss-art-item` — updated layout with thumbnail support
- `.boss-art-item-info` — flex container for name/meta
- `.boss-art-item-name` — artist name
- `.boss-art-item-meta` — flex row for categories + post count
- `.boss-art-cats` — small category text
- `.boss-art-posts` — post count badge

- [ ] **Step 4: Add `buildCategorySection()` method**

New method in ArtistEditor class that creates:
- Label "Categories"
- Horizontal scrollable chip container
- "All" chip (active when no categories selected)
- One chip per category from `this.data.categories`
- Click toggles category selection
- Multiple categories can be active

- [ ] **Step 5: Add `updateCategoryChips()` method**

Method to sync chip active states with `this.state.selectedCategories`.

- [ ] **Step 6: Add `createThumbPlaceholder()` method**

Returns a 48x48 div with "?" text for artists without preview images.

- [ ] **Step 7: Update `buildModal()` to include category section**

After `buildForceRefreshSection()`, add `buildCategorySection()`.

- [ ] **Step 8: Update `filteredList()` to filter by categories**

After search filter, add category filter:
```javascript
const selectedCats = this.state.selectedCategories || [];
if (selectedCats.length > 0) {
  const artistCats = this.data.artist_categories || {};
  list = list.filter((n) => {
    const cats = artistCats[n] || [];
    return selectedCats.some((c) => cats.includes(c));
  });
}
```

- [ ] **Step 9: Update `refreshList()` item rendering**

Replace the item rendering loop to include:
- Thumbnail (img element with onerror fallback to placeholder)
- Info container with name + meta row
- Meta row with category tags (max 3) and post count
- Favorite button (unchanged)

- [ ] **Step 10: Commit**

```bash
git add js/artist_selector/index.js
git commit -m "feat: add thumbnails, category chips, and post count badges to artist editor"
```

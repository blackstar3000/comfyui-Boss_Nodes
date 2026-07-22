# Task 4: Backend enrichment (`artist_selector.py`)

**Files:**
- Modify: `py/artist_selector.py`
- Reads: `py/artist_previews.json`, `py/artist_categories.json`

**Interfaces:**
- Consumes: enriched `artists.json` (object format), `artist_previews.json`, `artist_categories.json`
- Produces: updated `/wai_artist/data` response with previews, categories, post_counts

## Key Requirements

1. **Backward compatibility**: Python code must handle BOTH old string format and new object format for artist entries
2. **Helper functions**: `_get_artist_prompt(entry)`, `_get_artist_post_count(entry)`, `_get_artist_categories(entry)`
3. **New sort mode**: Add "Popular" sort (by post count descending) to SORT_MODES
4. **Updated `_sort_names`**: Accept `post_counts` parameter
5. **Updated `_format_output`**: Use `_get_artist_prompt()` to extract prompt text
6. **Updated `_get_database`**: Return enriched data (library, favorites, history, previews, categories_list, post_counts)
7. **Updated API response**: `/wai_artist/data` returns previews, categories, post_counts
8. **Updated `_set_favorites`**: Match new 6-tuple cache signature

## Steps

- [ ] **Step 1: Add helper functions and enriched data file paths**

After the existing imports and constants, add:
- `PREVIEWS_FILE` and `CATEGORIES_FILE` paths
- `_previews_cache` and `_categories_cache` module-level caches
- `_get_artist_prompt(entry)` — returns prompt text from string or dict
- `_get_artist_post_count(entry)` — returns post_count from dict (0 for strings)
- `_get_artist_categories(entry)` — returns categories list from dict ([] for strings)
- `_get_previews(force_refresh)` — loads and caches artist_previews.json
- `_get_artist_categories_file(force_refresh)` — loads and caches artist_categories.json

- [ ] **Step 2: Update `_sort_names` to support "Popular" sort**

Add `post_counts=None` parameter and a new case:
```python
if sort_mode == "Popular":
    counts = post_counts or {}
    return sorted(names, key=lambda n: -counts.get(n, 0))
```

- [ ] **Step 3: Update `_format_output` to use helper function**

Replace `library.get(n, n)` with `_get_artist_prompt(library.get(n, n))` in all output modes.

- [ ] **Step 4: Update `_get_database` to return enriched data**

Change return signature from 3-tuple to 6-tuple: `(library, favorites, history, previews, categories_list, post_counts)`. Load previews and categories files. Extract post_counts from enriched library. Merge artist_categories into library entries.

- [ ] **Step 5: Update `select` method to use enriched data**

Update the unpacking of `_get_database` to handle 6-tuple. Pass `post_counts` to `_sort_names`.

- [ ] **Step 6: Update `get_artists_data` route**

Add `previews`, `categories`, `post_counts` to the JSON response.

- [ ] **Step 7: Update `_set_favorites` to match new cache signature**

Unpack 6-tuple from `_get_database`.

- [ ] **Step 8: Verify backward compatibility**

Test that the node still works with both old string format and new object format artists.json.

- [ ] **Step 9: Commit**

```bash
git add py/artist_selector.py
git commit -m "feat: enrich artist_selector.py with previews, categories, post counts"
```

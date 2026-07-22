# Task 4 Report: Backend enrichment of artist_selector.py

**Status:** DONE

## Commit

`48c155e` — feat: enrich artist_selector.py with previews, categories, post counts

## Changes Made

Added 83 lines (+13 removed) to `py/artist_selector.py`:

1. **Helper functions** (lines 44-84):
   - `_get_artist_prompt(entry)` — extracts prompt from string or dict
   - `_get_artist_post_count(entry)` — extracts post_count (0 for strings)
   - `_get_artist_categories(entry)` — extracts categories list ([] for strings)
   - `_get_previews(force_refresh)` — loads/caches `artist_previews.json`
   - `_get_artist_categories_file(force_refresh)` — loads/caches `artist_categories.json`

2. **New sort mode**: `"Popular"` added to `SORT_MODES` (line 32), sorts by post count descending (lines 150-152)

3. **Updated `_sort_names`**: Added `post_counts=None` parameter (line 135)

4. **Updated `_format_output`**: Uses `_get_artist_prompt()` helper for all output modes (lines 161, 164)

5. **Updated `_get_database`**: Returns 6-tuple `(library, favorites, history, previews, cat_map, post_counts)` (lines 92-122)

6. **Updated `select`**: Unpacks 6-tuple, passes `post_counts` to `_sort_names` (lines 386, 417)

7. **Updated `_set_favorites`**: Unpacks 6-tuple from `_get_database` (lines 128-129)

8. **Updated `/wai_artist/data`**: Returns `previews`, `categories`, `post_counts` in JSON response (lines 438-446)

## Verification

- Syntax check: `py_compile.compile()` passed
- Integration tests: All helper functions handle both string and dict formats
- `_get_database()` returns 6-tuple with correct types
- Popular sort orders by post_count descending
- `_format_output()` produces correct prompts for both string and dict entries
- Backward compatibility: string-format artists.json entries work as before
- 2756 artists loaded, 16000 previews, 20 category mappings confirmed

# Task 2: Create Danbooru post count fetcher (`fetch_artist_post_counts.py`)

**Files:**
- Create: `py/fetch_artist_post_counts.py`
- Reads: `py/artists.json`
- Writes: `py/artists.json` (enriched with post_count)

**Interfaces:**
- Consumes: `artists.json` (string or object format)
- Produces: updates `artists.json` in-place with `post_count` field
- CLI args: `--dry-run` (preview without writing)

## Steps

- [ ] **Step 1: Create the post count fetcher script**

Create `py/fetch_artist_post_counts.py` with the following functionality:
- Fetch Danbooru post counts for all artists in `artists.json`
- Danbooru tags API: `https://danbooru.donmai.us/tags.json`
- Artist tags have `category=1`
- Paginate through all artist tags (200 per page, `search[tag_category]=1`, `search[order]=post_count`)
- Match fetched tags against our artist names (case-insensitive)
- Support `--dry-run` mode (show top 10 by post count, don't write)
- Rate limit: 1 request per second
- User-Agent: `BossNodes-Fetcher/1.0 (ComfyUI custom node)`
- Use only Python standard library
- Enrich `artists.json` in-place: convert string values to object format `{"prompt": "...", "post_count": N, "categories": []}`
- Stop early if all artists matched or if fewer than 200 results returned

- [ ] **Step 2: Test with dry-run**

Run: `python py/fetch_artist_post_counts.py --dry-run`
Expected: Shows top 10 artists by post count, no file changes

- [ ] **Step 3: Run for real**

Run: `python py/fetch_artist_post_counts.py`
Expected: Enriches artists.json with post_count field for matched artists

- [ ] **Step 4: Verify artists.json format**

Run: `python -c "import json; d=json.load(open('py/artists.json')); artists=d['artists']; print('Sample:', json.dumps({k: artists[k] for k in list(artists.keys())[:3]}, indent=2))"`
Expected: Shows 3 artist entries with object format (prompt, post_count, categories)

- [ ] **Step 5: Commit**

```bash
git add py/fetch_artist_post_counts.py py/artists.json
git commit -m "feat: add Danbooru post count fetcher and enrich artists.json"
```

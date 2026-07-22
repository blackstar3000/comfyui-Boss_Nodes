# Task 3: Create category curator (`curate_categories.py`)

**Files:**
- Create: `py/curate_categories.py`
- Output: `py/artist_categories.json`

**Interfaces:**
- Produces: `artist_categories.json` — `{ "categories": [...], "artist_categories": { "name": ["cat1"] } }`

## Steps

- [ ] **Step 1: Create the interactive category curator**

Create `py/curate_categories.py` with:
- Interactive CLI that shows top uncategorized artists by post count
- Prompts for comma-separated category names
- Commands: 'skip' to skip, 'quit' to save and exit
- Saves to `py/artist_categories.json`
- Default categories: realistic, anime, manga, watercolor, pixel_art, 3d, sketch, dark, cute, sexy, fantasy, scifi, horror, comedy, slice_of_life, painterly, cel_shaded, line_art, detailed, minimalist
- Use only Python standard library

- [ ] **Step 2: Create seed artist_categories.json**

Create `py/artist_categories.json` with seed data for ~10-20 well-known artists. Include the default categories list and a small set of artist_categories entries for popular artists like wlop, rossdraws, makimio, ikeno, etc.

- [ ] **Step 3: Test the script (abort after a few entries)**

Run: `python py/curate_categories.py`
Expected: Shows top uncategorized artists, prompts for categories. Enter 'quit' after a few entries.

- [ ] **Step 4: Commit**

```bash
git add py/curate_categories.py py/artist_categories.json
git commit -m "feat: add interactive category curator and seed data"
```

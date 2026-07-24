# Task 4: Python — Migrate `camera_style_mixer.json` to slug-based keys

**Files:**
- Create: `py/_migrate_camera_json.py` (temporary, deleted after run)
- Modify: `py/camera_style_mixer.json` (one-time migration)

**Interfaces:**
- Consumes: nothing (standalone migration script)
- Produces: migrated JSON file

- [ ] **Step 1: Write migration script**

Create `py/_migrate_camera_json.py`:

```python
"""One-time migration: convert camera_style_mixer.json to slug-based keys."""
import json
import re
from pathlib import Path

JSON_PATH = Path(__file__).parent / "camera_style_mixer.json"


def to_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "entry"


def unique_slug(slug: str, existing: set) -> str:
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}_{n}" in existing:
        n += 1
    return f"{slug}_{n}"


def migrate_collection(data: dict, entry_key: str, cat_key: str) -> None:
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
            new_entries[slug] = {
                "name": name,
                "prompt": value,
                "description": "",
                "favorite": False,
                "preview": "",
            }
        elif isinstance(value, dict):
            value["name"] = name
            new_entries[slug] = value

    # Migrate category lists
    new_cats = {}
    for cat_name, members in old_cats.items():
        if not isinstance(members, list):
            continue
        new_cats[cat_name] = [name_to_slug.get(m, m) for m in members]

    data[entry_key] = new_entries
    data[cat_key] = new_cats


def main():
    with JSON_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    migrate_collection(data, "camera_angles", "angle_categories")
    migrate_collection(data, "camera_framings", "framing_categories")
    migrate_collection(data, "art_styles", "style_categories")

    with JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Migrated: {len(data['camera_angles'])} angles, "
          f"{len(data['camera_framings'])} framings, {len(data['art_styles'])} styles")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run migration**

Run: `F:\ComfyUI\python_embeded\python.exe py/_migrate_camera_json.py`

Expected: `Migrated: 15 angles, 30 framings, 117 styles` (approximate counts)

- [ ] **Step 3: Verify first entry is slug-based**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import json; d=json.load(open('py/camera_style_mixer.json')); k=list(d['camera_angles'].keys())[0]; print(f'Key: {k}'); print(f'Value: {d[\"camera_angles\"][k]}')"`

Expected: Key is a slug (e.g. `extreme_low_angle`), value is an object with `name`, `prompt`, etc.

- [ ] **Step 4: Verify categories reference slugs**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import json; d=json.load(open('py/camera_style_mixer.json')); cats=d.get('angle_categories',{}); k=list(cats.keys())[0]; print(f'Category: {k}'); print(f'Members: {cats[k][:3]}')"`

Expected: Members are slugs, not names

- [ ] **Step 5: Delete migration script**

```bash
rm py/_migrate_camera_json.py
```

- [ ] **Step 6: Commit**

```bash
git add py/camera_style_mixer.json
git commit -m "feat(camera): migrate camera_style_mixer.json to slug-based keys"
```

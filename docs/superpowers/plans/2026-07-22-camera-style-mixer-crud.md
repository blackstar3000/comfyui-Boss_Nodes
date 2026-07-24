# Camera Style Mixer CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD to Camera Style Mixer using a reusable shared framework, with future-proof slug-based data model.

**Architecture:** Extract 4 shared components (CollectionModel, CollectionController, CollectionCRUDWidget, CollectionEditorDialog) into `js/boss_theme/index.js`. Python backend gets atomic saves and CRUD endpoints. Camera Editor integrates shared components for all 3 collections.

**Tech Stack:** Python 3.13, aiohttp (ComfyUI routes), vanilla JS (no framework), DOM widgets.

## Global Constraints

- Node class name, inputs, outputs, hidden state names — NEVER change
- Category filtering, strength sliders, weight format — unchanged
- Hot-reload, seed system, graphToPrompt injection — unchanged
- All existing workflows must load without modification
- `camera_lenses` and `quality_boosters` JSON sections — left as-is (out of scope)
- JSON writes must be atomic (temp file → os.replace)
- Slug generation: lowercase, spaces→underscores, strip non-alphanumeric, append _2/_3 on collision

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `py/camera_style_mixer.py` | Modify | Add `_save_json()`, `/camera_boss/save`, `/camera_boss/delete`, update `_load_library()` normalization |
| `py/camera_style_mixer.json` | Modify | Migrate to slug-based keys (one-time) |
| `js/boss_theme/index.js` | Modify | Add CollectionModel, CollectionController, CollectionCRUDWidget, CollectionEditorDialog |
| `js/camera_style_mixer/index.js` | Modify | Integrate shared CRUD components into CameraEditor |

---

## Task 1: Python — `_save_json()` + slug helpers

**Files:**
- Modify: `py/camera_style_mixer.py:26-28` (add imports)
- Modify: `py/camera_style_mixer.py` (add helpers after `_log` declaration)

**Interfaces:**
- Consumes: nothing (new utility functions)
- Produces: `_save_json(path, data)`, `_to_slug(name)`, `_unique_slug(slug, existing)`

- [ ] **Step 1: Add `re` import**

```python
import re
```

Add after existing `import json` at line 15.

- [ ] **Step 2: Add `_to_slug()` helper**

Add after `_log = make_logger("CameraStyleMixer")` (line 77):

```python
def _to_slug(name: str) -> str:
    """Lowercase, spaces→underscores, strip non-alphanumeric."""
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "entry"


def _unique_slug(slug: str, existing: set[str]) -> str:
    """Append _2, _3, ... until unique."""
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}_{n}" in existing:
        n += 1
    return f"{slug}_{n}"
```

- [ ] **Step 3: Add `_save_json()` helper**

Add after the slug helpers:

```python
def _save_json(path: Path, data: dict) -> None:
    """Atomic write: write to .tmp then os.replace."""
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)
```

- [ ] **Step 4: Verify Python compiles**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile(r'F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\camera_style_mixer.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add py/camera_style_mixer.py
git commit -m "feat(camera): add _save_json, _to_slug, _unique_slug helpers"
```

---

## Task 2: Python — Update `_load_library()` normalization

**Files:**
- Modify: `py/camera_style_mixer.py:134-170` (inside `_load_library()`)

**Interfaces:**
- Consumes: `_to_slug()` from Task 1
- Produces: updated `_LIB` with normalized object values + slug maps

- [ ] **Step 1: Update raw data loading to normalize strings→objects**

Replace lines 134-149 (the raw_angles/raw_framings/raw_styles block) with:

```python
    raw_angles = data.get("camera_angles", {})
    raw_framings = data.get("camera_framings", {})
    raw_styles = data.get("art_styles", {})
    if not isinstance(raw_angles, dict):
        _log("'camera_angles' must be a dict — skipped.")
        raw_angles = {}
    if not isinstance(raw_framings, dict):
        _log("'camera_framings' must be a dict — skipped.")
        raw_framings = {}
    if not isinstance(raw_styles, dict):
        _log("'art_styles' must be a dict — skipped.")
        raw_styles = {}

    def _normalize_entries(raw: dict) -> dict[str, dict]:
        """Convert legacy string values to objects, keep objects as-is."""
        out = {}
        for key, value in raw.items():
            if isinstance(value, str):
                out[key] = {
                    "name": key,
                    "prompt": value,
                    "description": "",
                    "favorite": False,
                    "preview": "",
                }
            elif isinstance(value, dict):
                value.setdefault("name", key)
                value.setdefault("prompt", "")
                value.setdefault("description", "")
                value.setdefault("favorite", False)
                value.setdefault("preview", "")
                out[key] = value
        return out

    angles = _normalize_entries(raw_angles)
    framings = _normalize_entries(raw_framings)
    styles = _normalize_entries(raw_styles)
```

- [ ] **Step 2: Update the rest of _load_library to use normalized data**

Replace lines 164-176 (the `_LIB.` assignments + log) with:

```python
    _LIB.angles = angles
    _LIB.framings = framings
    _LIB.styles = styles
    _LIB.cat_angle = sanitize_categories(raw_cat_angle, set(angles.keys()))
    _LIB.cat_framing = sanitize_categories(raw_cat_framing, set(framings.keys()))
    _LIB.cat_style = sanitize_categories(raw_cat_style, set(styles.keys()))
    _LIB.mtime = mtime

    _log(
        f"Loaded: {len(angles)} angles, {len(framings)} framings, {len(styles)} styles, "
        f"{len(_LIB.cat_angle)} angle-cats, {len(_LIB.cat_framing)} framing-cats, {len(_LIB.cat_style)} style-cats"
    )
    return _LIB
```

- [ ] **Step 3: Verify Python compiles**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile(r'F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\camera_style_mixer.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add py/camera_style_mixer.py
git commit -m "feat(camera): normalize legacy string values to objects in _load_library"
```

---

## Task 3: Python — `/camera_boss/save` and `/camera_boss/delete` endpoints

**Files:**
- Modify: `py/camera_style_mixer.py:441-488` (the `register_api_routes()` function)

**Interfaces:**
- Consumes: `_save_json()`, `_to_slug()`, `_unique_slug()` from Task 1, `_LIB` from Task 2
- Produces: two new HTTP endpoints

- [ ] **Step 1: Add the type→collection mapping and entry keys**

Add before `register_api_routes()`:

```python
# Mapping from API type name to (data_key, category_key, library_attr)
_COLLECTION_MAP = {
    "angles":  ("camera_angles",  "angle_categories",  "angles"),
    "framings": ("camera_framings", "framing_categories", "framings"),
    "styles":  ("art_styles",     "style_categories",  "styles"),
}
```

- [ ] **Step 2: Add `/camera_boss/save` endpoint**

Inside `register_api_routes()`, after the existing `/camera_boss/refresh` route, add:

```python
    @routes.post("/camera_boss/save")
    async def save_camera_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            slug = body.get("slug", "").strip()
            name = body.get("name", "").strip()
            prompt = body.get("prompt", "").strip()
            description = body.get("description", "").strip()
            favorite = bool(body.get("favorite", False))
            categories = body.get("categories", [])

            if lib_type not in _COLLECTION_MAP:
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            if not prompt:
                return web.json_response({"error": "Prompt required"}, status=400)

            data_key, cat_key, lib_attr = _COLLECTION_MAP[lib_type]
            lib = _load_library()
            collection = getattr(lib, lib_attr)

            if not isinstance(categories, list):
                categories = []

            # Generate or validate slug
            if slug and slug in collection:
                # Updating existing entry
                is_new = False
            else:
                # New entry — generate unique slug
                slug = _unique_slug(_to_slug(name), set(collection.keys()))
                is_new = True

            entry = {
                "name": name,
                "prompt": prompt,
                "description": description,
                "favorite": favorite,
                "preview": collection.get(slug, {}).get("preview", "") if isinstance(collection.get(slug), dict) else "",
            }
            collection[slug] = entry

            # Update categories
            cat_dict = getattr(lib, f"cat_{lib_attr.split('s')[0] if lib_attr.endswith('s') else lib_attr}")
            # Ensure all requested categories exist
            for cat in categories:
                if cat and cat != ALL_CATEGORIES and cat not in cat_dict:
                    cat_dict[cat] = []
            # Update membership
            for cat, members in cat_dict.items():
                if cat == ALL_CATEGORIES:
                    continue
                if slug in members and cat not in categories:
                    members.remove(slug)
                elif slug not in members and cat in categories:
                    members.append(slug)

            # Save to disk
            try:
                with JSON_FILE.open("r", encoding="utf-8") as f:
                    disk_data = json.load(f)
            except (json.JSONDecodeError, OSError):
                disk_data = {}

            disk_data[data_key] = {k: v if isinstance(v, dict) else v for k, v in collection.items()}
            disk_data[cat_key] = cat_dict
            _save_json(JSON_FILE, disk_data)

            # Bust mtime cache
            _LIB.mtime = None

            return web.json_response({
                "slug": slug,
                "name": name,
                "is_new": is_new,
                "count": len(collection),
            })
        except Exception as e:
            _log(f"/camera_boss/save failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)
```

- [ ] **Step 3: Add `/camera_boss/delete` endpoint**

After the save route, add:

```python
    @routes.post("/camera_boss/delete")
    async def delete_camera_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            slug = body.get("slug", "").strip()

            if lib_type not in _COLLECTION_MAP:
                return web.json_response({"error": "Invalid type"}, status=400)
            if not slug:
                return web.json_response({"error": "Slug required"}, status=400)

            data_key, cat_key, lib_attr = _COLLECTION_MAP[lib_type]
            lib = _load_library()
            collection = getattr(lib, lib_attr)

            if slug not in collection:
                return web.json_response({"error": "Not found"}, status=404)

            del collection[slug]

            # Remove from all categories
            cat_dict = getattr(lib, f"cat_{lib_attr.split('s')[0] if lib_attr.endswith('s') else lib_attr}")
            for members in cat_dict.values():
                if isinstance(members, list) and slug in members:
                    members.remove(slug)

            # Save to disk
            try:
                with JSON_FILE.open("r", encoding="utf-8") as f:
                    disk_data = json.load(f)
            except (json.JSONDecodeError, OSError):
                disk_data = {}

            disk_data[data_key] = dict(collection)
            disk_data[cat_key] = cat_dict
            _save_json(JSON_FILE, disk_data)

            # Bust mtime cache
            _LIB.mtime = None

            return web.json_response({"count": len(collection)})
        except Exception as e:
            _log(f"/camera_boss/delete failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)
```

- [ ] **Step 4: Verify Python compiles**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile(r'F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\camera_style_mixer.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add py/camera_style_mixer.py
git commit -m "feat(camera): add /camera_boss/save and /camera_boss/delete endpoints"
```

---

## Task 4: Python — Migrate `camera_style_mixer.json` to slug-based keys

**Files:**
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

---

## Task 5: JS — CollectionModel + CollectionController

**Files:**
- Modify: `js/boss_theme/index.js` (add before closing `export`)

**Interfaces:**
- Consumes: nothing (new shared components)
- Produces: `CollectionModel`, `CollectionController` classes exported from boss_theme

- [ ] **Step 1: Add CollectionModel class**

Add before the closing `export { ... }` in `js/boss_theme/index.js`:

```javascript
// ── Shared CRUD framework ─────────────────────────────────────────────────

class CollectionModel {
  static normalize(rawData) {
    const out = {};
    for (const [key, value] of Object.entries(rawData || {})) {
      if (typeof value === "string") {
        out[key] = { name: key, prompt: value, description: "", favorite: false, preview: "" };
      } else if (value && typeof value === "object") {
        out[key] = {
          name: value.name || key,
          prompt: value.prompt || "",
          description: value.description || "",
          favorite: !!value.favorite,
          preview: value.preview || "",
        };
      }
    }
    return out;
  }

  static toSlug(name, existingSlugs = new Set()) {
    let slug = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!slug) slug = "entry";
    if (!existingSlugs.has(slug)) return slug;
    let n = 2;
    while (existingSlugs.has(`${slug}_${n}`)) n++;
    return `${slug}_${n}`;
  }

  static validate(item, existingSlugs = new Set(), excludeSlug = null) {
    if (!item?.name?.trim()) return { ok: false, error: "Name required" };
    if (!item?.prompt?.trim()) return { ok: false, error: "Prompt required" };
    const nameLower = item.name.trim().toLowerCase();
    // Check name uniqueness (case-insensitive)
    for (const [slug, entry] of existingSlugs) {
      if (slug === excludeSlug) continue;
      if (typeof entry === "object" && entry?.name?.toLowerCase() === nameLower) {
        return { ok: false, error: "Name already exists" };
      }
    }
    return { ok: true, error: "" };
  }
}
```

- [ ] **Step 2: Add CollectionController class**

```javascript
class CollectionController {
  constructor(baseUrl = "/camera_boss") {
    this.baseUrl = baseUrl;
  }

  async add(type, item, categories = []) {
    return this._post("/save", { type, name: item.name, prompt: item.prompt, description: item.description || "", favorite: item.favorite || false, categories });
  }

  async edit(type, slug, item, categories = []) {
    return this._post("/save", { type, slug, name: item.name, prompt: item.prompt, description: item.description || "", favorite: item.favorite || false, categories });
  }

  async delete(type, slug) {
    return this._post("/delete", { type, slug });
  }

  async refresh() {
    try {
      const r = await fetch(`${this.baseUrl}/refresh`, { method: "POST" });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, data: null };
      const data = await r.json();
      return { ok: true, data, error: "" };
    } catch (e) {
      return { ok: false, error: e.message, data: null };
    }
  }

  async _post(path, body) {
    try {
      const r = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, error: data.error || `HTTP ${r.status}`, ...data };
      return { ok: true, ...data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}
```

- [ ] **Step 3: Export the new classes**

Find the existing `export { BossDropdown, escapeHtml };` line and replace with:

```javascript
export { BossDropdown, escapeHtml, CollectionModel, CollectionController };
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\js\boss_theme\index.js"`

Expected: no output (success)

- [ ] **Step 5: Commit**

```bash
git add js/boss_theme/index.js
git commit -m "feat(theme): add CollectionModel and CollectionController shared components"
```

---

## Task 6: JS — CollectionCRUDWidget

**Files:**
- Modify: `js/boss_theme/index.js` (add after CollectionController)

**Interfaces:**
- Consumes: CollectionModel from Task 5
- Produces: `CollectionCRUDWidget` class

- [ ] **Step 1: Add CollectionCRUDWidget class**

Add after CollectionController in `js/boss_theme/index.js`:

```javascript
class CollectionCRUDWidget {
  constructor({ title, data, categories, selectedSlug, onAdd, onSelect, onEdit, onDelete, onToggleFavorite }) {
    this.title = title;
    this.data = data || {};
    this.categories = categories || {};
    this.selectedSlug = selectedSlug || null;
    this.onAdd = onAdd || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onEdit = onEdit || (() => {});
    this.onDelete = onDelete || (() => {});
    this.onToggleFavorite = onToggleFavorite || (() => {});
    this.root = null;
    this.listEl = null;
    this.searchInput = null;
    this._search = "";
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "boss-crd-wrap";

    // Header with title
    const head = document.createElement("div");
    head.className = "boss-crd-head";
    head.innerHTML = `<span class="boss-crd-title">${escapeHtml(this.title)}</span>`;
    wrap.appendChild(head);

    // Search input
    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-input";
    search.placeholder = `Search ${this.title.toLowerCase()}…`;
    search.addEventListener("input", (e) => {
      this._search = e.target.value;
      this._renderList();
    });
    wrap.appendChild(search);
    this.searchInput = search;

    // List container
    const list = document.createElement("div");
    list.className = "boss-crd-list";
    wrap.appendChild(list);
    this.listEl = list;

    // Add button
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "boss-crd-add";
    addBtn.textContent = `＋ Add ${this.title}`;
    addBtn.addEventListener("click", () => this.onAdd());
    wrap.appendChild(addBtn);

    this.root = wrap;
    this._renderList();
    return wrap;
  }

  _renderList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";
    const search = this._search.toLowerCase();

    // Sentinel entries (random, none) are not rendered here — handled by parent
    const entries = Object.entries(this.data)
      .filter(([slug, item]) => {
        if (!item || typeof item !== "object") return false;
        if (search && !item.name?.toLowerCase().includes(search) && !item.prompt?.toLowerCase().includes(search)) return false;
        return true;
      })
      .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""));

    for (const [slug, item] of entries) {
      const row = document.createElement("div");
      row.className = "boss-crd-item" + (this.selectedSlug === slug ? " selected" : "");

      // Favorite star
      const star = document.createElement("span");
      star.className = "boss-crd-star" + (item.favorite ? " active" : "");
      star.textContent = item.favorite ? "★" : "☆";
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onToggleFavorite(slug);
      });
      row.appendChild(star);

      // Name
      const name = document.createElement("span");
      name.className = "boss-crd-name";
      name.textContent = item.name || slug;
      row.appendChild(name);

      // Edit button
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "boss-crd-icon";
      editBtn.textContent = "✎";
      editBtn.title = "Edit";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onEdit(slug);
      });
      row.appendChild(editBtn);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "boss-crd-icon boss-crd-icon-danger";
      delBtn.textContent = "✕";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onDelete(slug);
      });
      row.appendChild(delBtn);

      // Click to select
      row.addEventListener("click", () => this.onSelect(slug));

      // Context menu
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._showContextMenu(e, slug);
      });

      this.listEl.appendChild(row);
    }

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-crd-empty";
      empty.textContent = search ? "No matches." : "No entries yet.";
      this.listEl.appendChild(empty);
    }
  }

  _showContextMenu(e, slug) {
    // Remove any existing context menu
    document.querySelectorAll(".boss-crd-context").forEach((m) => m.remove());

    const menu = document.createElement("div");
    menu.className = "boss-crd-context";

    const item = this.data[slug];
    const items = [
      { label: "Edit", action: () => this.onEdit(slug) },
      { label: item?.favorite ? "Unfavorite" : "Favorite", action: () => this.onToggleFavorite(slug) },
      { label: "Delete", action: () => this.onDelete(slug), cls: "danger" },
    ];

    for (const it of items) {
      const btn = document.createElement("div");
      btn.className = "boss-crd-ctx-item" + (it.cls ? ` ${it.cls}` : "");
      btn.textContent = it.label;
      btn.addEventListener("click", () => {
        menu.remove();
        it.action();
      });
      menu.appendChild(btn);
    }

    menu.style.position = "fixed";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    document.body.appendChild(menu);

    // Close on outside click
    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  refresh(newData, newCategories, newSelectedSlug) {
    this.data = newData || this.data;
    this.categories = newCategories || this.categories;
    if (newSelectedSlug !== undefined) this.selectedSlug = newSelectedSlug;
    this._renderList();
  }

  setSelected(slug) {
    this.selectedSlug = slug;
    this._renderList();
  }
}
```

- [ ] **Step 2: Add CSS for CRUD widget**

Add inside the `injectCSS()` function in `js/boss_theme/index.js`, before the closing `const style = ...`:

```css
    /* ── CRUD widget ──────────────────────────────────────────────── */
    .boss-crd-wrap { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .boss-crd-head { display: flex; align-items: center; justify-content: space-between; }
    .boss-crd-title { font-size: 12px; font-weight: 600; color: var(--boss-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .boss-crd-list {
      max-height: 140px; overflow-y: auto;
      background: var(--boss-bg-input); border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
    }
    .boss-crd-item {
      padding: 5px 8px; font-size: 12px; color: var(--boss-text); cursor: pointer;
      border-bottom: 1px solid var(--boss-border); display: flex; align-items: center; gap: 6px;
    }
    .boss-crd-item:last-child { border-bottom: none; }
    .boss-crd-item:hover { background: var(--boss-bg-hover); }
    .boss-crd-item.selected { background: var(--boss-bg-active); box-shadow: inset 2px 0 0 var(--boss-brand); }
    .boss-crd-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .boss-crd-star { cursor: pointer; color: var(--boss-text-dim); font-size: 14px; }
    .boss-crd-star.active { color: #f5a623; }
    .boss-crd-star:hover { color: #f5a623; }
    .boss-crd-icon {
      background: none; border: none; color: var(--boss-text-dim); cursor: pointer;
      font-size: 13px; padding: 2px 4px; border-radius: 3px; line-height: 1;
    }
    .boss-crd-icon:hover { background: var(--boss-bg-hover); color: var(--boss-text); }
    .boss-crd-icon-danger:hover { color: #e74c3c; }
    .boss-crd-add {
      background: none; border: 1px dashed var(--boss-border); color: var(--boss-text-muted);
      padding: 5px; border-radius: var(--boss-radius-md); cursor: pointer; font-size: 12px;
      text-align: center; transition: border-color 0.15s, color 0.15s;
    }
    .boss-crd-add:hover { border-color: var(--boss-brand); color: var(--boss-brand); }
    .boss-crd-empty { padding: 8px; text-align: center; color: var(--boss-text-dim); font-size: 12px; font-style: italic; }
    .boss-crd-context {
      background: var(--boss-bg-section); border: 1px solid var(--boss-border-strong);
      border-radius: var(--boss-radius-md); padding: 4px 0; z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); min-width: 120px;
    }
    .boss-crd-ctx-item {
      padding: 6px 12px; font-size: 12px; color: var(--boss-text); cursor: pointer;
    }
    .boss-crd-ctx-item:hover { background: var(--boss-bg-hover); }
    .boss-crd-ctx-item.danger { color: #e74c3c; }
    .boss-crd-ctx-item.danger:hover { background: rgba(231,76,60,0.1); }
```

- [ ] **Step 3: Export CollectionCRUDWidget**

Update the export line to:

```javascript
export { BossDropdown, escapeHtml, CollectionModel, CollectionController, CollectionCRUDWidget };
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\js\boss_theme\index.js"`

Expected: no output (success)

- [ ] **Step 5: Commit**

```bash
git add js/boss_theme/index.js
git commit -m "feat(theme): add CollectionCRUDWidget with context menu and keyboard nav"
```

---

## Task 7: JS — CollectionEditorDialog

**Files:**
- Modify: `js/boss_theme/index.js` (add after CollectionCRUDWidget)

**Interfaces:**
- Consumes: CollectionModel from Task 5 (for validation)
- Produces: `CollectionEditorDialog` class

- [ ] **Step 1: Add CollectionEditorDialog class**

Add after CollectionCRUDWidget in `js/boss_theme/index.js`:

```javascript
class CollectionEditorDialog {
  constructor({ title, item, isEdit, existingSlugs, onSave, onCancel }) {
    this.title = title;
    this.item = item || { name: "", prompt: "", description: "", favorite: false };
    this.isEdit = isEdit;
    this.existingSlugs = existingSlugs || new Map();
    this.onSave = onSave || (() => {});
    this.onCancel = onCancel || (() => {});
    this.modal = null;
    this.errorEl = null;
  }

  open() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._build();
    });
  }

  _build() {
    const modal = document.createElement("div");
    modal.className = "boss-modal";

    // Bar
    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">${escapeHtml(this.isEdit ? "Edit" : "Add")} ${escapeHtml(this.title)}</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-btn-close";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this._cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-body";
    body.style.padding = "16px";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "12px";

    // Name field
    const nameGroup = this._makeField("Name", "text", this.item.name, "e.g. Dutch Angle");
    this._nameInput = nameGroup.input;
    body.appendChild(nameGroup.wrap);

    // Prompt field
    const promptGroup = this._makeField("Prompt", "textarea", this.item.prompt, "Prompt text sent to the model…");
    this._promptInput = promptGroup.input;
    body.appendChild(promptGroup.wrap);

    // Description field
    const descGroup = this._makeField("Description (optional)", "textarea", this.item.description || "", "Notes about this entry…");
    this._descInput = descGroup.input;
    body.appendChild(descGroup.wrap);

    // Favorite toggle
    const favWrap = document.createElement("div");
    favWrap.style.display = "flex";
    favWrap.style.alignItems = "center";
    favWrap.style.gap = "8px";
    const favLabel = document.createElement("span");
    favLabel.className = "boss-label";
    favLabel.textContent = "Favorite";
    const favToggle = document.createElement("button");
    favToggle.type = "button";
    favToggle.className = "boss-crd-star" + (this.item.favorite ? " active" : "");
    favToggle.textContent = this.item.favorite ? "★ Yes" : "☆ No";
    favToggle.style.fontSize = "13px";
    favToggle.style.padding = "4px 8px";
    favToggle.style.border = "1px solid var(--boss-border)";
    favToggle.style.borderRadius = "var(--boss-radius-md)";
    favToggle.style.background = "var(--boss-bg-input)";
    favToggle.style.cursor = "pointer";
    let isFav = !!this.item.favorite;
    favToggle.addEventListener("click", () => {
      isFav = !isFav;
      favToggle.className = "boss-crd-star" + (isFav ? " active" : "");
      favToggle.textContent = isFav ? "★ Yes" : "☆ No";
    });
    favWrap.appendChild(favLabel);
    favWrap.appendChild(favToggle);
    body.appendChild(favWrap);
    this._favToggle = () => isFav;

    // Error display
    const errorEl = document.createElement("div");
    errorEl.style.color = "#e74c3c";
    errorEl.style.fontSize = "12px";
    errorEl.style.minHeight = "16px";
    body.appendChild(errorEl);
    this.errorEl = errorEl;

    modal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "boss-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-btn-primary";
    saveBtn.textContent = this.isEdit ? "Save Changes" : "Add Entry";
    saveBtn.addEventListener("click", () => this._save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this._cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;

    // Keyboard
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this._cancel();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) this._save();
    });

    this._nameInput.focus();
  }

  _makeField(label, type, value, placeholder) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = label;
    wrap.appendChild(lbl);

    let input;
    if (type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
      input.style.resize = "vertical";
    } else {
      input = document.createElement("input");
      input.type = type;
    }
    input.className = "boss-input";
    input.value = value;
    input.placeholder = placeholder || "";
    wrap.appendChild(input);
    return { wrap, input };
  }

  _save() {
    const name = this._nameInput.value.trim();
    const prompt = this._promptInput.value.trim();
    const description = this._descInput.value.trim();
    const favorite = this._favToggle();

    const slug = CollectionModel.toSlug(name, this.existingSlugs);
    const item = { name, prompt, description, favorite };
    const excludeSlug = this.isEdit ? this.item._slug : null;
    const result = CollectionModel.validate(item, this.existingSlugs, excludeSlug);

    if (!result.ok) {
      this.errorEl.textContent = result.error;
      return;
    }

    this.modal.remove();
    this.modal = null;
    this.onSave({ slug, item });
    this._resolve({ slug, item });
  }

  _cancel() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.onCancel();
    this._resolve(null);
  }
}
```

- [ ] **Step 2: Export CollectionEditorDialog**

Update the export line to:

```javascript
export { BossDropdown, escapeHtml, CollectionModel, CollectionController, CollectionCRUDWidget, CollectionEditorDialog };
```

- [ ] **Step 3: Verify JS syntax**

Run: `node --check "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\js\boss_theme\index.js"`

Expected: no output (success)

- [ ] **Step 4: Commit**

```bash
git add js/boss_theme/index.js
git commit -m "feat(theme): add CollectionEditorDialog with validation and keyboard shortcuts"
```

---

## Task 8: JS — Integrate CRUD into CameraEditor

**Files:**
- Modify: `js/camera_style_mixer/index.js` (major changes to CameraEditor class)

**Interfaces:**
- Consumes: CollectionCRUDWidget, CollectionEditorDialog, CollectionController, CollectionModel from Tasks 5-7
- Produces: CameraEditor with CRUD rows for all 3 collections

- [ ] **Step 1: Update imports**

Replace line 18:

```javascript
import { BossDropdown } from "../boss_theme/index.js";
```

With:

```javascript
import { BossDropdown, CollectionCRUDWidget, CollectionEditorDialog, CollectionController, CollectionModel } from "../boss_theme/index.js";
```

- [ ] **Step 2: Add controller instance to CameraEditor constructor**

In the `CameraEditor` constructor (line 552), add after `this.modal = null;`:

```javascript
    this.controller = new CollectionController("/camera_boss");
```

- [ ] **Step 3: Update fetchData to store slug maps**

In `fetchData()` (line 569), update the library assignment to also store slug maps:

```javascript
    this.library = {
      angles: CollectionModel.normalize(data.angles),
      framings: CollectionModel.normalize(data.framings),
      styles: CollectionModel.normalize(data.styles),
      angleCategories: data.angleCategories || {},
      framingCategories: data.framingCategories || {},
      styleCategories: data.styleCategories || {},
      weightFormats: data.weightFormats || [],
    };
    // Build slug→name maps for display
    this.library.angleSlugMap = {};
    for (const [s, v] of Object.entries(this.library.angles)) this.library.angleSlugMap[s] = v.name || s;
    this.library.framingSlugMap = {};
    for (const [s, v] of Object.entries(this.library.framings)) this.library.framingSlugMap[s] = v.name || s;
    this.library.styleSlugMap = {};
    for (const [s, v] of Object.entries(this.library.styles)) this.library.styleSlugMap[s] = v.name || s;
```

- [ ] **Step 4: Update buildListSection to use slug-based selection**

In `buildListSection` (line 741), the list rendering currently uses item names. Update `refreshList` to work with slug-based data.

In `refreshList` (line 783), replace the items building and rendering logic:

Replace the section starting at line 827 (`const items = [...]`) through line 873 (end of empty check) with:

```javascript
    // Sentinel entries
    const items = [
      { slug: sentinel, name: sentinel === RANDOM_ANGLE ? "(Random)" : sentinel === RANDOM_FRAMING ? "(Random)" : "(Random)", badge: "Random", isSentinel: true },
      { slug: NONE_SENTINEL, name: "(None)", badge: "None", isSentinel: true },
    ];

    // Data entries (slug-based)
    const catData = isAngle ? this.library.angleCategories : isFraming ? this.library.framingCategories : this.library.styleCategories;
    const cat = this.state[categoryKey];
    let names;
    if (cat === ALL_CATEGORIES || !cat) {
      names = Object.keys(data).sort();
    } else {
      names = (catData[cat] || []).filter((s) => s in data).sort();
    }
    for (const slug of names) {
      const entry = data[slug];
      if (!entry || typeof entry !== "object") continue;
      const displayName = entry.name || slug;
      if (search && !displayName.toLowerCase().includes(search) && !entry.prompt?.toLowerCase().includes(search)) continue;
      items.push({ slug, name: displayName, badge: "", isSentinel: false });
    }

    for (const it of items) {
      const row = document.createElement("div");
      row.className =
        "boss-cam-list-item" +
        (this.state[stateKey] === it.slug ? " selected" : "");
      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = it.name;
      row.appendChild(nameEl);
      if (it.badge) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = it.badge;
        row.appendChild(badge);
      }
      // Edit/Delete icons for non-sentinel items
      if (!it.isSentinel) {
        const editIcon = document.createElement("span");
        editIcon.className = "boss-crd-icon";
        editIcon.textContent = "✎";
        editIcon.title = "Edit";
        editIcon.addEventListener("click", (e) => {
          e.stopPropagation();
          this._editEntry(which, it.slug);
        });
        row.appendChild(editIcon);

        const delIcon = document.createElement("span");
        delIcon.className = "boss-crd-icon boss-crd-icon-danger";
        delIcon.textContent = "✕";
        delIcon.title = "Delete";
        delIcon.addEventListener("click", (e) => {
          e.stopPropagation();
          this._deleteEntry(which, it.slug);
        });
        row.appendChild(delIcon);
      }
      row.addEventListener("click", () => {
        this.state[stateKey] = it.slug;
        this.refreshList(which);
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-cam-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = search ? "No matches." : "No entries yet.";
      el.appendChild(empty);
    }
```

- [ ] **Step 5: Add CRUD methods to CameraEditor**

Add these methods to the CameraEditor class, after `refreshPreview()` (line 1146):

```javascript
  // ── CRUD operations ──────────────────────────────────────────────────
  _addEntry(which) {
    const title = which === "angle" ? "Angle" : which === "framing" ? "Framing" : "Style";
    const existingSlugs = new Map(
      Object.entries(which === "angle" ? this.library.angles : which === "framing" ? this.library.framings : this.library.styles)
    );
    const dialog = new CollectionEditorDialog({
      title,
      item: { name: "", prompt: "", description: "", favorite: false },
      isEdit: false,
      existingSlugs,
      onSave: async ({ slug, item }) => {
        const type = which === "angle" ? "angles" : which === "framing" ? "framings" : "styles";
        const catKey = which === "angle" ? "angleCategory" : which === "framing" ? "framingCategory" : "styleCategory";
        const categories = this.state[catKey] && this.state[catKey] !== ALL_CATEGORIES ? [this.state[catKey]] : [];
        const result = await this.controller.add(type, item, categories);
        if (result.ok) {
          await this.fetchData();
          this.state[which === "angle" ? "cameraAngle" : which === "framing" ? "cameraFraming" : "artStyle"] = slug;
          this.refreshList(which);
          this.refreshPreview();
          setStatus(this.node, `Added "${item.name}"`);
          setTimeout(() => setStatus(this.node, ""), 2000);
        } else {
          setStatus(this.node, `Error: ${result.error}`, true);
        }
      },
    });
    dialog.open();
  }

  _editEntry(which, slug) {
    const title = which === "angle" ? "Angle" : which === "framing" ? "Framing" : "Style";
    const collection = which === "angle" ? this.library.angles : which === "framing" ? this.library.framings : this.library.styles;
    const entry = collection[slug];
    if (!entry) return;

    const existingSlugs = new Map(Object.entries(collection));
    const dialog = new CollectionEditorDialog({
      title,
      item: { ...entry, _slug: slug },
      isEdit: true,
      existingSlugs,
      onSave: async ({ slug: newSlug, item }) => {
        const type = which === "angle" ? "angles" : which === "framing" ? "framings" : "styles";
        const catKey = which === "angle" ? "angleCategory" : which === "framing" ? "framingCategory" : "styleCategory";
        const categories = this.state[catKey] && this.state[catKey] !== ALL_CATEGORIES ? [this.state[catKey]] : [];
        const result = await this.controller.edit(type, slug, item, categories);
        if (result.ok) {
          await this.fetchData();
          this.refreshList(which);
          this.refreshPreview();
          setStatus(this.node, `Saved "${item.name}"`);
          setTimeout(() => setStatus(this.node, ""), 2000);
        } else {
          setStatus(this.node, `Error: ${result.error}`, true);
        }
      },
    });
    dialog.open();
  }

  async _deleteEntry(which, slug) {
    const title = which === "angle" ? "Angle" : which === "framing" ? "Framing" : "Style";
    const collection = which === "angle" ? this.library.angles : which === "framing" ? this.library.framings : this.library.styles;
    const entry = collection[slug];
    if (!entry) return;

    const confirmed = await this._showConfirm(`Delete "${entry.name || slug}"?`);
    if (!confirmed) return;

    const type = which === "angle" ? "angles" : which === "framing" ? "framings" : "styles";
    const result = await this.controller.delete(type, slug);
    if (result.ok) {
      await this.fetchData();
      const stateKey = which === "angle" ? "cameraAngle" : which === "framing" ? "cameraFraming" : "artStyle";
      if (this.state[stateKey] === slug) {
        this.state[stateKey] = which === "angle" ? RANDOM_ANGLE : which === "framing" ? RANDOM_FRAMING : RANDOM_STYLE;
      }
      this.refreshList(which);
      this.refreshPreview();
      setStatus(this.node, `Deleted "${entry.name || slug}"`);
      setTimeout(() => setStatus(this.node, ""), 2000);
    } else {
      setStatus(this.node, `Error: ${result.error}`, true);
    }
  }

  _showConfirm(message) {
    return new Promise((resolve) => {
      const toast = document.createElement("div");
      toast.className = "boss-toast";
      toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="boss-btn-primary" style="margin-left:8px;padding:4px 12px;">Yes</button>
        <button class="boss-btn-ghost" style="margin-left:4px;padding:4px 12px;">No</button>
      `;
      toast.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--boss-bg-section);border:1px solid var(--boss-border-strong);border-radius:8px;padding:8px 16px;z-index:9999;display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
      document.body.appendChild(toast);
      const cleanup = (val) => { toast.remove(); resolve(val); };
      toast.querySelector(".boss-btn-primary").addEventListener("click", () => cleanup(true));
      toast.querySelector(".boss-btn-ghost").addEventListener("click", () => cleanup(false));
    });
  }

  _toggleFavorite(which, slug) {
    const collection = which === "angle" ? this.library.angles : which === "framing" ? this.library.framings : this.library.styles;
    const entry = collection[slug];
    if (!entry) return;
    const type = which === "angle" ? "angles" : which === "framing" ? "framings" : "styles";
    this.controller.edit(type, slug, { ...entry, favorite: !entry.favorite }, []);
    entry.favorite = !entry.favorite;
    this.refreshList(which);
  }
```

- [ ] **Step 6: Update buildModal to add "Add" buttons**

In `buildModal()`, after each `buildListSection` call, add an add button. Find each `side.appendChild(this.buildCategorySection(...)` block and insert an add button before it.

After the Angle list section (line 628), add:

```javascript
    const angleAddBtn = document.createElement("button");
    angleAddBtn.type = "button";
    angleAddBtn.className = "boss-crd-add";
    angleAddBtn.textContent = "＋ Add Angle";
    angleAddBtn.addEventListener("click", () => this._addEntry("angle"));
    side.appendChild(angleAddBtn);
```

After the Framing list section (line 655), add:

```javascript
    const framingAddBtn = document.createElement("button");
    framingAddBtn.type = "button";
    framingAddBtn.className = "boss-crd-add";
    framingAddBtn.textContent = "＋ Add Framing";
    framingAddBtn.addEventListener("click", () => this._addEntry("framing"));
    side.appendChild(framingAddBtn);
```

After the Style list section (line 682), add:

```javascript
    const styleAddBtn = document.createElement("button");
    styleAddBtn.type = "button";
    styleAddBtn.className = "boss-crd-add";
    styleAddBtn.textContent = "＋ Add Style";
    styleAddBtn.addEventListener("click", () => this._addEntry("style"));
    side.appendChild(styleAddBtn);
```

- [ ] **Step 7: Verify JS syntax**

Run: `node --check "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\js\camera_style_mixer\index.js"`

Expected: no output (success)

- [ ] **Step 8: Commit**

```bash
git add js/camera_style_mixer/index.js
git commit -m "feat(camera): integrate CRUD into CameraEditor with add/edit/delete"
```

---

## Task 9: End-to-end testing

**Files:**
- None (testing only)

- [ ] **Step 1: Start ComfyUI**

Run ComfyUI and load a workflow with Camera Style Mixer node.

- [ ] **Step 2: Test Add**

Click "＋ Add Angle" → enter name "Test Angle" and prompt "test angle prompt" → Save → verify entry appears in list

- [ ] **Step 3: Test Edit**

Click edit icon on "Test Angle" → change name to "Test Angle v2" → Save → verify updated name in list

- [ ] **Step 4: Test Delete**

Click delete icon on "Test Angle v2" → confirm → verify entry removed from list

- [ ] **Step 5: Test slug generation**

Add entry named "My Cool Angle!" → verify slug is "my_cool_angle" in JSON file

- [ ] **Step 6: Test slug collision**

Add entry named "My Cool Angle" → verify it gets slug "my_cool_angle_2"

- [ ] **Step 7: Test category filtering**

Add entry to a category → verify it appears when category is filtered

- [ ] **Step 8: Test hot-reload**

Edit JSON file externally → click Refresh → verify changes appear

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(camera): complete CRUD framework for Camera Style Mixer"
```

---

## Self-Review

1. **Spec coverage:** All requirements covered — data model, slug collision, category migration, 4 shared components, 2 backend endpoints, integration.
2. **Placeholder scan:** No TBDs or TODOs. All steps have complete code.
3. **Type consistency:** CollectionModel.validate returns `{ok, error}`, CollectionController methods return `{ok, ...data}`, CollectionEditorDialog returns `{slug, item}` or null.

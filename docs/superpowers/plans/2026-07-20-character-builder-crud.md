# Character Builder CRUD + Preview Images — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD (Add/Edit/Delete) and character preview images to the Ultimate Character Builder Pro node.

**Architecture:** Per-item backend endpoints (POST /char_boss/save, POST /char_boss/delete, GET /char_boss/proxy_image) following the Artist Selector pattern. JS frontend adds CRUD controls, sub-modals, toggle category chips, preview thumbnails, and toast notifications to the existing editor sections.

**Tech Stack:** Python (aiohttp routes, JSON persistence via Collection class), JavaScript (DOM widgets, BossDropdown, boss_theme CSS classes)

## Global Constraints

- 100% backward compatibility — node names, categories, inputs, outputs, widget names unchanged
- Existing string entries in characters.json/expressions.json/poses.json work unchanged (no forced migration)
- Follow established patterns: Artist Selector CRUD endpoints + Scene Maker Pro save pattern
- Reuse `boss_theme` CSS classes and shared components (BossDropdown, toast system)
- Use existing `Collection` class from `utils/cache_utils.py` for JSON persistence
- Node class: `UltimateCharacterBuilderPro`, categories: `["Boss Tools", "Prompting"]`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `py/ultimate_character_builder.py` | MODIFY | Add 3 new endpoints: save, delete, proxy_image; extend /data to return previews |
| `js/ultimate_character_builder/index.js` | MODIFY | Add CRUD UI: buttons, sub-modals, thumbnails, toasts, category chips |
| `py/character_previews.json` | CREATE | Character preview URLs from nax.moe (initially empty `{}`) |
| `py/fetch_character_previews.py` | CREATE | Script to scrape nax.moe for character tag previews |

---

### Task 1: Backend — Add `/char_boss/save` Endpoint

**Files:**
- Modify: `py/ultimate_character_builder.py`

**Interfaces:**
- Consumes: `_CHARACTERS`, `_EXPRESSIONS`, `_POSES` Collection objects (already defined)
- Produces: `POST /char_boss/save` route returning `{ name, prompt, categories, custom_preview, is_new }`

- [ ] **Step 1: Read the current file to understand structure**

Read `py/ultimate_character_builder.py` to find where routes are defined and where the Collection objects are initialized. Note the `_CHARACTERS`, `_EXPRESSIONS`, `_POSES` globals and the existing `@routes.get("/char_boss/data")` and `@routes.post("/char_boss/refresh")` endpoints.

- [ ] **Step 2: Add the save endpoint after the refresh endpoint**

Find the `@routes.post("/char_boss/refresh")` handler. Add the following route immediately after it:

```python
@routes.post("/char_boss/save")
async def save_char_entry(request):
    try:
        body = await request.json()
        lib_type = body.get("type", "")
        name = body.get("name", "").strip()
        prompt = body.get("prompt", "").strip()
        categories = body.get("categories", [])
        custom_preview = body.get("custom_preview", "").strip()

        if lib_type not in ("characters", "expressions", "poses"):
            return web.json_response({"error": "Invalid type"}, status=400)
        if not name:
            return web.json_response({"error": "Name required"}, status=400)
        if not prompt:
            return web.json_response({"error": "Prompt required"}, status=400)

        coll_map = {
            "characters": _CHARACTERS,
            "expressions": _EXPRESSIONS,
            "poses": _POSES,
        }
        coll = coll_map[lib_type]

        existing = coll.items.get(name)
        is_new = existing is None

        if is_new:
            entry = {"prompt": prompt, "custom_preview": custom_preview}
        else:
            old_preview = ""
            if isinstance(existing, dict):
                old_preview = existing.get("custom_preview", "")
            entry = {
                "prompt": prompt,
                "custom_preview": custom_preview or old_preview,
            }

        coll.items[name] = entry

        if categories:
            for cat, members in coll.categories.items():
                if cat == "All":
                    continue
                if name not in members:
                    members.append(name)

        coll.save()

        return web.json_response({
            "name": name,
            "prompt": prompt,
            "categories": categories,
            "custom_preview": entry.get("custom_preview", ""),
            "is_new": is_new,
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
```

- [ ] **Step 3: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 4: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: add POST /char_boss/save endpoint for CRUD"
```

---

### Task 2: Backend — Add `/char_boss/delete` Endpoint

**Files:**
- Modify: `py/ultimate_character_builder.py`

**Interfaces:**
- Consumes: `_CHARACTERS`, `_EXPRESSIONS`, `_POSES` Collection objects
- Produces: `POST /char_boss/delete` route returning `{ name, deleted }`

- [ ] **Step 1: Add the delete endpoint after the save endpoint**

Find the `save_char_entry` handler added in Task 1. Add the following route immediately after it:

```python
@routes.post("/char_boss/delete")
async def delete_char_entry(request):
    try:
        body = await request.json()
        lib_type = body.get("type", "")
        name = body.get("name", "").strip()

        if lib_type not in ("characters", "expressions", "poses"):
            return web.json_response({"error": "Invalid type"}, status=400)
        if not name:
            return web.json_response({"error": "Name required"}, status=400)

        coll_map = {
            "characters": _CHARACTERS,
            "expressions": _EXPRESSIONS,
            "poses": _POSES,
        }
        coll = coll_map[lib_type]

        if name not in coll.items:
            return web.json_response({"error": "Entry not found"}, status=404)

        del coll.items[name]

        for cat, members in coll.categories.items():
            if name in members:
                members.remove(name)

        coll.save()

        return web.json_response({"name": name, "deleted": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
```

- [ ] **Step 2: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: add POST /char_boss/delete endpoint for CRUD"
```

---

### Task 3: Backend — Add `/char_boss/proxy_image` Endpoint

**Files:**
- Modify: `py/ultimate_character_builder.py`

**Interfaces:**
- Consumes: None (standalone proxy)
- Produces: `GET /char_boss/proxy_image` route returning proxied image bytes

- [ ] **Step 1: Add the proxy endpoint after the delete endpoint**

Find the `delete_char_entry` handler added in Task 2. Add the following route immediately after it:

```python
@routes.get("/char_boss/proxy_image")
async def proxy_image(request):
    url = request.query.get("url", "")
    if not url:
        return web.json_response({"error": "Missing url parameter"}, status=400)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://nax.moe/",
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return web.json_response({"error": f"Upstream {resp.status}"}, status=502)
                data = await resp.read()
                content_type = resp.content_type or "image/jpeg"
                return web.Response(body=data, content_type=content_type)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
```

- [ ] **Step 2: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: add GET /char_boss/proxy_image endpoint for preview proxy"
```

---

### Task 4: Backend — Extend `/char_boss/data` to Return Character Previews

**Files:**
- Modify: `py/ultimate_character_builder.py`

**Interfaces:**
- Consumes: `py/character_previews.json` (loaded at module level)
- Produces: Extended `/char_boss/data` response with `character_previews` key

- [ ] **Step 1: Create the empty character_previews.json file**

Create `py/character_previews.json` with contents:
```json
{}
```

- [ ] **Step 2: Add a module-level variable to load character previews**

Find the existing Collection globals near the top of the file (where `_CHARACTERS`, `_EXPRESSIONS`, `_POSES` are defined). Add after them:

```python
_CHAR_PREVIEWS = {}
def _load_char_previews():
    global _CHAR_PREVIEWS
    p = os.path.join(os.path.dirname(__file__), "character_previews.json")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            _CHAR_PREVIEWS = json.load(f)
    else:
        _CHAR_PREVIEWS = {}

_load_char_previews()
```

- [ ] **Step 3: Add `character_previews` to the `/char_boss/data` response**

Find the existing `@routes.get("/char_boss/data")` handler. Add `"character_previews": _CHAR_PREVIEWS` to the response dict. The response dict is returned as `web.json_response(...)`. Add the key inside that dict.

- [ ] **Step 4: Force-reload previews in the refresh endpoint**

Find the `@routes.post("/char_boss/refresh")` handler. Add `_load_char_previews()` call inside it, after the existing `Collection` reloads.

- [ ] **Step 5: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 6: Commit**

```bash
git add py/ultimate_character_builder.py py/character_previews.json
git commit -m "feat: extend /char_boss/data to return character_previews"
```

---

### Task 5: Create Character Preview Scraper Script

**Files:**
- Create: `py/fetch_character_previews.py`

**Interfaces:**
- Consumes: `https://nax.moe/?gallery=danbooru-character-tags-v4.5`
- Produces: `py/character_previews.json`

- [ ] **Step 1: Create the scraper script**

Create `py/fetch_character_previews.py`:

```python
"""
Fetch character preview image URLs from nax.moe (danbooru-character-tags-v4.5 gallery).
Writes character_previews.json mapping character names to CDN image URLs.

Usage: python fetch_character_previews.py
"""
import json
import os
import re
import time

import requests

GALLERY_URL = "https://nax.moe/?gallery=danbooru-character-tags-v4.5"
CDN_PREFIX = "https://cdn.zele.st/data/NAX/Images/danbooru-character-tags-v4.5/"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "character_previews.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def fetch_gallery_page(url):
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_character_entries(html):
    """Parse gallery HTML to extract character tag -> image URL mappings."""
    entries = {}
    pattern = re.compile(
        r'data-src="([^"]*danbooru-character-tags-v4\.5/[^"]*)"'
        r'|src="([^"]*danbooru-character-tags-v4\.5/[^"]*)"'
        r'|(?:href|data-page-num)="([^"]*)"',
        re.IGNORECASE
    )
    img_pattern = re.compile(
        r'(https?://cdn\.zele\.st/data/NAX/Images/danbooru-character-tags-v4\.5/[^\s"\'<>]+)',
        re.IGNORECASE
    )
    name_pattern = re.compile(
        r'title="([^"]+)"',
        re.IGNORECASE
    )

    for match in img_pattern.finditer(html):
        url = match.group(1)
        name_match = name_pattern.search(html, max(0, match.start() - 500), match.end())
        if name_match:
            raw_name = name_match.group(1).strip()
            name = raw_name.replace("_", " ").strip()
            if name:
                entries[name] = url

    return entries


def main():
    print(f"Fetching gallery: {GALLERY_URL}")
    html = fetch_gallery_page(GALLERY_URL)
    print(f"Page length: {len(html)} chars")

    entries = parse_character_entries(html)
    print(f"Found {len(entries)} character entries")

    if entries:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2, ensure_ascii=False)
        print(f"Saved to {OUTPUT_FILE}")
        sample = list(entries.items())[:3]
        for name, url in sample:
            print(f"  {name}: {url[:80]}...")
    else:
        print("No entries found. The gallery page structure may have changed.")
        print("Saving empty mapping.")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f, indent=2)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/fetch_character_previews.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add py/fetch_character_previews.py
git commit -m "feat: add character preview scraper for nax.moe"
```

---

### Task 6: JS — Add CRUD Buttons and Refresh to Editor Sections

**Files:**
- Modify: `js/ultimate_character_builder/index.js`

**Interfaces:**
- Consumes: Existing `CharEditor` class, `open()` method
- Produces: CRUD button row in each section (Character, Expression, Pose)

- [ ] **Step 1: Read the current JS file structure**

Read `js/ultimate_character_builder/index.js` to find:
- The `CharEditor` class and its `open()` method
- Where each section's list is built (Character, Expression, Pose sections)
- The CSS injection block (to add new styles)
- The existing `showToast()` function (if any) — or confirm it doesn't exist yet

- [ ] **Step 2: Add toast CSS to the injected styles**

Find the existing CSS injection block (the `style` element with id guard). Add toast styles inside it:

```css
.boss-char-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--boss-bg-card);
  border: 1px solid var(--boss-border-subtle);
  border-radius: 8px;
  padding: 10px 20px;
  color: var(--boss-text);
  font-size: 13px;
  z-index: 10000;
  animation: boss-char-toast-in 0.2s ease;
  pointer-events: auto;
}
.boss-char-toast.success { border-color: var(--boss-success); }
.boss-char-toast.error { border-color: var(--boss-danger); }
.boss-char-toast.confirm {
  display: flex;
  align-items: center;
  gap: 10px;
}
.boss-char-toast .boss-art-crud-btn {
  padding: 4px 10px;
  font-size: 11px;
}
@keyframes boss-char-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.boss-char-crud-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.boss-char-crud-row .boss-art-crud-btn {
  flex: 1;
  font-size: 10px;
  padding: 4px 6px;
}
.boss-char-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.boss-char-item:hover {
  background: var(--boss-bg-hover);
}
.boss-char-item .boss-char-thumb {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.boss-char-item .boss-char-thumb-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: var(--boss-bg-hover);
  flex-shrink: 0;
}
.boss-char-item-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 2px;
}
.boss-char-item:hover .boss-char-item-actions {
  display: flex;
}
.boss-char-item-actions button {
  background: none;
  border: none;
  color: var(--boss-text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
}
.boss-char-item-actions button:hover {
  color: var(--boss-text);
  background: var(--boss-bg-hover);
}
```

- [ ] **Step 3: Add `showToast` and `showConfirmToast` functions**

Add these functions in the JS file (after the existing helper functions, before the `CharEditor` class):

```javascript
function showToast(message, type = "info", duration = 3000) {
  const existing = document.querySelectorAll(".boss-char-toast");
  existing.forEach((e) => e.remove());
  const toast = document.createElement("div");
  toast.className = `boss-char-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showConfirmToast(message, onYes, onNo) {
  const existing = document.querySelectorAll(".boss-char-toast");
  existing.forEach((e) => e.remove());
  const toast = document.createElement("div");
  toast.className = "boss-char-toast confirm";
  const msg = document.createElement("span");
  msg.textContent = message;
  toast.appendChild(msg);
  const yesBtn = document.createElement("button");
  yesBtn.type = "button";
  yesBtn.className = "boss-art-crud-btn primary";
  yesBtn.textContent = "Yes";
  yesBtn.addEventListener("click", () => { toast.remove(); onYes?.(); });
  toast.appendChild(yesBtn);
  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "boss-art-crud-btn";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", () => { toast.remove(); onNo?.(); });
  toast.appendChild(noBtn);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}
```

- [ ] **Step 4: Add CRUD button row builder method to CharEditor**

Add a new method to the `CharEditor` class (after the existing section-building methods):

```javascript
_buildCrudRow(type, listContainer, searchInput, categoryDropdown, strengthSlider) {
  const row = document.createElement("div");
  row.className = "boss-char-crud-row";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "boss-art-crud-btn primary";
  addBtn.textContent = "+ Add";
  addBtn.addEventListener("click", () => this._openItemModal(type, null));

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "boss-art-crud-btn";
  refreshBtn.textContent = "Refresh";
  refreshBtn.addEventListener("click", async () => {
    try {
      await this._refreshData();
      this._rebuildList(type, listContainer, searchInput, categoryDropdown, strengthSlider);
      showToast(`${type} library refreshed`, "success");
    } catch (e) {
      showToast("Refresh failed", "error");
    }
  });

  row.appendChild(addBtn);
  row.appendChild(refreshBtn);
  return row;
}
```

- [ ] **Step 5: Add `_refreshData` method to CharEditor**

Add this method to the `CharEditor` class:

```javascript
async _refreshData() {
  await fetch("/char_boss/refresh", { method: "POST" });
  const r = await fetch("/char_boss/data?t=" + Date.now());
  const data = await r.json();
  this.libs = data;
}
```

- [ ] **Step 6: Verify JS syntax**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 7: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add toast system, CRUD button row, refresh to Character Builder editor"
```

---

### Task 7: JS — Add Sub-Modal for Add/Edit Items

**Files:**
- Modify: `js/ultimate_character_builder/index.js`

**Interfaces:**
- Consumes: `showToast()`, `showConfirmToast()`, libs data
- Produces: `_openItemModal(type, existingName)` method on CharEditor

- [ ] **Step 1: Add the sub-modal method to CharEditor**

Add this method to the `CharEditor` class:

```javascript
_openItemModal(type, existingName) {
  const isEdit = existingName !== null;
  const libKey = type + "s";
  const libData = this.libs[libKey] || {};
  const catKey = type + "Categories";
  const allCats = this.libs[catKey] || [];
  const previews = this.libs.character_previews || {};

  let currentPrompt = "";
  let currentPreview = "";
  let currentCategories = [];

  if (isEdit && libData[existingName]) {
    const entry = libData[existingName];
    currentPrompt = typeof entry === "string" ? entry : (entry.prompt || "");
    currentPreview = typeof entry === "object" ? (entry.custom_preview || "") : "";
    const catData = this.libs[catKey] || {};
    for (const [cat, members] of Object.entries(catData)) {
      if (cat !== "All" && Array.isArray(members) && members.includes(existingName)) {
        currentCategories.push(cat);
      }
    }
  }

  const overlay = document.createElement("div");
  overlay.className = "boss-art-submodal-overlay";

  const modal = document.createElement("div");
  modal.className = "boss-art-submodal";

  const title = document.createElement("h3");
  title.textContent = isEdit ? `Edit: ${existingName}` : `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  modal.appendChild(title);

  if (!isEdit) {
    const nameField = document.createElement("div");
    nameField.className = "field";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "character_tag_name";
    nameInput.value = "";
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    modal.appendChild(nameField);
    this._subNameInput = nameInput;
  } else {
    this._subNameInput = null;
  }

  const promptField = document.createElement("div");
  promptField.className = "field";
  const promptLabel = document.createElement("label");
  promptLabel.textContent = "Prompt";
  const promptInput = document.createElement("textarea");
  promptInput.rows = 4;
  promptInput.value = currentPrompt;
  promptField.appendChild(promptLabel);
  promptField.appendChild(promptInput);
  modal.appendChild(promptField);

  const previewField = document.createElement("div");
  previewField.className = "field";
  const previewLabel = document.createElement("label");
  previewLabel.textContent = "Preview Image URL (optional)";
  const previewInput = document.createElement("input");
  previewInput.type = "text";
  previewInput.placeholder = "https://cdn.donmai.us/...";
  previewInput.value = currentPreview;
  previewField.appendChild(previewLabel);
  previewField.appendChild(previewInput);
  modal.appendChild(previewField);

  if (allCats.length > 0) {
    const catField = document.createElement("div");
    catField.className = "field";
    const catLabel = document.createElement("label");
    catLabel.textContent = "Categories";
    const catChips = document.createElement("div");
    catChips.className = "cat-chips";
    const selectedCats = new Set(currentCategories);

    for (const cat of allCats) {
      if (cat === "All") continue;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cat-chip" + (selectedCats.has(cat) ? " active" : "");
      chip.textContent = cat;
      chip.dataset.cat = cat;
      chip.addEventListener("click", () => {
        if (selectedCats.has(cat)) selectedCats.delete(cat);
        else selectedCats.add(cat);
        chip.classList.toggle("active");
      });
      catChips.appendChild(chip);
    }
    catField.appendChild(catLabel);
    catField.appendChild(catChips);
    modal.appendChild(catField);
    this._subSelectedCats = selectedCats;
  } else {
    this._subSelectedCats = new Set(currentCategories);
  }

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "boss-art-crud-btn primary";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", async () => {
    const name = isEdit ? existingName : (this._subNameInput?.value || "").trim();
    const prompt = promptInput.value.trim();
    const categories = Array.from(this._subSelectedCats);
    const custom_preview = previewInput.value.trim();

    if (!name) { showToast("Name required", "error"); return; }
    if (!prompt) { showToast("Prompt required", "error"); return; }

    const oldCats = isEdit ? currentCategories : [];
    const removed = oldCats.filter((c) => !categories.includes(c));
    const added = categories.filter((c) => !oldCats.includes(c));

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      const r = await fetch("/char_boss/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: libKey, name, prompt, categories, custom_preview }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Save failed");
      }
      await this._refreshData();
      this._rebuildAllLists();
      overlay.remove();
      if (isEdit && (removed.length > 0 || added.length > 0)) {
        const parts = [];
        if (added.length) parts.push(`added to: ${added.join(", ")}`);
        if (removed.length) parts.push(`removed from: ${removed.join(", ")}`);
        showToast(`${name}: ${parts.join("; ")}`, "success");
      } else {
        showToast(isEdit ? `${name} updated` : `${name} added`, "success");
      }
    } catch (e) {
      showToast("Save failed: " + e.message, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "boss-art-crud-btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (this._subNameInput) this._subNameInput.focus();
  else promptInput.focus();
}
```

- [ ] **Step 2: Add `_confirmDelete` method to CharEditor**

Add this method to the `CharEditor` class:

```javascript
_confirmDelete(type, name) {
  showConfirmToast(`Delete ${name}?`, async () => {
    try {
      const r = await fetch("/char_boss/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type + "s", name }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Delete failed");
      }
      await this._refreshData();
      this._rebuildAllLists();
      showToast(`${name} deleted`, "success");
    } catch (e) {
      showToast("Delete failed: " + e.message, "error");
    }
  });
}
```

- [ ] **Step 3: Verify JS syntax**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 4: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add sub-modal and delete confirmation to Character Builder CRUD"
```

---

### Task 8: JS — Add Preview Thumbnails and List Item Actions

**Files:**
- Modify: `js/ultimate_character_builder/index.js`

**Interfaces:**
- Consumes: `character_previews` from libs, `_openItemModal`, `_confirmDelete`
- Produces: Updated list rendering with thumbnails and edit/delete icons

- [ ] **Step 1: Add a `_buildListItem` method to CharEditor**

Add this method to the `CharEditor` class:

```javascript
_buildListItem(type, name, isSelected, onClick) {
  const item = document.createElement("div");
  item.className = "boss-char-item" + (isSelected ? " selected" : "");
  item.addEventListener("click", onClick);

  const previews = this.libs.character_previews || {};
  const libKey = type + "s";
  const libData = this.libs[libKey] || {};
  const entry = libData[name];
  const customPreview = typeof entry === "object" ? (entry.custom_preview || "") : "";
  const rawPreview = customPreview || previews[name] || "";
  const preview = rawPreview
    ? "/char_boss/proxy_image?url=" + encodeURIComponent(rawPreview)
    : "";

  if (preview) {
    const img = document.createElement("img");
    img.className = "boss-char-thumb";
    img.src = preview;
    img.alt = name;
    img.addEventListener("error", () => {
      img.replaceWith(this._thumbPlaceholder());
    });
    item.appendChild(img);
  } else {
    item.appendChild(this._thumbPlaceholder());
  }

  const label = document.createElement("span");
  label.textContent = name;
  label.style.flex = "1";
  label.style.overflow = "hidden";
  label.style.textOverflow = "ellipsis";
  label.style.whiteSpace = "nowrap";
  item.appendChild(label);

  const actions = document.createElement("div");
  actions.className = "boss-char-item-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.textContent = "✎";
  editBtn.title = "Edit";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    this._openItemModal(type, name);
  });

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.textContent = "✕";
  delBtn.title = "Delete";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    this._confirmDelete(type, name);
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  item.appendChild(actions);

  return item;
}

_thumbPlaceholder() {
  const ph = document.createElement("div");
  ph.className = "boss-char-thumb-placeholder";
  return ph;
}
```

- [ ] **Step 2: Add `_rebuildAllLists` method to CharEditor**

This method rebuilds all three lists (Character, Expression, Pose) after data changes. Add to the `CharEditor` class:

```javascript
_rebuildAllLists() {
  if (this._charListEl) {
    this._rebuildList("character", this._charListEl, this._charSearchInput, this._charCatDropdown, this._charStrengthSlider);
  }
  if (this._exprListEl) {
    this._rebuildList("expression", this._exprListEl, this._exprSearchInput, this._exprCatDropdown, this._exprStrengthSlider);
  }
  if (this._poseListEl) {
    this._rebuildList("pose", this._poseListEl, this._poseSearchInput, this._poseCatDropdown, this._poseStrengthSlider);
  }
}
```

- [ ] **Step 3: Update the list-building code in `open()` to use `_buildListItem`**

Find where each section's list is built in the `open()` method. Replace the existing list item creation with calls to `_buildListItem`. The key sections are:

For Character list:
```javascript
// OLD: for (const name of charList) { ... create item with text ... }
// NEW:
for (const name of charList) {
  const item = this._buildListItem("character", name, this.state.character === name, () => {
    this.state.character = name;
    this._updateSelection("character");
  });
  listEl.appendChild(item);
}
```

Same pattern for Expression and Pose lists.

- [ ] **Step 4: Store references for rebuild**

In the `open()` method, after building each list, store references:
```javascript
this._charListEl = listEl;      // (the character list container)
this._charSearchInput = searchInput;
this._charCatDropdown = catDropdown;
this._charStrengthSlider = strengthSlider;
// Same for expression and pose
```

- [ ] **Step 5: Verify JS syntax**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 6: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add preview thumbnails and edit/delete actions to Character Builder lists"
```

---

### Task 9: Wire CRUD Buttons Into Each Section

**Files:**
- Modify: `js/ultimate_character_builder/index.js`

**Interfaces:**
- Consumes: `_buildCrudRow` from Task 6, list elements from Task 8
- Produces: CRUD button rows visible in Character, Expression, Pose sections

- [ ] **Step 1: Insert CRUD rows into each section**

In the `open()` method, find where each section's DOM elements are assembled. After the category dropdown and before the list, insert the CRUD row:

For Character section:
```javascript
const charCrudRow = this._buildCrudRow(
  "character", listEl, searchInput, catDropdown, strengthSlider
);
section.appendChild(charCrudRow);
```

For Expression section:
```javascript
const exprCrudRow = this._buildCrudRow(
  "expression", listEl, searchInput, catDropdown, strengthSlider
);
section.appendChild(exprCrudRow);
```

For Pose section:
```javascript
const poseCrudRow = this._buildCrudRow(
  "pose", listEl, searchInput, catDropdown, strengthSlider
);
section.appendChild(poseCrudRow);
```

- [ ] **Step 2: Verify JS syntax**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 3: Verify full end-to-end flow manually**

Start ComfyUI, open Character Builder editor, and verify:
1. Each section has + Add and Refresh buttons
2. List items show thumbnails (if previews exist) and hover-reveal edit/delete icons
3. + Add opens sub-modal with name, prompt, preview URL, category chips
4. Edit icon opens pre-filled sub-modal
5. Delete icon shows confirmation toast
6. Save/Update/Delete shows toast and refreshes list
7. Existing characters still work (backward compatibility)

- [ ] **Step 4: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: wire CRUD buttons into Character Builder editor sections"
```

---

### Task 10: Final Integration Test and Cleanup

**Files:**
- All modified files

**Interfaces:**
- Full end-to-end: Backend endpoints + JS UI + data persistence

- [ ] **Step 1: Test all CRUD operations**

1. Open Character Builder editor
2. Character section: Click + Add → fill name, prompt, categories → Save → verify appears in list
3. Character section: Hover item → click ✎ → edit prompt → Save → verify updated
4. Character section: Hover item → click ✕ → Yes → verify removed
5. Repeat for Expression and Pose sections
6. Click Refresh → verify data reloads
7. Close editor, reopen → verify changes persisted

- [ ] **Step 2: Test backward compatibility**

1. Verify existing characters (e.g., `ganyu_(genshin impact)`) still appear and work
2. Verify existing expressions and poses still appear and work
3. Verify no errors in browser console

- [ ] **Step 3: Run any existing tests if present**

Check if there are test files and run them. If none exist, skip.

- [ ] **Step 4: Final commit with all changes**

```bash
git add -A
git commit -m "feat: Character Builder CRUD + preview images — complete implementation"
```

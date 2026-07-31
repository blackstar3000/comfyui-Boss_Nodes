# Prompt Booster PRO CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD support (add/edit/delete/duplicate) to the Prompt Booster PRO ComfyUI node, reusing the existing `CollectionController`/`CollectionEditorDialog`/`CollectionCRUDWidget` pattern from boss_theme.

**Architecture:** Python `_BoosterLibrary` class isolates flat (quality) vs nested (negative) storage behind a uniform interface. Three HTTP routes (`/booster_boss/save`, `/booster_boss/delete`, `/booster_boss/refresh`) mirror Prompt Master Library Pro exactly. JS editor becomes two-panel: CRUD list on left, strength/format/preview on right.

**Tech Stack:** Python (aiohttp routes, JSON files), JavaScript (DOM widgets, boss_theme components)

## Global Constraints

- Never rename node class, display name, category, inputs, outputs, return types
- `import { app } from "/scripts/app.js"` (absolute path)
- Vue Nodes 2.0: guard `node.addClass` with `if (node.addClass)`
- All code must pass syntax check before claiming done
- Atomic writes: temp file → replace original
- Preserve UI state after every CRUD operation

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `py/prompt_booster_pro.py` | Modify | Add `_BoosterLibrary` class, 3 HTTP routes |
| `js/prompt_booster_pro/index.js` | Modify | Import CRUD components, rebuild editor modal |

No new files. Reuse existing `boss_theme` components:
- `CollectionController` — HTTP CRUD wrapper
- `CollectionEditorDialog` — Add/edit dialog
- `CollectionCRUDWidget` — List with search/add/edit/delete
- `BossDropdown` — Styled dropdown

---

### Task 1: Python `_BoosterLibrary` helper class

**Files:**
- Modify: `py/prompt_booster_pro.py:88-131` (after `_Collection` class, before `_log`)

**Interfaces:**
- Consumes: `_QUALITY`, `_NEGATIVES` collection instances, `_FILES` dict
- Produces: `_BoosterLibrary` class with `load()`, `save_entry()`, `delete_entry()`, `list_entries()`, `_write_json()`

- [ ] **Step 1: Add `_BoosterLibrary` class after line 91**

```python
class _BoosterLibrary:
    """CRUD operations for quality and negative boosters.
    Isolates flat (quality) vs nested (negative) storage."""

    def load(self, key: str, force: bool = False) -> dict:
        """Load collection data. Quality returns {name: text},
        negatives returns {preset: {level: text}}."""
        coll = _QUALITY if key == "quality" else _NEGATIVES
        coll.load(force)
        return coll.items

    def save_entry(self, key: str, name: str, text: str, category: str = "") -> dict:
        """Create or update an entry. Quality: category ignored (flat).
        Negatives: category = preset name (nested).
        Returns updated collection data."""
        data = self.load(key)
        if key == "quality":
            data[name] = text
        else:
            cat = category or "default"
            if cat not in data:
                data[cat] = {}
            data[cat][name] = text
        self._write_json(key, data)
        _log(f"Saved {key}/{name} — total {self._count(key, data)} entries")
        return data

    def delete_entry(self, key: str, name: str, category: str = "") -> dict:
        """Delete an entry. Returns updated collection data."""
        data = self.load(key)
        if key == "quality":
            data.pop(name, None)
        else:
            cat = category or "default"
            if cat in data:
                data[cat].pop(name, None)
                if not data[cat]:
                    del data[cat]
        self._write_json(key, data)
        _log(f"Deleted {key}/{name} — total {self._count(key, data)} entries")
        return data

    def list_entries(self, key: str) -> dict:
        """Return current collection data."""
        return self.load(key)

    def _count(self, key: str, data: dict) -> int:
        if key == "quality":
            return len(data)
        return sum(len(v) for v in data.values())

    def _write_json(self, key: str, data: dict) -> None:
        """Atomic write: temp file → replace original."""
        import tempfile
        path = _FILES[key]
        try:
            fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path)
        except OSError as e:
            _log(f"Error writing {path.name}: {e}")
            if os.path.exists(tmp):
                os.remove(tmp)
```

- [ ] **Step 2: Add `_library` instance after the class**

```python
_library = _BoosterLibrary()
```

- [ ] **Step 3: Verify syntax**

Run: `& "F:\ComfyUI\python_embeded\python.exe" -m py_compile "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\prompt_booster_pro.py"`
Expected: No output (clean compile)

---

### Task 2: Python HTTP routes

**Files:**
- Modify: `py/prompt_booster_pro.py:326-357` (existing `register_api_routes` function)

**Interfaces:**
- Consumes: `_library` instance from Task 1
- Produces: Three HTTP routes registered on PromptServer

- [ ] **Step 1: Replace `register_api_routes` with expanded version**

```python
def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/prompt_booster_pro/data")
    async def get_booster_data(request):
        try:
            _load_all()
            return web.json_response(_data_payload())
        except Exception as e:
            _log(f"/prompt_booster_pro/data failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/booster_boss/save")
    async def save_booster_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            name = (body.get("name") or "").strip()
            text = (body.get("prompt") or "").strip()
            category = (body.get("category") or "").strip()

            if lib_type not in ("quality", "negatives"):
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            if not text:
                return web.json_response({"error": "Prompt required"}, status=400)

            _library.save_entry(lib_type, name, text, category)
            data = _library.load(lib_type)
            return web.json_response({
                "name": name,
                "category": category,
                "count": _library._count(lib_type, data),
            })
        except Exception as e:
            _log(f"/booster_boss/save failed: {e}")
            import traceback
            traceback.print_exc()
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/booster_boss/delete")
    async def delete_booster_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            name = (body.get("name") or "").strip()
            category = (body.get("category") or "").strip()

            if lib_type not in ("quality", "negatives"):
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)

            _library.delete_entry(lib_type, name, category)
            data = _library.load(lib_type)
            return web.json_response({
                "count": _library._count(lib_type, data),
            })
        except Exception as e:
            _log(f"/booster_boss/delete failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)

    @routes.post("/booster_boss/refresh")
    async def refresh_booster_data(request):
        try:
            _load_all(force=True)
            return web.json_response({
                "quality": len(_QUALITY.items),
                "negatives": len(_NEGATIVES.items),
                "negativeLevelsUnion": len(_NEGATIVES.levels),
            })
        except Exception as e:
            _log(f"/booster_boss/refresh failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)


register_api_routes()
```

- [ ] **Step 2: Verify syntax**

Run: `& "F:\ComfyUI\python_embeded\python.exe" -m py_compile "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\prompt_booster_pro.py"`
Expected: No output (clean compile)

---

### Task 3: JS import CRUD components

**Files:**
- Modify: `js/prompt_booster_pro/index.js:12-13` (import section)

**Interfaces:**
- Consumes: `CollectionController`, `CollectionEditorDialog`, `CollectionCRUDWidget` from boss_theme
- Produces: Available imports for Tasks 4-9

- [x] **Step 1: Update import statement**

Change line 13 from:
```javascript
import { BossDropdown } from "../boss_theme/index.js";
```
To:
```javascript
import { BossDropdown, CollectionController, CollectionEditorDialog, CollectionCRUDWidget } from "../boss_theme/index.js";
```

- [x] **Step 2: Add controller constant after imports**

Add after the import block (before constants):
```javascript
const CRUD_CONTROLLER = new CollectionController("/booster_boss");
```

---

### Task 4: JS rebuild editor modal with two-panel layout

**Files:**
- Modify: `js/prompt_booster_pro/index.js:443-564` (BoosterEditor.buildModal method)

**Interfaces:**
- Consumes: `CollectionCRUDWidget` from Task 3, existing state/library
- Produces: Two-panel modal (CRUD list left, controls right)

- [ ] **Step 1: Replace `buildModal` method**

```javascript
buildModal() {
  if (this.modal) {
    this.modal.remove();
    this.modal = null;
  }
  const modal = document.createElement("div");
  modal.className = "boss-modal";

  // Top bar
  const bar = document.createElement("div");
  bar.className = "boss-bar";
  bar.innerHTML = `<div class="boss-bar-title">Prompt Booster PRO Editor</div>`;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "boss-btn-close";
  closeBtn.textContent = "CLOSE";
  closeBtn.addEventListener("click", () => this.cancel());
  bar.appendChild(closeBtn);
  modal.appendChild(bar);

  // Body — two panels
  const body = document.createElement("div");
  body.className = "boss-body";
  body.style.display = "flex";
  body.style.gap = "12px";

  // Left: CRUD list
  const leftPanel = document.createElement("div");
  leftPanel.style.cssText = "flex: 0 0 280px; display: flex; flex-direction: column; gap: 8px; min-height: 0;";
  this._buildCRUDPanel(leftPanel);
  body.appendChild(leftPanel);

  // Right: controls + preview
  const rightPanel = document.createElement("div");
  rightPanel.style.cssText = "flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0;";
  this._buildControlsPanel(rightPanel);
  body.appendChild(rightPanel);

  modal.appendChild(body);

  // Footer
  const footer = document.createElement("div");
  footer.className = "boss-footer";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "boss-btn-primary";
  saveBtn.textContent = "Save to Node";
  saveBtn.addEventListener("click", () => this.save());
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "boss-btn-ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => this.cancel());
  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);
  modal.appendChild(footer);

  document.body.appendChild(modal);
  this.modal = modal;
}
```

- [ ] **Step 2: Add `_buildCRUDPanel` method**

```javascript
_buildCRUDPanel(container) {
  // Tab switcher for quality / negatives
  const tabs = document.createElement("div");
  tabs.style.cssText = "display: flex; gap: 4px;";
  const qTab = document.createElement("button");
  qTab.type = "button";
  qTab.className = "boss-btn-ghost";
  qTab.textContent = "Quality";
  qTab.style.flex = "1";
  const nTab = document.createElement("button");
  nTab.type = "button";
  nTab.className = "boss-btn-ghost";
  nTab.textContent = "Negatives";
  nTab.style.flex = "1";
  tabs.appendChild(qTab);
  tabs.appendChild(nTab);
  container.appendChild(tabs);

  // CRUD widget
  this._crudType = "quality";
  this._crudWidget = new CollectionCRUDWidget({
    title: "Quality Boosters",
    data: this._formatDataForCRUD("quality"),
    onAdd: () => this._onCRUDAdd(),
    onSelect: (slug) => this._onCRUDSelect(slug),
    onEdit: (slug) => this._onCRUDEdit(slug),
    onDelete: (slug) => this._onCRUDDelete(slug),
  });
  container.appendChild(this._crudWidget.render());

  // Tab click handlers
  qTab.addEventListener("click", () => {
    this._crudType = "quality";
    qTab.classList.add("boss-btn-primary");
    nTab.classList.remove("boss-btn-primary");
    nTab.classList.add("boss-btn-ghost");
    qTab.classList.remove("boss-btn-ghost");
    this._refreshCRUDList();
  });
  nTab.addEventListener("click", () => {
    this._crudType = "negatives";
    nTab.classList.add("boss-btn-primary");
    qTab.classList.remove("boss-btn-primary");
    qTab.classList.add("boss-btn-ghost");
    nTab.classList.remove("boss-btn-ghost");
    this._refreshCRUDList();
  });

  // Initial tab state
  qTab.classList.add("boss-btn-primary");
  qTab.classList.remove("boss-btn-ghost");
}
```

- [ ] **Step 3: Add `_buildControlsPanel` method**

```javascript
_buildControlsPanel(container) {
  // Positive section
  const posLabel = document.createElement("span");
  posLabel.className = "boss-label-accent";
  posLabel.textContent = "✨ Positive";
  container.appendChild(posLabel);

  container.appendChild(this.buildPositiveLevelSection());
  container.appendChild(this.buildStrengthSection("Positive Strength", "positiveStrength"));
  container.appendChild(this.buildFormatSection("Positive Weight Format", "positiveWeightFormat", this.library.positiveFormats, false));

  const posCustom = document.createElement("div");
  const posCustomLabel = document.createElement("span");
  posCustomLabel.className = "boss-label";
  posCustomLabel.textContent = "Custom Override";
  posCustom.appendChild(posCustomLabel);
  const posCustomTA = document.createElement("textarea");
  posCustomTA.className = "boss-textarea";
  posCustomTA.placeholder = "Override with your own positive prompt...";
  posCustomTA.value = this.state.positiveCustom || "";
  posCustomTA.rows = 3;
  posCustomTA.addEventListener("input", (e) => {
    this.state.positiveCustom = e.target.value;
    this.refreshPreview();
  });
  posCustom.appendChild(posCustomTA);
  container.appendChild(posCustom);

  // Divider
  const hr = document.createElement("hr");
  hr.className = "boss-boost-divider";
  container.appendChild(hr);

  // Negative section
  const negLabel = document.createElement("span");
  negLabel.className = "boss-label-accent";
  negLabel.textContent = "🛡️ Negative";
  container.appendChild(negLabel);

  container.appendChild(this.buildNegativePresetSection());
  container.appendChild(this.buildNegativeLevelSection());
  container.appendChild(this.buildStrengthSection("Negative Strength", "negativeStrength"));
  container.appendChild(this.buildFormatSection("Negative Weight Format", "negativeWeightFormat", this.library.weightFormats, false));

  const negCustom = document.createElement("div");
  const negCustomLabel = document.createElement("span");
  negCustomLabel.className = "boss-label";
  negCustomLabel.textContent = "Extra Negatives";
  negCustom.appendChild(negCustomLabel);
  const negCustomTA = document.createElement("textarea");
  negCustomTA.className = "boss-textarea";
  negCustomTA.placeholder = "Extra negatives appended after preset/level...";
  negCustomTA.value = this.state.negativeCustom || "";
  negCustomTA.rows = 3;
  negCustomTA.addEventListener("input", (e) => {
    this.state.negativeCustom = e.target.value;
    this.refreshPreview();
  });
  negCustom.appendChild(negCustomTA);
  container.appendChild(negCustom);

  // Preview
  const previewWrap = document.createElement("div");
  previewWrap.className = "boss-preview";
  const card = document.createElement("div");
  card.className = "boss-card";
  previewWrap.appendChild(card);
  container.appendChild(previewWrap);
  this.cardEl = card;
  this.refreshPreview();
}
```

---

### Task 5: JS CRUD helper methods

**Files:**
- Modify: `js/prompt_booster_pro/index.js` (add after `_buildControlsPanel`)

**Interfaces:**
- Consumes: `CRUD_CONTROLLER` from Task 3, `this.library`, `this.state`
- Produces: `_formatDataForCRUD`, `_refreshCRUDList`, `_onCRUDAdd`, `_onCRUDSelect`, `_onCRUDEdit`, `_onCRUDDelete`

- [ ] **Step 1: Add data formatting helper**

```javascript
_formatDataForCRUD(type) {
  const data = {};
  if (type === "quality") {
    for (const [name, text] of Object.entries(this.library.quality || {})) {
      data[name] = { name, prompt: text, description: "" };
    }
  } else {
    for (const [preset, levels] of Object.entries(this.library.negatives || {})) {
      for (const [level, text] of Object.entries(levels)) {
        data[level] = { name: level, prompt: text, description: preset };
      }
    }
  }
  return data;
}
```

- [ ] **Step 2: Add CRUD callback methods**

```javascript
_refreshCRUDList() {
  if (!this._crudWidget) return;
  this._crudWidget.data = this._formatDataForCRUD(this._crudType);
  this._crudWidget._renderList();
}

async _onCRUDAdd() {
  const existingSlugs = new Map(Object.entries(this._formatDataForCRUD(this._crudType)));
  const dialog = new CollectionEditorDialog({
    title: this._crudType === "quality" ? "Quality Booster" : "Negative Level",
    item: { name: "", prompt: "", description: "" },
    isEdit: false,
    existingSlugs,
    onSave: async (item) => {
      const category = this._crudType === "negatives" ? (item.description || "default") : "";
      const result = await CRUD_CONTROLLER.add(this._crudType, item, [category]);
      if (result.ok) {
        this.library = await this._fetchLibraryData();
        this._refreshCRUDList();
        this._refreshAffectedDropdowns();
        this._crudWidget.setSelected(item.name);
      }
      return result;
    },
  });
  await dialog.open();
}

_onCRUDSelect(slug) {
  // Load the selected booster's text into the appropriate field
  const data = this._formatDataForCRUD(this._crudType);
  const item = data[slug];
  if (!item) return;

  if (this._crudType === "quality") {
    this.state.positiveLevel = slug;
    this.state.positiveCustom = item.prompt;
  } else {
    // For negatives, set the preset from description
    if (item.description && this.library.negatives[item.description]) {
      this.state.negativePreset = item.description;
      this._refreshNegativeLevelOptions();
    }
    this.state.negativeLevel = slug;
    this.state.negativeCustom = item.prompt;
  }
  this.refreshPreview();
}

async _onCRUDEdit(slug) {
  const data = this._formatDataForCRUD(this._crudType);
  const item = data[slug];
  if (!item) return;

  const existingSlugs = new Map(Object.entries(data));
  const dialog = new CollectionEditorDialog({
    title: this._crudType === "quality" ? "Quality Booster" : "Negative Level",
    item: { ...item },
    isEdit: true,
    existingSlugs,
    onSave: async (updated) => {
      const category = this._crudType === "negatives" ? (updated.description || "default") : "";
      // Delete old if name changed
      if (updated.name !== slug) {
        await CRUD_CONTROLLER.delete(this._crudType, slug);
      }
      const result = await CRUD_CONTROLLER.add(this._crudType, updated, [category]);
      if (result.ok) {
        this.library = await this._fetchLibraryData();
        this._refreshCRUDList();
        this._refreshAffectedDropdowns();
        this._crudWidget.setSelected(updated.name);
      }
      return result;
    },
  });
  await dialog.open();
}

async _onCRUDDelete(slug) {
  if (!confirm(`Delete "${slug}"?\n\nThis action cannot be undone.`)) return;
  const category = this._crudType === "negatives" ? (this.library.negatives && Object.keys(this.library.negatives).find(k => this.library.negatives[k][slug])) : "";
  const result = await CRUD_CONTROLLER.delete(this._crudType, slug);
  if (result.ok) {
    this.library = await this._fetchLibraryData();
    this._refreshCRUDList();
    this._refreshAffectedDropdowns();
  }
}
```

- [ ] **Step 3: Add library data fetch helper**

```javascript
async _fetchLibraryData() {
  const r = await fetch("/prompt_booster_pro/data");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const weightFormats = data.weightFormats || [];
  const positiveFormats =
    Array.isArray(data.positiveFormats) && data.positiveFormats.length
      ? data.positiveFormats
      : [...weightFormats, { key: "break", label: "BREAK" }];
  return {
    quality: data.quality || {},
    negatives: data.negatives || {},
    qualityLevels: data.qualityLevels || [],
    negativePresets: data.negativePresets || [],
    negativeLevelsUnion: data.negativeLevelsUnion || [],
    positiveDefault: data.positiveDefault || { level: "" },
    negativeDefault: data.negativeDefault || { preset: "", level: "" },
    positiveFormats,
    weightFormats,
    weightFormatDefault: data.weightFormatDefault || "comfyui",
    strengthRange: data.strengthRange || { min: STRENGTH_MIN, max: STRENGTH_MAX, step: STRENGTH_STEP, default: STRENGTH_DEFAULT },
  };
}
```

- [ ] **Step 4: Add dropdown refresh helper**

```javascript
_refreshAffectedDropdowns() {
  // Refresh the on-node header
  renderHeader(this.node);

  // Rebuild the positive level dropdown if it exists
  if (this._posLevelDropdown) {
    const opts = this.library.qualityLevels.map((l) => ({ value: l, label: l }));
    this._posLevelDropdown.setOptions(opts);
    if (this.state.positiveLevel && !this.library.qualityLevels.includes(this.state.positiveLevel)) {
      this.state.positiveLevel = this.library.qualityLevels[0] || "";
      this._posLevelDropdown.setValue(this.state.positiveLevel);
    }
  }

  // Rebuild negative presets/levels if they exist
  if (this._negPresetDropdown) {
    const opts = this.library.negativePresets.map((p) => ({ value: p, label: p }));
    this._negPresetDropdown.setOptions(opts);
    if (this.state.negativePreset && !this.library.negativePresets.includes(this.state.negativePreset)) {
      this.state.negativePreset = this.library.negativePresets[0] || "";
      this._negPresetDropdown.setValue(this.state.negativePreset);
    }
  }
  this._refreshNegativeLevelOptions();
}
```

---

### Task 6: JS store dropdown references

**Files:**
- Modify: `js/prompt_booster_pro/index.js:567-586` (buildPositiveLevelSection)
- Modify: `js/prompt_booster_pro/index.js:589-609` (buildNegativePresetSection)

**Interfaces:**
- Consumes: existing dropdown builders
- Produces: `this._posLevelDropdown`, `this._negPresetDropdown` references

- [ ] **Step 1: Store reference in buildPositiveLevelSection**

Change line 584 from:
```javascript
wrap.appendChild(dropdown.element);
return wrap;
```
To:
```javascript
wrap.appendChild(dropdown.element);
this._posLevelDropdown = dropdown;
return wrap;
```

- [ ] **Step 2: Store reference in buildNegativePresetSection**

Already stored as `this._negPresetDropdown` at line 608. No change needed.

---

### Task 7: JS verify syntax

- [ ] **Step 1: Run syntax check**

No formal JS linter available. Verify manually:
1. Open browser DevTools console
2. Check for import errors
3. Check for syntax errors in console

---

### Task 8: Commit

- [ ] **Step 1: Stage and commit**

```bash
cd F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes
git add py/prompt_booster_pro.py js/prompt_booster_pro/index.js
git commit -m "feat: add CRUD support to Prompt Booster PRO editor

- Python: _BoosterLibrary class with save/delete/list + atomic writes
- Python: /booster_boss/save, /booster_boss/delete, /booster_boss/refresh routes
- JS: Two-panel editor layout (CRUD list + controls)
- JS: Import CollectionController/CollectionEditorDialog/CollectionCRUDWidget
- JS: Add/edit/delete/duplicate boosters from UI
- JS: Auto-select new items, preserve UI state after CRUD ops
- JS: Refresh only affected dropdowns"
```

---

## Verification

After implementation, test manually:

1. **Syntax check**: `& "F:\ComfyUI\python_embeded\python.exe" -m py_compile "F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\prompt_booster_pro.py"`
2. **Browser console**: No errors on page load
3. **Add quality booster**: Click + → fill name/prompt → Save → appears in list → selected → preview updates
4. **Edit booster**: Click edit icon → change prompt → Save → changes persist → UI state preserved
5. **Delete booster**: Click delete icon → confirm → removed from list → dropdown updates
6. **Duplicate**: Right-click → Duplicate → creates copy → rename dialog opens
7. **Tab switching**: Quality ↔ Negatives tabs work correctly
8. **State preservation**: After CRUD, search text, scroll, selection, slider values preserved
9. **Live preview**: Typing in name/prompt fields updates preview on keystroke

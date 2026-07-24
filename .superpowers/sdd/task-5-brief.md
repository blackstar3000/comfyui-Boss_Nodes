# Task 5: JS — CollectionModel + CollectionController

**Files:**
- Modify: `js/boss_theme/index.js` (add before closing `export`)

**Interfaces:**
- Consumes: nothing (new shared components)
- Produces: `CollectionModel`, `CollectionController` classes exported from boss_theme

**IMPORTANT**: Read the current state of `js/boss_theme/index.js` first to understand the current structure. Add the new classes before the closing `export { ... }` line.

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

# Task 6: JS — CollectionCRUDWidget

**Files:**
- Modify: `js/boss_theme/index.js` (add after CollectionController, add CSS to injectCSS, update export)

**Interfaces:**
- Consumes: CollectionModel, escapeHtml from Task 5
- Produces: `CollectionCRUDWidget` class exported from boss_theme

**IMPORTANT**: Read the current state of `js/boss_theme/index.js` first. Tasks 5 added CollectionModel and CollectionController. Add CollectionCRUDWidget after CollectionController.

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

// Boss Nodes — Shared Theme
// Loads theme.css and exports JS constants matching the CSS variables.
// This file MUST load before any other Boss Node extension.

import { app } from "/scripts/app.js";

// ── Inject theme.css ──────────────────────────────────────────────────────

async function loadThemeCSS() {
  if (document.getElementById("boss-theme-css")) return;
  try {
    const resp = await fetch(
      "/extensions/comfyui-Boss_Nodes/boss_theme/theme.css",
    );
    if (!resp.ok) return;
    const css = await resp.text();
    const style = document.createElement("style");
    style.id = "boss-theme-css";
    style.textContent = css;
    document.head.appendChild(style);
  } catch (e) {
    console.warn("[BossTheme] Failed to load theme.css:", e);
  }
}

loadThemeCSS();

// ── JS-side theme constants (mirror CSS variables) ────────────────────────

export const BOSS = {
  // Brand
  brand: "#8B5CF6",
  brandHover: "#7C3AED",
  brandGlow: "rgba(139, 92, 246, 0.3)",
  brandGlowStrong: "rgba(139, 92, 246, 0.45)",

  // Surfaces
  bgRoot: "rgba(22, 22, 24, 0.55)",
  bgModal: "rgba(0, 0, 0, 0.55)",
  bgBar: "rgba(23, 23, 24, 0.8)",
  bgSide: "rgba(23, 23, 24, 0.5)",
  bgPanel: "rgba(23, 23, 24, 0.9)",
  bgInput: "rgba(0, 0, 0, 0.3)",
  bgSection: "rgba(255, 255, 255, 0.04)",
  bgHover: "rgba(255, 255, 255, 0.05)",
  bgActive: "rgba(139, 92, 246, 0.15)",

  // Text
  text: "#eee",
  textBright: "#fff",
  textDim: "#999",
  textMuted: "#888",
  textFaint: "#666",

  // Borders
  border: "rgba(255, 255, 255, 0.06)",
  borderInput: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.12)",

  // Typography
  font: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  fontMono: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
};

// ── Shared utilities ────────────────────────────────────────────────────────

export function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── BossDropdown Component ──────────────────────────────────────────────────
// Replaces native <select> with glassmorphism-styled searchable dropdown.

export class BossDropdown {
  /**
   * @param {Object} config
   * @param {string} config.label - Label displayed in header
   * @param {Array<string|Object>} config.options - Option strings or {value, label, icon}
   * @param {string} config.value - Currently selected value
   * @param {string} config.placeholder - Placeholder when no selection
   * @param {boolean} config.searchable - Enable search input (default: true)
   * @param {Function} config.onChange - Callback when selection changes (value, option)
   * @param {Object} config.categoryMap - Optional { category: [value1, value2] } for category headers
   */
  constructor(config) {
    this.config = config;
    this.options = config.options || [];
    this.value = config.value || "";
    this.placeholder = config.placeholder || "Select…";
    this.searchable = config.searchable !== false;
    this.onChange = config.onChange || (() => {});
    this.categoryMap = config.categoryMap || {};
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.filteredIndices = [];
    this.searchTerm = "";
    this.element = null;
    this.menu = null;
    this.listEl = null;
    this.searchInput = null;
    this._create();
  }

  _create() {
    const container = document.createElement("div");
    container.className = "boss-dropdown";

    const header = document.createElement("div");
    header.className = "dropdown-header";
    const labelSpan = document.createElement("span");
    labelSpan.className = "dd-label";
    labelSpan.textContent = this.config.label || "";
    const valueSpan = document.createElement("span");
    valueSpan.className = "dd-value";
    valueSpan.textContent = this._getDisplayValue(this.value);
    const arrowSpan = document.createElement("span");
    arrowSpan.className = "dd-arrow";
    arrowSpan.textContent = "▼";
    header.appendChild(labelSpan);
    header.appendChild(valueSpan);
    header.appendChild(arrowSpan);
    container.appendChild(header);

    const menu = document.createElement("div");
    menu.className = "dropdown-menu";
    if (this.searchable) {
      const searchWrap = document.createElement("div");
      searchWrap.className = "dd-search";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Search…";
      input.autocomplete = "off";
      searchWrap.appendChild(input);
      menu.appendChild(searchWrap);
      this.searchInput = input;
    }
    const list = document.createElement("div");
    list.className = "dd-list";
    menu.appendChild(list);
    this.listEl = list;
    container.appendChild(menu);

    header.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this._onDocClick = (e) => {
      if (this.isOpen && !container.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener("click", this._onDocClick);

    container.addEventListener("keydown", (e) => {
      if (!this.isOpen) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.open();
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          this._highlightNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          this._highlightPrev();
          break;
        case "Enter":
          e.preventDefault();
          this._selectHighlighted();
          break;
        case "Escape":
          e.preventDefault();
          this.close();
          break;
        case "Tab":
          this.close();
          break;
        default:
          if (
            this.searchInput &&
            !e.ctrlKey &&
            !e.metaKey &&
            e.key.length === 1 &&
            e.target !== this.searchInput
          ) {
            this.searchInput.focus();
          }
          break;
      }
    });

    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.searchTerm = e.target.value;
        this._filterAndRender();
      });
      this.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.close();
          e.stopPropagation();
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this._highlightNext();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this._highlightPrev();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          this._selectHighlighted();
        }
      });
    }

    this.element = container;
    this.menu = menu;
    this.header = header;
    this.valueSpan = valueSpan;
    this.arrowSpan = arrowSpan;
    this._filterAndRender();
  }

  _getDisplayValue(value) {
    const opt = this.options.find((o) =>
      typeof o === "string" ? o === value : o.value === value,
    );
    if (opt) return typeof opt === "string" ? opt : opt.label || opt.value;
    return value || this.placeholder;
  }

  _filterAndRender() {
    const term = this.searchTerm.toLowerCase();
    const filtered = [];
    for (let i = 0; i < this.options.length; i++) {
      const opt = this.options[i];
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      if (label.toLowerCase().includes(term)) filtered.push(i);
    }
    this.filteredIndices = filtered;
    this._renderList();
    this.highlightedIndex = -1;
  }

  _renderList() {
    const list = this.listEl;
    list.innerHTML = "";
    if (this.filteredIndices.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dd-empty";
      empty.textContent = "No results found";
      list.appendChild(empty);
      return;
    }
    const categories = {};
    for (const idx of this.filteredIndices) {
      const opt = this.options[idx];
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      let cat = null;
      for (const [catName, catValues] of Object.entries(this.categoryMap)) {
        if (catValues.includes(label) || catValues.includes(opt.value)) {
          cat = catName;
          break;
        }
      }
      if (!cat) cat = "All";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(idx);
    }
    const catOrder = ["Favorites", "Recent", "All"];
    const otherCats = Object.keys(categories)
      .filter((c) => !catOrder.includes(c))
      .sort();
    const orderedCats = [
      ...catOrder.filter((c) => categories[c]),
      ...otherCats,
    ];
    for (const cat of orderedCats) {
      if (cat !== "All" || orderedCats.length > 1) {
        const catDiv = document.createElement("div");
        catDiv.className = "dd-category";
        catDiv.textContent = cat;
        list.appendChild(catDiv);
      }
      for (const idx of categories[cat]) {
        const opt = this.options[idx];
        const label = typeof opt === "string" ? opt : opt.label || opt.value;
        const value = typeof opt === "string" ? opt : opt.value;
        const icon = typeof opt === "object" && opt.icon ? opt.icon : null;
        const div = document.createElement("div");
        div.className = "dd-item" + (value === this.value ? " selected" : "");
        div.dataset.index = idx;
        div.dataset.value = value;
        if (icon) {
          const iconSpan = document.createElement("span");
          iconSpan.className = "dd-icon";
          iconSpan.textContent = icon;
          div.appendChild(iconSpan);
        }
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        div.appendChild(labelSpan);
        if (value === this.value) {
          const checkSpan = document.createElement("span");
          checkSpan.className = "dd-check";
          checkSpan.textContent = "✓";
          div.appendChild(checkSpan);
        }
        div.addEventListener("click", () => this._selectValue(value, opt));
        div.addEventListener("mouseenter", () => {
          this._clearHighlight();
          div.classList.add("highlighted");
        });
        div.addEventListener("mouseleave", () => {
          div.classList.remove("highlighted");
        });
        list.appendChild(div);
      }
    }
  }

  _clearHighlight() {
    this.listEl
      .querySelectorAll(".dd-item.highlighted")
      .forEach((el) => el.classList.remove("highlighted"));
  }

  _highlightNext() {
    const items = this.listEl.querySelectorAll(".dd-item");
    if (items.length === 0) return;
    let next = this.highlightedIndex + 1;
    if (next >= items.length) next = 0;
    this._clearHighlight();
    this.highlightedIndex = next;
    items[next].classList.add("highlighted");
    items[next].scrollIntoView({ block: "nearest" });
  }

  _highlightPrev() {
    const items = this.listEl.querySelectorAll(".dd-item");
    if (items.length === 0) return;
    let prev = this.highlightedIndex - 1;
    if (prev < 0) prev = items.length - 1;
    this._clearHighlight();
    this.highlightedIndex = prev;
    items[prev].classList.add("highlighted");
    items[prev].scrollIntoView({ block: "nearest" });
  }

  _selectHighlighted() {
    const items = this.listEl.querySelectorAll(".dd-item");
    if (this.highlightedIndex >= 0 && this.highlightedIndex < items.length) {
      const el = items[this.highlightedIndex];
      this._selectValue(el.dataset.value, this.options[parseInt(el.dataset.index)]);
    }
  }

  _selectValue(value, opt) {
    if (value === this.value) {
      this.close();
      return;
    }
    this.value = value;
    this.valueSpan.textContent = this._getDisplayValue(value);
    this.onChange(value, opt);
    this._filterAndRender();
    this.close();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.menu.classList.add("open");
    this.arrowSpan.classList.add("open");
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 50);
    }
    this._filterAndRender();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.menu.classList.remove("open");
    this.arrowSpan.classList.remove("open");
    if (this.searchInput) {
      this.searchInput.value = "";
      this.searchTerm = "";
    }
    this._clearHighlight();
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  setValue(value) {
    if (this.value !== value) {
      this.value = value;
      this.valueSpan.textContent = this._getDisplayValue(value);
      this._filterAndRender();
    }
  }

  setOptions(options) {
    this.options = options;
    this._filterAndRender();
  }

  destroy() {
    this.close();
    document.removeEventListener("click", this._onDocClick);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

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
    for (const [slug, entry] of existingSlugs) {
      if (slug === excludeSlug) continue;
      if (typeof entry === "object" && entry?.name?.toLowerCase() === nameLower) {
        return { ok: false, error: "Name already exists" };
      }
    }
    return { ok: true, error: "" };
  }
}

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

    const head = document.createElement("div");
    head.className = "boss-crd-head";
    head.innerHTML = `<span class="boss-crd-title">${escapeHtml(this.title)}</span>`;
    wrap.appendChild(head);

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

    const list = document.createElement("div");
    list.className = "boss-crd-list";
    wrap.appendChild(list);
    this.listEl = list;

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

      const star = document.createElement("span");
      star.className = "boss-crd-star" + (item.favorite ? " active" : "");
      star.textContent = item.favorite ? "★" : "☆";
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onToggleFavorite(slug);
      });
      row.appendChild(star);

      const name = document.createElement("span");
      name.className = "boss-crd-name";
      name.textContent = item.name || slug;
      row.appendChild(name);

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

      row.addEventListener("click", () => this.onSelect(slug));

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

    const body = document.createElement("div");
    body.className = "boss-body";
    body.style.padding = "16px";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "12px";

    const nameGroup = this._makeField("Name", "text", this.item.name, "e.g. Dutch Angle");
    this._nameInput = nameGroup.input;
    body.appendChild(nameGroup.wrap);

    const promptGroup = this._makeField("Prompt", "textarea", this.item.prompt, "Prompt text sent to the model…");
    this._promptInput = promptGroup.input;
    body.appendChild(promptGroup.wrap);

    const descGroup = this._makeField("Description (optional)", "textarea", this.item.description || "", "Notes about this entry…");
    this._descInput = descGroup.input;
    body.appendChild(descGroup.wrap);

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

    const errorEl = document.createElement("div");
    errorEl.style.color = "#e74c3c";
    errorEl.style.fontSize = "12px";
    errorEl.style.minHeight = "16px";
    body.appendChild(errorEl);
    this.errorEl = errorEl;

    modal.appendChild(body);

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

// ── Extension registration ────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.Theme",
  async setup() {
    // Theme CSS is loaded on import; nothing else needed here.
  },
});

export { CollectionModel, CollectionController, CollectionCRUDWidget, CollectionEditorDialog };

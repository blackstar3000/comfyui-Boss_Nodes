// Artist Selector Boss - compact canvas face + fullscreen editor.
//
// Python keeps the native widgets for workflow compatibility. This frontend
// hides them from the canvas and owns the visible editor state on
// node.properties.artistState, then injects that state into ArtistState when
// the graph is queued.

import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "artistState";
const HIDDEN_INPUT_NAME = "ArtistState";

const TABS = ["All", "Favorites", "Recent"];
const SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent"];
const OUTPUT_MODES = ["Prompt", "Names", "Both"];

const MAX_ARTISTS_DEFAULT = 3;
const MAX_ARTISTS_MIN = 1;
const MAX_ARTISTS_MAX = 100;

const VISIBLE_NATIVE_WIDGETS = [
  "selection",
  "max_artists",
  "randomize",
  "favorites_only",
  "output_mode",
  "sort_mode",
  "force_refresh",
];

function injectCSS() {
  if (document.getElementById("boss-artist-css")) return;
  const css = `
    .boss-art-root {
      box-sizing: border-box;
      width: 100%;
      padding: 10px;
      background: #131415;
      border-radius: 6px;
      color: #eee;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .boss-art-head {
      display: flex;
      flex-direction: column;
      gap: 3px;
      line-height: 1.45;
      min-height: 36px;
    }
    .boss-art-head .label { color: #999; }
    .boss-art-head .value { color: #fff; font-weight: 600; }
    .boss-art-head .value.none { color: #888; font-style: italic; }
    .boss-art-head .value.random { color: ${BRAND}; }
    .boss-art-open {
      background: ${BRAND};
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.05s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .boss-art-open:hover { background: #7C3AED; }
    .boss-art-open:active { transform: translateY(1px); }
    .boss-art-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-art-status.is-error { color: #ff8080; }

    .boss-art-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-art-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-art-bar-title {
      font-size: 14px; font-weight: 600; letter-spacing: 1px;
      text-transform: uppercase;
    }
    .boss-art-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-art-bar-x:hover { background: #3a3d40; }
    .boss-art-body { flex: 1; display: flex; overflow: hidden; min-height: 0; }
    .boss-art-side {
      width: 320px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 20px;
      display: flex; flex-direction: column; gap: 16px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-art-workspace { flex: 1; overflow: hidden; }
    .boss-art-list {
      height: 100%;
      overflow-y: auto;
      padding: 20px;
      box-sizing: border-box;
    }
    .boss-art-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-art-input, .boss-art-select {
      width: 100%;
      padding: 9px 12px;
      background: #131415;
      border: 1px solid #3a3d40;
      color: #fff;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    .boss-art-input:focus, .boss-art-select:focus { border-color: ${BRAND}; }
    .boss-art-row { display: flex; align-items: center; gap: 10px; }
    .boss-art-row .boss-art-input { flex: 1; }
    .boss-art-tabs, .boss-art-pill {
      display: flex;
      gap: 0;
      background: rgba(255,255,255,0.06);
      border-radius: 7px;
      padding: 3px;
    }
    .boss-art-tab, .boss-art-seg {
      flex: 1;
      text-align: center;
      padding: 7px 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit;
      font-size: 12px;
      color: rgba(255,255,255,0.58);
      cursor: pointer;
      user-select: none;
      outline: none;
    }
    .boss-art-tab:hover:not(.active), .boss-art-seg:hover:not(.active) {
      color: rgba(255,255,255,0.86);
    }
    .boss-art-tab.active, .boss-art-seg.active {
      background: ${BRAND};
      color: #fff;
      font-weight: 600;
    }
    .boss-art-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: #ddd;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-art-check input { width: 16px; height: 16px; accent-color: ${BRAND}; }
    .boss-art-count {
      color: #aaa;
      font-size: 12px;
      text-align: center;
      min-height: 16px;
    }
    .boss-art-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px;
      background: #242628;
      border: 1px solid #3a3d40;
      border-radius: 6px;
      font-size: 14px;
      margin-bottom: 6px;
      cursor: pointer;
    }
    .boss-art-item:hover { background: #2d2f32; border-color: #555; }
    .boss-art-item.selected {
      border-color: ${BRAND};
      background: rgba(139,92,246,0.10);
      box-shadow: inset 0 0 0 1px ${BRAND};
    }
    .boss-art-item .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .boss-art-fav {
      background: none;
      border: none;
      color: #555;
      cursor: pointer;
      font-size: 18px;
      padding: 0 6px;
      line-height: 1;
    }
    .boss-art-fav.active { color: ${BRAND}; }
    .boss-art-empty {
      color: #999;
      font-size: 13px;
      padding: 20px;
      text-align: center;
    }
    .boss-art-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-art-save {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 6px ${BRAND_GLOW};
    }
    .boss-art-save:hover { background: #7C3AED; }
    .boss-art-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-art-cancel:hover { background: #3a3d40; }
  `;
  const style = document.createElement("style");
  style.id = "boss-artist-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

function clampMaxArtists(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return MAX_ARTISTS_DEFAULT;
  return Math.max(MAX_ARTISTS_MIN, Math.min(MAX_ARTISTS_MAX, n));
}

function widgetValue(node, name, fallback) {
  const w = (node.widgets || []).find((x) => x.name === name);
  return w ? w.value : fallback;
}

function defaultStateFromWidgets(node) {
  const selection = String(widgetValue(node, "selection", "") || "");
  const selectedNames = selection
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const outputMode = widgetValue(node, "output_mode", "Prompt");
  const sortMode = widgetValue(node, "sort_mode", "A-Z");
  return {
    selectedNames,
    maxArtists: clampMaxArtists(widgetValue(node, "max_artists", MAX_ARTISTS_DEFAULT)),
    randomize: !!widgetValue(node, "randomize", false),
    favoritesOnly: !!widgetValue(node, "favorites_only", false),
    outputMode: OUTPUT_MODES.includes(outputMode) ? outputMode : "Prompt",
    sortMode: SORT_MODES.includes(sortMode) ? sortMode : "A-Z",
    forceRefresh: !!widgetValue(node, "force_refresh", false),
  };
}

function readState(node) {
  const base = defaultStateFromWidgets(node);
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") {
        const merged = { ...base, ...obj };
        merged.selectedNames = Array.isArray(obj.selectedNames)
          ? obj.selectedNames.filter((n) => typeof n === "string" && n.trim())
          : base.selectedNames;
        merged.maxArtists = clampMaxArtists(merged.maxArtists);
        merged.randomize = !!merged.randomize;
        merged.favoritesOnly = !!merged.favoritesOnly;
        if (!OUTPUT_MODES.includes(merged.outputMode)) merged.outputMode = base.outputMode;
        if (!SORT_MODES.includes(merged.sortMode)) merged.sortMode = base.sortMode;
        merged.forceRefresh = !!merged.forceRefresh;
        return merged;
      }
    } catch { /* fall through */ }
  }
  return base;
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify({
    selectedNames: state.selectedNames || [],
    maxArtists: clampMaxArtists(state.maxArtists),
    randomize: !!state.randomize,
    favoritesOnly: !!state.favoritesOnly,
    outputMode: OUTPUT_MODES.includes(state.outputMode) ? state.outputMode : "Prompt",
    sortMode: SORT_MODES.includes(state.sortMode) ? state.sortMode : "A-Z",
    forceRefresh: !!state.forceRefresh,
  });
}

function setWidgetValue(node, name, value) {
  const w = (node.widgets || []).find((x) => x.name === name);
  if (!w) return;
  if (w.value !== value) {
    w.value = value;
    if (typeof w.callback === "function") {
      try { w.callback(value); } catch { /* detached widget */ }
    }
  }
}

function syncNativeWidgets(node, state) {
  setWidgetValue(node, "selection", (state.selectedNames || []).join(", "));
  setWidgetValue(node, "max_artists", clampMaxArtists(state.maxArtists));
  setWidgetValue(node, "randomize", !!state.randomize);
  setWidgetValue(node, "favorites_only", !!state.favoritesOnly);
  setWidgetValue(node, "output_mode", OUTPUT_MODES.includes(state.outputMode) ? state.outputMode : "Prompt");
  setWidgetValue(node, "sort_mode", SORT_MODES.includes(state.sortMode) ? state.sortMode : "A-Z");
  setWidgetValue(node, "force_refresh", !!state.forceRefresh);
}

function hideCanvasWidget(widgets, name) {
  const w = (widgets || []).find((x) => x.name === name);
  if (!w) return;
  w.hidden = true;
  w.computeSize = () => [0, -4];
  if (!w.options) w.options = {};
  w.options.canvasOnly = true;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHeader(node) {
  const head = node._bossArtHead;
  if (!head) return;
  const state = readState(node);
  let mainText;
  let mainClass = "value";
  if (state.randomize) {
    const pool = state.favoritesOnly ? "favorites" : "all artists";
    mainText = `random ${state.maxArtists} from ${pool}`;
    mainClass = "value random";
  } else if (state.selectedNames.length) {
    const visible = state.selectedNames.slice(0, 3).join(", ");
    const extra = state.selectedNames.length > 3 ? ` +${state.selectedNames.length - 3}` : "";
    mainText = visible + extra;
  } else {
    mainText = "no artists selected";
    mainClass = "value none";
  }
  head.innerHTML =
    `<div><span class="label">Artists:</span> <span class="${mainClass}">${escapeHtml(mainText)}</span></div>` +
    `<div><span class="label">Output:</span> <span class="value">${escapeHtml(state.outputMode)}</span>` +
    ` <span class="label">Sort:</span> <span class="value">${escapeHtml(state.sortMode)}</span></div>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossArtRoot;
  if (!root) return;
  const s = root.querySelector(".boss-art-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

class ArtistEditor {
  constructor(node) {
    this.node = node;
    this.data = { library: {}, favorites: [], history: [] };
    this.state = readState(node);
    this.tab = "All";
    this.search = "";
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/wai_artist/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.data = await r.json();
  }

  async toggleFavorite(name) {
    const r = await fetch("/wai_artist/toggle_favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await this.fetchData();
  }

  open() {
    return this.fetchData().then(() => this.buildModal());
  }

  buildModal() {
    if (this.modal) { this.modal.remove(); this.modal = null; }
    const modal = document.createElement("div");
    modal.className = "boss-art-modal";

    const bar = document.createElement("div");
    bar.className = "boss-art-bar";
    bar.innerHTML = `<div class="boss-art-bar-title">Artist Selector Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-art-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-art-body";

    const side = document.createElement("div");
    side.className = "boss-art-side";
    side.appendChild(this.buildSearchSection());
    side.appendChild(this.buildTabsSection());
    side.appendChild(this.buildModeSection());
    side.appendChild(this.buildMaxSection());
    side.appendChild(this.buildSelectSection("Output", "outputMode", OUTPUT_MODES));
    side.appendChild(this.buildSelectSection("Sort", "sortMode", SORT_MODES));
    side.appendChild(this.buildForceRefreshSection());
    this.countEl = document.createElement("div");
    this.countEl.className = "boss-art-count";
    side.appendChild(this.countEl);

    const workspace = document.createElement("div");
    workspace.className = "boss-art-workspace";
    const list = document.createElement("div");
    list.className = "boss-art-list";
    workspace.appendChild(list);
    this.listEl = list;

    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-art-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-art-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-art-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshList();
    setTimeout(() => this.searchInput?.focus(), 0);
  }

  buildSearchSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-art-section-label";
    label.textContent = "Search";
    const input = document.createElement("input");
    input.className = "boss-art-input";
    input.type = "text";
    input.placeholder = "Type to filter...";
    input.value = this.search;
    input.addEventListener("input", (e) => {
      this.search = e.target.value;
      this.refreshList();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    this.searchInput = input;
    return wrap;
  }

  buildTabsSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-art-section-label";
    label.textContent = "Collection";
    const tabs = document.createElement("div");
    tabs.className = "boss-art-tabs";
    for (const name of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boss-art-tab" + (this.tab === name ? " active" : "");
      btn.textContent = name;
      btn.addEventListener("click", () => {
        this.tab = name;
        tabs.querySelectorAll(".boss-art-tab").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        this.refreshList();
      });
      tabs.appendChild(btn);
    }
    wrap.appendChild(label);
    wrap.appendChild(tabs);
    return wrap;
  }

  buildModeSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-art-section-label";
    label.textContent = "Mode";
    const pill = document.createElement("div");
    pill.className = "boss-art-pill";
    const sync = () => {
      pill.querySelectorAll(".boss-art-seg").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === (this.state.randomize ? "random" : "manual"));
      });
    };
    for (const [mode, text] of [["manual", "Manual"], ["random", "Random"]]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boss-art-seg";
      btn.dataset.mode = mode;
      btn.textContent = text;
      btn.addEventListener("click", () => {
        this.state.randomize = mode === "random";
        sync();
        this.refreshCount();
      });
      pill.appendChild(btn);
    }
    const favLabel = document.createElement("label");
    favLabel.className = "boss-art-check";
    const fav = document.createElement("input");
    fav.type = "checkbox";
    fav.checked = !!this.state.favoritesOnly;
    fav.addEventListener("change", (e) => {
      this.state.favoritesOnly = !!e.target.checked;
      this.refreshCount();
    });
    favLabel.appendChild(fav);
    favLabel.appendChild(document.createTextNode("Random from favorites only"));
    wrap.appendChild(label);
    wrap.appendChild(pill);
    wrap.appendChild(favLabel);
    sync();
    return wrap;
  }

  buildMaxSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-art-section-label";
    label.textContent = "Max artists";
    const row = document.createElement("div");
    row.className = "boss-art-row";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(MAX_ARTISTS_MIN);
    slider.max = String(MAX_ARTISTS_MAX);
    slider.step = "1";
    slider.value = String(this.state.maxArtists);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-art-input";
    num.min = String(MAX_ARTISTS_MIN);
    num.max = String(MAX_ARTISTS_MAX);
    num.step = "1";
    num.value = String(this.state.maxArtists);
    const apply = (v) => {
      this.state.maxArtists = clampMaxArtists(v);
      slider.value = String(this.state.maxArtists);
      num.value = String(this.state.maxArtists);
      this.refreshCount();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(label);
    wrap.appendChild(row);
    return wrap;
  }

  buildSelectSection(title, key, options) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-art-section-label";
    label.textContent = title;
    const select = document.createElement("select");
    select.className = "boss-art-select";
    for (const option of options) {
      const o = document.createElement("option");
      o.value = option;
      o.textContent = option;
      if (this.state[key] === option) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", (e) => {
      this.state[key] = e.target.value;
      if (key === "sortMode") this.refreshList();
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    return wrap;
  }

  buildForceRefreshSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.className = "boss-art-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!this.state.forceRefresh;
    input.addEventListener("change", (e) => {
      this.state.forceRefresh = !!e.target.checked;
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode("Force refresh library on run"));
    wrap.appendChild(label);
    return wrap;
  }

  filteredList() {
    const lib = this.data.library || {};
    let list;
    if (this.tab === "Favorites") {
      list = (this.data.favorites || []).filter((n) => n in lib);
    } else if (this.tab === "Recent") {
      list = (this.data.history || []).filter((n) => n in lib);
    } else {
      list = Object.keys(lib);
    }

    const favSet = new Set(this.data.favorites || []);
    const hist = this.data.history || [];
    if (this.state.sortMode === "A-Z") {
      list.sort((a, b) => a.localeCompare(b));
    } else if (this.state.sortMode === "Z-A") {
      list.sort((a, b) => b.localeCompare(a));
    } else if (this.state.sortMode === "Favorites") {
      list.sort((a, b) => (favSet.has(b) - favSet.has(a)) || a.localeCompare(b));
    } else if (this.state.sortMode === "Recent") {
      list.sort((a, b) => {
        const ai = hist.indexOf(a);
        const bi = hist.indexOf(b);
        const aKey = ai === -1 ? Number.POSITIVE_INFINITY : ai;
        const bKey = bi === -1 ? Number.POSITIVE_INFINITY : bi;
        return aKey - bKey || a.localeCompare(b);
      });
    }

    const search = this.search.trim().toLowerCase();
    if (search) list = list.filter((n) => n.toLowerCase().includes(search));
    return list;
  }

  refreshList() {
    if (!this.listEl) return;
    const selected = new Set(this.state.selectedNames || []);
    const favorites = new Set(this.data.favorites || []);
    const list = this.filteredList();
    this.listEl.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "boss-art-empty";
      empty.textContent = this.search ? `No artists match "${this.search}".` : "No artists in this collection.";
      this.listEl.appendChild(empty);
      this.refreshCount();
      return;
    }

    for (const name of list) {
      const item = document.createElement("div");
      item.className = "boss-art-item" + (selected.has(name) ? " selected" : "");
      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = name;
      nameEl.title = name;
      item.appendChild(nameEl);

      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "boss-art-fav" + (favorites.has(name) ? " active" : "");
      favBtn.textContent = "*";
      favBtn.title = favorites.has(name) ? "Remove from favorites" : "Add to favorites";
      favBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await this.toggleFavorite(name);
          this.refreshList();
        } catch (err) {
          console.error("[BossArtistSelector] favorite toggle failed", err);
        }
      });
      item.appendChild(favBtn);

      item.addEventListener("click", () => {
        const next = new Set(this.state.selectedNames || []);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        this.state.selectedNames = Array.from(next);
        this.refreshList();
      });
      this.listEl.appendChild(item);
    }
    this.refreshCount();
  }

  refreshCount() {
    if (!this.countEl) return;
    if (this.state.randomize) {
      const pool = this.state.favoritesOnly ? (this.data.favorites || []) : Object.keys(this.data.library || {});
      this.countEl.textContent = `Random pool: ${pool.length} artists`;
    } else {
      this.countEl.textContent = `Selected: ${(this.state.selectedNames || []).length} / ${this.state.maxArtists}`;
    }
  }

  save() {
    this.state.maxArtists = clampMaxArtists(this.state.maxArtists);
    writeState(this.node, this.state);
    syncNativeWidgets(this.node, this.state);
    renderHeader(this.node);
    this.node.setDirtyCanvas?.(true, true);
    this.close();
  }

  cancel() { this.close(); }

  close() {
    if (this.modal) { this.modal.remove(); this.modal = null; }
  }
}

function setupArtistNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-art-root";

  const head = document.createElement("div");
  head.className = "boss-art-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-art-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-art-status";
  root.appendChild(status);

  node.addDOMWidget("artist_ui", "boss_artist", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossArtRoot = root;
  node._bossArtHead = head;

  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library...");
      const editor = new ArtistEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossArtistSelector] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });

  renderHeader(node);
}

let _bossArtLoadingGraph = false;
if (app && app.loadGraphData && !app._bossArtLoadWrapped) {
  app._bossArtLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossArtLoadingGraph = true;
    let r;
    try { r = _origLoad(...args); }
    finally {
      Promise.resolve(r).finally(() => setTimeout(() => { _bossArtLoadingGraph = false; }, 300));
    }
    return r;
  };
}

app.registerExtension({
  name: "BossNodes.ArtistSelector",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "BossArtistSelector") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossArtHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "BossArtistSelector") return;
    setupArtistNode(node);
  },
});

function buildArtistNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === "BossArtistSelector" || n.type === "BossArtistSelector") {
        index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return index;
}

function findArtistNode(index, promptId) {
  const sId = String(promptId);
  if (index.has(sId)) return index.get(sId);
  const tail = sId.includes(":") ? sId.slice(sId.lastIndexOf(":") + 1) : null;
  if (tail && index.has(tail)) return index.get(tail);
  return null;
}

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  const result = await _origGraphToPrompt(...args);
  try {
    const out = result?.output;
    if (!out) return result;
    let index = null;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== "BossArtistSelector") continue;
      if (!index) index = buildArtistNodeIndex();
      const node = findArtistNode(index, id);
      const state = node ? readState(node) : {
        selectedNames: [],
        maxArtists: MAX_ARTISTS_DEFAULT,
        randomize: false,
        favoritesOnly: false,
        outputMode: "Prompt",
        sortMode: "A-Z",
        forceRefresh: false,
      };
      const injected = { ...state };
      if (injected.randomize) {
        injected.runNonce = `${Date.now()}-${Math.random()}`;
      }
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(injected);
    }
  } catch (e) {
    console.warn("[BossArtistSelector] graphToPrompt inject failed", e);
  }
  return result;
};

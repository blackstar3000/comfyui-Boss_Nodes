// ╔═══════════════════════════════════════════════════════════════════╗
// ║  Outfit Selector Boss — DOM widget + editor modal           ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/artist_selector/index.js + the Pixaroma
// "stateful UI" pattern (comfyui-pixaroma/js/seed/index.js):
//   - Python declares a single hidden OutfitState STRING input.
//   - JS owns outfit / category / strength / seed (+ seedMode) on
//     node.properties.outfitState — that JSON is what gets serialized.
//   - The graphToPrompt wrapper injects the resolved state at execution
//     time, including a fresh per-run seed for Random mode.
//   - All interactive UI (header, Open Editor button, fullscreen
//     editor modal with live preview) is a DOM widget via addDOMWidget.

import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

// ── Constants ──────────────────────────────────────────────────────────────

const STATE_PROP = "outfitState";
const HIDDEN_INPUT_NAME = "OutfitState";

const RANDOM_SENTINEL = "(Random)";
const NONE_SENTINEL = "(None)";
const ALL_CATEGORIES = "All";

const STRENGTH_MIN = 0.0;
const STRENGTH_MAX = 2.5;
const STRENGTH_DEFAULT = 1.35;
const STRENGTH_STEP = 0.05;

// ── CSS (injected once, idempotent) ────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-outfit-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Header value variants */
    .boss-widget-head .value.none { color: var(--boss-text-muted); font-style: italic; }
    .boss-widget-head .value.random { color: var(--boss-brand); }

    /* Preview centering override */
    .boss-side + .boss-preview {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Outfit list (search + scrollable entries) */
    .boss-out-outfits-wrap {
      display: flex; flex-direction: column; gap: 6px;
    }
    .boss-out-outfit-list {
      max-height: 220px;
      overflow-y: auto;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
    }
    .boss-out-outfit-item {
      padding: 7px 12px;
      font-size: 13px;
      color: var(--boss-text);
      cursor: pointer;
      border-bottom: 1px solid var(--boss-border);
      display: flex; align-items: center; gap: 8px;
    }
    .boss-out-outfit-item:last-child { border-bottom: none; }
    .boss-out-outfit-item:hover { background: var(--boss-bg-hover); }
    .boss-out-outfit-item.selected {
      background: var(--boss-bg-active);
      color: var(--boss-text-bright);
      box-shadow: inset 3px 0 0 var(--boss-brand);
    }
    .boss-out-outfit-item .badge {
      font-size: 10px; color: var(--boss-text-dim); padding: 2px 6px;
      background: var(--boss-border); border-radius: 3px;
      flex-shrink: 0;
    }
    .boss-out-outfit-item .name { flex: 1; }

    /* Strength slider + linked number */
    .boss-out-strength {
      display: flex; align-items: center; gap: 10px;
    }
    .boss-out-strength input[type=range] {
      flex: 1; accent-color: var(--boss-brand);
    }
    .boss-out-strength input[type=number] {
      width: 70px; flex-shrink: 0;
    }

    /* Seed pill + buttons */
    .boss-out-pill {
      display: flex; gap: 0;
      background: var(--boss-bg-hover);
      border-radius: var(--boss-radius-lg);
      padding: 3px;
    }
    .boss-out-seg {
      flex: 1;
      text-align: center;
      padding: 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit; font-size: var(--boss-font-size);
      color: var(--boss-text-muted);
      cursor: pointer; user-select: none;
      outline: none;
      transition: background var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-out-seg:hover:not(.active) { color: var(--boss-text); }
    .boss-out-seg.active { background: var(--boss-brand); color: #fff; font-weight: 500; }
    .boss-out-seg:focus-visible { outline: 2px solid var(--boss-brand); outline-offset: -2px; }

    .boss-out-btn {
      box-sizing: border-box;
      padding: 7px 10px;
      border-radius: var(--boss-radius-md);
      background: var(--boss-bg-hover);
      border: 1px solid var(--boss-border-strong);
      color: var(--boss-text);
      font-family: inherit; font-size: var(--boss-font-size);
      cursor: pointer; user-select: none;
      text-align: center;
      transition: background var(--boss-transition-fast), border-color var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-out-btn:hover { background: var(--boss-brand); border-color: var(--boss-brand); color: #fff; }
    .boss-out-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-out-btn:disabled:hover {
      background: var(--boss-bg-hover);
      border-color: var(--boss-border-strong);
      color: var(--boss-text);
    }
    .boss-out-btn.is-flashing,
    .boss-out-btn.is-flashing:hover {
      background: #3ec371; border-color: #3ec371; color: #fff;
    }
    .boss-out-seed-row { display: flex; gap: 6px; }
    .boss-out-seed-row .boss-out-btn { flex: 1; }
    .boss-out-seed-row .boss-out-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-out-seed-num {
      width: 100%; box-sizing: border-box;
      height: 36px;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
      padding: 6px 10px;
      color: var(--boss-text-bright);
      font-family: var(--boss-font-mono);
      font-size: 15px;
      text-align: center;
      outline: none;
    }
    .boss-out-seed-num:focus { border-color: var(--boss-brand); }
    .boss-out-seed-last {
      font-size: var(--boss-font-size-sm); line-height: 1.5;
      color: var(--boss-text-muted);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Card */
    .boss-out-card {
      padding: 24px;
      border-radius: 22px;
      background: linear-gradient(135deg, #1a0033, #001122);
      color: #fff;
      max-width: 720px;
      width: 100%;
      box-shadow: 0 0 40px rgba(255,255,255,0.05);
      transition: border-color var(--boss-transition), box-shadow var(--boss-transition);
    }
    .boss-out-card-title {
      text-align: center;
      font-size: 26px; font-weight: bold;
      color: #ffd700;
      text-shadow: 0 0 10px #ff6b6b;
    }
    .boss-out-card-name {
      text-align: center;
      font-size: 20px; margin-top: 8px;
      color: #ffd700; font-weight: bold;
    }
    .boss-out-card-name.none { color: var(--boss-text-muted); font-style: italic; }
    .boss-out-card-text {
      background: var(--boss-bg-code);
      padding: 18px;
      border-radius: 14px;
      font-family: var(--boss-font-mono);
      font-size: 14px; line-height: 1.6;
      border: 2px solid var(--boss-border-strong);
      word-wrap: break-word;
      white-space: pre-wrap;
      max-height: 360px;
      overflow-y: auto;
    }
    .boss-out-card-foot {
      margin-top: 16px;
      text-align: center;
      color: #00ffff;
      font-size: 14px;
    }
    .boss-out-card-empty {
      text-align: center;
      color: var(--boss-text-dim);
      font-size: 14px;
      padding: 40px;
    }

    /* Modal error banner */
    .boss-out-error {
      background: #5a1a1a;
      color: #ff9999;
      padding: 12px 16px;
      border-radius: var(--boss-radius-md);
      border-left: 4px solid #ff4444;
      margin-bottom: 12px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .boss-out-error .icon { font-size: 18px; }
  `;
  const style = document.createElement("style");
  style.id = "boss-outfit-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState() {
  return {
    outfit: RANDOM_SENTINEL,
    category: ALL_CATEGORIES,
    strength: STRENGTH_DEFAULT,
    seed: 0,
    seedMode: "random", // "random" | "fixed"
  };
}

function readState(node) {
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      // Merge so missing fields get sensible defaults (forward-compat with
      // older saved workflows that only had {outfit, category, ...}).
      const merged = { ...defaultState(), ...obj };
      // Sanitize strength / seed ranges defensively.
      merged.strength = clampStrength(merged.strength);
      merged.seed = clampSeed(merged.seed);
      if (merged.seedMode !== "random" && merged.seedMode !== "fixed") {
        merged.seedMode = "random";
      }
      return merged;
    } catch {
      /* fall through */
    }
  }
  return defaultState();
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify(state);
}

function clampStrength(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return STRENGTH_DEFAULT;
  return Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, n));
}

function clampSeed(s) {
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0) return 0;
  // Match Python's 2^64-1 bound. Math.pow(2,53)-1 is safe-int max, but the
  // slider is unbounded visually — just clamp to the safe-integer ceiling.
  if (n > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  return n;
}

function rollSeed() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

// Hide a widget so it doesn't render on the canvas. Used for both the
// hidden OutfitState JSON channel AND the visible native widgets (outfit /
// category / strength / seed / force_refresh) — those stay in INPUT_TYPES
// for the Python schema + workflow-compat, but the editor modal owns the
// visible UI, so we suppress them on the canvas with canvasOnly.
function hideCanvasWidget(widgets, name) {
  const w = (widgets || []).find((x) => x.name === name);
  if (!w) return;
  w.hidden = true;
  w.computeSize = () => [0, -4];
  if (!w.options) w.options = {};
  w.options.canvasOnly = true;
}

// Names of the visible native widgets. We keep them in INPUT_TYPES so the
// schema is correct and existing workflows wire through them, but we hide
// them on the canvas — the editor modal is the only UI surface.
const VISIBLE_NATIVE_WIDGETS = [
  "outfit",
  "category",
  "strength",
  "seed",
  "force_refresh",
];

// ── On-node body ───────────────────────────────────────────────────────────

function renderHeader(node) {
  const head = node._bossOutHead;
  if (!head) return;
  const state = readState(node);
  let label = "";
  let cls = "value";
  if (state.outfit === NONE_SENTINEL) {
    label = "(none)";
    cls = "value none";
  } else if (state.outfit === RANDOM_SENTINEL) {
    label = `(random — ${state.category})`;
    cls = "value random";
  } else {
    label = state.outfit;
  }
  head.innerHTML = `<span class="label">Outfit:</span> <span class="${cls}">${escapeHtml(label)}</span>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(node, text, isError = false) {
  const root = node._bossOutRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// Sync the native widget values from the JS state. The widgets stay on the
// node (for users who want the basic combo) but are styled canvasOnly so
// only our header line is visible.
function syncNativeWidgets(node, state) {
  const outfitW = (node.widgets || []).find((x) => x.name === "outfit");
  if (outfitW && outfitW.value !== state.outfit) {
    outfitW.value = state.outfit;
    if (typeof outfitW.callback === "function") {
      try {
        outfitW.callback(state.outfit);
      } catch {
        /* */
      }
    }
  }
  const catW = (node.widgets || []).find((x) => x.name === "category");
  if (catW && catW.value !== state.category) {
    catW.value = state.category;
    if (typeof catW.callback === "function") {
      try {
        catW.callback(state.category);
      } catch {
        /* */
      }
    }
  }
  const strW = (node.widgets || []).find((x) => x.name === "strength");
  if (strW) {
    const s = clampStrength(state.strength);
    if (strW.value !== s) {
      strW.value = s;
      if (typeof strW.callback === "function") {
        try {
          strW.callback(s);
        } catch {
          /* */
        }
      }
    }
  }
  const seedW = (node.widgets || []).find((x) => x.name === "seed");
  if (seedW) {
    const sd = clampSeed(state.seed);
    if (seedW.value !== sd) {
      seedW.value = sd;
      if (typeof seedW.callback === "function") {
        try {
          seedW.callback(sd);
        } catch {
          /* */
        }
      }
    }
  }
}

function setupOutfitNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  // Hide the visible native widgets — the editor modal owns the UI surface,
  // and the JS owns the source of truth on node.properties.outfitState.
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-widget";

  const head = document.createElement("div");
  head.className = "boss-widget-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-btn-open";
  openBtn.textContent = "✏️ Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
  root.appendChild(status);

  node.addDOMWidget("outfit_ui", "boss_outfit", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossOutRoot = root;
  node._bossOutHead = head;

  // Seed the (hidden) native widgets from the saved state on first paint so
  // Python reads the right values on the first Run, before the user has
  // opened the editor. After this, every Save() keeps them in lockstep.
  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library…");
      const editor = new OutfitEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossOutfitSelector] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });

  renderHeader(node);
}

// ── Live preview (mirrors the current node's _preview() output) ────────────

function buildPreviewHTML(state, library) {
  const name = state.outfit;
  let text = "";
  if (state.outfit === NONE_SENTINEL) {
    return `<div class="boss-out-card-name none">(none)</div>
            <div class="boss-out-card-text" style="color:#888;">(no outfit will be added)</div>
            <div class="boss-out-card-foot">Strength: ${state.strength.toFixed(2)} · Category: ${escapeHtml(state.category)}</div>`;
  }
  if (state.outfit === RANDOM_SENTINEL) {
    return `<div class="boss-out-card-name">(Random — pick will happen on Run)</div>
            <div class="boss-out-card-empty">Pick a specific outfit to preview the prompt fragment, or leave on Random to sample from <b>${escapeHtml(state.category)}</b> at execution time.</div>
            <div class="boss-out-card-foot">Strength: ${state.strength.toFixed(2)} · Category: ${escapeHtml(state.category)}</div>`;
  }
  text = library[name] || "";
  if (!text) {
    return `<div class="boss-out-card-name">Missing: ${escapeHtml(name)}</div>
            <div class="boss-out-card-empty">This outfit is not in the current library.</div>
            <div class="boss-out-card-foot">Strength: ${state.strength.toFixed(2)} · Category: ${escapeHtml(state.category)}</div>`;
  }
  // Weighted prompt fragment (matches Python's dress() output exactly).
  const s = state.strength;
  let prompt;
  if (s <= 0.01) {
    prompt = "(strength 0 — outfit omitted)";
  } else if (Math.abs(s - 1.0) > 0.01) {
    prompt = `(${text}:${s.toFixed(2)})`;
  } else {
    prompt = text;
  }

  // Color based on strength (same rule as the original _preview).
  let color, glow;
  if (s >= 1.3) {
    color = "#ffd700";
    glow = "0 0 40px rgba(255,215,0,0.4)";
  } else if (s >= 1.0) {
    color = "#00ff00";
    glow = "0 0 40px rgba(0,255,0,0.3)";
  } else {
    color = "#ff5555";
    glow = "0 0 40px rgba(255,85,85,0.3)";
  }

  // We can't easily restyle the wrapper from JS-injected HTML inside a
  // shadow-free DOM, so we return HTML for the contents and let CSS handle
  // the wrapper border. We DO override the wrapper border-color via a
  // data attribute that the modal's CSS reads.
  return {
    html: `
      <div class="boss-out-card-title">OUTFIT SELECTOR BOSS</div>
      <div class="boss-out-card-name">${escapeHtml(name)}</div>
      <div class="boss-out-card-text">→ ${escapeHtml(prompt)}</div>
      <div class="boss-out-card-foot">Strength: ${s.toFixed(2)} × Category: ${escapeHtml(state.category)}</div>
    `,
    borderColor: color,
    glow,
  };
}

// ── Debounce helper ─────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── OutfitEditor ────────────────────────────────────────────────────────────

class OutfitEditor {
  constructor(node) {
    this.node = node;
    this.library = {};
    this.categories = {};
    this.state = readState(node);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
    this.loadError = false;
    this._previewDirty = true;
  }

  async fetchData() {
    const r = await fetch("/outfit_boss/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.library = data.outfits || {};
    this.categories = data.categories || {};
    this.loadError = false;
  }

  // ── Modal scaffolding ──────────────────────────────────────────────────
  async open() {
    try {
      await this.fetchData();
    } catch (err) {
      console.error("[OutfitEditor] fetch failed", err);
      this.loadError = true;
      this.library = {};
      this.categories = {};
    }
    this.buildModal();
  }

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
    bar.innerHTML = `<div class="boss-bar-title">Outfit Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-btn-close";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body: left controls + right preview
    const body = document.createElement("div");
    body.className = "boss-body";
    const side = document.createElement("div");
    side.className = "boss-side";
    body.appendChild(side);

    // ── Error banner (if load failed) ──
    if (this.loadError) {
      const errDiv = document.createElement("div");
      errDiv.className = "boss-out-error";
      errDiv.innerHTML = `<span class="icon">⚠️</span> Failed to load outfit library. Check console and ensure the server is running.`;
      side.appendChild(errDiv);
    }

    // Outfit section: search + scrollable list
    const outfitSec = this.buildOutfitSection();
    side.appendChild(outfitSec);

    // Category section
    const catSec = this.buildCategorySection();
    side.appendChild(catSec);

    // Strength section
    const strSec = this.buildStrengthSection();
    side.appendChild(strSec);

    // Seed section
    const seedSec = this.buildSeedSection();
    side.appendChild(seedSec);

    // Preview panel
    const previewWrap = document.createElement("div");
    previewWrap.className = "boss-preview";
    const card = document.createElement("div");
    card.className = "boss-out-card";
    card.id = "boss-out-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
    modal.appendChild(body);

    // Footer: Save + Cancel pinned bottom-left
    const footer = document.createElement("div");
    footer.className = "boss-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-btn-primary";
    saveBtn.textContent = "Save";
    saveBtn.disabled = this.loadError;
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
    this.cardEl = card;

    this.refreshOutfitList();
    this.refreshPreview();
  }

  // ── Outfit section ─────────────────────────────────────────────────────
  buildOutfitSection() {
    const wrap = document.createElement("div");
    wrap.className = "boss-out-outfits-wrap";

    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Outfit";
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-input";
    search.placeholder = "Search outfits…";
    wrap.appendChild(search);

    const list = document.createElement("div");
    list.className = "boss-out-outfit-list";
    wrap.appendChild(list);

    // Apply debounce to search input
    const debouncedRefresh = debounce(() => this.refreshOutfitList(), 200);
    search.addEventListener("input", (e) => {
      this._outfitSearch = e.target.value;
      debouncedRefresh();
    });

    this._outfitSearch = "";
    this._outfitListEl = list;
    return wrap;
  }

  refreshOutfitList() {
    const el = this._outfitListEl;
    if (!el) return;
    el.innerHTML = "";
    const search = (this._outfitSearch || "").toLowerCase();

    const items = [
      { name: RANDOM_SENTINEL, badge: "Random" },
      { name: NONE_SENTINEL, badge: "None" },
    ];

    // Filter the library by category if one is selected.
    let names;
    if (this.state.category === ALL_CATEGORIES || !this.state.category) {
      names = Object.keys(this.library).sort();
    } else {
      const catItems = (this.categories[this.state.category] || []).filter(
        (n) => n in this.library,
      );
      names = catItems.sort();
    }
    for (const n of names) {
      if (search && !n.toLowerCase().includes(search)) continue;
      items.push({ name: n, badge: "" });
    }

    for (const it of items) {
      const row = document.createElement("div");
      row.className =
        "boss-out-outfit-item" +
        (this.state.outfit === it.name ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = it.name;
      row.appendChild(name);
      if (it.badge) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = it.badge;
        row.appendChild(badge);
      }
      row.addEventListener("click", () => {
        this.state.outfit = it.name;
        this.refreshOutfitList();
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-out-outfit-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = "No outfits match.";
      el.appendChild(empty);
    }
  }

  // ── Category section ───────────────────────────────────────────────────
  buildCategorySection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Category";
    wrap.appendChild(lbl);

    const opts = [ALL_CATEGORIES, ...Object.keys(this.categories).sort()];
    const dropdown = new BossDropdown({
      label: "",
      options: opts.map((c) => ({ value: c, label: c })),
      value: this.state.category,
      searchable: opts.length > 8,
      onChange: (value) => {
        this.state.category = value;
        this.refreshOutfitList();
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  // ── Strength section ───────────────────────────────────────────────────
  buildStrengthSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = `Strength: ${this.state.strength.toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-out-strength";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(STRENGTH_MIN);
    slider.max = String(STRENGTH_MAX);
    slider.step = String(STRENGTH_STEP);
    slider.value = String(this.state.strength);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-input";
    num.min = String(STRENGTH_MIN);
    num.max = String(STRENGTH_MAX);
    num.step = String(STRENGTH_STEP);
    num.value = this.state.strength.toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state.strength = clampStrength(v);
      lbl.textContent = `Strength: ${this.state.strength.toFixed(2)}`;
      slider.value = String(this.state.strength);
      num.value = this.state.strength.toFixed(2);
      this.refreshPreview();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    return wrap;
  }

  // ── Seed section (mirrors Pixaroma Seed) ───────────────────────────────
  buildSeedSection() {
    const wrap = document.createElement("div");

    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    // Big editable number field
    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-out-seed-num";
    num.value = String(this.state.seed);
    num.spellcheck = false;
    num.autocomplete = "off";
    num.inputMode = "numeric";
    const commit = () => {
      const cleaned = num.value.replace(/[^\d]/g, "");
      const v = cleaned === "" ? this.state.seed : clampSeed(cleaned);
      num.value = String(v);
      this.state.seed = v;
      this.state.seedMode = "fixed";
      syncPill();
      this.refreshLastRun();
    };
    num.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        num.blur();
      }
    });
    num.addEventListener("blur", commit);
    wrap.appendChild(num);

    // Random / Fixed pill
    const pill = document.createElement("div");
    pill.className = "boss-out-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-out-seg").forEach((s) => {
        s.classList.toggle("active", s.dataset.mode === this.state.seedMode);
      });
    };
    for (const [m, label] of [
      ["random", "Random"],
      ["fixed", "Fixed"],
    ]) {
      const seg = document.createElement("button");
      seg.type = "button";
      seg.className =
        "boss-out-seg" + (this.state.seedMode === m ? " active" : "");
      seg.textContent = label;
      seg.dataset.mode = m;
      seg.addEventListener("click", () => {
        if (this.state.seedMode === m) return;
        this.state.seedMode = m;
        syncPill();
        this.refreshLastRun();
      });
      pill.appendChild(seg);
    }
    wrap.appendChild(pill);

    // New fixed random
    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "boss-out-btn";
    newBtn.textContent = "New fixed random";
    newBtn.addEventListener("click", () => {
      this.state.seed = rollSeed();
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
    });
    wrap.appendChild(newBtn);

    // Use last seed + Copy row
    const row = document.createElement("div");
    row.className = "boss-out-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-out-btn";
    useLast.textContent = "Use last seed";
    useLast.disabled = this.lastSeed == null;
    useLast.addEventListener("click", () => {
      if (this.lastSeed == null) return;
      this.state.seed = clampSeed(this.lastSeed);
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "boss-out-btn is-copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = String(clampSeed(this.state.seed));
      const flash = (ok) => {
        copyBtn.classList.toggle("is-flashing", ok);
        copyBtn.textContent = ok ? "Copied" : "No clipboard";
        setTimeout(() => {
          copyBtn.classList.remove("is-flashing");
          copyBtn.textContent = "Copy";
        }, 700);
      };
      const legacy = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;";
        let ok = false;
        try {
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        } finally {
          ta.remove();
        }
        flash(ok);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => flash(true))
          .catch(legacy);
      } else {
        legacy();
      }
    });

    row.appendChild(useLast);
    row.appendChild(copyBtn);
    wrap.appendChild(row);

    // Last run line
    this._lastRunEl = document.createElement("div");
    this._lastRunEl.className = "boss-out-seed-last";
    wrap.appendChild(this._lastRunEl);
    this.refreshLastRun();
    syncPill();
    return wrap;
  }

  refreshLastRun() {
    if (!this._lastRunEl) return;
    if (this.state.seedMode === "fixed") {
      this._lastRunEl.textContent = "Fixed: same outfit every run";
    } else if (this.lastSeed != null) {
      this._lastRunEl.textContent = `Last run seed: ${this.lastSeed}`;
    } else {
      this._lastRunEl.textContent = "Last run: not run yet";
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────
  refreshPreview() {
    if (!this.cardEl) return;
    const result = buildPreviewHTML(this.state, this.library);
    if (typeof result === "string") {
      this.cardEl.innerHTML = result;
      this.cardEl.style.borderColor = "";
      this.cardEl.style.boxShadow = "";
    } else {
      this.cardEl.innerHTML = result.html;
      this.cardEl.style.border = `4px solid ${result.borderColor}`;
      this.cardEl.style.boxShadow = result.glow;
    }
  }

  // ── Commit / cancel ────────────────────────────────────────────────────
  save() {
    writeState(this.node, this.state);
    syncNativeWidgets(this.node, this.state);
    renderHeader(this.node);
    this.node.setDirtyCanvas?.(true, true);
    this.close();
  }

  cancel() {
    this.close();
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.OutfitSelector",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "BossOutfitSelector") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      // Resync state from properties after loading a workflow.
      if (this._bossOutHead) {
        const state = readState(this);
        syncNativeWidgets(this, state);
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "BossOutfitSelector") return;
    setupOutfitNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────
// Mirrors comfyui-pixaroma/js/seed/index.js:576-616 and the artist selector's
// graphToPrompt wrapper. We roll a fresh seed here in Random mode so Python
// only ever sees a committed seed value.

function buildOutfitNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "BossOutfitSelector" ||
        n.type === "BossOutfitSelector"
      ) {
        index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return index;
}

function findOutfitNode(index, promptId) {
  const sId = String(promptId);
  if (index.has(sId)) return index.get(sId);
  const tail = sId.includes(":") ? sId.slice(sId.lastIndexOf(":") + 1) : null;
  if (tail && index.has(tail)) return index.get(tail);
  return null;
}

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  // Sync native widgets BEFORE serialization, so the prompt JSON captures
  // the current editor state (outfit, category, strength, seed).
  try {
    const syncIndex = buildOutfitNodeIndex();
    for (const [, syncNode] of syncIndex) {
      syncNativeWidgets(syncNode, readState(syncNode));
    }
  } catch (_) { /* ignore sync errors */ }

  const result = await _origGraphToPrompt(...args);
  try {
    const out = result?.output;
    if (!out) return result;
    const index = buildOutfitNodeIndex();
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== "BossOutfitSelector") continue;
      const node = findOutfitNode(index, id);
      const state = node ? readState(node) : defaultState();
      // Resolve the per-run seed BEFORE we hand the state to Python.
      let runSeed;
      if (state.seedMode === "random") {
        runSeed = rollSeed();
        if (node) {
          node._pixBossLastSeed = runSeed;
        }
      } else {
        runSeed = clampSeed(state.seed);
      }
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify({
        ...state,
        seed: runSeed,
      });
    }
  } catch (e) {
    console.warn("[BossOutfitSelector] graphToPrompt inject failed", e);
  }
  return result;
};

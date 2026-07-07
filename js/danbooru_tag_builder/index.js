// Danbooru Tag Builder Pro – BOSS EDITION v2.0
// Glassmorphism UI, searchable multi‑select, collapsible sections, full database.
// FIXED: accordion overlaps, smooth transitions, auto‑scroll, sticky favorites, responsive.
// NEW: BossDropdown component replaces all native <select> with glass‑styled, searchable dropdowns.

import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "tagState";
const HIDDEN_INPUT_NAME = "TagState";

// List of visible native widgets (we hide them and use DOM)
const VISIBLE_NATIVE_WIDGETS = [
  "characters",
  "quality_tags",
  "custom_tags",
  "use_wildcards",
  "wildcard_format",
  "randomize",
  "random_min",
  "random_max",
];

// ── CSS ──────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-danbooru-v2-css")) return;
  const css = `
    /* Glassmorphism root */
    .boss-db-root {
      box-sizing: border-box;
      width: 100%;
      padding: 12px;
      background: rgba(22, 22, 24, 0.55);
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      color: #eee;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    }
    .boss-db-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .boss-db-head .label { color: #999; }
    .boss-db-head .value { color: #fff; font-weight: 600; }
    .boss-db-open {
      background: ${BRAND};
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.05s, box-shadow 0.2s;
      box-shadow: 0 0 20px ${BRAND_GLOW};
    }
    .boss-db-open:hover { background: #7C3AED; box-shadow: 0 0 30px ${BRAND_GLOW}; }
    .boss-db-open:active { transform: scale(0.97); }
    .boss-db-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-db-status.is-error { color: #ff8080; }
    .boss-db-status.is-success { color: #4ade80; }

    /* Modal */
    .boss-db-modal {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-db-bar {
      height: 56px;
      background: rgba(23, 23, 24, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-db-bar-title {
      font-size: 14px; font-weight: 600; letter-spacing: 1px;
      text-transform: uppercase;
      color: #fff;
      text-shadow: 0 0 30px ${BRAND_GLOW};
    }
    .boss-db-bar-x {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.12);
      color: #eee;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .boss-db-bar-x:hover { background: rgba(255,255,255,0.08); }

    .boss-db-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }

    .boss-db-characters-label,
    .boss-db-quality-label,
    .boss-db-custom-label {
      color: ${BRAND};
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 8px;
      text-transform: uppercase;
      text-shadow: 0 0 12px ${BRAND_GLOW};
    }

    /* ── Sidebar ────────────────────────────────────────────────── */
    .boss-db-side {
      width: 440px;
      min-width: 300px;
      background: rgba(23, 23, 24, 0.5);
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(255,255,255,0.06);
      padding: 18px 18px 0 18px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow-y: auto;
      overflow-x: hidden;
      height: 100%;
      gap: 8px;
      position: relative;
    }
    .boss-db-side::-webkit-scrollbar { width: 4px; }
    .boss-db-side::-webkit-scrollbar-thumb { background: ${BRAND}; border-radius: 4px; }

    /* ── Responsive: stack sidebar below 1200px ────────────────── */
    @media (max-width: 1200px) {
      .boss-db-body {
        flex-direction: column;
      }
      .boss-db-side {
        width: 100%;
        max-height: 50vh;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        padding-bottom: 12px;
      }
      .boss-db-preview {
        height: auto;
        min-height: 300px;
      }
    }

    /* ── Accordion sections ────────────────────────────────────── */
    .boss-db-section {
      background: rgba(255,255,255,0.04);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
      overflow: visible;
      transition: border-color 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
    }
    .boss-db-section.active {
      border-color: ${BRAND};
      box-shadow: 0 0 20px ${BRAND_GLOW};
    }

    .boss-db-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      color: #ddd;
      font-size: 12px;
      letter-spacing: 0.5px;
      background: rgba(255,255,255,0.02);
      transition: background 0.1s, border-radius 0.2s;
      border-radius: 12px;
    }
    .boss-db-section-header:hover { background: rgba(255,255,255,0.05); }
    .boss-db-section-header .arrow {
      transition: transform 0.3s ease;
      font-size: 10px;
      display: inline-block;
    }
    .boss-db-section-header .arrow.collapsed { transform: rotate(-90deg); }

    .boss-db-section-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.35s ease, padding 0.35s ease, opacity 0.2s ease;
      opacity: 0;
      padding: 0 12px;
      background: rgba(255,255,255,0.02);
      border-radius: 0 0 12px 12px;
    }
    .boss-db-section-body.open {
      max-height: 1200px;
      opacity: 1;
      padding: 8px 12px 16px 12px;
      border-top: 1px solid rgba(255,255,255,0.04);
    }

    .boss-db-section-body > * {
      margin-bottom: 8px;
    }
    .boss-db-section-body > *:last-child {
      margin-bottom: 0;
    }

    /* ── Inside accordion: nested glass cards ─────────────────── */
    .boss-db-section-body .boss-db-section-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .boss-db-section-body .boss-db-search {
      width: 100%;
      padding: 6px 10px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      color: #fff;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    .boss-db-section-body .boss-db-search:focus {
      border-color: ${BRAND};
    }
    .boss-db-section-body .boss-db-multiselect {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 4px;
      max-height: 120px;
      overflow-y: auto;
      margin-top: 4px;
    }
    .boss-db-section-body .boss-db-multiselect .option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: #ccc;
      transition: background 0.1s;
    }
    .boss-db-section-body .boss-db-multiselect .option:hover { background: rgba(255,255,255,0.05); }
    .boss-db-section-body .boss-db-multiselect .option input { accent-color: ${BRAND}; }
    .boss-db-section-body .boss-db-multiselect .option .tag-name { flex: 1; }
    .boss-db-section-body .boss-db-multiselect .option .tag-count { color: #666; font-size: 10px; }
    .boss-db-section-body .boss-db-multiselect .option.selected { background: rgba(139,92,246,0.15); }

    /* ── Favorites (sticky) ─────────────────────────────────────── */
    .boss-db-favorites-wrapper {
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      background: rgba(23, 23, 24, 0.9);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 12px 0 8px 0;
      margin: 0 -18px;
      padding-left: 18px;
      padding-right: 18px;
      z-index: 5;
    }
    .boss-db-favorites-wrapper .boss-db-section-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .boss-db-fav-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 150px;
      overflow-y: auto;
    }
    .boss-db-fav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: rgba(255,255,255,0.04);
      border-radius: 6px;
      border-left: 3px solid ${BRAND};
      transition: background 0.1s;
    }
    .boss-db-fav-item:hover { background: rgba(255,255,255,0.07); }
    .boss-db-fav-item .name { flex: 1; font-weight: 600; font-size: 12px; }
    .boss-db-fav-item .meta { color: #888; font-size: 10px; }
    .boss-db-fav-item .actions { display: flex; gap: 4px; }

    /* ── Inputs in the main sidebar (not inside accordion) ────── */
    .boss-db-side .boss-db-input,
    .boss-db-side .boss-db-textarea {
      width: 100%;
      padding: 8px 10px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      color: #fff;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    .boss-db-side .boss-db-input:focus,
    .boss-db-side .boss-db-textarea:focus { border-color: ${BRAND}; }
    .boss-db-side .boss-db-textarea {
      resize: vertical;
      min-height: 50px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .boss-db-side .boss-db-check {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ddd;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-db-side .boss-db-check input { width: 16px; height: 16px; accent-color: ${BRAND}; }

    /* ── BossDropdown component ─────────────────────────────────── */
    .boss-dropdown {
      position: relative;
      width: 100%;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: inherit;
      box-sizing: border-box;
    }
    .boss-dropdown:focus-within {
      border-color: ${BRAND};
      box-shadow: 0 0 20px ${BRAND_GLOW};
    }
    .boss-dropdown .dropdown-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      cursor: pointer;
      user-select: none;
      color: #ddd;
      font-size: 12px;
      min-height: 32px;
      gap: 8px;
    }
    .boss-dropdown .dropdown-header .dd-label {
      color: #999;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .boss-dropdown .dropdown-header .dd-value {
      flex: 1;
      text-align: right;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .boss-dropdown .dropdown-header .dd-arrow {
      font-size: 10px;
      transition: transform 0.2s;
      color: #888;
    }
    .boss-dropdown .dropdown-header .dd-arrow.open {
      transform: rotate(180deg);
    }
    .boss-dropdown .dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: rgba(23, 23, 24, 0.95);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      max-height: 260px;
      overflow: hidden;
      display: none;
      flex-direction: column;
      z-index: 100;
      transition: opacity 0.15s ease, transform 0.15s ease;
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
      pointer-events: none;
    }
    .boss-dropdown .dropdown-menu.open {
      display: flex;
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .boss-dropdown .dropdown-menu .dd-search {
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .boss-dropdown .dropdown-menu .dd-search input {
      width: 100%;
      padding: 4px 8px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
    }
    .boss-dropdown .dropdown-menu .dd-search input:focus {
      border-color: ${BRAND};
    }
    .boss-dropdown .dropdown-menu .dd-list {
      overflow-y: auto;
      padding: 4px 0;
      flex: 1;
    }
    .boss-dropdown .dropdown-menu .dd-list::-webkit-scrollbar { width: 4px; }
    .boss-dropdown .dropdown-menu .dd-list::-webkit-scrollbar-thumb { background: ${BRAND}; border-radius: 4px; }
    .boss-dropdown .dropdown-menu .dd-item {
      padding: 6px 12px;
      cursor: pointer;
      color: #ddd;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.08s, color 0.08s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .boss-dropdown .dropdown-menu .dd-item:hover {
      background: rgba(255,255,255,0.05);
    }
    .boss-dropdown .dropdown-menu .dd-item.highlighted {
      background: rgba(139,92,246,0.2);
      color: #fff;
    }
    .boss-dropdown .dropdown-menu .dd-item.selected {
      background: rgba(139,92,246,0.15);
      color: #fff;
      font-weight: 600;
    }
    .boss-dropdown .dropdown-menu .dd-item .dd-icon {
      font-size: 14px;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }
    .boss-dropdown .dropdown-menu .dd-item .dd-check {
      margin-left: auto;
      color: ${BRAND};
      font-weight: 700;
    }
    .boss-dropdown .dropdown-menu .dd-category {
      padding: 6px 12px 2px 12px;
      font-size: 10px;
      text-transform: uppercase;
      color: #888;
      letter-spacing: 0.5px;
      border-top: 1px solid rgba(255,255,255,0.05);
      margin-top: 2px;
    }
    .boss-dropdown .dropdown-menu .dd-category:first-of-type {
      border-top: none;
    }
    .boss-dropdown .dropdown-menu .dd-empty {
      padding: 12px;
      color: #888;
      font-style: italic;
      text-align: center;
      font-size: 12px;
    }

    /* ── Buttons ────────────────────────────────────────────────── */
    .boss-db-btn {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.1s, box-shadow 0.2s;
    }
    .boss-db-btn:hover { background: #7C3AED; box-shadow: 0 0 20px ${BRAND_GLOW}; }
    .boss-db-btn.danger { background: #e53e3e; }
    .boss-db-btn.danger:hover { background: #c53030; }

    /* ── Footer ────────────────────────────────────────────────── */
    .boss-db-footer {
      height: 56px;
      background: rgba(23, 23, 24, 0.5);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
      justify-content: flex-end;
    }
    .boss-db-save {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 9px 22px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 0 30px ${BRAND_GLOW};
      transition: background 0.1s;
    }
    .boss-db-save:hover { background: #7C3AED; }
    .boss-db-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid rgba(255,255,255,0.15);
      padding: 9px 22px;
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .boss-db-cancel:hover { background: rgba(255,255,255,0.05); }

    /* ── Preview ────────────────────────────────────────────────── */
    .boss-db-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .boss-db-card {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 18px;
      padding: 18px;
      color: #fff;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .boss-db-card-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 12px;
      color: ${BRAND};
    }
    .boss-db-prompt-box {
      background: rgba(0,0,0,0.4);
      padding: 12px;
      border-radius: 10px;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid rgba(255,255,255,0.04);
      max-height: 400px;
      overflow-y: auto;
    }
    .boss-db-empty {
      color: #999;
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-danbooru-v2-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── Helpers ──────────────────────────────────────────────────────────────

function widgetValue(node, name, fallback) {
  const w = (node.widgets || []).find((x) => x.name === name);
  return w ? w.value : fallback;
}

function defaultStateFromWidgets(node) {
  const state = {};
  const excludeNames = ["danbooru_ui", HIDDEN_INPUT_NAME];
  for (const w of node.widgets || []) {
    if (excludeNames.includes(w.name)) continue;
    state[w.name] = w.value;
  }
  state.characters = widgetValue(node, "characters", "1girl solo");
  state.quality_tags = widgetValue(
    node,
    "quality_tags",
    "masterpiece, best quality, ultra detailed, realistic, photorealistic, 8k",
  );
  state.custom_tags = widgetValue(node, "custom_tags", "");
  state.use_wildcards = !!widgetValue(node, "use_wildcards", false);
  state.wildcard_format = widgetValue(
    node,
    "wildcard_format",
    "__category_sub__",
  );
  state.randomize = !!widgetValue(node, "randomize", false);
  state.random_min = parseInt(widgetValue(node, "random_min", 1)) || 1;
  state.random_max = parseInt(widgetValue(node, "random_max", 3)) || 3;
  return state;
}

function readState(node) {
  const base = defaultStateFromWidgets(node);
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") {
        return { ...base, ...obj };
      }
    } catch {
      /* ignore */
    }
  }
  return base;
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify(state);
}

function setWidgetValue(node, name, value) {
  const w = (node.widgets || []).find((x) => x.name === name);
  if (!w) return;
  if (w.value !== value) {
    w.value = value;
    if (typeof w.callback === "function") {
      try {
        w.callback(value);
      } catch {
        /* */
      }
    }
  }
}

function syncNativeWidgets(node, state) {
  const excludeNames = ["danbooru_ui", HIDDEN_INPUT_NAME];
  for (const key in state) {
    if (excludeNames.includes(key)) continue;
    setWidgetValue(node, key, state[key]);
  }
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
  const head = node._bossDbHead;
  if (!head) return;
  const state = readState(node);
  const chars = state.characters || "none";
  head.innerHTML = `
    <span class="label">Characters:</span> <span class="value">${escapeHtml(chars)}</span>
    <span class="label">Random:</span> <span class="value">${state.randomize ? "🎲" : "✖"}</span>
    <span class="label">Wildcards:</span> <span class="value">${state.use_wildcards ? "✅" : "❌"}</span>
  `;
}

function setStatus(node, text, type = "") {
  const root = node._bossDbRoot;
  if (!root) return;
  const s = root.querySelector(".boss-db-status");
  if (!s) return;
  s.textContent = text || "";
  s.className = "boss-db-status";
  if (type) s.classList.add(type);
}

// ── BossDropdown Component ───────────────────────────────────────────────

class BossDropdown {
  /**
   * @param {Object} config
   * @param {string} config.label - Label displayed in header
   * @param {Array<string|Object>} config.options - Array of option strings or {value, label, icon}
   * @param {string} config.value - Currently selected value (string)
   * @param {string} config.placeholder - Placeholder when no selection
   * @param {boolean} config.searchable - Enable search input
   * @param {Function} config.onChange - Callback when selection changes (value, option)
   * @param {Object} config.categoryMap - Optional { category: [value1, value2] } to show category headers
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

    // Header
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

    // Menu
    const menu = document.createElement("div");
    menu.className = "dropdown-menu";
    // Search
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
    // List
    const list = document.createElement("div");
    list.className = "dd-list";
    menu.appendChild(list);
    this.listEl = list;
    container.appendChild(menu);

    // Event listeners
    header.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (this.isOpen && !container.contains(e.target)) {
        this.close();
      }
    });

    // Keyboard
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
          // If a printable character is typed and the target is NOT the search input,
          // focus the search input and let the key be inserted.
          if (
            this.searchInput &&
            !e.ctrlKey &&
            !e.metaKey &&
            e.key.length === 1 &&
            e.target !== this.searchInput
          ) {
            this.searchInput.focus();
            // Do NOT clear the value; the key will be inserted naturally.
          }
          break;
      }
    });

    // If searchable, wire search
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

    // Initial render
    this._filterAndRender();
  }

  _getDisplayValue(value) {
    const opt = this.options.find((o) =>
      typeof o === "string" ? o === value : o.value === value,
    );
    if (opt) {
      return typeof opt === "string" ? opt : opt.label || opt.value;
    }
    return value || this.placeholder;
  }

  _filterAndRender() {
    const term = this.searchTerm.toLowerCase();
    const filtered = [];
    for (let i = 0; i < this.options.length; i++) {
      const opt = this.options[i];
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      if (label.toLowerCase().includes(term)) {
        filtered.push(i);
      }
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

    // Build a map of index to category for grouping
    const categories = {};
    for (const idx of this.filteredIndices) {
      const opt = this.options[idx];
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      // Determine category from categoryMap (if any)
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

    // Render categories in order: favorites, recent, then rest (alphabetical)
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
        div.addEventListener("click", () => {
          this._selectValue(value, opt);
        });
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
      const value = el.dataset.value;
      const idx = parseInt(el.dataset.index);
      const opt = this.options[idx];
      this._selectValue(value, opt);
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
    this._filterAndRender(); // re-render to update selection highlight
    this.close();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.menu.classList.add("open");
    this.arrowSpan.classList.add("open");
    // Focus search if available
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 50);
    }
    // Re-filter in case options changed
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
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// ── Editor class ────────────────────────────────────────────────────────────

class DanbooruEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.modal = null;
    this.db = null;
    this.subSelections = {};
    this.favorites = [];
    this.sections = {};
    this.dropdowns = {}; // store references to dropdown instances
  }

  async fetchDatabase() {
    const r = await fetch("/danbooru_tags/database");
    if (!r.ok) throw new Error("Failed to fetch database");
    this.db = await r.json();
    for (const cat in this.db) {
      const subKey = `${cat}_sub`;
      const val = this.state[subKey] || "";
      this.subSelections[cat] = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  async fetchFavorites() {
    const r = await fetch("/danbooru_tags/favorites");
    if (!r.ok) return;
    const data = await r.json();
    this.favorites = Object.entries(data).map(([name, info]) => ({
      name,
      ...info,
    }));
  }

  async saveFavorite(name, notes = "") {
    const config = { ...this.state };
    for (const cat in this.db) {
      const subKey = `${cat}_sub`;
      config[subKey] = this.subSelections[cat]
        ? this.subSelections[cat].join(", ")
        : "";
    }
    const preview = this.buildPrompt(config, true);
    const r = await fetch("/danbooru_tags/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config, preview, notes }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || "Save failed");
    }
    await this.fetchFavorites();
  }

  async deleteFavorite(name) {
    const r = await fetch("/danbooru_tags/favorites/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error("Delete failed");
    await this.fetchFavorites();
  }

  buildPrompt(state, forPreview = false) {
    const parts = [state.characters || "1girl solo"];
    const allTags = [];
    for (const cat in this.db) {
      const mainKey = `${cat}_main`;
      const mainChoice = state[mainKey] || "";
      const subList = this.subSelections[cat] || [];
      const items = this.db[cat] || { main: {}, sub: {} };
      let catTags = [];
      if (mainChoice in items.main)
        catTags = catTags.concat(items.main[mainChoice]);
      for (const sub of subList) {
        if (sub in items.sub) catTags = catTags.concat(items.sub[sub]);
      }
      if (!catTags.length) continue;
      let selected = catTags;
      if (state.randomize && state.random_max > 0 && !forPreview) {
        const minRaw = parseInt(state.random_min);
        const maxRaw = parseInt(state.random_max);
        const a = Number.isNaN(minRaw) ? 1 : minRaw;
        const b = Number.isNaN(maxRaw) ? 3 : maxRaw;
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const rawCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const count = Math.min(rawCount, catTags.length);
        selected = count > 0 ? this.shuffle(catTags).slice(0, count) : [];
      }
      if (!selected.length) continue;
      if (state.use_wildcards) {
        const subStr = subList.length ? subList.join("_") : mainChoice;
        const fmt = state.wildcard_format || "__category_sub__";
        if (fmt === "__category_sub__") {
          parts.push(`__${cat}_${mainChoice}_${subStr}__`);
        } else if (fmt === "__category/main/sub__") {
          const subPath = subList.length ? subList.join("/") : mainChoice;
          parts.push(`__${cat}/${mainChoice}/${subPath}__`);
        } else {
          parts.push(`__${cat}_${mainChoice}_${subStr}`);
        }
      } else {
        allTags.push(...selected);
      }
    }
    if (allTags.length && !state.use_wildcards) {
      parts.push(allTags.join(", "));
    }
    let prompt = parts.join(", ");
    if (state.quality_tags) prompt += `, ${state.quality_tags}`;
    if (state.custom_tags) prompt += `, ${state.custom_tags}`;
    return prompt;
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── UI builders ──────────────────────────────────────────────────────

  buildSection(title, key, content) {
    const section = document.createElement("div");
    section.className = "boss-db-section";
    const header = document.createElement("div");
    header.className = "boss-db-section-header";
    const arrow = document.createElement("span");
    arrow.className = "arrow collapsed";
    arrow.textContent = "▼";
    header.appendChild(arrow);
    const label = document.createElement("span");
    label.textContent = title;
    header.appendChild(label);
    let collapsed = true;

    const body = document.createElement("div");
    body.className = "boss-db-section-body";
    body.appendChild(content);

    this.sections[key] = { section, header, body, collapsed };

    const toggle = () => {
      collapsed = !collapsed;
      arrow.classList.toggle("collapsed", collapsed);
      body.classList.toggle("open", !collapsed);
      section.classList.toggle("active", !collapsed);
      if (!collapsed) {
        setTimeout(() => {
          header.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
    };

    header.addEventListener("click", toggle);
    section.appendChild(header);
    section.appendChild(body);
    return section;
  }

  // ── Build Main Category Dropdown (BossDropdown) ──────────────────
  buildMainSelect(cat, items) {
    const wrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "boss-db-section-label";
    label.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    wrap.appendChild(label);

    const opts = Object.keys(items.main).map((key) => ({
      value: key,
      label: key,
    }));
    const current =
      this.state[`${cat}_main`] || (opts.length ? opts[0].value : "");

    const dd = new BossDropdown({
      label: "",
      options: opts,
      value: current,
      searchable: true,
      onChange: (val) => {
        this.state[`${cat}_main`] = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(dd.element);
    this.dropdowns[`${cat}_main`] = dd;
    return wrap;
  }

  // ── Sub‑tag multi‑select (unchanged) ──────────────────────────────
  buildSubMultiSelect(cat, items) {
    const wrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "boss-db-section-label";
    label.textContent = "Sub‑tags";
    wrap.appendChild(label);

    const search = document.createElement("input");
    search.className = "boss-db-search";
    search.placeholder = "Search...";
    wrap.appendChild(search);

    const listContainer = document.createElement("div");
    listContainer.className = "boss-db-multiselect";
    wrap.appendChild(listContainer);

    const subKeys = Object.keys(items.sub);
    const selectedSet = new Set(this.subSelections[cat] || []);
    const renderList = (filter = "") => {
      listContainer.innerHTML = "";
      const filtered = subKeys.filter((k) =>
        k.toLowerCase().includes(filter.toLowerCase()),
      );
      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "boss-db-empty";
        empty.textContent = "No matching tags";
        listContainer.appendChild(empty);
        return;
      }
      for (const key of filtered) {
        const div = document.createElement("div");
        div.className = "option" + (selectedSet.has(key) ? " selected" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = selectedSet.has(key);
        cb.addEventListener("change", (e) => {
          e.stopPropagation();
          if (cb.checked) selectedSet.add(key);
          else selectedSet.delete(key);
          this.subSelections[cat] = Array.from(selectedSet);
          this.state[`${cat}_sub`] = this.subSelections[cat].join(", ");
          div.classList.toggle("selected", cb.checked);
          this.refreshPreview();
        });
        const nameSpan = document.createElement("span");
        nameSpan.className = "tag-name";
        nameSpan.textContent = key;
        const countSpan = document.createElement("span");
        countSpan.className = "tag-count";
        const tagCount = (items.sub[key] || []).length;
        countSpan.textContent = `(${tagCount})`;
        div.appendChild(cb);
        div.appendChild(nameSpan);
        div.appendChild(countSpan);
        div.addEventListener("click", () => {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        });
        listContainer.appendChild(div);
      }
    };
    search.addEventListener("input", () => renderList(search.value));
    renderList("");
    return wrap;
  }

  buildCategorySection(cat, items) {
    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "6px";
    if (Object.keys(items.main).length) {
      content.appendChild(this.buildMainSelect(cat, items));
    }
    if (Object.keys(items.sub).length) {
      content.appendChild(this.buildSubMultiSelect(cat, items));
    }
    return this.buildSection(
      cat.charAt(0).toUpperCase() + cat.slice(1),
      cat,
      content,
    );
  }

  buildFavoritesSection() {
    const wrap = document.createElement("div");
    wrap.className = "boss-db-favorites-wrapper";

    const label = document.createElement("div");
    label.className = "boss-db-section-label";
    label.textContent = "Favorites";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";
    row.style.alignItems = "center";
    row.style.marginBottom = "6px";
    const nameInput = document.createElement("input");
    nameInput.className = "boss-db-input";
    nameInput.placeholder = "Favorite name";
    nameInput.style.flex = "1";
    const notesInput = document.createElement("input");
    notesInput.className = "boss-db-input";
    notesInput.placeholder = "Notes (optional)";
    notesInput.style.flex = "1";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-db-btn";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) return setStatus(this.node, "Enter a name", "is-error");
      try {
        await this.saveFavorite(name, notesInput.value.trim());
        setStatus(this.node, `Saved "${name}"`, "is-success");
        this.refreshFavoritesList();
      } catch (err) {
        setStatus(this.node, err.message, "is-error");
      }
    });
    row.appendChild(nameInput);
    row.appendChild(notesInput);
    row.appendChild(saveBtn);
    wrap.appendChild(row);

    const list = document.createElement("div");
    list.className = "boss-db-fav-list";
    wrap.appendChild(list);
    this.favListEl = list;
    this.refreshFavoritesList();
    return wrap;
  }

  refreshFavoritesList() {
    if (!this.favListEl) return;
    this.favListEl.innerHTML = "";
    if (!this.favorites || this.favorites.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-db-empty";
      empty.textContent = "No favorites saved.";
      this.favListEl.appendChild(empty);
      return;
    }
    for (const fav of this.favorites) {
      const item = document.createElement("div");
      item.className = "boss-db-fav-item";
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = fav.name;
      const metaSpan = document.createElement("span");
      metaSpan.className = "meta";
      const ts = fav.timestamp ? new Date(fav.timestamp).toLocaleString() : "";
      metaSpan.textContent = `${ts}${fav.notes ? " · " + fav.notes : ""}`;
      const actions = document.createElement("div");
      actions.className = "actions";
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "boss-db-btn";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        const config = fav.config || {};
        for (const key in config) {
          if (key.endsWith("_sub")) {
            const cat = key.replace("_sub", "");
            this.subSelections[cat] = config[key]
              ? config[key]
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
          }
          this.state[key] = config[key];
        }
        for (const cat in this.db) {
          const subKey = `${cat}_sub`;
          if (subKey in this.state) {
            this.subSelections[cat] = this.state[subKey]
              ? this.state[subKey]
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
          }
        }
        this.refreshPreview();
        this.rebuildModal();
        setStatus(this.node, `Loaded "${fav.name}"`, "is-success");
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "boss-db-btn danger";
      delBtn.textContent = "Del";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete "${fav.name}"?`)) return;
        try {
          await this.deleteFavorite(fav.name);
          this.refreshFavoritesList();
        } catch (err) {
          setStatus(this.node, err.message, "is-error");
        }
      });
      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      item.appendChild(nameSpan);
      item.appendChild(metaSpan);
      item.appendChild(actions);
      this.favListEl.appendChild(item);
    }
  }

  // ── Modal construction ─────────────────────────────────────────────

  open() {
    return this.fetchDatabase()
      .then(() => this.fetchFavorites())
      .then(() => this.buildModal());
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const modal = document.createElement("div");
    modal.className = "boss-db-modal";

    const bar = document.createElement("div");
    bar.className = "boss-db-bar";
    bar.innerHTML = `<div class="boss-db-bar-title">Danbooru Tag Builder Pro</div>`;
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "boss-db-bar-x";
    refreshBtn.textContent = "🔄 REFRESH TAGS";
    refreshBtn.title = "Rescan tag files on disk";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing…";
      try {
        const r = await fetch("/danbooru_tags/refresh", { method: "POST" });
        if (!r.ok) throw new Error("Refresh failed");
        this.db = await r.json();
        this.rebuildModal();
        setStatus(this.node, "Tags refreshed", "is-success");
      } catch (err) {
        setStatus(this.node, err.message, "is-error");
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "🔄 REFRESH TAGS";
      }
    });
    bar.appendChild(refreshBtn);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-db-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-db-body";

    const side = document.createElement("div");
    side.className = "boss-db-side";
    this.sideEl = side;

    // ── Characters (BossDropdown) ──────────────────────────────────
    const charWrap = document.createElement("div");
    const charLabel = document.createElement("div");
    charLabel.className = "boss-db-section-label boss-db-characters-label";
    charLabel.textContent = "Characters";
    charWrap.appendChild(charLabel);

    const charOptions = [
      "1girl",
      "2girls",
      "3girls",
      "4girls",
      "5girls",
      "6+girls",
      "1girl + solo",
      "1boy",
      "2boys",
      "3boys",
      "4boys",
      "5boys",
      "6+boys",
      "1boy + solo",
      "solo",
      "solo_focus",
      "multiple girls and boys",
    ];
    const charOpts = charOptions.map((v) => ({ value: v, label: v }));
    const charDD = new BossDropdown({
      label: "",
      options: charOpts,
      value: this.state.characters || "1girl",
      searchable: true,
      onChange: (val) => {
        this.state.characters = val;
        this.refreshPreview();
      },
    });
    charWrap.appendChild(charDD.element);
    this.dropdowns["characters"] = charDD;
    side.appendChild(charWrap);

    // ── Category sections (collapsible) ────────────────────────────
    for (const cat in this.db) {
      const items = this.db[cat];
      if (
        Object.keys(items.main).length === 0 &&
        Object.keys(items.sub).length === 0
      )
        continue;
      side.appendChild(this.buildCategorySection(cat, items));
    }

    // ── Quality and custom ──────────────────────────────────────────
    const qualityWrap = document.createElement("div");
    const qLabel = document.createElement("div");
    qLabel.className = "boss-db-section-label boss-db-quality-label";
    qLabel.textContent = "Quality Tags";
    qualityWrap.appendChild(qLabel);
    const qInput = document.createElement("input");
    qInput.className = "boss-db-input";
    qInput.value = this.state.quality_tags || "";
    qInput.addEventListener("input", () => {
      this.state.quality_tags = qInput.value;
      this.refreshPreview();
    });
    qualityWrap.appendChild(qInput);
    side.appendChild(qualityWrap);

    const customWrap = document.createElement("div");
    const cLabel = document.createElement("div");
    cLabel.className = "boss-db-section-label boss-db-custom-label";
    cLabel.textContent = "Custom Tags (optional)";
    customWrap.appendChild(cLabel);
    const cInput = document.createElement("textarea");
    cInput.className = "boss-db-textarea";
    cInput.value = this.state.custom_tags || "";
    cInput.addEventListener("input", () => {
      this.state.custom_tags = cInput.value;
      this.refreshPreview();
    });
    customWrap.appendChild(cInput);
    side.appendChild(customWrap);

    // ── Advanced toggles ────────────────────────────────────────────
    const advContent = document.createElement("div");
    advContent.style.display = "flex";
    advContent.style.flexDirection = "column";
    advContent.style.gap = "6px";

    const wcWrap = document.createElement("label");
    wcWrap.className = "boss-db-check";
    const wcCb = document.createElement("input");
    wcCb.type = "checkbox";
    wcCb.checked = !!this.state.use_wildcards;
    wcCb.addEventListener("change", () => {
      this.state.use_wildcards = !!wcCb.checked;
      this.refreshPreview();
    });
    wcWrap.appendChild(wcCb);
    wcWrap.appendChild(document.createTextNode("Use Wildcards"));
    advContent.appendChild(wcWrap);

    // Wildcard Format (BossDropdown)
    const fmtWrap = document.createElement("div");
    const fmtLabel = document.createElement("div");
    fmtLabel.className = "boss-db-section-label";
    fmtLabel.textContent = "Wildcard Format";
    fmtWrap.appendChild(fmtLabel);
    const fmtOptions = [
      "__category_sub__",
      "__category/main/sub__",
      "__category_sub",
    ];
    const fmtOpts = fmtOptions.map((v) => ({ value: v, label: v }));
    const fmtDD = new BossDropdown({
      label: "",
      options: fmtOpts,
      value: this.state.wildcard_format || "__category_sub__",
      searchable: true,
      onChange: (val) => {
        this.state.wildcard_format = val;
        this.refreshPreview();
      },
    });
    fmtWrap.appendChild(fmtDD.element);
    this.dropdowns["wildcard_format"] = fmtDD;
    advContent.appendChild(fmtWrap);

    const randWrap = document.createElement("label");
    randWrap.className = "boss-db-check";
    const randCb = document.createElement("input");
    randCb.type = "checkbox";
    randCb.checked = !!this.state.randomize;
    randCb.addEventListener("change", () => {
      this.state.randomize = !!randCb.checked;
      this.refreshPreview();
    });
    randWrap.appendChild(randCb);
    randWrap.appendChild(document.createTextNode("Randomize"));
    advContent.appendChild(randWrap);

    const minWrap = document.createElement("div");
    const minLabel = document.createElement("div");
    minLabel.className = "boss-db-section-label";
    minLabel.textContent = "Random Min";
    minWrap.appendChild(minLabel);
    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.className = "boss-db-input";
    minInput.min = 0;
    minInput.max = 10;
    minInput.value = this.state.random_min || 1;
    minInput.addEventListener("input", () => {
      this.state.random_min = parseInt(minInput.value) || 0;
      this.refreshPreview();
    });
    minWrap.appendChild(minInput);
    advContent.appendChild(minWrap);

    const maxWrap = document.createElement("div");
    const maxLabel = document.createElement("div");
    maxLabel.className = "boss-db-section-label";
    maxLabel.textContent = "Random Max";
    maxWrap.appendChild(maxLabel);
    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.className = "boss-db-input";
    maxInput.min = 1;
    maxInput.max = 20;
    maxInput.value = this.state.random_max || 3;
    maxInput.addEventListener("input", () => {
      this.state.random_max = parseInt(maxInput.value) || 1;
      this.refreshPreview();
    });
    maxWrap.appendChild(maxInput);
    advContent.appendChild(maxWrap);

    const advSection = this.buildSection("Advanced", "advanced", advContent);
    side.appendChild(advSection);

    // ── Favorites (sticky) ──────────────────────────────────────────
    const favSection = this.buildFavoritesSection();
    side.appendChild(favSection);

    // ── Preview ──────────────────────────────────────────────────────
    const workspace = document.createElement("div");
    workspace.className = "boss-db-preview";
    this.previewEl = document.createElement("div");
    workspace.appendChild(this.previewEl);
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-db-footer";
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "boss-db-save";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-db-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(applyBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshPreview();
  }

  rebuildModal() {
    this.close();
    this.buildModal();
  }

  refreshPreview() {
    if (!this.previewEl) return;
    const prompt = this.buildPrompt(this.state, true);
    const html = `
      <div class="boss-db-card">
        <div class="boss-db-card-title">📝 Prompt Preview</div>
        <div class="boss-db-prompt-box">${escapeHtml(prompt)}</div>
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button class="boss-db-btn" id="copy-prompt">📋 Copy</button>
          <button class="boss-db-btn" id="refresh-preview">🔄 Refresh (re‑random)</button>
        </div>
      </div>
    `;
    this.previewEl.innerHTML = html;
    const copyBtn = this.previewEl.querySelector("#copy-prompt");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard
          .writeText(prompt)
          .then(() => setStatus(this.node, "Copied!", "is-success"))
          .catch(() => setStatus(this.node, "Copy failed", "is-error"));
      });
    }
    const refreshBtn = this.previewEl.querySelector("#refresh-preview");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.refreshPreview());
    }
  }

  save() {
    for (const cat in this.db) {
      const subKey = `${cat}_sub`;
      this.state[subKey] = this.subSelections[cat]
        ? this.subSelections[cat].join(", ")
        : "";
    }
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

// ── Node setup ────────────────────────────────────────────────────────────

function setupDanbooruNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const w of node.widgets || []) {
    if (!VISIBLE_NATIVE_WIDGETS.includes(w.name)) {
      w.hidden = true;
      w.computeSize = () => [0, -4];
      if (!w.options) w.options = {};
      w.options.canvasOnly = true;
    }
  }

  const root = document.createElement("div");
  root.className = "boss-db-root";

  const head = document.createElement("div");
  head.className = "boss-db-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-db-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-db-status";
  root.appendChild(status);

  node.addDOMWidget("danbooru_ui", "boss_danbooru", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossDbRoot = root;
  node._bossDbHead = head;

  const state = readState(node);
  syncNativeWidgets(node, state);
  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading…");
      const editor = new DanbooruEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[Danbooru] open editor failed", err);
      setStatus(node, "Failed to load. Is backend running?", "is-error");
    }
  });
}

// ── Graph injection ──────────────────────────────────────────────────────

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  const result = await _origGraphToPrompt(...args);
  try {
    const out = result?.output;
    if (!out) return result;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== "DanbooruTagBuilder") continue;
      const node = app.graph._nodes.find((n) => String(n.id) === id);
      if (!node) continue;
      const state = readState(node);
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[Danbooru] graphToPrompt inject failed", e);
  }
  return result;
};

// ── Extension registration ──────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.DanbooruTagBuilder",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "DanbooruTagBuilder") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossDbHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "DanbooruTagBuilder") return;
    setupDanbooruNode(node);
  },
});

// ╔═══════════════════════════════════════════════════════════════╗
// ║  Prompt Master Library Pro Boss — DOM widget + editor modal   ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/camera_style_mixer/index.js (2 collections)
// + comfyui-Boss_Nodes/js/scene_maker_pro/index.js (3 collections) and the
// Pixaroma "stateful UI" pattern (comfyui-pixaroma/js/seed/index.js):
//   - Python declares a single hidden MasterState STRING input.
//   - JS owns light + theme + style (each with weight) + 4 weight formats
//     + newlines toggle + negative strength/text + seed(+seedMode) on
//     node.properties.masterState.
//   - The graphToPrompt wrapper injects the resolved state at execution
//     time, including a fresh per-run seed in Random mode.
//   - All interactive UI is a DOM widget via addDOMWidget.
//   - In-editor Favorites section with HTTP-backed save/load/delete.

import { app } from "/scripts/app.js";

// ── Brand + constants (mirror Python exactly) ──────────────────────────────
const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "masterState";
const HIDDEN_INPUT_NAME = "MasterState";

const RANDOM_LIGHT = "__RANDOM_LIGHT__";
const RANDOM_THEME = "__RANDOM_THEME__";
const RANDOM_STYLE = "__RANDOM_STYLE__";
const NONE_SENTINEL = "__NONE__";

const WEIGHT_FORMAT_KEYS = ["comfyui", "parentheses", "multiply", "none"];
const WEIGHT_FORMAT_LABELS = {
  comfyui: "(text:1.30) — ComfyUI / A1111 standard",
  parentheses: "((text))    — Stacked parentheses",
  multiply: "text * 1.30 — Multiply style",
  none: "none        — No weighting",
};
const WEIGHT_FORMAT_DEFAULT = "comfyui";

const STRENGTH_MIN = 0.0;
const STRENGTH_MAX = 2.0;
const STRENGTH_STEP = 0.05;
const STRENGTH_DEFAULT = 1.0;

const SEPARATOR_DEFAULT = ", ";
const NEWLINES_DEFAULT = false;

const NEGATIVE_STRENGTH_DEFAULT = 1.0;
const NEGATIVE_TEXT_DEFAULT = "";

const COLLECTION_ACCENTS = {
  light: { color: "#fbbf24", bg: "#332111", bgLight: "#1a1006" }, // amber
  theme: { color: "#60a5fa", bg: "#0b223d", bgLight: "#040d18" }, // blue
  style: { color: "#34d399", bg: "#0c3329", bgLight: "#031711" }, // green
};
const COLLECTION_LABELS = { light: "LIGHT", theme: "THEME", style: "STYLE" };
const NEGATIVE_ACCENT = { color: "#f87171", bg: "#3d0e0e", bgLight: "#1a0404" }; // red

// ── CSS (injected once, idempotent) ────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-master-css")) return;
  const css = `
    /* On-node body */
    .boss-ms-root {
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
    .boss-ms-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-ms-head .label { color: #999; }
    .boss-ms-head .value { color: #fff; font-weight: 600; }
    .boss-ms-head .value.none { color: #888; font-style: italic; }
    .boss-ms-head .value.random { color: ${BRAND}; }
    .boss-ms-head .sep { color: #555; margin: 0 6px; }
    .boss-ms-open {
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
    .boss-ms-open:hover { background: #7C3AED; }
    .boss-ms-open:active { transform: translateY(1px); }
    .boss-ms-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-ms-status.is-error { color: #ff8080; }

    /* Fullscreen editor modal */
    .boss-ms-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-ms-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-ms-bar-title { font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .boss-ms-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-ms-bar-x:hover { background: #3a3d40; }

    /* Body: left controls | right preview */
    .boss-ms-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }
    .boss-ms-side {
      width: 380px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-ms-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-ms-input {
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
    .boss-ms-input:focus { border-color: ${BRAND}; }

    .boss-ms-textarea {
      width: 100%;
      padding: 9px 12px;
      background: #131415;
      border: 1px solid #3a3d40;
      color: #fff;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      resize: vertical;
      min-height: 60px;
    }
    .boss-ms-textarea:focus { border-color: ${BRAND}; }

    .boss-ms-select {
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
    .boss-ms-select:focus { border-color: ${BRAND}; }

    /* Per-collection list (search + scrollable entries) */
    .boss-ms-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-ms-list {
      max-height: 150px;
      overflow-y: auto;
      background: #131415;
      border: 1px solid #3a3d40;
      border-radius: 6px;
    }
    .boss-ms-list-item {
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      border-bottom: 1px solid #232527;
      display: flex; align-items: center; gap: 8px;
    }
    .boss-ms-list-item:last-child { border-bottom: none; }
    .boss-ms-list-item:hover { background: #1c1e20; }
    .boss-ms-list-item.selected {
      background: rgba(139,92,246,0.18);
      color: #fff;
      box-shadow: inset 3px 0 0 ${BRAND};
    }
    .boss-ms-list-item .badge {
      font-size: 10px; color: #999; padding: 2px 6px;
      background: #232527; border-radius: 3px;
      flex-shrink: 0;
    }
    .boss-ms-list-item .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Strength slider + linked number */
    .boss-ms-strength { display: flex; align-items: center; gap: 10px; }
    .boss-ms-strength input[type=range] { flex: 1; accent-color: ${BRAND}; }
    .boss-ms-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Random/Fixed pill */
    .boss-ms-pill {
      display: flex; gap: 0;
      background: rgba(255,255,255,0.06);
      border-radius: 7px;
      padding: 3px;
    }
    .boss-ms-seg {
      flex: 1;
      text-align: center;
      padding: 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit; font-size: 12px;
      color: rgba(255,255,255,0.55);
      cursor: pointer; user-select: none; outline: none;
      transition: background 0.08s, color 0.08s;
    }
    .boss-ms-seg:hover:not(.active) { color: rgba(255,255,255,0.85); }
    .boss-ms-seg.active { background: ${BRAND}; color: #fff; font-weight: 500; }
    .boss-ms-seg:focus-visible { outline: 2px solid ${BRAND}; outline-offset: -2px; }

    .boss-ms-btn {
      box-sizing: border-box;
      padding: 7px 10px;
      border-radius: 6px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85);
      font-family: inherit; font-size: 12px;
      cursor: pointer; user-select: none;
      text-align: center;
      transition: background 0.08s, border-color 0.08s, color 0.08s;
    }
    .boss-ms-btn:hover { background: ${BRAND}; border-color: ${BRAND}; color: #fff; }
    .boss-ms-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-ms-btn:disabled:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85);
    }
    .boss-ms-btn.is-danger:hover {
      background: ${NEGATIVE_ACCENT.color}; border-color: ${NEGATIVE_ACCENT.color};
    }
    .boss-ms-btn.is-flashing,
    .boss-ms-btn.is-flashing:hover {
      background: #3ec371; border-color: #3ec371; color: #fff;
    }
    .boss-ms-seed-row { display: flex; gap: 6px; }
    .boss-ms-seed-row .boss-ms-btn { flex: 1; }
    .boss-ms-seed-row .boss-ms-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-ms-seed-num {
      width: 100%; box-sizing: border-box;
      height: 36px;
      background: #171819;
      border: 1px solid #3a3d40;
      border-radius: 6px;
      padding: 6px 10px;
      color: #f2f2f2;
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 15px;
      text-align: center;
      outline: none;
    }
    .boss-ms-seed-num:focus { border-color: ${BRAND}; }
    .boss-ms-seed-last {
      font-size: 11px; line-height: 1.5;
      color: rgba(255,255,255,0.55);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Inline favorite name row */
    .boss-ms-fav-row { display: flex; gap: 6px; align-items: center; }
    .boss-ms-fav-row .boss-ms-input { flex: 1; }

    /* Favorites list (vertical stack of saved combos) */
    .boss-ms-fav-list {
      max-height: 220px;
      overflow-y: auto;
      background: #131415;
      border: 1px solid #3a3d40;
      border-radius: 6px;
      display: flex; flex-direction: column;
    }
    .boss-ms-fav-item {
      padding: 10px 12px;
      border-bottom: 1px solid #232527;
      display: flex; flex-direction: column; gap: 6px;
    }
    .boss-ms-fav-item:last-child { border-bottom: none; }
    .boss-ms-fav-item-head {
      display: flex; align-items: center; gap: 8px;
    }
    .boss-ms-fav-item-name {
      flex: 1;
      font-weight: 600;
      font-size: 13px;
      color: ${BRAND};
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .boss-ms-fav-item-btns { display: flex; gap: 6px; flex-shrink: 0; }
    .boss-ms-fav-item-btns .boss-ms-btn { padding: 4px 10px; font-size: 11px; }
    .boss-ms-fav-summary {
      font-size: 11px;
      color: #aaa;
      line-height: 1.5;
      word-break: break-word;
    }
    .boss-ms-fav-summary .b { color: #888; }
    .boss-ms-fav-empty {
      padding: 18px;
      color: #777;
      text-align: center;
      font-size: 12px;
      font-style: italic;
    }

    /* Right preview panel — 4 cards */
    .boss-ms-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-ms-card {
      padding: 16px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid #444;
      font-family: system-ui, sans-serif;
      color: #fff;
      max-width: 800px;
      width: 100%;
    }
    .boss-ms-card-title {
      font-size: 1.4em;
      font-weight: bold;
      text-align: center;
      margin-bottom: 14px;
      letter-spacing: 1px;
      background: linear-gradient(#ffd700, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 0 30px rgba(255,215,0,0.3);
    }
    .boss-ms-cards {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .boss-ms-mini {
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid var(--accent);
      background: var(--bg);
    }
    .boss-ms-mini .h {
      color: var(--accent);
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .boss-ms-mini .v {
      font-weight: bold;
      font-size: 1em;
      margin: 4px 0;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .boss-ms-mini .w {
      color: #aaa;
      font-size: 0.8em;
    }
    .boss-ms-mini.none .v { color: #666; font-style: italic; }

    .boss-ms-negcard {
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid ${NEGATIVE_ACCENT.color};
      background: ${NEGATIVE_ACCENT.bg};
      margin-bottom: 12px;
    }
    .boss-ms-negcard .h {
      color: ${NEGATIVE_ACCENT.color};
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .boss-ms-negcard .v {
      font-size: 0.95em;
      word-break: break-word;
      overflow-wrap: anywhere;
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      color: #ffb3b3;
    }
    .boss-ms-negcard .w {
      color: #aaa;
      font-size: 0.8em;
      margin-top: 4px;
    }
    .boss-ms-meta {
      color: #888;
      font-size: 0.8em;
      margin-bottom: 8px;
      text-align: center;
    }
    .boss-ms-output {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 8px;
      font-family: "Courier New", ui-monospace, monospace;
      font-size: 0.95em;
      line-height: 1.6;
      word-break: break-all;
      border: 1px solid #333;
      white-space: pre-wrap;
      margin-top: 6px;
    }
    .boss-ms-output .arrow { color: ${BRAND}; font-weight: bold; }
    .boss-ms-output.empty { color: #666; font-style: italic; }

    /* Footer with Save/Cancel pinned bottom-left */
    .boss-ms-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-ms-save {
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
    .boss-ms-save:hover { background: #7C3AED; }
    .boss-ms-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-ms-cancel:hover { background: #3a3d40; }
  `;
  const style = document.createElement("style");
  style.id = "boss-master-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState() {
  return {
    light: RANDOM_LIGHT,
    lightStrength: STRENGTH_DEFAULT,
    theme: RANDOM_THEME,
    themeStrength: STRENGTH_DEFAULT,
    style: RANDOM_STYLE,
    styleStrength: STRENGTH_DEFAULT,
    weightFormat: WEIGHT_FORMAT_DEFAULT,
    separator: SEPARATOR_DEFAULT,
    newlines: NEWLINES_DEFAULT,
    negativeStrength: NEGATIVE_STRENGTH_DEFAULT,
    negativeText: NEGATIVE_TEXT_DEFAULT,
    seed: 0,
    seedMode: "random",
  };
}

function readState(node) {
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      const merged = { ...defaultState(), ...obj };
      merged.lightStrength = clampStrength(merged.lightStrength);
      merged.themeStrength = clampStrength(merged.themeStrength);
      merged.styleStrength = clampStrength(merged.styleStrength);
      merged.negativeStrength = clampStrength(merged.negativeStrength, 1.0);
      merged.seed = clampSeed(merged.seed);
      if (merged.seedMode !== "random" && merged.seedMode !== "fixed") {
        merged.seedMode = "random";
      }
      if (typeof merged.separator !== "string")
        merged.separator = SEPARATOR_DEFAULT;
      if (typeof merged.newlines !== "boolean")
        merged.newlines = NEWLINES_DEFAULT;
      if (typeof merged.negativeText !== "string") merged.negativeText = "";
      if (!WEIGHT_FORMAT_KEYS.includes(merged.weightFormat)) {
        merged.weightFormat = WEIGHT_FORMAT_DEFAULT;
      }
      // Choice strings are kept as-is; Python `_resolve` returns "" for unknown keys.
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

function clampStrength(s, fallback = STRENGTH_DEFAULT) {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, n));
}

function clampSeed(s) {
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  return n;
}

function rollSeed() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function hideCanvasWidget(widgets, name) {
  const w = (widgets || []).find((x) => x.name === name);
  if (!w) return;
  w.hidden = true;
  w.computeSize = () => [0, -4];
  if (!w.options) w.options = {};
  w.options.canvasOnly = true;
}

const VISIBLE_NATIVE_WIDGETS = [
  // Required: left as "light / theme / style" because they double as the
  // sentinel-bearing picker (the JS owns the value via MasterState). But
  // the editor + the JS graphToPrompt wrapper are now the only thing that
  // sets them; we don't expose them on the canvas anymore.
  "light",
  "theme",
  "style",
  "light_strength",
  "theme_strength",
  "style_strength",
  "seed",
  "separator",
  "newlines",
  "weight_format",
  "show_preview",
  "force_refresh",
  "negative_strength",
  "negative_text",
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&quot;/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── On-node body ───────────────────────────────────────────────────────────

function shortLabel(value) {
  if (value === NONE_SENTINEL) return { text: "(none)", cls: "value none" };
  if (typeof value === "string" && value.startsWith("__RANDOM_")) {
    return { text: "(random)", cls: "value random" };
  }
  return { text: value, cls: "value" };
}

function renderHeader(node) {
  const head = node._bossMsHead;
  if (!head) return;
  const state = readState(node);
  const l = shortLabel(state.light);
  const t = shortLabel(state.theme);
  const s = shortLabel(state.style);
  head.innerHTML =
    `<span class="label">Light:</span> <span class="${l.cls}">${escapeHtml(l.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Theme:</span> <span class="${t.cls}">${escapeHtml(t.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Style:</span> <span class="${s.cls}">${escapeHtml(s.text)}</span>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossMsRoot;
  if (!root) return;
  const s = root.querySelector(".boss-ms-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

function syncNativeWidgets(node, state) {
  const setWidget = (name, value) => {
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
  };
  setWidget("light", state.light);
  setWidget("light_strength", clampStrength(state.lightStrength));
  setWidget("theme", state.theme);
  setWidget("theme_strength", clampStrength(state.themeStrength));
  setWidget("style", state.style);
  setWidget("style_strength", clampStrength(state.styleStrength));
  setWidget("weight_format", state.weightFormat);
  setWidget("seed", clampSeed(state.seed));
  setWidget("separator", state.separator);
  setWidget("newlines", !!state.newlines);
  setWidget("negative_strength", clampStrength(state.negativeStrength, 1.0));
  setWidget("negative_text", state.negativeText || "");
}

function setupMasterNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-ms-root";

  const head = document.createElement("div");
  head.className = "boss-ms-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-ms-open";
  openBtn.textContent = "✨ Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-ms-status";
  root.appendChild(status);

  node.addDOMWidget("master_ui", "boss_master", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 110,
    margin: 4,
    serialize: false,
  });

  node._bossMsRoot = root;
  node._bossMsHead = head;

  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading libraries…");
      const editor = new MasterEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossPromptMasterPro] open editor failed", err);
      setStatus(
        node,
        "Failed to load libraries. Is the backend running?",
        true,
      );
    }
  });

  renderHeader(node);
}

// ── JS-side preview helpers (mirror Python) ────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seed) {
  const r = mulberry32(seed);
  return {
    pick(items) {
      if (!items || !items.length) return undefined;
      return items[Math.floor(r() * items.length)];
    },
  };
}

// Parse "Cat → Name" -> ["Cat", "Name"]; tolerate "Cat -> Name".
function parseChoice(choice) {
  if (!choice) return ["", ""];
  for (const sep of [" → ", " -> ", " →"]) {
    const i = choice.indexOf(sep);
    if (i >= 0) return [choice.slice(0, i), choice.slice(i + sep.length)];
  }
  return ["", choice];
}

function resolveJS(rng, choice, flat, cats) {
  if (choice === NONE_SENTINEL) return { category: "", name: "", text: "" };
  if (typeof choice === "string" && choice.startsWith("__RANDOM_")) {
    const pool = Object.keys(flat || {})
      .slice()
      .sort();
    if (!pool.length) return { category: "", name: "", text: "" };
    const key = rng.pick(pool);
    return { category: "", name: key, text: flat[key] || "" };
  }
  const text = flat[choice] || "";
  const [cat, name] = parseChoice(choice);
  return { category: cat, name, text };
}

function applyWeightJS(text, strength, fmt) {
  if (!text || strength < 0.01) return "";
  const s = Number(strength);
  if (fmt === "none") return text;
  if (fmt === "comfyui") {
    return Math.abs(s - 1.0) < 1e-4 ? text : `(${text}:${s.toFixed(2)})`;
  }
  if (fmt === "parentheses") {
    if (Math.abs(s - 1.0) < 1e-4) return text;
    const layers = Math.max(
      1,
      Math.min(5, Math.round(Math.abs(s - 1.0) / 0.1)),
    );
    if (s > 1.0) return "(".repeat(layers) + text + ")".repeat(layers);
    return "[".repeat(layers) + text + "]".repeat(layers);
  }
  if (fmt === "multiply") return `${text} * ${s.toFixed(2)}`;
  return text;
}

// Port of Python `_NEGATIVE_RULES` (12 keyword groups) and `_DEFAULT_NEGATIVE`.
const NEGATIVE_RULES = [
  [
    ["anime", "manga", "kawaii", "pixel art", "retro game", "retro arcade"],
    "realistic, photography, photorealistic, 3d render, deformed, low contrast",
  ],
  [
    [
      "photo",
      "cinematic",
      "film",
      "hdr",
      "glamour",
      "long exposure",
      "tilt shift",
    ],
    "drawing, painting, cartoon, anime, sketch, illustration, low quality, blurry",
  ],
  [
    ["digital art", "concept art", "matte painting"],
    "photo, photography, realistic, photorealistic, ugly, deformed",
  ],
  [
    ["watercolor", "impressionist", "pointillism", "expressionist"],
    "photo, realistic, digital art, vector, sharp outlines, deformed, noisy",
  ],
  [
    ["pop art", "psychedelic", "graffiti"],
    "realistic, photorealistic, low contrast, muted colors, photo, deformed",
  ],
  [
    ["origami", "papercraft", "kirigami", "papercut", "paper mache"],
    "3d render, realistic, photo, textured noise, blur, deformed, painting",
  ],
  [
    ["pixel art", "lowpoly", "retro arcade", "retro game"],
    "smooth shading, realistic, high resolution, photo, 3d, blurry",
  ],
  [
    [
      "cyberpunk",
      "neonpunk",
      "vaporwave",
      "biomechanical",
      "sci fi",
      "futuristic",
    ],
    "natural lighting, rustic, historical, low tech, deformed, painting",
  ],
  [
    ["line art", "minimalist", "monochrome", "silhouette"],
    "colorful, textured, realistic, photo, noise, blurry, complex background",
  ],
  [
    ["stained glass", "zentangle", "typography"],
    "photo, realistic, 3d, deformed, blurry, noisy",
  ],
  [
    ["steampunk", "gothic", "horror", "macabre", "lovecraftian"],
    "bright colors, cartoon, kawaii, cute, deformed, low contrast",
  ],
  [
    ["comic book", "comic", "manga panel"],
    "realistic, photo, 3d render, deformed, blurry, low quality",
  ],
];
const DEFAULT_NEGATIVE = "blurry, deformed, ugly, low quality, noise, artifact";

function autoNegativeJS(sel) {
  if (!sel.name) return "";
  const s = `${sel.category} ${sel.name}`.toLowerCase();
  for (const [keywords, negative] of NEGATIVE_RULES) {
    if (keywords.some((k) => s.includes(k))) return negative;
  }
  return DEFAULT_NEGATIVE;
}

function buildNegativeText(state, sel) {
  const auto = autoNegativeJS(sel);
  const extra = (state.negativeText || "").trim();
  if (auto && extra) return `${auto}, ${extra}`;
  if (auto || extra) return auto || extra;
  return "";
}

function previewComposeJS(state, libs, seed) {
  const rng = rngFromSeed(seed);
  const l = resolveJS(rng, state.light, libs.lights, libs.lightCategories);
  const t = resolveJS(rng, state.theme, libs.themes, libs.themeCategories);
  const s = resolveJS(rng, state.style, libs.styles, libs.styleCategories);

  const lW = applyWeightJS(l.text, state.lightStrength, state.weightFormat);
  const tW = applyWeightJS(t.text, state.themeStrength, state.weightFormat);
  const sW = applyWeightJS(s.text, state.styleStrength, state.weightFormat);

  const parts = [lW, tW, sW].filter(Boolean);
  const joinStr = state.newlines ? "\n" : (state.separator ?? ", ");
  const combined = parts.length ? parts.join(joinStr) : "";

  const negRaw = buildNegativeText(state, s);
  const negWeighted = applyWeightJS(
    negRaw,
    state.negativeStrength,
    state.weightFormat,
  );

  return { l, t, s, lW, tW, sW, combined, negRaw, negWeighted };
}

// ── Live preview HTML ──────────────────────────────────────────────────────

function buildCard(which, res, weight, isRandomChoice) {
  const accent = COLLECTION_ACCENTS[which];
  const label = COLLECTION_LABELS[which];
  const isNone = res.name === "" && res.text === "";
  const displayName = isNone
    ? "(none)"
    : isRandomChoice
      ? "(random)"
      : res.name;
  return `<div class="boss-ms-mini ${isNone ? "none" : ""}" style="--accent:${accent.color};--bg:${accent.bg};">
    <div class="h">${label}</div>
    <div class="v">${escapeHtml(displayName)}</div>
    <div class="w">×${Number(weight).toFixed(2)}</div>
  </div>`;
}

function buildPreviewHTML(state, libs) {
  const isRandom = state.seedMode === "random";
  const isFixed = state.seedMode === "fixed";

  // Always resolve — explicit picks land as the user chose them, RANDOM
  // picks roll using seed 0 (cosmetic only — the "(random picks on Run)"
  // caption tells the user those will change).
  const runSeed = isFixed ? clampSeed(state.seed) : 0;
  const res = previewComposeJS(state, libs, runSeed);

  const seedLabel = isFixed ? `seed ${state.seed}` : "random";

  const cards = [
    buildCard(
      "light",
      res.l,
      state.lightStrength,
      state.light === RANDOM_LIGHT,
    ),
    buildCard(
      "theme",
      res.t,
      state.themeStrength,
      state.theme === RANDOM_THEME,
    ),
    buildCard(
      "style",
      res.s,
      state.styleStrength,
      state.style === RANDOM_STYLE,
    ),
  ].join("");

  const negBlock = res.negRaw
    ? `<div class="boss-ms-negcard">
        <div class="h">NEGATIVE (auto + extras)</div>
        <div class="v">${escapeHtml(res.negRaw)}</div>
        <div class="w">×${Number(state.negativeStrength).toFixed(2)}${res.negWeighted && res.negWeighted !== res.negRaw ? ` · weighted: ${escapeHtml(res.negWeighted)}` : ""}</div>
      </div>`
    : `<div class="boss-ms-negcard">
        <div class="h">NEGATIVE</div>
        <div class="v" style="color:#888">(no negative — pick a style or add extras)</div>
        <div class="w">×${Number(state.negativeStrength).toFixed(2)}</div>
      </div>`;

  const outputBlock = res.combined
    ? `<span class="arrow">→</span> ${escapeHtml(res.combined)}`
    : `<em style="color:#666">(nothing selected — switch to Fixed to preview)</em>`;
  const outputCls = res.combined ? "" : "empty";
  const formatLabel =
    state.weightFormat === "none" ? "none" : state.weightFormat;

  return `
    <div class="boss-ms-card-title">✨ PROMPT MASTER LIBRARY PRO BOSS</div>
    <div class="boss-ms-cards">${cards}</div>
    ${negBlock}
    <div class="boss-ms-meta">format: <strong>${escapeHtml(formatLabel)}</strong>${state.newlines ? " · newlines" : ` · separator: ${escapeHtml(JSON.stringify(state.separator))}`}</div>
    <div class="boss-ms-output ${outputCls}">${outputBlock}</div>
    <div class="boss-ms-meta">${escapeHtml(seedLabel)}</div>
  `;
}

// ── Favorites HTTP API ─────────────────────────────────────────────────────

async function fetchFavorites() {
  const r = await fetch("/master_boss/favorites");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.favorites || [];
}

async function saveFavoriteHTTP(payload) {
  const r = await fetch("/master_boss/favorites/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.favorites || [];
}

async function deleteFavoriteHTTP(name) {
  const r = await fetch("/master_boss/favorites/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.favorites || [];
}

// ── MasterEditor ───────────────────────────────────────────────────────────

class MasterEditor {
  constructor(node) {
    this.node = node;
    this.libs = {
      lights: {},
      themes: {},
      styles: {},
      lightCategories: {},
      themeCategories: {},
      styleCategories: {},
      weightFormats: WEIGHT_FORMAT_KEYS.map((k) => ({
        key: k,
        label: WEIGHT_FORMAT_LABELS[k],
      })),
      separatorDefault: SEPARATOR_DEFAULT,
      newlinesDefault: NEWLINES_DEFAULT,
    };
    this.favorites = [];
    this.state = readState(node);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/master_boss/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.libs.lights = data.lights || {};
    this.libs.themes = data.themes || {};
    this.libs.styles = data.styles || {};
    this.libs.lightCategories = data.lightCategories || {};
    this.libs.themeCategories = data.themeCategories || {};
    this.libs.styleCategories = data.styleCategories || {};
    if (Array.isArray(data.weightFormats) && data.weightFormats.length) {
      this.libs.weightFormats = data.weightFormats;
    }
    if (typeof data.separatorDefault === "string") {
      this.libs.separatorDefault = data.separatorDefault;
    }
    if (typeof data.newlinesDefault === "boolean") {
      this.libs.newlinesDefault = data.newlinesDefault;
    }
  }

  async fetchFavorites() {
    try {
      this.favorites = await fetchFavorites();
    } catch (err) {
      console.warn("[BossPromptMasterPro] favorites fetch failed", err);
      this.favorites = [];
    }
  }

  async open() {
    await this.fetchData();
    await this.fetchFavorites();
    this.buildModal();
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const modal = document.createElement("div");
    modal.className = "boss-ms-modal";

    // Top bar
    const bar = document.createElement("div");
    bar.className = "boss-ms-bar";
    bar.innerHTML = `<div class="boss-ms-bar-title">Prompt Master Library Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-ms-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-ms-body";

    // Left controls
    const side = document.createElement("div");
    side.className = "boss-ms-side";

    // 1. Light section
    side.appendChild(
      this.buildListSection({
        title: "Light",
        collection: "lights",
        stateKey: "light",
        searchVar: "_lightSearch",
        listVar: "_lightListEl",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Light Strength",
        stateKey: "lightStrength",
      }),
    );

    // 2. Theme section
    side.appendChild(
      this.buildListSection({
        title: "Theme",
        collection: "themes",
        stateKey: "theme",
        searchVar: "_themeSearch",
        listVar: "_themeListEl",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Theme Strength",
        stateKey: "themeStrength",
      }),
    );

    // 3. Style section
    side.appendChild(
      this.buildListSection({
        title: "Style",
        collection: "styles",
        stateKey: "style",
        searchVar: "_styleSearch",
        listVar: "_styleListEl",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Style Strength",
        stateKey: "styleStrength",
      }),
    );

    // 4. Weight Format dropdown
    side.appendChild(this.buildWeightFormatSection());

    // 5. Separator
    side.appendChild(this.buildSeparatorSection());

    // 6. Newlines toggle
    side.appendChild(this.buildNewlinesSection());

    // 7. Negative Strength
    side.appendChild(this.buildNegativeStrengthSection());

    // 8. Negative Text
    side.appendChild(this.buildNegativeTextSection());

    // 9. Seed section
    side.appendChild(this.buildSeedSection());

    // 10. Favorites section
    side.appendChild(this.buildFavoritesSection());

    body.appendChild(side);

    // Right preview
    const previewWrap = document.createElement("div");
    previewWrap.className = "boss-ms-preview";
    const card = document.createElement("div");
    card.className = "boss-ms-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "boss-ms-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-ms-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-ms-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.cardEl = card;

    this.refreshList("light");
    this.refreshList("theme");
    this.refreshList("style");
    this.refreshFavoritesList();
    this.refreshPreview();
  }

  // ── List section ─────────────────────────────────────────────────────
  buildListSection({ title, collection, stateKey, searchVar, listVar }) {
    const wrap = document.createElement("div");
    wrap.className = "boss-ms-list-wrap";

    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-ms-input";
    search.placeholder = `Search ${title.toLowerCase()}…`;
    wrap.appendChild(search);

    const list = document.createElement("div");
    list.className = "boss-ms-list";
    wrap.appendChild(list);

    this[searchVar] = "";
    this[listVar] = list;

    search.addEventListener("input", (e) => {
      this[searchVar] = e.target.value;
      this.refreshList(
        stateKey === "light"
          ? "light"
          : stateKey === "theme"
            ? "theme"
            : "style",
      );
    });

    // Disable drag and drop of text by capture (drop targets in modals are flaky).
    return wrap;
  }

  refreshList(which) {
    const collectionMap = { light: "lights", theme: "themes", style: "styles" };
    const data = this.libs[collectionMap[which]] || {};
    const stateKey = which;
    const searchVar = "_" + which + "Search";
    const listVar = "_" + which + "ListEl";
    const el = this[listVar];
    if (!el) return;
    el.innerHTML = "";
    const search = (this[searchVar] || "").toLowerCase();

    const sentinelFor = {
      light: RANDOM_LIGHT,
      theme: RANDOM_THEME,
      style: RANDOM_STYLE,
    };
    const items = [
      { name: sentinelFor[which], badge: "Random" },
      { name: NONE_SENTINEL, badge: "None" },
    ];

    const names = Object.keys(data || {}).sort();
    for (const n of names) {
      if (search && !n.toLowerCase().includes(search)) continue;
      items.push({ name: n, badge: "" });
    }

    for (const it of items) {
      const row = document.createElement("div");
      row.className =
        "boss-ms-list-item" +
        (this.state[stateKey] === it.name ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = it.name;
      name.title = it.name;
      row.appendChild(name);
      if (it.badge) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = it.badge;
        row.appendChild(badge);
      }
      row.addEventListener("click", () => {
        this.state[stateKey] = it.name;
        this.refreshList(which);
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-ms-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = "No matches.";
      el.appendChild(empty);
    }
  }

  // ── Strength slider + linked number ─────────────────────────────────
  buildStrengthSection({ title, stateKey }) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = `${title}: ${Number(this.state[stateKey]).toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-ms-strength";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(STRENGTH_MIN);
    slider.max = String(STRENGTH_MAX);
    slider.step = String(STRENGTH_STEP);
    slider.value = String(this.state[stateKey]);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-ms-input";
    num.min = String(STRENGTH_MIN);
    num.max = String(STRENGTH_MAX);
    num.step = String(STRENGTH_STEP);
    num.value = Number(this.state[stateKey]).toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state[stateKey] = clampStrength(v, this.state[stateKey]);
      lbl.textContent = `${title}: ${Number(this.state[stateKey]).toFixed(2)}`;
      slider.value = String(this.state[stateKey]);
      num.value = Number(this.state[stateKey]).toFixed(2);
      this.refreshPreview();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    return wrap;
  }

  // ── Weight format dropdown ──────────────────────────────────────────
  buildWeightFormatSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = "Weight Format";
    wrap.appendChild(lbl);

    const sel = document.createElement("select");
    sel.className = "boss-ms-select";
    const formats =
      this.libs.weightFormats && this.libs.weightFormats.length
        ? this.libs.weightFormats
        : WEIGHT_FORMAT_KEYS.map((k) => ({
            key: k,
            label: WEIGHT_FORMAT_LABELS[k],
          }));
    for (const fmt of formats) {
      const o = document.createElement("option");
      o.value = fmt.key;
      o.textContent = fmt.label || fmt.key;
      if (fmt.key === this.state.weightFormat) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", (e) => {
      this.state.weightFormat = e.target.value;
      this.refreshPreview();
    });
    wrap.appendChild(sel);
    return wrap;
  }

  // ── Separator (small text input) ────────────────────────────────────
  buildSeparatorSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = "Separator (ignored when Newlines ON)";
    wrap.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "boss-ms-input";
    inp.value = this.state.separator;
    inp.addEventListener("change", (e) => {
      this.state.separator = e.target.value;
      this.refreshPreview();
    });
    wrap.appendChild(inp);
    return wrap;
  }

  // ── Newlines toggle pill ────────────────────────────────────────────
  buildNewlinesSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = "Fragment Separator";
    wrap.appendChild(lbl);

    const pill = document.createElement("div");
    pill.className = "boss-ms-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-ms-seg").forEach((s) => {
        s.classList.toggle(
          "active",
          s.dataset.value === String(this.state.newlines),
        );
      });
    };
    for (const [v, label] of [
      [false, "Delimiter"],
      [true, "Newline"],
    ]) {
      const seg = document.createElement("button");
      seg.type = "button";
      seg.className =
        "boss-ms-seg" + (this.state.newlines === v ? " active" : "");
      seg.textContent = label;
      seg.dataset.value = String(v);
      seg.addEventListener("click", () => {
        if (this.state.newlines === v) return;
        this.state.newlines = v;
        syncPill();
        this.refreshPreview();
      });
      pill.appendChild(seg);
    }
    wrap.appendChild(pill);
    syncPill();
    return wrap;
  }

  // ── Negative strength slider ────────────────────────────────────────
  buildNegativeStrengthSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = `Negative Strength: ${Number(this.state.negativeStrength).toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-ms-strength";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(STRENGTH_MIN);
    slider.max = String(STRENGTH_MAX);
    slider.step = String(STRENGTH_STEP);
    slider.value = String(this.state.negativeStrength);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-ms-input";
    num.min = String(STRENGTH_MIN);
    num.max = String(STRENGTH_MAX);
    num.step = String(STRENGTH_STEP);
    num.value = Number(this.state.negativeStrength).toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state.negativeStrength = clampStrength(
        v,
        this.state.negativeStrength,
      );
      lbl.textContent = `Negative Strength: ${Number(this.state.negativeStrength).toFixed(2)}`;
      slider.value = String(this.state.negativeStrength);
      num.value = Number(this.state.negativeStrength).toFixed(2);
      this.refreshPreview();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    return wrap;
  }

  // ── Negative text textarea ──────────────────────────────────────────
  buildNegativeTextSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = "Extra Negatives (appended to auto-negative)";
    wrap.appendChild(lbl);

    const ta = document.createElement("textarea");
    ta.className = "boss-ms-textarea";
    ta.placeholder = "Extra negatives: blurry, deformed, ugly...";
    ta.spellcheck = false;
    ta.value = this.state.negativeText || "";
    ta.addEventListener("input", (e) => {
      this.state.negativeText = e.target.value;
      this.refreshPreview();
    });
    wrap.appendChild(ta);
    return wrap;
  }

  // ── Seed section ────────────────────────────────────────────────────
  buildSeedSection() {
    const wrap = document.createElement("div");

    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-ms-seed-num";
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
      this.refreshPreview();
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

    const pill = document.createElement("div");
    pill.className = "boss-ms-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-ms-seg").forEach((s) => {
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
        "boss-ms-seg" + (this.state.seedMode === m ? " active" : "");
      seg.textContent = label;
      seg.dataset.mode = m;
      seg.addEventListener("click", () => {
        if (this.state.seedMode === m) return;
        this.state.seedMode = m;
        syncPill();
        this.refreshLastRun();
        this.refreshPreview();
      });
      pill.appendChild(seg);
    }
    wrap.appendChild(pill);

    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "boss-ms-btn";
    newBtn.textContent = "New fixed random";
    newBtn.addEventListener("click", () => {
      this.state.seed = rollSeed();
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
      this.refreshPreview();
    });
    wrap.appendChild(newBtn);

    const row = document.createElement("div");
    row.className = "boss-ms-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-ms-btn";
    useLast.textContent = "Use last seed";
    useLast.disabled = this.lastSeed == null;
    useLast.addEventListener("click", () => {
      if (this.lastSeed == null) return;
      this.state.seed = clampSeed(this.lastSeed);
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
      this.refreshPreview();
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "boss-ms-btn is-copy";
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

    this._lastRunEl = document.createElement("div");
    this._lastRunEl.className = "boss-ms-seed-last";
    wrap.appendChild(this._lastRunEl);
    this.refreshLastRun();
    syncPill();
    return wrap;
  }

  refreshLastRun() {
    if (!this._lastRunEl) return;
    if (this.state.seedMode === "fixed") {
      this._lastRunEl.textContent = "Fixed: same picks every run";
    } else if (this.lastSeed != null) {
      this._lastRunEl.textContent = `Last run seed: ${this.lastSeed}`;
    } else {
      this._lastRunEl.textContent = "Last run: not run yet";
    }
  }

  // ── Favorites section ───────────────────────────────────────────────
  buildFavoritesSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-ms-section-label";
    lbl.textContent = "Favorites";
    wrap.appendChild(lbl);

    // Save-row: name + Save button + status
    const saveRow = document.createElement("div");
    saveRow.className = "boss-ms-fav-row";
    const nameInp = document.createElement("input");
    nameInp.type = "text";
    nameInp.className = "boss-ms-input";
    nameInp.placeholder = "Name (e.g. Golden Anime)";
    nameInp.value = "My Combo";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-ms-btn";
    saveBtn.textContent = "💾 Save";
    saveBtn.style.flex = "0 0 auto";
    saveBtn.style.minWidth = "78px";
    saveRow.appendChild(nameInp);
    saveRow.appendChild(saveBtn);
    wrap.appendChild(saveRow);

    const saveStatus = document.createElement("div");
    saveStatus.style.fontSize = "11px";
    saveStatus.style.color = "#888";
    saveStatus.style.minHeight = "14px";
    saveStatus.style.textAlign = "center";
    wrap.appendChild(saveStatus);

    saveBtn.addEventListener("click", async () => {
      const name = (nameInp.value || "").trim();
      if (!name) {
        saveStatus.textContent = "Name required";
        saveStatus.style.color = "#ff8080";
        return;
      }
      saveBtn.disabled = true;
      saveStatus.textContent = "Saving…";
      saveStatus.style.color = "#888";
      try {
        this.favorites = await saveFavoriteHTTP({
          name,
          light: this.state.light,
          theme: this.state.theme,
          style: this.state.style,
          light_strength: clampStrength(this.state.lightStrength),
          theme_strength: clampStrength(this.state.themeStrength),
          style_strength: clampStrength(this.state.styleStrength),
        });
        saveStatus.textContent = `Saved '${name}'`;
        saveStatus.style.color = BRAND;
        this.refreshFavoritesList();
      } catch (err) {
        saveStatus.textContent = "Save failed — is the backend running?";
        saveStatus.style.color = "#ff8080";
      } finally {
        saveBtn.disabled = false;
      }
    });

    // Favorites list
    const list = document.createElement("div");
    list.className = "boss-ms-fav-list";
    wrap.appendChild(list);
    this._favListEl = list;

    this.refreshFavoritesList();
    return wrap;
  }

  refreshFavoritesList() {
    const el = this._favListEl;
    if (!el) return;
    el.innerHTML = "";
    if (!this.favorites || !this.favorites.length) {
      const empty = document.createElement("div");
      empty.className = "boss-ms-fav-empty";
      empty.textContent = "No saved combos yet — use the Save field above.";
      el.appendChild(empty);
      return;
    }
    for (const fav of this.favorites) {
      const item = document.createElement("div");
      item.className = "boss-ms-fav-item";

      const head = document.createElement("div");
      head.className = "boss-ms-fav-item-head";
      const nm = document.createElement("div");
      nm.className = "boss-ms-fav-item-name";
      nm.textContent = fav.name || "(unnamed)";
      nm.title = fav.name || "(unnamed)";
      head.appendChild(nm);

      const btns = document.createElement("div");
      btns.className = "boss-ms-fav-item-btns";
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "boss-ms-btn";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        this.state.light = fav.light_choice || RANDOM_LIGHT;
        this.state.theme = fav.theme_choice || RANDOM_THEME;
        this.state.style = fav.style_choice || RANDOM_STYLE;
        this.state.lightStrength = clampStrength(
          fav.light_strength,
          this.state.lightStrength,
        );
        this.state.themeStrength = clampStrength(
          fav.theme_strength,
          this.state.themeStrength,
        );
        this.state.styleStrength = clampStrength(
          fav.style_strength,
          this.state.styleStrength,
        );
        this.refreshList("light");
        this.refreshList("theme");
        this.refreshList("style");
        this.refreshPreview();
        // Rebuild the strength-section labels by re-rendering the modal.
        this.rerenderStrengthLabels();
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "boss-ms-btn is-danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete favorite '${fav.name}'?`)) return;
        delBtn.disabled = true;
        try {
          this.favorites = await deleteFavoriteHTTP(fav.name);
          this.refreshFavoritesList();
        } catch (err) {
          alert("Delete failed — is the backend running?");
          delBtn.disabled = false;
        }
      });

      btns.appendChild(loadBtn);
      btns.appendChild(delBtn);
      head.appendChild(btns);
      item.appendChild(head);

      const summary = document.createElement("div");
      summary.className = "boss-ms-fav-summary";
      const light = fav.light_choice || RANDOM_LIGHT;
      const theme = fav.theme_choice || RANDOM_THEME;
      const style = fav.style_choice || RANDOM_STYLE;
      summary.innerHTML =
        `<span class="b">L:</span> ${escapeHtml(shortSummary(light))}<br>` +
        `<span class="b">T:</span> ${escapeHtml(shortSummary(theme))}<br>` +
        `<span class="b">S:</span> ${escapeHtml(shortSummary(style))}<br>` +
        `<span class="b">×</span> ${fav.light_strength?.toFixed?.(2) ?? "1.00"} / ` +
        `${fav.theme_strength?.toFixed?.(2) ?? "1.00"} / ` +
        `${fav.style_strength?.toFixed?.(2) ?? "1.00"}`;
      item.appendChild(summary);

      el.appendChild(item);
    }
  }

  rerenderStrengthLabels() {
    // Walk the side panel and update strength slider labels.
    const side = this.modal?.querySelector(".boss-ms-side");
    if (!side) return;
    // The simplest way is to find the three labels by their prefix and update.
    // We tagged them in buildStrengthSection() — re-tag by their current value.
    // (Safer: just trigger a full refresh by calling rebuildFromState().)
    // Here we just nudge the labels based on the current state.
    const labels = side.querySelectorAll(".boss-ms-section-label");
    for (const lbl of labels) {
      const t = lbl.textContent;
      if (t.startsWith("Light Strength:"))
        lbl.textContent = `Light Strength: ${Number(this.state.lightStrength).toFixed(2)}`;
      else if (t.startsWith("Theme Strength:"))
        lbl.textContent = `Theme Strength: ${Number(this.state.themeStrength).toFixed(2)}`;
      else if (t.startsWith("Style Strength:"))
        lbl.textContent = `Style Strength: ${Number(this.state.styleStrength).toFixed(2)}`;
      else if (t.startsWith("Negative Strength:"))
        lbl.textContent = `Negative Strength: ${Number(this.state.negativeStrength).toFixed(2)}`;
    }
  }

  refreshPreview() {
    if (!this.cardEl) return;
    this.cardEl.innerHTML = buildPreviewHTML(this.state, this.libs);
  }

  // ── Commit / cancel ───────────────────────────────────────────────────
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

function shortSummary(value) {
  if (value === NONE_SENTINEL) return "(none)";
  if (typeof value === "string" && value.startsWith("__RANDOM_"))
    return "(random)";
  return value;
}

// ── loadGraphData 300 ms guard ─────────────────────────────────────────────
let _bossMsLoadingGraph = false;
if (app && app.loadGraphData && !app._bossMsLoadWrapped) {
  app._bossMsLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossMsLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossMsLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.PromptMasterLibraryPro",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PromptMasterLibraryPro") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossMsHead) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "PromptMasterLibraryPro") return;
    setupMasterNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────

function buildMasterNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "PromptMasterLibraryPro" ||
        n.type === "PromptMasterLibraryPro"
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

function findMasterNode(index, promptId) {
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
      if (!entry || entry.class_type !== "PromptMasterLibraryPro") continue;
      if (!index) index = buildMasterNodeIndex();
      const node = findMasterNode(index, id);
      const state = node ? readState(node) : defaultState();
      let runSeed;
      if (state.seedMode === "random") {
        runSeed = rollSeed();
        if (node) node._pixBossLastSeed = runSeed;
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
    console.warn("[BossPromptMasterPro] graphToPrompt inject failed", e);
  }
  return result;
};

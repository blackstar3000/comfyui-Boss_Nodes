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
import { BossDropdown } from "../boss_theme/index.js";

// ── Constants (mirror Python exactly) ──────────────────────────────────────

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

// ── CSS (injected once, idempotent) ────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-master-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Header value variants */
    .boss-widget-head .value.none { color: var(--boss-text-muted); font-style: italic; }
    .boss-widget-head .value.random { color: var(--boss-brand); }
    .boss-widget-head .sep { color: var(--boss-text-faint); margin: 0 6px; }

    /* Preview centering */
    .boss-side + .boss-preview {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Side panel width override */
    .boss-ms-side-custom { width: 380px; }

    /* Per-collection list */
    .boss-ms-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-ms-list {
      max-height: 150px;
      overflow-y: auto;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
    }
    .boss-ms-list-item {
      padding: 6px 12px;
      font-size: 13px;
      color: var(--boss-text);
      cursor: pointer;
      border-bottom: 1px solid var(--boss-border);
      display: flex; align-items: center; gap: 8px;
    }
    .boss-ms-list-item:last-child { border-bottom: none; }
    .boss-ms-list-item:hover { background: var(--boss-bg-hover); }
    .boss-ms-list-item.selected {
      background: var(--boss-bg-active);
      color: var(--boss-text-bright);
      box-shadow: inset 3px 0 0 var(--boss-brand);
    }
    .boss-ms-list-item .badge {
      font-size: 10px; color: var(--boss-text-dim); padding: 2px 6px;
      background: var(--boss-border); border-radius: 3px;
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
    .boss-ms-strength input[type=range] { flex: 1; accent-color: var(--boss-brand); }
    .boss-ms-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Random/Fixed pill */
    .boss-pill {
      display: flex; gap: 0;
      background: var(--boss-bg-hover);
      border-radius: var(--boss-radius-lg);
      padding: 3px;
    }
    .boss-seg {
      flex: 1;
      text-align: center;
      padding: 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit; font-size: var(--boss-font-size);
      color: var(--boss-text-muted);
      cursor: pointer; user-select: none; outline: none;
      transition: background var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-seg:hover:not(.active) { color: var(--boss-text); }
    .boss-seg.active { background: var(--boss-brand); color: #fff; font-weight: 500; }
    .boss-seg:focus-visible { outline: 2px solid var(--boss-brand); outline-offset: -2px; }

    .boss-btn {
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
    .boss-btn:hover { background: var(--boss-brand); border-color: var(--boss-brand); color: #fff; }
    .boss-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-btn:disabled:hover {
      background: var(--boss-bg-hover);
      border-color: var(--boss-border-strong);
      color: var(--boss-text);
    }
    .boss-btn.is-danger:hover {
      background: #f87171; border-color: #f87171;
    }
    .boss-btn.is-flashing,
    .boss-btn.is-flashing:hover {
      background: #3ec371; border-color: #3ec371; color: #fff;
    }
    .boss-seed-row { display: flex; gap: 6px; }
    .boss-seed-row .boss-btn { flex: 1; }
    .boss-seed-row .boss-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-seed-num {
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
    .boss-seed-num:focus { border-color: var(--boss-brand); }
    .boss-seed-last {
      font-size: var(--boss-font-size-sm); line-height: 1.5;
      color: var(--boss-text-muted);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Inline favorite name row */
    .boss-fav-row { display: flex; gap: 6px; align-items: center; }
    .boss-fav-row .boss-input { flex: 1; }

    /* Favorites list */
    .boss-fav-list {
      max-height: 220px;
      overflow-y: auto;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
      display: flex; flex-direction: column;
    }
    .boss-fav-item {
      padding: 10px 12px;
      border-bottom: 1px solid var(--boss-border);
      display: flex; flex-direction: column; gap: 6px;
    }
    .boss-fav-item:last-child { border-bottom: none; }
    .boss-fav-item-head {
      display: flex; align-items: center; gap: 8px;
    }
    .boss-fav-item-name {
      flex: 1;
      font-weight: 600;
      font-size: 13px;
      color: var(--boss-brand);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .boss-fav-item-btns { display: flex; gap: 6px; flex-shrink: 0; }
    .boss-fav-item-btns .boss-btn { padding: 4px 10px; font-size: 11px; }
    .boss-fav-summary {
      font-size: 11px;
      color: var(--boss-text-muted);
      line-height: 1.5;
      word-break: break-word;
    }
    .boss-fav-summary .b { color: var(--boss-text-dim); }
    .boss-fav-empty {
      padding: 18px;
      color: var(--boss-text-faint);
      text-align: center;
      font-size: 12px;
      font-style: italic;
    }

    /* Preview mini-cards + negative card */
    .boss-ms-card {
      padding: 16px;
      background: #2a2a2a;
      background: var(--boss-bg-card);
      backdrop-filter: var(--boss-blur-card);
      border-radius: 12px;
      border: 1px solid var(--boss-border-strong);
      color: #fff;
      max-width: 800px;
      width: 100%;
      box-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
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
      color: var(--boss-text-muted);
      font-size: 0.8em;
    }
    .boss-ms-mini.none .v { color: var(--boss-text-faint); font-style: italic; }

    .boss-ms-negcard {
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid #f87171;
      background: #3d0e0e;
      margin-bottom: 12px;
    }
    .boss-ms-negcard .h {
      color: #f87171;
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .boss-ms-negcard .v {
      font-size: 0.95em;
      word-break: break-word;
      overflow-wrap: anywhere;
      font-family: var(--boss-font-mono);
      color: #ffb3b3;
    }
    .boss-ms-negcard .w {
      color: var(--boss-text-muted);
      font-size: 0.8em;
      margin-top: 4px;
    }
    .boss-ms-meta {
      color: var(--boss-text-muted);
      font-size: 0.8em;
      margin-bottom: 8px;
      text-align: center;
    }
    .boss-ms-output {
      background: var(--boss-bg-code);
      padding: 12px;
      border-radius: var(--boss-radius-lg);
      font-family: var(--boss-font-mono);
      font-size: 0.95em;
      line-height: 1.6;
      word-break: break-all;
      border: 1px solid var(--boss-border);
      white-space: pre-wrap;
      margin-top: 6px;
    }
    .boss-ms-output .arrow { color: var(--boss-brand); font-weight: bold; }
    .boss-ms-output.empty { color: var(--boss-text-faint); font-style: italic; }
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
  "control_after_generate",
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
  const s = root.querySelector(".boss-status");
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
  root.className = "boss-widget";

  const head = document.createElement("div");
  head.className = "boss-widget-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-btn-open";
  openBtn.textContent = "✨ Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
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
    modal.className = "boss-modal";

    // Top bar
    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">Prompt Master Library Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-btn-close";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-body";

    // Left controls
    const side = document.createElement("div");
    side.className = "boss-side boss-ms-side-custom";

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
    previewWrap.className = "boss-preview";
    const card = document.createElement("div");
    card.className = "boss-card boss-ms-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "boss-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-btn-primary";
    saveBtn.textContent = "Save";
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
    lbl.className = "boss-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-input";
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
    lbl.className = "boss-label";
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
    num.className = "boss-input";
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
    const formats =
      this.libs.weightFormats && this.libs.weightFormats.length
        ? this.libs.weightFormats
        : WEIGHT_FORMAT_KEYS.map((k) => ({
            key: k,
            label: WEIGHT_FORMAT_LABELS[k],
          }));

    const options = formats.map((f) => ({
      value: f.key,
      label: f.label || f.key,
    }));

    const dropdown = new BossDropdown({
      label: "Weight Format",
      options,
      value: this.state.weightFormat,
      searchable: formats.length > 4,
      onChange: (value) => {
        this.state.weightFormat = value;
        this.refreshPreview();
      },
    });

    return dropdown.element;
  }

  // ── Separator (small text input) ────────────────────────────────────
  buildSeparatorSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Separator (ignored when Newlines ON)";
    wrap.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "boss-input";
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
    lbl.className = "boss-label";
    lbl.textContent = "Fragment Separator";
    wrap.appendChild(lbl);

    const pill = document.createElement("div");
    pill.className = "boss-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-seg").forEach((s) => {
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
      seg.className = "boss-seg" + (this.state.newlines === v ? " active" : "");
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
    lbl.className = "boss-label";
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
    num.className = "boss-input";
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
    lbl.className = "boss-label";
    lbl.textContent = "Extra Negatives (appended to auto-negative)";
    wrap.appendChild(lbl);

    const ta = document.createElement("textarea");
    ta.className = "boss-textarea";
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
    lbl.className = "boss-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-seed-num";
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
    pill.className = "boss-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-seg").forEach((s) => {
        s.classList.toggle("active", s.dataset.mode === this.state.seedMode);
      });
    };
    for (const [m, label] of [
      ["random", "Random"],
      ["fixed", "Fixed"],
    ]) {
      const seg = document.createElement("button");
      seg.type = "button";
      seg.className = "boss-seg" + (this.state.seedMode === m ? " active" : "");
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
    newBtn.className = "boss-btn";
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
    row.className = "boss-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-btn";
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
    copyBtn.className = "boss-btn is-copy";
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
    this._lastRunEl.className = "boss-seed-last";
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
    lbl.className = "boss-label";
    lbl.textContent = "Favorites";
    wrap.appendChild(lbl);

    // Save-row: name + Save button + status
    const saveRow = document.createElement("div");
    saveRow.className = "boss-fav-row";
    const nameInp = document.createElement("input");
    nameInp.type = "text";
    nameInp.className = "boss-input";
    nameInp.placeholder = "Name (e.g. Golden Anime)";
    nameInp.value = "My Combo";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-btn";
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
    list.className = "boss-fav-list";
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
      empty.className = "boss-fav-empty";
      empty.textContent = "No saved combos yet — use the Save field above.";
      el.appendChild(empty);
      return;
    }
    for (const fav of this.favorites) {
      const item = document.createElement("div");
      item.className = "boss-fav-item";

      const head = document.createElement("div");
      head.className = "boss-fav-item-head";
      const nm = document.createElement("div");
      nm.className = "boss-fav-item-name";
      nm.textContent = fav.name || "(unnamed)";
      nm.title = fav.name || "(unnamed)";
      head.appendChild(nm);

      const btns = document.createElement("div");
      btns.className = "boss-fav-item-btns";
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "boss-btn";
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
      delBtn.className = "boss-btn is-danger";
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
      summary.className = "boss-fav-summary";
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
    const side = this.modal?.querySelector(".boss-side");
    if (!side) return;
    // The simplest way is to find the three labels by their prefix and update.
    // We tagged them in buildStrengthSection() — re-tag by their current value.
    // (Safer: just trigger a full refresh by calling rebuildFromState().)
    // Here we just nudge the labels based on the current state.
    const labels = side.querySelectorAll(".boss-label");
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
      // Write the resolved seed to the REAL wire input - go() reads `seed`
      // directly and never parses MasterState, so this is what actually
      // reaches the sampler each run. Without this, "random" mode only
      // ever changed the (unused) hidden state and the node kept reusing
      // whatever seed was last synced by the editor's Apply button.
      entry.inputs.seed = runSeed;
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

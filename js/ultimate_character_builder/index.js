// ╔═══════════════════════════════════════════════════════════════╗
// ║  Ultimate Character Builder Pro Boss — DOM widget + editor    ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/scene_maker_pro/index.js (3-collection
// variant) and the Pixaroma "stateful UI" pattern:
//   - Python declares a single hidden CharacterState STRING input.
//   - JS owns character + expression + pose (each with category +
//     weight) + delimiter + seed(+seedMode) on
//     node.properties.characterState.
//   - The graphToPrompt wrapper injects the resolved state at
//     execution time, including a fresh per-run seed in Random mode.
//   - All interactive UI (header, Open Editor button, fullscreen
//     editor with live preview) is a DOM widget via addDOMWidget.
//
// This is structurally the simplest of the three 3-collection rebuilds:
// no placeholder substitution, no favorites, no auto-negative, no
// multi-format weighting — three independent libraries joined by a
// delimiter.

import { app } from "/scripts/app.js";

// ── Brand + constants ──────────────────────────────────────────────────────
//
// A pink-violet brand for this node so the three 3-collection rebuilds
// are visually distinct (scene=green, master=gold gradient, character=
// pink/violet). Title colour keeps #ff66cc continuity with the v3.2
// pink brand this node has used since the original.
const BRAND = "#a855f7"; // violet-500 — distinct from green/gold siblings
const BRAND_LIGHT = "#c084fc"; // violet-400 for gradients
const BRAND_GLOW = "rgba(168, 85, 247, 0.3)";

const STATE_PROP = "characterState";
const HIDDEN_INPUT_NAME = "CharacterState";

// Per-collection RANDOM_* sentinels (one per combo) match the Python
// constants. Each combo has its own random sentinel so the wire values
// stay unambiguous.
const RANDOM_CHARACTER = "__RANDOM_CHARACTER__";
const RANDOM_EXPRESSION = "__RANDOM_EXPRESSION__";
const RANDOM_POSE = "__RANDOM_POSE__";
const NONE_SENTINEL = "__NONE__";
const ALL_CATEGORIES = "All";

// Strength bounds — character can go bolder (matches v3.2 ceiling of
// 2.5), expression + pose cap at 2.0 (matches v3.2 defaults).
const CHAR_STRENGTH_MIN = 0.0;
const CHAR_STRENGTH_MAX = 2.5;
const SUB_STRENGTH_MIN = 0.0;
const SUB_STRENGTH_MAX = 2.0;
const STRENGTH_STEP = 0.05;

const CHAR_STRENGTH_DEFAULT = 1.3;
const EXP_STRENGTH_DEFAULT = 1.1;
const POSE_STRENGTH_DEFAULT = 1.2;

const DELIMITER_DEFAULT = ", ";

// Per-collection accent colours for the preview cards. Kept the v3.2
// pink/cyan/green identity so muscle memory carries over for any
// existing UltimateCharacterBuilder users.
const COLLECTION_ACCENTS = {
  character: { color: "#ff66cc", bg: "#330022", bgLight: "#1a0611" },
  expression: { color: "#00ffff", bg: "#001133", bgLight: "#020b1a" },
  pose: { color: "#00ff88", bg: "#003311", bgLight: "#021a0c" },
};
const COLLECTION_LABELS = {
  character: "CHARACTER",
  expression: "EXPRESSION",
  pose: "POSE",
};

// ── CSS (injected once, idempotent) ────────────────────────────────────────
//
// Same primitives as scene_maker_pro. Scoped to `boss-char-css` so the
// style block has its own id and we can iterate without colliding.
function injectCSS() {
  if (document.getElementById("boss-char-css")) return;
  const css = `
    /* On-node body */
    .boss-char-root {
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
    .boss-char-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-char-head .label { color: #999; }
    .boss-char-head .value { color: #fff; font-weight: 600; }
    .boss-char-head .value.none { color: #888; font-style: italic; }
    .boss-char-head .value.random { color: ${BRAND}; }
    .boss-char-head .sep { color: #555; margin: 0 6px; }
    .boss-char-open {
      background: linear-gradient(90deg, ${BRAND}, ${BRAND_LIGHT});
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s, transform 0.05s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .boss-char-open:hover { filter: brightness(1.1); }
    .boss-char-open:active { transform: translateY(1px); }
    .boss-char-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-char-status.is-error { color: #ff8080; }

    /* Fullscreen editor modal */
    .boss-char-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-char-bar {
      height: 56px;
      background: linear-gradient(90deg, #171718, #1f1827);
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-char-bar-title {
      font-size: 14px; font-weight: 600; letter-spacing: 1px;
      text-transform: uppercase;
      background: linear-gradient(90deg, ${BRAND_LIGHT}, ${BRAND});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .boss-char-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-char-bar-x:hover { background: #3a3d40; }

    /* Body: left controls | right preview */
    .boss-char-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }
    .boss-char-side {
      width: 320px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-char-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-char-input {
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
    .boss-char-input:focus { border-color: ${BRAND}; }

    /* Per-collection list (search + scrollable entries) */
    .boss-char-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-char-list {
      max-height: 130px;
      overflow-y: auto;
      background: #131415;
      border: 1px solid #3a3d40;
      border-radius: 6px;
    }
    .boss-char-list-item {
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      border-bottom: 1px solid #232527;
      display: flex; align-items: center; gap: 8px;
    }
    .boss-char-list-item:last-child { border-bottom: none; }
    .boss-char-list-item:hover { background: #1c1e20; }
    .boss-char-list-item.selected {
      background: rgba(168,85,247,0.18);
      color: #fff;
      box-shadow: inset 3px 0 0 ${BRAND};
    }
    .boss-char-list-item .badge {
      font-size: 10px; color: #999; padding: 2px 6px;
      background: #232527; border-radius: 3px;
      flex-shrink: 0;
    }
    .boss-char-list-item .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Strength slider + linked number */
    .boss-char-strength { display: flex; align-items: center; gap: 10px; }
    .boss-char-strength input[type=range] { flex: 1; accent-color: ${BRAND}; }
    .boss-char-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Seed pill + buttons */
    .boss-char-pill {
      display: flex; gap: 0;
      background: rgba(255,255,255,0.06);
      border-radius: 7px;
      padding: 3px;
    }
    .boss-char-seg {
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
    .boss-char-seg:hover:not(.active) { color: rgba(255,255,255,0.85); }
    .boss-char-seg.active { background: ${BRAND}; color: #fff; font-weight: 500; }
    .boss-char-seg:focus-visible { outline: 2px solid ${BRAND}; outline-offset: -2px; }

    .boss-char-btn {
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
    .boss-char-btn:hover { background: ${BRAND}; border-color: ${BRAND}; color: #fff; }
    .boss-char-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-char-btn:disabled:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85);
    }
    .boss-char-btn.is-flashing,
    .boss-char-btn.is-flashing:hover {
      background: #3ec371; border-color: #3ec371; color: #fff;
    }
    .boss-char-seed-row { display: flex; gap: 6px; }
    .boss-char-seed-row .boss-char-btn { flex: 1; }
    .boss-char-seed-row .boss-char-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-char-seed-num {
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
    .boss-char-seed-num:focus { border-color: ${BRAND}; }
    .boss-char-seed-last {
      font-size: 11px; line-height: 1.5;
      color: rgba(255,255,255,0.55);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Right preview panel — three side-by-side cards + dark monospace final prompt */
    .boss-char-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-char-card {
      padding: 16px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid #444;
      font-family: system-ui, sans-serif;
      color: #fff;
      max-width: 760px;
      width: 100%;
      box-shadow: 0 0 40px rgba(255, 102, 204, 0.3);
    }
    .boss-char-card-title {
      font-size: 1.4em;
      font-weight: bold;
      text-align: center;
      margin-bottom: 14px;
      letter-spacing: 1px;
      background: linear-gradient(90deg, #ff66cc, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 0 30px rgba(255,102,204,0.3);
    }
    .boss-char-cards {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .boss-char-mini {
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid var(--accent);
      background: var(--bg);
    }
    .boss-char-mini .h {
      color: var(--accent);
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .boss-char-mini .v {
      font-weight: bold;
      font-size: 1em;
      margin: 4px 0;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .boss-char-mini .w {
      color: #aaa;
      font-size: 0.8em;
    }
    .boss-char-mini.none .v { color: #666; font-style: italic; }
    .boss-char-meta {
      color: #888;
      font-size: 0.8em;
      margin-bottom: 8px;
      text-align: center;
    }
    .boss-char-output {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 8px;
      font-family: "Courier New", ui-monospace, monospace;
      font-size: 0.95em;
      line-height: 1.6;
      word-break: break-all;
      border: 1px solid #333;
      white-space: pre-wrap;
    }
    .boss-char-output .arrow { color: #ff66cc; font-weight: bold; }
    .boss-char-output.empty { color: #666; font-style: italic; }

    /* Footer with Save/Cancel pinned bottom-left */
    .boss-char-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-char-save {
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
    .boss-char-save:hover { background: ${BRAND_LIGHT}; }
    .boss-char-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-char-cancel:hover { background: #3a3d40; }
  `;
  const style = document.createElement("style");
  style.id = "boss-char-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

// Returns the per-collection random sentinel (used when the user picks
// the "(Random)" badge in the editor list).
function randomSentinelFor(which) {
  if (which === "character") return RANDOM_CHARACTER;
  if (which === "expression") return RANDOM_EXPRESSION;
  if (which === "pose") return RANDOM_POSE;
  return RANDOM_CHARACTER;
}

function strengthBoundsFor(which) {
  if (which === "character") {
    return {
      min: CHAR_STRENGTH_MIN,
      max: CHAR_STRENGTH_MAX,
      default: CHAR_STRENGTH_DEFAULT,
    };
  }
  return {
    min: SUB_STRENGTH_MIN,
    max: SUB_STRENGTH_MAX,
    default:
      which === "expression" ? EXP_STRENGTH_DEFAULT : POSE_STRENGTH_DEFAULT,
  };
}

function defaultState() {
  return {
    character: RANDOM_CHARACTER,
    characterCat: ALL_CATEGORIES,
    characterStrength: CHAR_STRENGTH_DEFAULT,
    expression: RANDOM_EXPRESSION,
    expressionCat: ALL_CATEGORIES,
    expressionStrength: EXP_STRENGTH_DEFAULT,
    pose: RANDOM_POSE,
    poseCat: ALL_CATEGORIES,
    poseStrength: POSE_STRENGTH_DEFAULT,
    delimiter: DELIMITER_DEFAULT,
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
      merged.characterStrength = clampStrength(
        merged.characterStrength,
        CHAR_STRENGTH_DEFAULT,
        "character",
      );
      merged.expressionStrength = clampStrength(
        merged.expressionStrength,
        EXP_STRENGTH_DEFAULT,
        "expression",
      );
      merged.poseStrength = clampStrength(
        merged.poseStrength,
        POSE_STRENGTH_DEFAULT,
        "pose",
      );
      merged.seed = clampSeed(merged.seed);
      if (merged.seedMode !== "random" && merged.seedMode !== "fixed") {
        merged.seedMode = "random";
      }
      if (typeof merged.delimiter !== "string")
        merged.delimiter = DELIMITER_DEFAULT;
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

function clampStrength(s, fallback, which) {
  const n = Number(s);
  const { min, max } = strengthBoundsFor(which);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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
  "character",
  "character_cat",
  "character_strength",
  "expression",
  "expression_cat",
  "expression_strength",
  "pose",
  "pose_cat",
  "pose_strength",
  "seed",
  "force_refresh",
  "delimiter",
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── On-node body ───────────────────────────────────────────────────────────

function shortLabel(value, category) {
  if (value === NONE_SENTINEL) return { text: "(none)", cls: "value none" };
  if (value && value.startsWith("__RANDOM_")) {
    return { text: `(random — ${category})`, cls: "value random" };
  }
  return { text: value, cls: "value" };
}

function renderHeader(node) {
  const head = node._bossCharHead;
  if (!head) return;
  const state = readState(node);
  const c = shortLabel(state.character, state.characterCat);
  const e = shortLabel(state.expression, state.expressionCat);
  const p = shortLabel(state.pose, state.poseCat);
  head.innerHTML =
    `<span class="label">Char:</span> <span class="${c.cls}">${escapeHtml(c.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Expr:</span> <span class="${e.cls}">${escapeHtml(e.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Pose:</span> <span class="${p.cls}">${escapeHtml(p.text)}</span>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossCharRoot;
  if (!root) return;
  const s = root.querySelector(".boss-char-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// Mirror values into the (hidden) native widgets so Python reads the
// same numbers at execution time. Called on first paint and on every
// Save.
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
  setWidget("character", state.character);
  setWidget("character_cat", state.characterCat);
  setWidget(
    "character_strength",
    clampStrength(state.characterStrength, CHAR_STRENGTH_DEFAULT, "character"),
  );
  setWidget("expression", state.expression);
  setWidget("expression_cat", state.expressionCat);
  setWidget(
    "expression_strength",
    clampStrength(state.expressionStrength, EXP_STRENGTH_DEFAULT, "expression"),
  );
  setWidget("pose", state.pose);
  setWidget("pose_cat", state.poseCat);
  setWidget(
    "pose_strength",
    clampStrength(state.poseStrength, POSE_STRENGTH_DEFAULT, "pose"),
  );
  setWidget("seed", clampSeed(state.seed));
  setWidget("delimiter", state.delimiter);
}

function setupCharNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-char-root";

  const head = document.createElement("div");
  head.className = "boss-char-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-char-open";
  openBtn.textContent = "🧝 Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-char-status";
  root.appendChild(status);

  node.addDOMWidget("char_ui", "boss_char", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 110,
    margin: 4,
    serialize: false,
  });

  node._bossCharRoot = root;
  node._bossCharHead = head;

  // Seed hidden widgets so Python reads the right values on first Run,
  // before the user has opened the editor.
  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading libraries…");
      const editor = new CharEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossUltimateCharBuilder] open editor failed", err);
      // Surface the real reason in the node body so the user can see it
      // without opening devtools.
      const msg = err && err.message ? err.message : String(err);
      setStatus(node, `Failed: ${msg}`, true);
    }
  });

  renderHeader(node);
}

// ── JS-side preview helper (mirrors Python _resolve + _apply_weight) ───────

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

function resolveJS(rng, choice, data, cats, category) {
  if (choice === NONE_SENTINEL) return { key: "", text: "" };
  if (choice && choice.startsWith("__RANDOM_")) {
    let pool;
    if (category === ALL_CATEGORIES || !category) {
      pool = Object.keys(data || {});
    } else {
      pool = (cats || {})[category] || [];
      pool = pool.filter((n) => n in (data || {}));
    }
    if (!pool.length) return { key: "", text: "" };
    const key = rng.pick(pool);
    return { key, text: data[key] || "" };
  }
  return { key: choice || "", text: (data && data[choice]) || "" };
}

function applyWeightJS(text, strength) {
  if (!text || strength < 0.01) return "";
  const s = Number(strength);
  if (Math.abs(s - 1.0) < 1e-4) return text;
  return `(${text}:${s.toFixed(2)})`;
}

function previewComposeJS(state, libs, seed) {
  const rng = rngFromSeed(seed);

  const c = resolveJS(
    rng,
    state.character,
    libs.characters,
    libs.characterCategories,
    state.characterCat,
  );
  const e = resolveJS(
    rng,
    state.expression,
    libs.expressions,
    libs.expressionCategories,
    state.expressionCat,
  );
  const p = resolveJS(
    rng,
    state.pose,
    libs.poses,
    libs.poseCategories,
    state.poseCat,
  );

  const cW = applyWeightJS(c.text, state.characterStrength);
  const eW = applyWeightJS(e.text, state.expressionStrength);
  const pW = applyWeightJS(p.text, state.poseStrength);

  const parts = [cW, eW, pW].filter(Boolean);
  const final = parts.length ? parts.join(state.delimiter ?? ", ") : "";

  return { c, e, p, cW, eW, pW, final };
}

// ── Live preview HTML ──────────────────────────────────────────────────────

function buildCard(which, res, weight, isRandomChoice) {
  const accent = COLLECTION_ACCENTS[which];
  const label = COLLECTION_LABELS[which];
  const isNone = res.key === "" && res.text === "";
  // Show "(random)" when the user has the RANDOM_* sentinel selected, even
  // if the rolled pick came back as a real name — on Run the pick will
  // differ. Explicit picks show their chosen name.
  const displayKey = isNone ? "(none)" : isRandomChoice ? "(random)" : res.key;
  return `<div class="boss-char-mini ${isNone ? "none" : ""}" style="--accent:${accent.color};--bg:${accent.bg};">
    <div class="h">${label}</div>
    <div class="v">${escapeHtml(displayKey)}</div>
    <div class="w">×${weight.toFixed(2)}</div>
  </div>`;
}

function buildPreviewHTML(state, libs) {
  const isRandom = state.seedMode === "random";
  const isFixed = state.seedMode === "fixed";

  // Always resolve via mulberry32 — explicit picks land as the user chose
  // them, RANDOM_* picks are rolled from the seed (which is meaningless in
  // Random mode but stays stable across re-renders). The "(random picks on
  // Run)" caption only appends when the user is in Random mode AND some
  // collection is still on its RANDOM_* sentinel — that's the only case
  // where the preview can't represent what'll actually happen on Run.
  const runSeed = isFixed ? clampSeed(state.seed) : 0;
  const res = previewComposeJS(state, libs, runSeed);

  let placeholderNote = "";
  if (isRandom) {
    const anyRandom =
      state.character === RANDOM_CHARACTER ||
      state.expression === RANDOM_EXPRESSION ||
      state.pose === RANDOM_POSE;
    if (anyRandom) placeholderNote = " · (random picks on Run)";
  }

  const seedLabel = isFixed ? `seed ${state.seed}` : "random";

  const cards = [
    buildCard(
      "character",
      res.c,
      state.characterStrength,
      state.character === RANDOM_CHARACTER,
    ),
    buildCard(
      "expression",
      res.e,
      state.expressionStrength,
      state.expression === RANDOM_EXPRESSION,
    ),
    buildCard("pose", res.p, state.poseStrength, state.pose === RANDOM_POSE),
  ].join("");

  const outputBlock = res.final
    ? `<span class="arrow">→</span> ${escapeHtml(res.final)}`
    : `<em style="color:#666">(nothing selected — switch to Fixed to preview)</em>`;
  const outputCls = res.final ? "" : "empty";

  return `
    <div class="boss-char-card-title">🧝 ULTIMATE CHARACTER BUILDER PRO BOSS</div>
    <div class="boss-char-cards">${cards}</div>
    <div class="boss-char-meta">delimiter: ${escapeHtml(JSON.stringify(state.delimiter))}${escapeHtml(placeholderNote)}</div>
    <div class="boss-char-output ${outputCls}">${outputBlock}</div>
    <div class="boss-char-meta">${escapeHtml(seedLabel)}</div>
  `;
}

// ── CharEditor ─────────────────────────────────────────────────────────────

class CharEditor {
  constructor(node) {
    this.node = node;
    this.libs = {
      characters: {},
      poses: {},
      expressions: {},
      characterCategories: {},
      poseCategories: {},
      expressionCategories: {},
    };
    this.state = readState(node);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/char_boss/data");
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(
        `HTTP ${r.status} from /char_boss/data: ${body.slice(0, 200)}`,
      );
    }
    const data = await r.json();
    if (!data || !data.characters) {
      throw new Error("/char_boss/data returned an unexpected shape");
    }
    this.libs = {
      characters: data.characters || {},
      poses: data.poses || {},
      expressions: data.expressions || {},
      characterCategories: data.characterCategories || {},
      poseCategories: data.poseCategories || {},
      expressionCategories: data.expressionCategories || {},
    };
  }

  open() {
    return this.fetchData().then(() => this.buildModal());
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const modal = document.createElement("div");
    modal.className = "boss-char-modal";

    // Top bar
    const bar = document.createElement("div");
    bar.className = "boss-char-bar";
    bar.innerHTML = `<div class="boss-char-bar-title">Ultimate Character Builder Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-char-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-char-body";

    // Left controls
    const side = document.createElement("div");
    side.className = "boss-char-side";

    side.appendChild(
      this.buildListSection({
        title: "Character",
        which: "character",
        choiceKey: "character",
        categoryKey: "characterCat",
        strengthKey: "characterStrength",
        data: this.libs.characters,
        cats: this.libs.characterCategories,
        searchVar: "_characterSearch",
        listVar: "_characterListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Character Category",
        stateKey: "characterCat",
        cats: this.libs.characterCategories,
        which: "character",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Character Strength",
        stateKey: "characterStrength",
        which: "character",
      }),
    );

    side.appendChild(
      this.buildListSection({
        title: "Expression",
        which: "expression",
        choiceKey: "expression",
        categoryKey: "expressionCat",
        strengthKey: "expressionStrength",
        data: this.libs.expressions,
        cats: this.libs.expressionCategories,
        searchVar: "_expressionSearch",
        listVar: "_expressionListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Expression Category",
        stateKey: "expressionCat",
        cats: this.libs.expressionCategories,
        which: "expression",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Expression Strength",
        stateKey: "expressionStrength",
        which: "expression",
      }),
    );

    side.appendChild(
      this.buildListSection({
        title: "Pose",
        which: "pose",
        choiceKey: "pose",
        categoryKey: "poseCat",
        strengthKey: "poseStrength",
        data: this.libs.poses,
        cats: this.libs.poseCategories,
        searchVar: "_poseSearch",
        listVar: "_poseListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Pose Category",
        stateKey: "poseCat",
        cats: this.libs.poseCategories,
        which: "pose",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Pose Strength",
        stateKey: "poseStrength",
        which: "pose",
      }),
    );

    side.appendChild(this.buildDelimiterSection());
    side.appendChild(this.buildSeedSection());

    body.appendChild(side);

    // Right preview
    const previewWrap = document.createElement("div");
    previewWrap.className = "boss-char-preview";
    const card = document.createElement("div");
    card.className = "boss-char-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "boss-char-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-char-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-char-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.cardEl = card;

    this.refreshList("character");
    this.refreshList("expression");
    this.refreshList("pose");
    this.refreshPreview();
  }

  // ── List section ──────────────────────────────────────────────────────
  buildListSection({
    title,
    which,
    choiceKey,
    data,
    cats,
    searchVar,
    listVar,
  }) {
    const wrap = document.createElement("div");
    wrap.className = "boss-char-list-wrap";

    const lbl = document.createElement("span");
    lbl.className = "boss-char-section-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-char-input";
    search.placeholder = `Search ${title.toLowerCase()}…`;
    wrap.appendChild(search);

    const list = document.createElement("div");
    list.className = "boss-char-list";
    wrap.appendChild(list);

    this[searchVar] = "";
    this[listVar] = list;

    search.addEventListener("input", (e) => {
      this[searchVar] = e.target.value;
      this.refreshList(which);
    });

    return wrap;
  }

  refreshList(which) {
    // map: which → (data key, cats key, choice key in state, category key in state)
    const libKey =
      which === "character"
        ? "characters"
        : which === "expression"
          ? "expressions"
          : "poses";
    const catsKey =
      which === "character"
        ? "characterCategories"
        : which === "expression"
          ? "expressionCategories"
          : "poseCategories";
    const categoryKey =
      which === "character"
        ? "characterCat"
        : which === "expression"
          ? "expressionCat"
          : "poseCat";
    const choiceKey = which;
    const listVar = "_" + which + "ListEl";
    const searchVar = "_" + which + "Search";
    const el = this[listVar];
    if (!el) return;
    el.innerHTML = "";
    const search = (this[searchVar] || "").toLowerCase();

    const data = this.libs[libKey] || {};
    const cats = this.libs[catsKey] || {};
    const randomSentinel = randomSentinelFor(which);

    const items = [
      { name: randomSentinel, badge: "Random" },
      { name: NONE_SENTINEL, badge: "None" },
    ];

    let names;
    const cat = this.state[categoryKey];
    if (cat === ALL_CATEGORIES || !cat) {
      names = Object.keys(data).sort();
    } else {
      names = ((cats || {})[cat] || []).filter((n) => n in data).sort();
    }
    for (const n of names) {
      if (search && !n.toLowerCase().includes(search)) continue;
      items.push({ name: n, badge: "" });
    }

    for (const it of items) {
      const row = document.createElement("div");
      row.className =
        "boss-char-list-item" +
        (this.state[choiceKey] === it.name ? " selected" : "");
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
        this.state[choiceKey] = it.name;
        this.refreshList(which);
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-char-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = "No matches.";
      el.appendChild(empty);
    }
  }

  // ── Category dropdown ─────────────────────────────────────────────────
  buildCategorySection({ title, stateKey, cats, which }) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-char-section-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const sel = document.createElement("select");
    sel.className = "boss-char-input";
    const opts = [ALL_CATEGORIES, ...Object.keys(cats || {}).sort()];
    for (const c of opts) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      if (c === this.state[stateKey]) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", (e) => {
      this.state[stateKey] = e.target.value;
      this.refreshList(which);
      this.refreshPreview();
    });
    wrap.appendChild(sel);
    return wrap;
  }

  // ── Strength slider + linked number ─────────────────────────────────
  buildStrengthSection({ title, stateKey, which }) {
    const wrap = document.createElement("div");
    const { min, max, default: def } = strengthBoundsFor(which);

    const lbl = document.createElement("span");
    lbl.className = "boss-char-section-label";
    lbl.textContent = `${title}: ${this.state[stateKey].toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-char-strength";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(STRENGTH_STEP);
    slider.value = String(this.state[stateKey]);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-char-input";
    num.min = String(min);
    num.max = String(max);
    num.step = String(STRENGTH_STEP);
    num.value = this.state[stateKey].toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state[stateKey] = clampStrength(v, def, which);
      lbl.textContent = `${title}: ${this.state[stateKey].toFixed(2)}`;
      slider.value = String(this.state[stateKey]);
      num.value = this.state[stateKey].toFixed(2);
      this.refreshPreview();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    return wrap;
  }

  // ── Delimiter ─────────────────────────────────────────────────────────
  buildDelimiterSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-char-section-label";
    lbl.textContent = "Delimiter";
    wrap.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "boss-char-input";
    inp.value = this.state.delimiter;
    inp.addEventListener("change", (e) => {
      this.state.delimiter = e.target.value;
      this.refreshPreview();
    });
    wrap.appendChild(inp);
    return wrap;
  }

  // ── Seed section ─────────────────────────────────────────────────────
  buildSeedSection() {
    const wrap = document.createElement("div");

    const lbl = document.createElement("span");
    lbl.className = "boss-char-section-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-char-seed-num";
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
    pill.className = "boss-char-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-char-seg").forEach((s) => {
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
        "boss-char-seg" + (this.state.seedMode === m ? " active" : "");
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
    newBtn.className = "boss-char-btn";
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
    row.className = "boss-char-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-char-btn";
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
    copyBtn.className = "boss-char-btn is-copy";
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
    this._lastRunEl.className = "boss-char-seed-last";
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

// ── loadGraphData 300 ms guard (same trick as the three siblings) ─────────
let _bossCharLoadingGraph = false;
if (app && app.loadGraphData && !app._bossCharLoadWrapped) {
  app._bossCharLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossCharLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossCharLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.UltimateCharacterBuilder",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "UltimateCharacterBuilderPRO") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossCharHead) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "UltimateCharacterBuilderPRO") return;
    setupCharNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────

function buildCharNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "UltimateCharacterBuilderPRO" ||
        n.type === "UltimateCharacterBuilderPRO"
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

function findCharNode(index, promptId) {
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
      if (!entry || entry.class_type !== "UltimateCharacterBuilderPRO")
        continue;
      if (!index) index = buildCharNodeIndex();
      const node = findCharNode(index, id);
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
    console.warn("[BossUltimateCharBuilder] graphToPrompt inject failed", e);
  }
  return result;
};

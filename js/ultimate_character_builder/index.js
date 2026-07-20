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
import { BossDropdown } from "../boss_theme/index.js";

// ── Constants ──────────────────────────────────────────────────────────────
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
function injectCSS() {
  if (document.getElementById("boss-char-css")) return;
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
    .boss-char-side-custom { width: 320px; }

    /* Per-collection list */
    .boss-char-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-char-list {
      max-height: 130px;
      overflow-y: auto;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
    }
    .boss-char-list-item {
      padding: 6px 12px;
      font-size: 13px;
      color: var(--boss-text);
      cursor: pointer;
      border-bottom: 1px solid var(--boss-border);
      display: flex; align-items: center; gap: 8px;
    }
    .boss-char-list-item:last-child { border-bottom: none; }
    .boss-char-list-item:hover { background: var(--boss-bg-hover); }
    .boss-char-list-item.selected {
      background: var(--boss-bg-active);
      color: var(--boss-text-bright);
      box-shadow: inset 3px 0 0 var(--boss-brand);
    }
    .boss-char-list-item .badge {
      font-size: 10px; color: var(--boss-text-dim); padding: 2px 6px;
      background: var(--boss-border); border-radius: 3px;
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
    .boss-char-strength input[type=range] { flex: 1; accent-color: var(--boss-brand); }
    .boss-char-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Seed pill + buttons */
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

    /* Preview mini-cards + card */
    .boss-card {
      padding: 16px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid var(--boss-border-strong);
      color: #fff;
      max-width: 760px;
      width: 100%;
      box-shadow: 0 0 40px rgba(255, 102, 204, 0.3);
    }
    .boss-card-title {
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
      color: var(--boss-text-muted);
      font-size: 0.8em;
    }
    .boss-char-mini.none .v { color: var(--boss-text-faint); font-style: italic; }
    .boss-char-meta {
      color: var(--boss-text-muted);
      font-size: 0.8em;
      margin-bottom: 8px;
      text-align: center;
    }
    .boss-char-output {
      background: var(--boss-bg-code);
      padding: 12px;
      border-radius: var(--boss-radius-lg);
      font-family: var(--boss-font-mono);
      font-size: 0.95em;
      line-height: 1.6;
      word-break: break-all;
      border: 1px solid var(--boss-border);
      white-space: pre-wrap;
    }
    .boss-char-output .arrow { color: #ff66cc; font-weight: bold; }
    .boss-char-output.empty { color: var(--boss-text-faint); font-style: italic; }

    .boss-char-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--boss-bg-card);
      border: 1px solid var(--boss-border-subtle);
      border-radius: 8px;
      padding: 10px 20px;
      color: var(--boss-text);
      font-size: 13px;
      z-index: 10000;
      animation: boss-char-toast-in 0.2s ease;
      pointer-events: auto;
    }
    .boss-char-toast.success { border-color: var(--boss-success); }
    .boss-char-toast.error { border-color: var(--boss-danger); }
    .boss-char-toast.confirm {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .boss-char-toast .boss-art-crud-btn {
      padding: 4px 10px;
      font-size: 11px;
    }
    @keyframes boss-char-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .boss-char-crud-row {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }
    .boss-char-crud-row .boss-art-crud-btn {
      flex: 1;
      font-size: 10px;
      padding: 4px 6px;
    }
    .boss-char-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
      position: relative;
    }
    .boss-char-item:hover {
      background: var(--boss-bg-hover);
    }
    .boss-char-item .boss-char-thumb {
      width: 36px;
      height: 36px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .boss-char-item .boss-char-thumb-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 4px;
      background: var(--boss-bg-hover);
      flex-shrink: 0;
    }
    .boss-char-item-actions {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      display: none;
      gap: 2px;
    }
    .boss-char-item:hover .boss-char-item-actions {
      display: flex;
    }
    .boss-char-item-actions button {
      background: none;
      border: none;
      color: var(--boss-text-muted);
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .boss-char-item-actions button:hover {
      color: var(--boss-text);
      background: var(--boss-bg-hover);
    }
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
  "control_after_generate",
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

function showToast(message, type = "info", duration = 3000) {
  const existing = document.querySelectorAll(".boss-char-toast");
  existing.forEach((e) => e.remove());
  const toast = document.createElement("div");
  toast.className = `boss-char-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showConfirmToast(message, onYes, onNo) {
  const existing = document.querySelectorAll(".boss-char-toast");
  existing.forEach((e) => e.remove());
  const toast = document.createElement("div");
  toast.className = "boss-char-toast confirm";
  const msg = document.createElement("span");
  msg.textContent = message;
  toast.appendChild(msg);
  const yesBtn = document.createElement("button");
  yesBtn.type = "button";
  yesBtn.className = "boss-art-crud-btn primary";
  yesBtn.textContent = "Yes";
  yesBtn.addEventListener("click", () => { toast.remove(); onYes?.(); });
  toast.appendChild(yesBtn);
  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "boss-art-crud-btn";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", () => { toast.remove(); onNo?.(); });
  toast.appendChild(noBtn);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
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
  const s = root.querySelector(".boss-status");
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
  root.className = "boss-widget";

  const head = document.createElement("div");
  head.className = "boss-widget-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-btn-open";
  openBtn.textContent = "🧝 Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
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
    modal.className = "boss-modal";

    // Top bar
    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">Ultimate Character Builder Pro Editor</div>`;
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
    side.className = "boss-side boss-char-side-custom";

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
    previewWrap.className = "boss-preview";
    const card = document.createElement("div");
    card.className = "boss-card";
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
    lbl.className = "boss-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-input";
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
    const opts = [ALL_CATEGORIES, ...Object.keys(cats || {}).sort()];
    const options = opts.map((c) => ({ value: c, label: c }));

    const dropdown = new BossDropdown({
      label: title,
      options,
      value: this.state[stateKey],
      searchable: opts.length > 6,
      onChange: (value) => {
        this.state[stateKey] = value;
        this.refreshList(which);
        this.refreshPreview();
      },
    });

    return dropdown.element;
  }

  // ── Strength slider + linked number ─────────────────────────────────
  buildStrengthSection({ title, stateKey, which }) {
    const wrap = document.createElement("div");
    const { min, max, default: def } = strengthBoundsFor(which);

    const lbl = document.createElement("span");
    lbl.className = "boss-label";
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
    num.className = "boss-input";
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
    lbl.className = "boss-label";
    lbl.textContent = "Delimiter";
    wrap.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "boss-input";
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
      seg.className =
        "boss-seg" + (this.state.seedMode === m ? " active" : "");
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

  refreshPreview() {
    if (!this.cardEl) return;
    this.cardEl.innerHTML = buildPreviewHTML(this.state, this.libs);
  }

  _buildCrudRow(type, listContainer, searchInput, categoryDropdown, strengthSlider) {
    const row = document.createElement("div");
    row.className = "boss-char-crud-row";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "boss-art-crud-btn primary";
    addBtn.textContent = "+ Add";
    addBtn.addEventListener("click", () => this._openItemModal(type, null));

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "boss-art-crud-btn";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", async () => {
      try {
        await this._refreshData();
        this._rebuildList(type, listContainer, searchInput, categoryDropdown, strengthSlider);
        showToast(`${type} library refreshed`, "success");
      } catch (e) {
        showToast("Refresh failed", "error");
      }
    });

    row.appendChild(addBtn);
    row.appendChild(refreshBtn);
    return row;
  }

  async _refreshData() {
    await fetch("/char_boss/refresh", { method: "POST" });
    const r = await fetch("/char_boss/data?t=" + Date.now());
    const data = await r.json();
    this.libs = data;
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

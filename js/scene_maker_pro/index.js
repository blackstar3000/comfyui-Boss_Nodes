// ╔═══════════════════════════════════════════════════════════════╗
// ║  Scene Maker Pro Boss — DOM widget + editor modal            ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/camera_style_mixer/index.js and the Pixaroma
// "stateful UI" pattern (comfyui-pixaroma/js/seed/index.js):
//   - Python declares a single hidden SceneState STRING input.
//   - JS owns girl + male + scene (each with category + weight) + delimiter
//     + seed(+seedMode) on node.properties.sceneState.
//   - The graphToPrompt wrapper injects the resolved state at execution
//     time, including a fresh per-run seed in Random mode.
//   - All interactive UI (header, Open Editor button, fullscreen
//     editor with live preview) is a DOM widget via addDOMWidget.
//
// This is the three-collection sibling of the two-collection camera mixer:
// same primitives, just one more list-section / category / strength triplet.

import { app } from "/scripts/app.js";

// ── Brand + constants ──────────────────────────────────────────────────────
const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "sceneState";
const HIDDEN_INPUT_NAME = "SceneState";

const RANDOM_SENTINEL = "Random";
const NONE_SENTINEL = "None";
const ALL_CATEGORIES = "All";

const STRENGTH_MIN = 0.0;
const STRENGTH_MAX = 2.5;
const STRENGTH_STEP = 0.05;
const STRENGTH_DEFAULT = 1.0;

const DELIMITER_DEFAULT = ", ";

// Per-collection accent colors for the preview cards (pink / cyan / green).
const COLLECTION_ACCENTS = {
  girl: { color: "#ff0066", bg: "#330011", bgLight: "#1a060d" },
  male: { color: "#00ffff", bg: "#001133", bgLight: "#020b1a" },
  scene: { color: "#00ff88", bg: "#003311", bgLight: "#021a0c" },
};
const COLLECTION_LABELS = { girl: "GIRL", male: "MALE", scene: "SCENE" };

// ── CSS (injected once, idempotent) ────────────────────────────────────────
//
// Same brand palette + primitives as the camera/outfit editor. Renamed to
// `boss-scene-css` so each extension has its own scoped style block.
function injectCSS() {
  if (document.getElementById("boss-scene-css")) return;
  const css = `
    /* On-node body */
    .boss-scn-root {
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
    .boss-scn-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-scn-head .label { color: #999; }
    .boss-scn-head .value { color: #fff; font-weight: 600; }
    .boss-scn-head .value.none { color: #888; font-style: italic; }
    .boss-scn-head .value.random { color: ${BRAND}; }
    .boss-scn-head .sep { color: #555; margin: 0 6px; }
    .boss-scn-open {
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
    .boss-scn-open:hover { background: #7C3AED; }
    .boss-scn-open:active { transform: translateY(1px); }
    .boss-scn-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-scn-status.is-error { color: #ff8080; }

    /* Fullscreen editor modal */
    .boss-scn-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-scn-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-scn-bar-title { font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .boss-scn-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-scn-bar-x:hover { background: #3a3d40; }

    /* Body: left controls | right preview */
    .boss-scn-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }
    .boss-scn-side {
      width: 320px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-scn-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-scn-input {
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
    .boss-scn-input:focus { border-color: ${BRAND}; }

    /* Per-collection list (search + scrollable entries) */
    .boss-scn-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-scn-list {
      max-height: 130px;
      overflow-y: auto;
      background: #131415;
      border: 1px solid #3a3d40;
      border-radius: 6px;
    }
    .boss-scn-list-item {
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      border-bottom: 1px solid #232527;
      display: flex; align-items: center; gap: 8px;
    }
    .boss-scn-list-item:last-child { border-bottom: none; }
    .boss-scn-list-item:hover { background: #1c1e20; }
    .boss-scn-list-item.selected {
      background: rgba(139,92,246,0.18);
      color: #fff;
      box-shadow: inset 3px 0 0 ${BRAND};
    }
    .boss-scn-list-item .badge {
      font-size: 10px; color: #999; padding: 2px 6px;
      background: #232527; border-radius: 3px;
      flex-shrink: 0;
    }
    .boss-scn-list-item .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Strength slider + linked number */
    .boss-scn-strength { display: flex; align-items: center; gap: 10px; }
    .boss-scn-strength input[type=range] { flex: 1; accent-color: ${BRAND}; }
    .boss-scn-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Seed pill + buttons */
    .boss-scn-pill {
      display: flex; gap: 0;
      background: rgba(255,255,255,0.06);
      border-radius: 7px;
      padding: 3px;
    }
    .boss-scn-seg {
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
    .boss-scn-seg:hover:not(.active) { color: rgba(255,255,255,0.85); }
    .boss-scn-seg.active { background: ${BRAND}; color: #fff; font-weight: 500; }
    .boss-scn-seg:focus-visible { outline: 2px solid ${BRAND}; outline-offset: -2px; }

    .boss-scn-btn {
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
    .boss-scn-btn:hover { background: ${BRAND}; border-color: ${BRAND}; color: #fff; }
    .boss-scn-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-scn-btn:disabled:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85);
    }
    .boss-scn-btn.is-flashing,
    .boss-scn-btn.is-flashing:hover {
      background: #3ec371; border-color: #3ec371; color: #fff;
    }
    .boss-scn-seed-row { display: flex; gap: 6px; }
    .boss-scn-seed-row .boss-scn-btn { flex: 1; }
    .boss-scn-seed-row .boss-scn-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-scn-seed-num {
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
    .boss-scn-seed-num:focus { border-color: ${BRAND}; }
    .boss-scn-seed-last {
      font-size: 11px; line-height: 1.5;
      color: rgba(255,255,255,0.55);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Right preview panel — three side-by-side cards + dark monospace final prompt */
    .boss-scn-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-scn-card {
      padding: 16px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid #444;
      font-family: system-ui, sans-serif;
      color: #fff;
      max-width: 760px;
      width: 100%;
      box-shadow: 0 0 40px rgba(82, 78, 184, 0.3);
    }
    .boss-scn-card-title {
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
    .boss-scn-cards {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .boss-scn-mini {
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid var(--accent);
      background: var(--bg);
    }
    .boss-scn-mini .h {
      color: var(--accent);
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .boss-scn-mini .v {
      font-weight: bold;
      font-size: 1em;
      margin: 4px 0;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .boss-scn-mini .w {
      color: #aaa;
      font-size: 0.8em;
    }
    .boss-scn-mini.none .v { color: #666; font-style: italic; }
    .boss-scn-meta {
      color: #888;
      font-size: 0.8em;
      margin-bottom: 8px;
      text-align: center;
    }
    .boss-scn-output {
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
    .boss-scn-output .arrow { color: #ff0066; font-weight: bold; }
    .boss-scn-output.empty { color: #666; font-style: italic; }

    /* Footer with Save/Cancel pinned bottom-left */
    .boss-scn-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-scn-save {
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
    .boss-scn-save:hover { background: #7C3AED; }
    .boss-scn-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-scn-cancel:hover { background: #3a3d40; }
  `;
  const style = document.createElement("style");
  style.id = "boss-scene-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState() {
  return {
    girl: RANDOM_SENTINEL,
    girlCat: ALL_CATEGORIES,
    girlW: 1.3,
    male: NONE_SENTINEL,
    maleCat: ALL_CATEGORIES,
    maleW: 1.2,
    scene: RANDOM_SENTINEL,
    sceneCat: ALL_CATEGORIES,
    sceneW: 1.1,
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
      merged.girlW = clampStrength(merged.girlW, 1.3);
      merged.maleW = clampStrength(merged.maleW, 1.2);
      merged.sceneW = clampStrength(merged.sceneW, 1.1);
      merged.seed = clampSeed(merged.seed);
      if (merged.seedMode !== "random" && merged.seedMode !== "fixed") {
        merged.seedMode = "random";
      }
      if (typeof merged.delimiter !== "string")
        merged.delimiter = DELIMITER_DEFAULT;
      // Keep choice strings intact — unknown keys are gracefully handled
      // in Python (`_resolve` returns "" when key is missing).
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

function clampStrength(s, fallback = 1.0) {
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
  "girl",
  "girl_cat",
  "girl_w",
  "male",
  "male_cat",
  "male_w",
  "scene",
  "scene_cat",
  "scene_w",
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
  if (value === RANDOM_SENTINEL) {
    return { text: `(random — ${category})`, cls: "value random" };
  }
  return { text: value, cls: "value" };
}

function renderHeader(node) {
  const head = node._bossScnHead;
  if (!head) return;
  const state = readState(node);
  const g = shortLabel(state.girl, state.girlCat);
  const m = shortLabel(state.male, state.maleCat);
  const s = shortLabel(state.scene, state.sceneCat);
  head.innerHTML =
    `<span class="label">Girl:</span> <span class="${g.cls}">${escapeHtml(g.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Male:</span> <span class="${m.cls}">${escapeHtml(m.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Scene:</span> <span class="${s.cls}">${escapeHtml(s.text)}</span>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossScnRoot;
  if (!root) return;
  const s = root.querySelector(".boss-scn-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// Mirror values into the (hidden) native widgets so Python reads the same
// numbers at execution time. Called on first paint and on every Save.
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
  setWidget("girl", state.girl);
  setWidget("girl_cat", state.girlCat);
  setWidget("girl_w", clampStrength(state.girlW, 1.3));
  setWidget("male", state.male);
  setWidget("male_cat", state.maleCat);
  setWidget("male_w", clampStrength(state.maleW, 1.2));
  setWidget("scene", state.scene);
  setWidget("scene_cat", state.sceneCat);
  setWidget("scene_w", clampStrength(state.sceneW, 1.1));
  setWidget("seed", clampSeed(state.seed));
  setWidget("delimiter", state.delimiter);
}

function setupSceneNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-scn-root";

  const head = document.createElement("div");
  head.className = "boss-scn-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-scn-open";
  openBtn.textContent = "🎞️ Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-scn-status";
  root.appendChild(status);

  node.addDOMWidget("scene_ui", "boss_scene", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 110,
    margin: 4,
    serialize: false,
  });

  node._bossScnRoot = root;
  node._bossScnHead = head;

  // Seed hidden widgets so Python reads the right values on first Run,
  // before the user has opened the editor.
  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading libraries…");
      const editor = new SceneEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossSceneMakerPro] open editor failed", err);
      setStatus(
        node,
        "Failed to load libraries. Is the backend running?",
        true,
      );
    }
  });

  renderHeader(node);
}

// ── JS-side preview helper (mirrors Python _resolve + _apply_weight + _substitute) ─

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
  if (choice === RANDOM_SENTINEL) {
    let pool;
    if (category === ALL_CATEGORIES || !category) {
      pool = Object.keys(data);
    } else {
      pool = (cats[category] || []).filter((n) => n in data);
    }
    if (!pool.length) return { key: "", text: "" };
    const key = rng.pick(pool);
    return { key, text: data[key] || "" };
  }
  return { key: choice, text: data[choice] || "" };
}

function applyWeightJS(text, strength) {
  if (!text || strength < 0.01) return "";
  const s = Number(strength);
  if (Math.abs(s - 1.0) < 1e-4) return text;
  return `(${text}:${s.toFixed(2)})`;
}

function substituteJS(sceneText, gWeighted, mWeighted) {
  if (!sceneText) return sceneText;
  let out = sceneText;
  if (gWeighted) {
    out = out.split("{girl}").join(gWeighted);
    out = out.split("{girls}").join(`${gWeighted}, ${gWeighted}`);
  }
  if (mWeighted) {
    out = out.split("{male}").join(mWeighted);
    out = out.split("{males}").join(`${mWeighted}, ${mWeighted}`);
  }
  return out;
}

function previewComposeJS(state, libs, seed) {
  const rng = rngFromSeed(seed);

  const g = resolveJS(
    rng,
    state.girl,
    libs.girls,
    libs.girlCategories,
    state.girlCat,
  );
  const m = resolveJS(
    rng,
    state.male,
    libs.males,
    libs.maleCategories,
    state.maleCat,
  );
  const s = resolveJS(
    rng,
    state.scene,
    libs.scenes,
    libs.sceneCategories,
    state.sceneCat,
  );

  const gW = applyWeightJS(g.text, state.girlW);
  const mW = applyWeightJS(m.text, state.maleW);
  const sW = applyWeightJS(s.text, state.sceneW);
  const sSub = substituteJS(sW, gW, mW);

  const parts = [gW, mW, sSub].filter(Boolean);
  const final = parts.length ? parts.join(state.delimiter ?? ", ") : "";

  return { g, m, s, gW, mW, sSub, final };
}

// ── Live preview HTML ──────────────────────────────────────────────────────

function buildCard(which, res, weight, isRandomChoice) {
  const accent = COLLECTION_ACCENTS[which];
  const label = COLLECTION_LABELS[which];
  const isNone = res.key === "" && res.text === "";
  const displayKey = isNone ? "(none)" : isRandomChoice ? "(random)" : res.key;
  return `<div class="boss-scn-mini ${isNone ? "none" : ""}" style="--accent:${accent.color};--bg:${accent.bg};">
    <div class="h">${label}</div>
    <div class="v">${escapeHtml(displayKey)}</div>
    <div class="w">×${weight.toFixed(2)}</div>
  </div>`;
}

function buildPreviewHTML(state, libs) {
  const isRandom = state.seedMode === "random";
  const isFixed = state.seedMode === "fixed";

  // Always resolve — explicit picks land as the user chose them, RANDOM
  // picks are rolled using seed 0 in Random mode (cosmetic only — the
  // "(random picks on Run)" caption tells the user those will change).
  const runSeed = isFixed ? clampSeed(state.seed) : 0;
  const res = previewComposeJS(state, libs, runSeed);

  let placeholderNote = "";
  if (isFixed) {
    // Detect placeholder substitution (only in Fixed — Random rolls a
    // new pick each Run so the user can't rely on a specific value).
    const gW = res.gW,
      mW = res.mW;
    const hadPlaceholder =
      (res.s.text && /\{girl\}|\{girls\}/.test(res.s.text) && !!gW) ||
      (res.s.text && /\{male\}|\{males\}/.test(res.s.text) && !!mW);
    if (hadPlaceholder) placeholderNote = " · placeholders substituted";
  } else {
    const anyRandom =
      state.girl === RANDOM_SENTINEL ||
      state.male === RANDOM_SENTINEL ||
      state.scene === RANDOM_SENTINEL;
    if (anyRandom) placeholderNote = " · (random picks on Run)";
  }

  const seedLabel = isFixed ? `seed ${state.seed}` : "random";

  const cards = [
    buildCard("girl", res.g, state.girlW, state.girl === RANDOM_SENTINEL),
    buildCard("male", res.m, state.maleW, state.male === RANDOM_SENTINEL),
    buildCard("scene", res.s, state.sceneW, state.scene === RANDOM_SENTINEL),
  ].join("");

  const outputBlock = res.final
    ? `<span class="arrow">→</span> ${escapeHtml(res.final)}`
    : `<em style="color:#666">(nothing selected — switch to Fixed to preview)</em>`;
  const outputCls = res.final ? "" : "empty";

  return `
    <div class="boss-scn-card-title">🎞️ SCENE MAKER PRO BOSS</div>
    <div class="boss-scn-cards">${cards}</div>
    <div class="boss-scn-meta">delimiter: ${escapeHtml(JSON.stringify(state.delimiter))}${escapeHtml(placeholderNote)}</div>
    <div class="boss-scn-output ${outputCls}">${outputBlock}</div>
    <div class="boss-scn-meta">${escapeHtml(seedLabel)}</div>
  `;
}

// ── SceneEditor ────────────────────────────────────────────────────────────

class SceneEditor {
  constructor(node) {
    this.node = node;
    this.libs = {
      girls: {},
      males: {},
      scenes: {},
      girlCategories: {},
      maleCategories: {},
      sceneCategories: {},
    };
    this.state = readState(node);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/scene_boss/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.libs = {
      girls: data.girls || {},
      males: data.males || {},
      scenes: data.scenes || {},
      girlCategories: data.girlCategories || {},
      maleCategories: data.maleCategories || {},
      sceneCategories: data.sceneCategories || {},
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
    modal.className = "boss-scn-modal";

    // Top bar
    const bar = document.createElement("div");
    bar.className = "boss-scn-bar";
    bar.innerHTML = `<div class="boss-scn-bar-title">Scene Maker Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-scn-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-scn-body";

    // Left controls
    const side = document.createElement("div");
    side.className = "boss-scn-side";

    side.appendChild(
      this.buildListSection({
        title: "Girl",
        which: "girl",
        stateKey: "girl",
        categoryKey: "girlCat",
        strengthKey: "girlW",
        data: this.libs.girls,
        cats: this.libs.girlCategories,
        searchVar: "_girlSearch",
        listVar: "_girlListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Girl Category",
        stateKey: "girlCat",
        cats: this.libs.girlCategories,
        which: "girl",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Girl Strength",
        stateKey: "girlW",
      }),
    );

    side.appendChild(
      this.buildListSection({
        title: "Male",
        which: "male",
        stateKey: "male",
        categoryKey: "maleCat",
        strengthKey: "maleW",
        data: this.libs.males,
        cats: this.libs.maleCategories,
        searchVar: "_maleSearch",
        listVar: "_maleListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Male Category",
        stateKey: "maleCat",
        cats: this.libs.maleCategories,
        which: "male",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Male Strength",
        stateKey: "maleW",
      }),
    );

    side.appendChild(
      this.buildListSection({
        title: "Scene",
        which: "scene",
        stateKey: "scene",
        categoryKey: "sceneCat",
        strengthKey: "sceneW",
        data: this.libs.scenes,
        cats: this.libs.sceneCategories,
        searchVar: "_sceneSearch",
        listVar: "_sceneListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Scene Category",
        stateKey: "sceneCat",
        cats: this.libs.sceneCategories,
        which: "scene",
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Scene Strength",
        stateKey: "sceneW",
      }),
    );

    side.appendChild(this.buildDelimiterSection());
    side.appendChild(this.buildSeedSection());

    body.appendChild(side);

    // Right preview
    const previewWrap = document.createElement("div");
    previewWrap.className = "boss-scn-preview";
    const card = document.createElement("div");
    card.className = "boss-scn-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "boss-scn-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-scn-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-scn-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.cardEl = card;

    this.refreshList("girl");
    this.refreshList("male");
    this.refreshList("scene");
    this.refreshPreview();
  }

  // ── List section ──────────────────────────────────────────────────────
  buildListSection({
    title,
    which,
    stateKey,
    categoryKey,
    data,
    cats,
    searchVar,
    listVar,
  }) {
    const wrap = document.createElement("div");
    wrap.className = "boss-scn-list-wrap";

    const lbl = document.createElement("span");
    lbl.className = "boss-scn-section-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-scn-input";
    search.placeholder = `Search ${title.toLowerCase()}…`;
    wrap.appendChild(search);

    const list = document.createElement("div");
    list.className = "boss-scn-list";
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
    const data = this.libs[which + "s"] || this.libs[which];
    const cats = this.libs[which + "Categories"];
    const stateKey = which;
    const categoryKey = which + "Cat";
    const searchVar = "_" + which + "Search";
    const listVar = "_" + which + "ListEl";
    const el = this[listVar];
    if (!el) return;
    el.innerHTML = "";
    const search = (this[searchVar] || "").toLowerCase();

    const items = [
      { name: RANDOM_SENTINEL, badge: "Random" },
      { name: NONE_SENTINEL, badge: "None" },
    ];

    let names;
    const cat = this.state[categoryKey];
    if (cat === ALL_CATEGORIES || !cat) {
      names = Object.keys(data || {}).sort();
    } else {
      names = ((cats || {})[cat] || []).filter((n) => n in (data || {})).sort();
    }
    for (const n of names) {
      if (search && !n.toLowerCase().includes(search)) continue;
      items.push({ name: n, badge: "" });
    }

    for (const it of items) {
      const row = document.createElement("div");
      row.className =
        "boss-scn-list-item" +
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
      empty.className = "boss-scn-list-item";
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
    lbl.className = "boss-scn-section-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const sel = document.createElement("select");
    sel.className = "boss-scn-input";
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
  buildStrengthSection({ title, stateKey }) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-scn-section-label";
    lbl.textContent = `${title}: ${this.state[stateKey].toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-scn-strength";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(STRENGTH_MIN);
    slider.max = String(STRENGTH_MAX);
    slider.step = String(STRENGTH_STEP);
    slider.value = String(this.state[stateKey]);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-scn-input";
    num.min = String(STRENGTH_MIN);
    num.max = String(STRENGTH_MAX);
    num.step = String(STRENGTH_STEP);
    num.value = this.state[stateKey].toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state[stateKey] = clampStrength(v, this.state[stateKey]);
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
    lbl.className = "boss-scn-section-label";
    lbl.textContent = "Delimiter";
    wrap.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "boss-scn-input";
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
    lbl.className = "boss-scn-section-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-scn-seed-num";
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
    pill.className = "boss-scn-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-scn-seg").forEach((s) => {
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
        "boss-scn-seg" + (this.state.seedMode === m ? " active" : "");
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
    newBtn.className = "boss-scn-btn";
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
    row.className = "boss-scn-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-scn-btn";
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
    copyBtn.className = "boss-scn-btn is-copy";
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
    this._lastRunEl.className = "boss-scn-seed-last";
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
let _bossScnLoadingGraph = false;
if (app && app.loadGraphData && !app._bossScnLoadWrapped) {
  app._bossScnLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossScnLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossScnLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.SceneMakerPro",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "SceneMakerGOD") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossScnHead) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "SceneMakerGOD") return;
    setupSceneNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────

function buildSceneNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === "SceneMakerGOD" || n.type === "SceneMakerGOD") {
        index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return index;
}

function findSceneNode(index, promptId) {
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
      if (!entry || entry.class_type !== "SceneMakerGOD") continue;
      if (!index) index = buildSceneNodeIndex();
      const node = findSceneNode(index, id);
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
    console.warn("[BossSceneMakerPro] graphToPrompt inject failed", e);
  }
  return result;
};

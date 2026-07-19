// ╔═══════════════════════════════════════════════════════════════╗
// ║  Camera Style Mixer Boss — DOM widget + editor modal        ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/outfit_selector/index.js and the Pixaroma
// "stateful UI" pattern (comfyui-pixaroma/js/seed/index.js):
//   - Python declares a single hidden CameraState STRING input.
//   - JS owns angle + framing + style + categories + strengths + format + delimiter
//     + seed(+seedMode) on node.properties.cameraState.
//   - The graphToPrompt wrapper injects the resolved state at execution
//     time, including a fresh per-run seed in Random mode.
//   - All interactive UI (header, Open Editor button, fullscreen
//     editor with live preview) is a DOM widget via addDOMWidget.
//
// UPDATED: Added Camera Framing as a third independent axis.

import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

// ── Constants ──────────────────────────────────────────────────────────────
const STATE_PROP = "cameraState";
const HIDDEN_INPUT_NAME = "CameraState";

const RANDOM_ANGLE = "__RANDOM_ANGLE__";
const RANDOM_FRAMING = "__RANDOM_FRAMING__";
const RANDOM_STYLE = "__RANDOM_STYLE__";
const NONE_SENTINEL = "__NONE__";
const ALL_CATEGORIES = "All";

const STRENGTH_MIN = 0.0;
const STRENGTH_MAX = 2.0;
const STRENGTH_DEFAULT = 1.0;
const STRENGTH_STEP = 0.05;

const DELIMITER_DEFAULT = ", ";

// ── CSS (injected once, idempotent) ────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-camera-css")) return;
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
    .boss-cam-side-custom { width: 320px; }

    /* Per-collection list */
    .boss-cam-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-cam-list {
      max-height: 160px;
      overflow-y: auto;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
    }
    .boss-cam-list-item {
      padding: 6px 12px;
      font-size: 13px;
      color: var(--boss-text);
      cursor: pointer;
      border-bottom: 1px solid var(--boss-border);
      display: flex; align-items: center; gap: 8px;
    }
    .boss-cam-list-item:last-child { border-bottom: none; }
    .boss-cam-list-item:hover { background: var(--boss-bg-hover); }
    .boss-cam-list-item.selected {
      background: var(--boss-bg-active);
      color: var(--boss-text-bright);
      box-shadow: inset 3px 0 0 var(--boss-brand);
    }
    .boss-cam-list-item .badge {
      font-size: 10px; color: var(--boss-text-dim); padding: 2px 6px;
      background: var(--boss-border); border-radius: 3px;
      flex-shrink: 0;
    }
    .boss-cam-list-item .name { flex: 1; }

    /* Strength slider + linked number */
    .boss-cam-strength { display: flex; align-items: center; gap: 10px; }
    .boss-cam-strength input[type=range] { flex: 1; accent-color: var(--boss-brand); }
    .boss-cam-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Preview mini-cards */
    .boss-cam-cards {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .boss-cam-mini {
      background: var(--boss-bg-section);
      padding: 10px;
      border-radius: 8px;
      border-left: 3px solid var(--accent);
    }
    .boss-cam-mini .h {
      color: var(--accent);
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .boss-cam-mini .v {
      font-weight: bold;
      font-size: 1.05em;
      margin: 4px 0;
      word-break: break-word;
    }
    .boss-cam-mini .w {
      color: var(--boss-text-muted);
      font-size: 0.8em;
    }
    .boss-cam-mini.none .v { color: var(--boss-text-faint); font-style: italic; }
    .boss-cam-meta {
      color: var(--boss-text-muted);
      font-size: 0.8em;
      margin-bottom: 8px;
    }
    .boss-cam-output {
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
    .boss-cam-output .arrow { color: #ff0066; font-weight: bold; }
    .boss-cam-output.empty { color: var(--boss-text-faint); font-style: italic; }

    /* Seed pill + buttons */
    .boss-cam-pill {
      display: flex; gap: 0;
      background: var(--boss-bg-section);
      border-radius: var(--boss-radius-md);
      padding: 3px;
    }
    .boss-cam-seg {
      flex: 1;
      text-align: center;
      padding: 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit; font-size: 12px;
      color: var(--boss-text-muted);
      cursor: pointer; user-select: none; outline: none;
      transition: background 0.08s, color 0.08s;
    }
    .boss-cam-seg:hover:not(.active) { color: var(--boss-text-bright); }
    .boss-cam-seg.active { background: var(--boss-brand); color: #fff; font-weight: 500; }
    .boss-cam-btn {
      box-sizing: border-box;
      padding: 7px 10px;
      border-radius: var(--boss-radius-md);
      background: var(--boss-bg-section);
      border: 1px solid var(--boss-border-strong);
      color: var(--boss-text);
      font-family: inherit; font-size: 12px;
      cursor: pointer; user-select: none;
      text-align: center;
      transition: background 0.08s, border-color 0.08s, color 0.08s;
    }
    .boss-cam-btn:hover { background: var(--boss-brand); border-color: var(--boss-brand); color: #fff; }
    .boss-cam-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-cam-btn:disabled:hover { background: var(--boss-bg-section); border-color: var(--boss-border-strong); color: var(--boss-text); }
    .boss-cam-btn.is-flashing,
    .boss-cam-btn.is-flashing:hover { background: #3ec371; border-color: #3ec371; color: #fff; }
    .boss-cam-seed-row { display: flex; gap: 6px; }
    .boss-cam-seed-row .boss-cam-btn { flex: 1; }
    .boss-cam-seed-row .boss-cam-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-cam-seed-num {
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
    .boss-cam-seed-num:focus { border-color: var(--boss-brand); }
    .boss-cam-seed-last {
      font-size: 11px; line-height: 1.5;
      color: var(--boss-text-muted);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-camera-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState() {
  return {
    cameraAngle: RANDOM_ANGLE,
    angleCategory: ALL_CATEGORIES,
    angleStrength: STRENGTH_DEFAULT,
    cameraFraming: RANDOM_FRAMING,
    framingCategory: ALL_CATEGORIES,
    framingStrength: STRENGTH_DEFAULT,
    artStyle: RANDOM_STYLE,
    styleCategory: ALL_CATEGORIES,
    styleStrength: STRENGTH_DEFAULT,
    weightFormat: "comfyui",
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
      merged.angleStrength = clampStrength(merged.angleStrength);
      merged.framingStrength = clampStrength(merged.framingStrength);
      merged.styleStrength = clampStrength(merged.styleStrength);
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

function clampStrength(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return STRENGTH_DEFAULT;
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
  "camera_angle",
  "angle_category",
  "angle_strength",
  "camera_framing",
  "framing_category",
  "framing_strength",
  "art_style",
  "style_category",
  "style_strength",
  "weight_format",
  "delimiter",
  "seed",
  "control_after_generate",
  "force_refresh",
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

function shortLabel(value, category, sentinel) {
  if (value === NONE_SENTINEL) return { text: "(none)", cls: "value none" };
  if (value === sentinel) {
    return { text: `(random — ${category})`, cls: "value random" };
  }
  return { text: value, cls: "value" };
}

function renderHeader(node) {
  const head = node._bossCamHead;
  if (!head) return;
  const state = readState(node);
  const ang = shortLabel(state.cameraAngle, state.angleCategory, RANDOM_ANGLE);
  const fra = shortLabel(
    state.cameraFraming,
    state.framingCategory,
    RANDOM_FRAMING,
  );
  const sty = shortLabel(state.artStyle, state.styleCategory, RANDOM_STYLE);
  head.innerHTML =
    `<span class="label">Angle:</span> <span class="${ang.cls}">${escapeHtml(ang.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Framing:</span> <span class="${fra.cls}">${escapeHtml(fra.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Style:</span> <span class="${sty.cls}">${escapeHtml(sty.text)}</span>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossCamRoot;
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
  setWidget("camera_angle", state.cameraAngle);
  setWidget("angle_category", state.angleCategory);
  setWidget("angle_strength", clampStrength(state.angleStrength));
  setWidget("camera_framing", state.cameraFraming);
  setWidget("framing_category", state.framingCategory);
  setWidget("framing_strength", clampStrength(state.framingStrength));
  setWidget("art_style", state.artStyle);
  setWidget("style_category", state.styleCategory);
  setWidget("style_strength", clampStrength(state.styleStrength));
  setWidget("weight_format", state.weightFormat);
  setWidget("delimiter", state.delimiter);
  setWidget("seed", clampSeed(state.seed));
}

function setupCameraNode(node) {
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
  openBtn.textContent = "🎬 Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
  root.appendChild(status);

  node.addDOMWidget("camera_ui", "boss_camera", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossCamRoot = root;
  node._bossCamHead = head;

  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library…");
      const editor = new CameraEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossCameraStyleMixer] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });

  renderHeader(node);
}

// ── Weight formatting (mirrors Python _apply_weight exactly) ──────────────

function applyWeight(text, strength, fmt) {
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
  if (fmt === "deemphasis") return `[${text}]`;
  return text;
}

// ── Live preview HTML ──────────────────────────────────────────────────────

function buildPreviewHTML(state, lib) {
  const angKey = state.cameraAngle;
  const fraKey = state.cameraFraming;
  const styKey = state.artStyle;
  const fmt = state.weightFormat;
  const angStr = clampStrength(state.angleStrength);
  const fraStr = clampStrength(state.framingStrength);
  const styStr = clampStrength(state.styleStrength);

  let angText = "";
  if (angKey === NONE_SENTINEL) angText = "";
  else if (angKey === RANDOM_ANGLE) angText = "(random pick on Run)";
  else angText = lib.angles[angKey] || `(missing: ${angKey})`;

  let fraText = "";
  if (fraKey === NONE_SENTINEL) fraText = "";
  else if (fraKey === RANDOM_FRAMING) fraText = "(random pick on Run)";
  else fraText = lib.framings[fraKey] || `(missing: ${fraKey})`;

  let styText = "";
  if (styKey === NONE_SENTINEL) styText = "";
  else if (styKey === RANDOM_STYLE) styText = "(random pick on Run)";
  else styText = lib.styles[styKey] || `(missing: ${styKey})`;

  const angWeighted = applyWeight(angText, angStr, fmt);
  const fraWeighted = applyWeight(fraText, fraStr, fmt);
  const styWeighted = applyWeight(styText, styStr, fmt);

  const parts = [angWeighted, fraWeighted, styWeighted].filter(Boolean);
  const combined = parts.join(state.delimiter);

  const fmtLabel = (
    lib.weightFormats.find((f) => f.key === fmt) || { label: fmt }
  ).label;
  const seedLabel = state.seedMode === "random" ? "random" : String(state.seed);

  const angleCard =
    angKey === NONE_SENTINEL
      ? `<div class="boss-cam-mini none" style="--accent:#88ccff">
         <div class="h">📐 ANGLE</div>
         <div class="v">(none)</div>
         <div class="w">weight: ${angStr.toFixed(2)}</div>
       </div>`
      : `<div class="boss-cam-mini" style="--accent:#88ccff">
         <div class="h">📐 ANGLE</div>
         <div class="v">${escapeHtml(angKey === RANDOM_ANGLE ? "(random)" : angKey)}</div>
         <div class="w">weight: ${angStr.toFixed(2)}</div>
       </div>`;

  const framingCard =
    fraKey === NONE_SENTINEL
      ? `<div class="boss-cam-mini none" style="--accent:#ffaa88">
         <div class="h">📦 FRAMING</div>
         <div class="v">(none)</div>
         <div class="w">weight: ${fraStr.toFixed(2)}</div>
       </div>`
      : `<div class="boss-cam-mini" style="--accent:#ffaa88">
         <div class="h">📦 FRAMING</div>
         <div class="v">${escapeHtml(fraKey === RANDOM_FRAMING ? "(random)" : fraKey)}</div>
         <div class="w">weight: ${fraStr.toFixed(2)}</div>
       </div>`;

  const styleCard =
    styKey === NONE_SENTINEL
      ? `<div class="boss-cam-mini none" style="--accent:#ff88cc">
         <div class="h">🎨 STYLE</div>
         <div class="v">(none)</div>
         <div class="w">weight: ${styStr.toFixed(2)}</div>
       </div>`
      : `<div class="boss-cam-mini" style="--accent:#ff88cc">
         <div class="h">🎨 STYLE</div>
         <div class="v">${escapeHtml(styKey === RANDOM_STYLE ? "(random)" : styKey)}</div>
         <div class="w">weight: ${styStr.toFixed(2)}</div>
       </div>`;

  const outputBlock = combined
    ? `<span class="arrow">→</span> ${escapeHtml(combined)}`
    : `<em style="color:#666">(nothing selected)</em>`;
  const outputCls = combined ? "" : "empty";

  return `
    <div class="boss-cam-card-title">📷 CAMERA STYLE MIXER BOSS</div>
    <div class="boss-cam-cards">
      ${angleCard}
      ${framingCard}
      ${styleCard}
    </div>
    <div class="boss-cam-meta">
      Format: ${escapeHtml(fmtLabel)}
      &nbsp;·&nbsp; Seed: ${escapeHtml(seedLabel)}
    </div>
    <div class="boss-cam-output ${outputCls}">${outputBlock}</div>
  `;
}

// ── CameraEditor ───────────────────────────────────────────────────────────

class CameraEditor {
  constructor(node) {
    this.node = node;
    this.library = {
      angles: {},
      framings: {},
      styles: {},
      angleCategories: {},
      framingCategories: {},
      styleCategories: {},
      weightFormats: [],
    };
    this.state = readState(node);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/camera_boss/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.library = {
      angles: data.angles || {},
      framings: data.framings || {},
      styles: data.styles || {},
      angleCategories: data.angleCategories || {},
      framingCategories: data.framingCategories || {},
      styleCategories: data.styleCategories || {},
      weightFormats: data.weightFormats || [],
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
    bar.innerHTML = `<div class="boss-bar-title">Camera Style Mixer Editor</div>`;
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
    side.className = "boss-side boss-cam-side-custom";

    // ── Angle ──────────────────────────────────────────────────────────
    side.appendChild(
      this.buildListSection({
        title: "Angle",
        sentinel: RANDOM_ANGLE,
        stateKey: "cameraAngle",
        categoryKey: "angleCategory",
        data: this.library.angles,
        categories: this.library.angleCategories,
        searchVar: "_angleSearch",
        listVar: "_angleListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Angle Category",
        stateKey: "angleCategory",
        categories: this.library.angleCategories,
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Angle Strength",
        stateKey: "angleStrength",
      }),
    );

    // ── Framing ──────────────────────────────────────────────────────
    side.appendChild(
      this.buildListSection({
        title: "Framing",
        sentinel: RANDOM_FRAMING,
        stateKey: "cameraFraming",
        categoryKey: "framingCategory",
        data: this.library.framings,
        categories: this.library.framingCategories,
        searchVar: "_framingSearch",
        listVar: "_framingListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Framing Category",
        stateKey: "framingCategory",
        categories: this.library.framingCategories,
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Framing Strength",
        stateKey: "framingStrength",
      }),
    );

    // ── Style ──────────────────────────────────────────────────────────
    side.appendChild(
      this.buildListSection({
        title: "Style",
        sentinel: RANDOM_STYLE,
        stateKey: "artStyle",
        categoryKey: "styleCategory",
        data: this.library.styles,
        categories: this.library.styleCategories,
        searchVar: "_styleSearch",
        listVar: "_styleListEl",
      }),
    );
    side.appendChild(
      this.buildCategorySection({
        title: "Style Category",
        stateKey: "styleCategory",
        categories: this.library.styleCategories,
      }),
    );
    side.appendChild(
      this.buildStrengthSection({
        title: "Style Strength",
        stateKey: "styleStrength",
      }),
    );

    // ── Format, delimiter, seed ──────────────────────────────────────
    side.appendChild(this.buildFormatSection());
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

    this.refreshList("angle");
    this.refreshList("framing");
    this.refreshList("style");
    this.refreshPreview();
  }

  // ── List section ──────────────────────────────────────────────────────
  buildListSection({
    title,
    sentinel,
    stateKey,
    categoryKey,
    data,
    categories,
    searchVar,
    listVar,
  }) {
    const wrap = document.createElement("div");
    wrap.className = "boss-cam-list-wrap";

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
    list.className = "boss-cam-list";
    wrap.appendChild(list);

    this[searchVar] = "";
    this[listVar] = list;
    this[`_${stateKey}Sentinel`] = sentinel;

    search.addEventListener("input", (e) => {
      this[searchVar] = e.target.value;
      this.refreshList(
        title === "Angle" ? "angle" : title === "Framing" ? "framing" : "style",
      );
    });

    return wrap;
  }

  refreshList(which) {
    const isAngle = which === "angle";
    const isFraming = which === "framing";
    const isStyle = which === "style";
    const data = isAngle
      ? this.library.angles
      : isFraming
        ? this.library.framings
        : this.library.styles;
    const cats = isAngle
      ? this.library.angleCategories
      : isFraming
        ? this.library.framingCategories
        : this.library.styleCategories;
    const sentinel = isAngle
      ? RANDOM_ANGLE
      : isFraming
        ? RANDOM_FRAMING
        : RANDOM_STYLE;
    const stateKey = isAngle
      ? "cameraAngle"
      : isFraming
        ? "cameraFraming"
        : "artStyle";
    const categoryKey = isAngle
      ? "angleCategory"
      : isFraming
        ? "framingCategory"
        : "styleCategory";
    const searchVar = isAngle
      ? "_angleSearch"
      : isFraming
        ? "_framingSearch"
        : "_styleSearch";
    const listVar = isAngle
      ? "_angleListEl"
      : isFraming
        ? "_framingListEl"
        : "_styleListEl";
    const el = this[listVar];
    if (!el) return;
    el.innerHTML = "";
    const search = (this[searchVar] || "").toLowerCase();

    const items = [
      { name: sentinel, badge: "Random" },
      { name: NONE_SENTINEL, badge: "None" },
    ];

    let names;
    const cat = this.state[categoryKey];
    if (cat === ALL_CATEGORIES || !cat) {
      names = Object.keys(data).sort();
    } else {
      names = (cats[cat] || []).filter((n) => n in data).sort();
    }
    for (const n of names) {
      if (search && !n.toLowerCase().includes(search)) continue;
      items.push({ name: n, badge: "" });
    }

    for (const it of items) {
      const row = document.createElement("div");
      row.className =
        "boss-cam-list-item" +
        (this.state[stateKey] === it.name ? " selected" : "");
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
        this.state[stateKey] = it.name;
        this.refreshList(which);
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-cam-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = "No matches.";
      el.appendChild(empty);
    }
  }

  // ── Category dropdown ──────────────────────────────────────────────────
  buildCategorySection({ title, stateKey, categories }) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const opts = [ALL_CATEGORIES, ...Object.keys(categories).sort()];
    const dropdown = new BossDropdown({
      options: opts.map((c) => ({ value: c, label: c })),
      value: this.state[stateKey],
      placeholder: `Select ${title.toLowerCase()}…`,
      onChange: (val) => {
        this.state[stateKey] = val;
        const which =
          stateKey === "angleCategory"
            ? "angle"
            : stateKey === "framingCategory"
              ? "framing"
              : "style";
        this.refreshList(which);
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  // ── Strength slider + linked number ───────────────────────────────────
  buildStrengthSection({ title, stateKey }) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = `${title}: ${this.state[stateKey].toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-cam-strength";
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
    num.value = this.state[stateKey].toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state[stateKey] = clampStrength(v);
      lbl.textContent = `${title}: ${this.state[stateKey].toFixed(2)}`;
      slider.value = String(this.state[stateKey]);
      num.value = this.state[stateKey].toFixed(2);
      this.refreshPreview();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    return wrap;
  }

  // ── Weight format dropdown ─────────────────────────────────────────────
  buildFormatSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Weight Format";
    wrap.appendChild(lbl);

    const dropdown = new BossDropdown({
      options: this.library.weightFormats.map((f) => ({
        value: f.key,
        label: f.label,
      })),
      value: this.state.weightFormat,
      placeholder: "Select format…",
      onChange: (val) => {
        this.state.weightFormat = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  // ── Delimiter ──────────────────────────────────────────────────────────
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

  // ── Seed section ────────────────────────────────────────────────────────
  buildSeedSection() {
    const wrap = document.createElement("div");

    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-cam-seed-num";
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

    const pill = document.createElement("div");
    pill.className = "boss-cam-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-cam-seg").forEach((s) => {
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
        "boss-cam-seg" + (this.state.seedMode === m ? " active" : "");
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

    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "boss-cam-btn";
    newBtn.textContent = "New fixed random";
    newBtn.addEventListener("click", () => {
      this.state.seed = rollSeed();
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
    });
    wrap.appendChild(newBtn);

    const row = document.createElement("div");
    row.className = "boss-cam-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-cam-btn";
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
    copyBtn.className = "boss-cam-btn is-copy";
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
    this._lastRunEl.className = "boss-cam-seed-last";
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
    this.cardEl.innerHTML = buildPreviewHTML(this.state, this.library);
  }

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

// ── loadGraphData 300 ms guard ────────────────────────────────────────────
let _bossCamLoadingGraph = false;
if (app && app.loadGraphData && !app._bossCamLoadWrapped) {
  app._bossCamLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossCamLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossCamLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.CameraStyleMixer",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "CameraStyleMixer") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossCamHead) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "CameraStyleMixer") return;
    setupCameraNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────
// Mirrors the outfit selector's graphToPrompt wrapper. In Random mode we
// roll a fresh seed here so Python only ever sees a committed seed value.

function buildCameraNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "CameraStyleMixer" ||
        n.type === "CameraStyleMixer"
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

function findCameraNode(index, promptId) {
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
      if (!entry || entry.class_type !== "CameraStyleMixer") continue;
      if (!index) index = buildCameraNodeIndex();
      const node = findCameraNode(index, id);
      const state = node ? readState(node) : defaultState();
      let runSeed;
      if (state.seedMode === "random") {
        runSeed = rollSeed();
        if (node) node._pixBossLastSeed = runSeed;
      } else {
        runSeed = clampSeed(state.seed);
      }
      entry.inputs = entry.inputs || {};
      // Write to the REAL wire input - mix() reads `seed` directly and
      // never parses CameraState, so this is what actually reaches
      // execution each run. Without this, random mode only changed the
      // (unused) hidden state and kept reusing whatever seed was last
      // synced by the editor's Apply button.
      entry.inputs.seed = runSeed;
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify({
        ...state,
        seed: runSeed,
      });
    }
  } catch (e) {
    console.warn("[BossCameraStyleMixer] graphToPrompt inject failed", e);
  }
  return result;
};

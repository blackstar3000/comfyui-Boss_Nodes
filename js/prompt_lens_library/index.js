// ╔═══════════════════════════════════════════════════════════════╗
// ║  Lens Library Pro Boss — DOM widget + editor modal            ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/camera_style_mixer/index.js and the Pixaroma
// "stateful UI" pattern (comfyui-pixaroma/js/seed/index.js):
//   - Python declares a single hidden LensState STRING input.
//   - JS owns mode + brand + camera + lens + addFocalAperture + seed(+seedMode)
//     on node.properties.lensState.
//   - The graphToPrompt wrapper injects the resolved state at execution
//     time, including a fresh per-run seed in Random mode.
//   - All interactive UI is a DOM widget via addDOMWidget.

import { app } from "/scripts/app.js";

// ── Brand + constants (mirror Python exactly) ──────────────────────────────
const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "lensState";
const HIDDEN_INPUT_NAME = "LensState";

const RANDOM_BRAND = "__RANDOM_BRAND__";

const MODE_KEYS = [
  "manual select",
  "random full setup",
  "random lens only",
  "full phrase",
  "camera + lens",
  "lens only",
];
const MODE_DEFAULT = "manual select";

const MODE_LABELS = {
  "manual select": "Manual select",
  "random full setup": "Random full setup",
  "random lens only": "Random lens only",
  "full phrase": "Full phrase",
  "camera + lens": "Camera + lens",
  "lens only": "Lens only",
};

function isRandomMode(mode) {
  return mode === "random full setup" || mode === "random lens only";
}

// ── CSS (injected once, idempotent) ────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-lens-css")) return;
  const css = `
    .boss-lens-root {
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
    .boss-lens-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-lens-head .label { color: #999; }
    .boss-lens-head .value { color: #fff; font-weight: 600; }
    .boss-lens-head .value.random { color: ${BRAND}; }
    .boss-lens-head .sep { color: #555; margin: 0 6px; }
    .boss-lens-open {
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
    .boss-lens-open:hover { background: #7C3AED; }
    .boss-lens-open:active { transform: translateY(1px); }
    .boss-lens-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-lens-status.is-error { color: #ff8080; }

    .boss-lens-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-lens-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-lens-bar-title {
      font-size: 14px; font-weight: 600;
      letter-spacing: 1px; text-transform: uppercase;
    }
    .boss-lens-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-lens-bar-x:hover { background: #3a3d40; }

    .boss-lens-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }
    .boss-lens-side {
      width: 340px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-lens-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-lens-input {
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
    .boss-lens-input:focus { border-color: ${BRAND}; }
    .boss-lens-input:disabled { opacity: 0.45; cursor: not-allowed; }

    .boss-lens-list-wrap { display: flex; flex-direction: column; gap: 6px; }
    .boss-lens-list-wrap.is-disabled { opacity: 0.45; pointer-events: none; }
    .boss-lens-list {
      max-height: 140px;
      overflow-y: auto;
      background: #131415;
      border: 1px solid #3a3d40;
      border-radius: 6px;
    }
    .boss-lens-list-item {
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      border-bottom: 1px solid #232527;
    }
    .boss-lens-list-item:last-child { border-bottom: none; }
    .boss-lens-list-item:hover { background: #1c1e20; }
    .boss-lens-list-item.selected {
      background: rgba(139,92,246,0.18);
      color: #fff;
      box-shadow: inset 3px 0 0 ${BRAND};
    }

    .boss-lens-toggle {
      display: flex; align-items: center; gap: 10px;
      cursor: pointer; user-select: none;
    }
    .boss-lens-toggle input { accent-color: ${BRAND}; width: 16px; height: 16px; }

    .boss-lens-pill {
      display: flex; gap: 0;
      background: rgba(255,255,255,0.06);
      border-radius: 7px;
      padding: 3px;
    }
    .boss-lens-seg {
      flex: 1;
      text-align: center;
      padding: 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit; font-size: 12px;
      color: rgba(255,255,255,0.55);
      cursor: pointer; user-select: none; outline: none;
    }
    .boss-lens-seg.active { background: ${BRAND}; color: #fff; font-weight: 500; }

    .boss-lens-btn {
      box-sizing: border-box;
      padding: 7px 10px;
      border-radius: 6px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85);
      font-family: inherit; font-size: 12px;
      cursor: pointer; text-align: center;
    }
    .boss-lens-btn:hover { background: ${BRAND}; border-color: ${BRAND}; color: #fff; }
    .boss-lens-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-lens-seed-row { display: flex; gap: 6px; }
    .boss-lens-seed-num {
      width: 100%; box-sizing: border-box;
      height: 36px;
      background: #171819;
      border: 1px solid #3a3d40;
      border-radius: 6px;
      padding: 6px 10px;
      color: #f2f2f2;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 15px;
      text-align: center;
      outline: none;
    }
    .boss-lens-seed-num:focus { border-color: ${BRAND}; }
    .boss-lens-seed-last {
      font-size: 11px; color: rgba(255,255,255,0.55);
      text-align: center;
    }

    .boss-lens-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-lens-card {
      padding: 16px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid #444;
      color: #fff;
      max-width: 760px;
      width: 100%;
      box-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
    }
    .boss-lens-card-title {
      font-size: 1.2em;
      color: #ffd700;
      font-weight: bold;
      text-align: center;
      margin-bottom: 14px;
    }
    .boss-lens-gear {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .boss-lens-mini {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 8px;
      border-left: 3px solid var(--accent, ${BRAND});
    }
    .boss-lens-mini .h {
      color: var(--accent, ${BRAND});
      font-size: 0.85em;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .boss-lens-mini .v {
      font-weight: bold;
      font-size: 0.95em;
      margin: 4px 0;
      word-break: break-word;
    }
    .boss-lens-meta {
      color: #888;
      font-size: 0.8em;
      margin-bottom: 8px;
    }
    .boss-lens-output {
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
    .boss-lens-output .arrow { color: #ff0066; font-weight: bold; }

    .boss-lens-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-lens-save {
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
    .boss-lens-save:hover { background: #7C3AED; }
    .boss-lens-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-lens-cancel:hover { background: #3a3d40; }
  `;
  const style = document.createElement("style");
  style.id = "boss-lens-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState(libDefaults) {
  const d = libDefaults || {};
  return {
    mode: d.mode || MODE_DEFAULT,
    brand: d.brand || "Canon",
    cameraModel: d.cameraModel || "Generic Camera",
    lens: d.lens || "Generic Lens",
    addFocalAperture: d.addFocalAperture !== false,
    seed: 0,
    seedMode: "random",
  };
}

function readState(node, libDefaults) {
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      const merged = { ...defaultState(libDefaults), ...obj };
      merged.seed = clampSeed(merged.seed);
      if (merged.seedMode !== "random" && merged.seedMode !== "fixed") {
        merged.seedMode = "random";
      }
      if (!MODE_KEYS.includes(merged.mode)) merged.mode = MODE_DEFAULT;
      return merged;
    } catch {
      /* fall through */
    }
  }
  return defaultState(libDefaults);
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify(state);
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
  "mode",
  "brand",
  "camera_model",
  "lens",
  "add_focal_aperture",
  "seed",
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

// ── Prompt logic (mirrors Python _parse_focal_aperture + _build_prompt) ────

function outputStyle(mode) {
  if (mode === "random full setup") return "full phrase";
  if (mode === "random lens only") return "lens only";
  return mode;
}

function parseFocalAperture(lens) {
  const focalMatch = lens.match(/(\d+)(?:-|–|\s)?(\d*)mm/i);
  const apertureMatch = lens.match(/f[/\s]?([0-9.]+)/i);

  let focalText = "";
  let apertureText = "";
  let dofText = "";

  if (focalMatch) {
    const start = focalMatch[1];
    const end = focalMatch[2];
    if (end) {
      if (parseInt(end, 10) > parseInt(start, 10)) {
        focalText = `${start}-${end}mm zoom`;
      } else {
        focalText = `${start}mm prime`;
      }
    } else {
      focalText = `${start}mm lens`;
    }
  }

  if (apertureMatch) {
    const ap = parseFloat(apertureMatch[1]);
    if (Number.isFinite(ap)) {
      apertureText = ap < 10 ? `f/${ap.toFixed(1)}` : `f/${Math.round(ap)}`;
      if (ap <= 1.8) dofText = "shallow depth of field, beautiful bokeh";
      else if (ap <= 2.8) dofText = "creamy bokeh, smooth background blur";
      else dofText = "deep depth of field";
    }
  }

  return { focalText, apertureText, dofText };
}

function focalApertureTag(lens, addFocalAperture) {
  const { focalText, apertureText, dofText } = parseFocalAperture(lens);
  const parts = [focalText, apertureText, dofText].filter(Boolean);
  if (parts.length && addFocalAperture) return " " + parts.join(", ");
  return "";
}

function buildPrompt(
  outputStyleKey,
  brand,
  cameraModel,
  lens,
  addFocalAperture,
) {
  const tag = focalApertureTag(lens, addFocalAperture);
  if (outputStyleKey === "full phrase") {
    return (
      `professional photography, shot on ${brand} ${cameraModel} with ` +
      `${lens}${tag}, 8k hdr, sharp focus, cinematic lighting, highly detailed`
    );
  }
  if (outputStyleKey === "camera + lens") {
    return `${brand} ${cameraModel} + ${lens}${tag}`;
  }
  if (outputStyleKey === "lens only") {
    return `${lens}${tag}`;
  }
  return (
    `photographed with ${brand} ${cameraModel}, shot on ${lens}${tag}, ` +
    `professional photo, sharp focus`
  );
}

function resolvePreviewSelections(state, lib) {
  if (isRandomMode(state.mode)) {
    return {
      brand: "(random on Run)",
      cameraModel: "(random on Run)",
      lens: "(random on Run)",
      isRandom: true,
    };
  }
  let brand = state.brand;
  let cameraModel = state.cameraModel;
  let lens = state.lens;

  const brands = lib.brands || [];
  if (!brands.includes(brand) && brands.length) brand = brands[0];

  const models = (lib.modelsByBrand || {})[brand] || [];
  const lenses = (lib.lensesByBrand || {})[brand] || [];
  if (!models.includes(cameraModel) && models.length) cameraModel = models[0];
  if (!lenses.includes(lens) && lenses.length) lens = lenses[0];

  return { brand, cameraModel, lens, isRandom: false };
}

function buildPreviewHTML(state, lib) {
  const style = outputStyle(state.mode);
  const sel = resolvePreviewSelections(state, lib);
  const prompt = sel.isRandom
    ? "(random pick on Run — preview unavailable until queue)"
    : buildPrompt(
        style,
        sel.brand,
        sel.cameraModel,
        sel.lens,
        state.addFocalAperture,
      );

  const seedLabel = state.seedMode === "random" ? "random" : String(state.seed);
  const tagPreview = sel.isRandom
    ? ""
    : focalApertureTag(sel.lens, state.addFocalAperture).trim();

  const gearVal = (v, isRandom) =>
    isRandom
      ? `<span style="color:${BRAND}">${escapeHtml(v)}</span>`
      : escapeHtml(v);

  return `
    <div class="boss-lens-card-title">📸 LENS LIBRARY PRO BOSS</div>
    <div class="boss-lens-gear">
      <div class="boss-lens-mini" style="--accent:#88ccff">
        <div class="h">BRAND</div>
        <div class="v">${gearVal(sel.brand, sel.isRandom)}</div>
      </div>
      <div class="boss-lens-mini" style="--accent:#ffcc88">
        <div class="h">CAMERA</div>
        <div class="v">${gearVal(sel.cameraModel, sel.isRandom)}</div>
      </div>
      <div class="boss-lens-mini" style="--accent:#88ffcc">
        <div class="h">LENS</div>
        <div class="v">${gearVal(sel.lens, sel.isRandom)}</div>
      </div>
    </div>
    <div class="boss-lens-meta">
      Mode: ${escapeHtml(MODE_LABELS[state.mode] || state.mode)}
      &nbsp;·&nbsp; Output: ${escapeHtml(style)}
      &nbsp;·&nbsp; Focal tags: ${state.addFocalAperture ? "on" : "off"}
      ${tagPreview ? ` &nbsp;·&nbsp; Tags: ${escapeHtml(tagPreview)}` : ""}
      &nbsp;·&nbsp; Seed: ${escapeHtml(seedLabel)}
    </div>
    <div class="boss-lens-output">
      <span class="arrow">→</span> ${escapeHtml(prompt)}
    </div>
  `;
}

// ── On-node body ───────────────────────────────────────────────────────────

function renderHeader(node) {
  const head = node._bossLensHead;
  if (!head) return;
  const state = readState(node, node._bossLensDefaults);
  const modeShort = MODE_LABELS[state.mode] || state.mode;
  const brandText = isRandomMode(state.mode) ? "(random)" : state.brand;
  const lensText = isRandomMode(state.mode) ? "(random)" : state.lens;
  head.innerHTML =
    `<span class="label">Mode:</span> <span class="value">${escapeHtml(modeShort)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Brand:</span> <span class="value${isRandomMode(state.mode) ? " random" : ""}">${escapeHtml(brandText)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Lens:</span> <span class="value${isRandomMode(state.mode) ? " random" : ""}">${escapeHtml(lensText)}</span>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossLensRoot;
  if (!root) return;
  const s = root.querySelector(".boss-lens-status");
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
  setWidget("mode", state.mode);
  setWidget("brand", state.brand);
  setWidget("camera_model", state.cameraModel);
  setWidget("lens", state.lens);
  setWidget("add_focal_aperture", state.addFocalAperture);
  // Wire seed: -1 means random-at-run for Python when graphToPrompt hasn't injected yet.
  setWidget("seed", state.seedMode === "random" ? -1 : clampSeed(state.seed));
}

function setupLensNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-lens-root";

  const head = document.createElement("div");
  head.className = "boss-lens-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-lens-open";
  openBtn.textContent = "📸 Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-lens-status";
  root.appendChild(status);

  node.addDOMWidget("lens_ui", "boss_lens", root, {
    getValue: () => readState(node, node._bossLensDefaults),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossLensRoot = root;
  node._bossLensHead = head;

  syncNativeWidgets(node, readState(node, node._bossLensDefaults));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library…");
      const editor = new LensEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossPromptLensLibraryPro] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });

  renderHeader(node);
}

// ── LensEditor ─────────────────────────────────────────────────────────────

class LensEditor {
  constructor(node) {
    this.node = node;
    this.library = {
      brands: [],
      modelsByBrand: {},
      lensesByBrand: {},
      defaults: {},
    };
    this.state = readState(node, node._bossLensDefaults);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/lens_boss/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.library = {
      brands: data.brands || [],
      modelsByBrand: data.modelsByBrand || {},
      lensesByBrand: data.lensesByBrand || {},
      defaults: data.defaults || {},
    };
    this.node._bossLensDefaults = data.defaults || {};
  }

  open() {
    return this.fetchData().then(() => {
      this.ensureValidSelections();
      return this.buildModal();
    });
  }

  ensureValidSelections() {
    const brands = this.library.brands || [];
    if (brands.length && !brands.includes(this.state.brand)) {
      this.state.brand = brands[0];
    }
    this.syncGearToBrand();
  }

  syncGearToBrand() {
    const models = (this.library.modelsByBrand || {})[this.state.brand] || [];
    const lenses = (this.library.lensesByBrand || {})[this.state.brand] || [];
    if (models.length && !models.includes(this.state.cameraModel)) {
      this.state.cameraModel = models[0];
    }
    if (lenses.length && !lenses.includes(this.state.lens)) {
      this.state.lens = lenses[0];
    }
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    const modal = document.createElement("div");
    modal.className = "boss-lens-modal";

    const bar = document.createElement("div");
    bar.className = "boss-lens-bar";
    bar.innerHTML = `<div class="boss-lens-bar-title">Lens Library Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-lens-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-lens-body";

    const side = document.createElement("div");
    side.className = "boss-lens-side";

    side.appendChild(this.buildModeSection());
    this._brandWrap = this.buildListSection(
      "Brand",
      "brand",
      "_brandListEl",
      "_brandSearch",
    );
    side.appendChild(this._brandWrap);
    this._cameraWrap = this.buildListSection(
      "Camera Model",
      "cameraModel",
      "_cameraListEl",
      "_cameraSearch",
    );
    side.appendChild(this._cameraWrap);
    this._lensWrap = this.buildListSection(
      "Lens",
      "lens",
      "_lensListEl",
      "_lensSearch",
    );
    side.appendChild(this._lensWrap);
    side.appendChild(this.buildFocalToggle());
    side.appendChild(this.buildSeedSection());

    body.appendChild(side);

    const previewWrap = document.createElement("div");
    previewWrap.className = "boss-lens-preview";
    const card = document.createElement("div");
    card.className = "boss-lens-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-lens-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-lens-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-lens-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.cardEl = card;

    this.updateGearDisabled();
    this.refreshBrandList();
    this.refreshCameraList();
    this.refreshLensList();
    this.refreshPreview();
  }

  buildModeSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-lens-section-label";
    lbl.textContent = "Mode";
    wrap.appendChild(lbl);

    const sel = document.createElement("select");
    sel.className = "boss-lens-input";
    for (const m of MODE_KEYS) {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = MODE_LABELS[m] || m;
      if (m === this.state.mode) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", (e) => {
      this.state.mode = e.target.value;
      this.updateGearDisabled();
      this.refreshPreview();
    });
    wrap.appendChild(sel);
    return wrap;
  }

  buildListSection(title, stateKey, listVar, searchVar) {
    const wrap = document.createElement("div");
    wrap.className = "boss-lens-list-wrap";

    const lbl = document.createElement("span");
    lbl.className = "boss-lens-section-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const search = document.createElement("input");
    search.type = "text";
    search.className = "boss-lens-input";
    search.placeholder = `Search ${title.toLowerCase()}…`;
    wrap.appendChild(search);

    const list = document.createElement("div");
    list.className = "boss-lens-list";
    wrap.appendChild(list);

    this[searchVar] = "";
    this[listVar] = list;

    search.addEventListener("input", (e) => {
      this[searchVar] = e.target.value;
      if (stateKey === "brand") this.refreshBrandList();
      else if (stateKey === "cameraModel") this.refreshCameraList();
      else this.refreshLensList();
    });

    return wrap;
  }

  updateGearDisabled() {
    const disabled = isRandomMode(this.state.mode);
    for (const el of [this._brandWrap, this._cameraWrap, this._lensWrap]) {
      if (el) el.classList.toggle("is-disabled", disabled);
    }
  }

  refreshBrandList() {
    const el = this._brandListEl;
    if (!el) return;
    el.innerHTML = "";
    const search = (this._brandSearch || "").toLowerCase();
    const brands = this.library.brands || [];
    for (const b of brands) {
      if (search && !b.toLowerCase().includes(search)) continue;
      const row = document.createElement("div");
      row.className =
        "boss-lens-list-item" + (this.state.brand === b ? " selected" : "");
      row.textContent = b;
      row.addEventListener("click", () => {
        this.state.brand = b;
        this.syncGearToBrand();
        this.refreshBrandList();
        this.refreshCameraList();
        this.refreshLensList();
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (!el.childElementCount) {
      const empty = document.createElement("div");
      empty.className = "boss-lens-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = "No matches.";
      el.appendChild(empty);
    }
  }

  refreshCameraList() {
    const el = this._cameraListEl;
    if (!el) return;
    el.innerHTML = "";
    const search = (this._cameraSearch || "").toLowerCase();
    const models = (this.library.modelsByBrand || {})[this.state.brand] || [];
    for (const m of models) {
      if (search && !m.toLowerCase().includes(search)) continue;
      const row = document.createElement("div");
      row.className =
        "boss-lens-list-item" +
        (this.state.cameraModel === m ? " selected" : "");
      row.textContent = m;
      row.addEventListener("click", () => {
        this.state.cameraModel = m;
        this.refreshCameraList();
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (!el.childElementCount) {
      const empty = document.createElement("div");
      empty.className = "boss-lens-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = models.length
        ? "No matches."
        : "No models for this brand.";
      el.appendChild(empty);
    }
  }

  refreshLensList() {
    const el = this._lensListEl;
    if (!el) return;
    el.innerHTML = "";
    const search = (this._lensSearch || "").toLowerCase();
    const lenses = (this.library.lensesByBrand || {})[this.state.brand] || [];
    for (const l of lenses) {
      if (search && !l.toLowerCase().includes(search)) continue;
      const row = document.createElement("div");
      row.className =
        "boss-lens-list-item" + (this.state.lens === l ? " selected" : "");
      row.textContent = l;
      row.addEventListener("click", () => {
        this.state.lens = l;
        this.refreshLensList();
        this.refreshPreview();
      });
      el.appendChild(row);
    }
    if (!el.childElementCount) {
      const empty = document.createElement("div");
      empty.className = "boss-lens-list-item";
      empty.style.color = "#999";
      empty.style.cursor = "default";
      empty.textContent = lenses.length
        ? "No matches."
        : "No lenses for this brand.";
      el.appendChild(empty);
    }
  }

  buildFocalToggle() {
    const wrap = document.createElement("label");
    wrap.className = "boss-lens-toggle";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.checked = this.state.addFocalAperture;
    inp.addEventListener("change", (e) => {
      this.state.addFocalAperture = e.target.checked;
      this.refreshPreview();
    });
    const span = document.createElement("span");
    span.textContent = "Add focal length, f-stop, and bokeh tags";
    wrap.appendChild(inp);
    wrap.appendChild(span);
    return wrap;
  }

  buildSeedSection() {
    const wrap = document.createElement("div");

    const lbl = document.createElement("span");
    lbl.className = "boss-lens-section-label";
    lbl.textContent = "Seed (for random modes)";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-lens-seed-num";
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
    pill.className = "boss-lens-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-lens-seg").forEach((s) => {
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
        "boss-lens-seg" + (this.state.seedMode === m ? " active" : "");
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
    newBtn.className = "boss-lens-btn";
    newBtn.textContent = "New fixed random";
    newBtn.style.marginTop = "6px";
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
    row.className = "boss-lens-seed-row";
    row.style.marginTop = "6px";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-lens-btn";
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
    copyBtn.className = "boss-lens-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = String(clampSeed(this.state.seed));
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    });

    row.appendChild(useLast);
    row.appendChild(copyBtn);
    wrap.appendChild(row);

    this._lastRunEl = document.createElement("div");
    this._lastRunEl.className = "boss-lens-seed-last";
    this._lastRunEl.style.marginTop = "6px";
    wrap.appendChild(this._lastRunEl);
    this.refreshLastRun();
    syncPill();
    return wrap;
  }

  refreshLastRun() {
    if (!this._lastRunEl) return;
    if (this.state.seedMode === "fixed") {
      this._lastRunEl.textContent = "Fixed: same random picks every run";
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

// ── loadGraphData guard ────────────────────────────────────────────────────
if (app && app.loadGraphData && !app._bossLensLoadWrapped) {
  app._bossLensLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() => setTimeout(() => {}, 300));
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.PromptLensLibraryPro",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PromptLensLibraryPro") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossLensHead) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "PromptLensLibraryPro") return;
    setupLensNode(node);
  },
});

// ── graphToPrompt: inject LensState + wire seed at execution time ──────────

function buildLensNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "PromptLensLibraryPro" ||
        n.type === "PromptLensLibraryPro"
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

function findLensNode(index, promptId) {
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
      if (!entry || entry.class_type !== "PromptLensLibraryPro") continue;
      if (!index) index = buildLensNodeIndex();
      const node = findLensNode(index, id);
      const state = node
        ? readState(node, node._bossLensDefaults)
        : defaultState();
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
      entry.inputs.seed = runSeed;
    }
  } catch (e) {
    console.warn("[BossPromptLensLibraryPro] graphToPrompt inject failed", e);
  }
  return result;
};

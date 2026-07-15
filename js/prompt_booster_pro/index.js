// ╔═══════════════════════════════════════════════════════════════╗
// ║  Prompt Booster PRO Boss — DOM widget + editor modal         ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Merge of Quality Booster + Negative Booster into one node.
// Mirrors the camera_style_mixer / outfit_selector pattern:
//   - Python declares a single hidden BoosterState STRING input.
//   - JS owns all editor state on node.properties.boosterState.
//   - graphToPrompt wrapper injects resolved state at execution time.
//   - All interactive UI is a DOM widget via addDOMWidget.

import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

// ── Constants ──────────────────────────────────────────────────────────────
const STATE_PROP = "boosterState";
const HIDDEN_INPUT_NAME = "BoosterState";

const STRENGTH_MIN = 0.5;
const STRENGTH_MAX = 2.0;
const STRENGTH_DEFAULT = 1.0;
const STRENGTH_STEP = 0.05;

// Native widgets to hide (shown via DOM widget instead)
const WIDGETS_TO_HIDE = [
  "enable",
  "positive_level",
  "positive_strength",
  "negative_preset",
  "negative_level",
  "negative_strength",
  "positive_weight_format",
  "negative_weight_format",
  "positive_custom",
  "negative_custom",
];

// ── CSS (injected once) ────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-booster-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */
    .boss-widget-head { display: flex; align-items: center; gap: 10px; }
    .boss-enable-toggle {
      flex-shrink: 0;
      border: 1px solid var(--boss-border);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 0.8em;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      background: transparent;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .boss-enable-toggle.is-on {
      color: #4ade80;
      border-color: #4ade80;
      background: rgba(74, 222, 128, 0.12);
    }
    .boss-enable-toggle.is-off {
      color: #f87171;
      border-color: #f87171;
      background: rgba(248, 113, 113, 0.12);
    }
    .boss-widget-head-info { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .boss-widget-head-info.is-disabled { opacity: 0.4; }
    .boss-widget-head .sep { color: var(--boss-text-faint); margin: 0 6px; }
    .boss-widget-head .value.pos { color: #4ade80; font-weight: 600; }
    .boss-widget-head .value.neg { color: #f87171; font-weight: 600; }

    /* Preview centering */
    .boss-side + .boss-preview {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Strength slider + linked number */
    .boss-boost-strength { display: flex; align-items: center; gap: 10px; }
    .boss-boost-strength input[type=range] { flex: 1; accent-color: var(--boss-brand); }
    .boss-boost-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Section divider */
    .boss-boost-divider {
      border: none;
      border-top: 1px solid var(--boss-border);
      margin: 6px 0;
    }

    /* Preview output blocks */
    .boss-boost-output {
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
    .boss-boost-output .arrow { color: var(--boss-brand); font-weight: bold; }
    .boss-boost-output.empty { color: var(--boss-text-faint); font-style: italic; }
    .boss-boost-output-label {
      font-size: 0.8em;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--boss-text-dim);
      margin-bottom: 6px;
      font-weight: 600;
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-booster-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState() {
  return {
    enable: true,
    positiveLevel: "",
    positiveStrength: STRENGTH_DEFAULT,
    negativePreset: "",
    negativeLevel: "",
    negativeStrength: STRENGTH_DEFAULT,
    positiveWeightFormat: "comfyui",
    negativeWeightFormat: "comfyui",
    positiveCustom: "",
    negativeCustom: "",
  };
}

function readState(node) {
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      const merged = { ...defaultState(), ...obj };
      merged.positiveStrength = clampStrength(merged.positiveStrength);
      merged.negativeStrength = clampStrength(merged.negativeStrength);
      return merged;
    } catch { /* fall through */ }
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

// ── On-node body ───────────────────────────────────────────────────────────

function renderHeader(node) {
  const info = node._bossBoostHeadInfo;
  const btn = node._bossBoostEnableBtn;
  if (!info && !btn) return;
  const state = readState(node);
  const on = state.enable !== false;

  if (btn) {
    btn.textContent = on ? "⚡ ON" : "⛔ OFF";
    btn.classList.toggle("is-on", on);
    btn.classList.toggle("is-off", !on);
  }

  if (info) {
    const posLabel = state.positiveCustom?.trim()
      ? "(custom)"
      : state.positiveLevel || "(none)";
    const negLabel = state.negativeCustom?.trim()
      ? state.negativeCustom.trim().slice(0, 20) + (state.negativeCustom.trim().length > 20 ? "..." : "")
      : state.negativeLevel || "(none)";
    info.innerHTML =
      `<span class="label">Pos:</span> <span class="value pos">${escapeHtml(posLabel)}</span>` +
      `<span class="sep">·</span>` +
      `<span class="label">Neg:</span> <span class="value neg">${escapeHtml(negLabel)}</span>`;
    info.classList.toggle("is-disabled", !on);
  }
}

function setStatus(node, text, isError = false) {
  const root = node._bossBoostRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

function setupBoosterNode(node) {
  // Hide all native widgets
  for (const name of WIDGETS_TO_HIDE) {
    hideCanvasWidget(node.widgets, name);
  }
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);

  const root = document.createElement("div");
  root.className = "boss-widget";

  const head = document.createElement("div");
  head.className = "boss-widget-head";
  root.appendChild(head);

  const enableBtn = document.createElement("button");
  enableBtn.type = "button";
  enableBtn.className = "boss-enable-toggle";
  enableBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const state = readState(node);
    state.enable = state.enable === false; // flip, defaulting true -> false, false -> true
    writeState(node, state);
    renderHeader(node);
    node.setDirtyCanvas?.(true, true);
  });
  head.appendChild(enableBtn);

  const headInfo = document.createElement("span");
  headInfo.className = "boss-widget-head-info";
  head.appendChild(headInfo);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-btn-open";
  openBtn.textContent = "⚡ Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
  root.appendChild(status);

  node.addDOMWidget("booster_ui", "boss_booster", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossBoostRoot = root;
  node._bossBoostHeadInfo = headInfo;
  node._bossBoostEnableBtn = enableBtn;

  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library...");
      const editor = new BoosterEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossPromptBoosterPro] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });
}

// ── Weight formatting (mirrors Python apply_weight exactly) ─────────────────

function applyWeight(text, strength, fmt) {
  if (!text || strength < 0.01) return "";
  const s = Number(strength);
  if (fmt === "none") return text;
  if (fmt === "comfyui") {
    return Math.abs(s - 1.0) < 1e-4 ? text : `(${text}:${s.toFixed(2)})`;
  }
  if (fmt === "parentheses") {
    if (Math.abs(s - 1.0) < 1e-4) return text;
    const layers = Math.max(1, Math.min(5, Math.round(Math.abs(s - 1.0) / 0.1)));
    if (s > 1.0) return "(".repeat(layers) + text + ")".repeat(layers);
    return "[".repeat(layers) + text + "]".repeat(layers);
  }
  if (fmt === "multiply") return `${text} * ${s.toFixed(2)}`;
  if (fmt === "break") return Math.abs(s - 1.0) < 1e-4 ? `${text} BREAK` : `(${text}:${s.toFixed(2)}) BREAK`;
  return text;
}

// ── Live preview HTML ──────────────────────────────────────────────────────

function buildPreviewHTML(state, lib) {
  const posLevel = state.positiveLevel;
  const negPreset = state.negativePreset;
  const negLevel = state.negativeLevel;
  // Positive and negative each carry their own independent weight format.
  const posFmt = state.positiveWeightFormat || "comfyui";
  const negFmt = state.negativeWeightFormat || "comfyui";

  let posText = "";
  if (state.positiveCustom?.trim()) {
    posText = state.positiveCustom.trim();
  } else if (posLevel && lib.quality[posLevel]) {
    posText = lib.quality[posLevel];
  }

  let negText = "";
  if (state.negativeCustom?.trim()) {
    negText = state.negativeCustom.trim();
  } else if (negPreset && negLevel && lib.negatives[negPreset] && lib.negatives[negPreset][negLevel]) {
    negText = lib.negatives[negPreset][negLevel];
  }

  const posWeighted = applyWeight(posText, state.positiveStrength, posFmt);
  const negWeighted = applyWeight(negText, state.negativeStrength, negFmt);

  const posBlock = posWeighted
    ? `<span class="arrow">→</span> ${escapeHtml(posWeighted)}`
    : `<em style="color:#666">(no positive text)</em>`;
  const negBlock = negWeighted
    ? `<span class="arrow">→</span> ${escapeHtml(negWeighted)}`
    : `<em style="color:#666">(no negative text)</em>`;

  const allFormats = [...lib.positiveFormats, ...lib.weightFormats];
  const posFmtObj = allFormats.find((f) => f.key === posFmt) || { label: posFmt };
  const negFmtObj = lib.weightFormats.find((f) => f.key === negFmt) || { label: negFmt };

  return `
    <div class="boss-boost-output-label">Positive Output</div>
    <div class="boss-boost-output ${posWeighted ? '' : 'empty'}">${posBlock}</div>
    <div style="margin-bottom:12px; font-size:0.75em; color:var(--boss-text-muted); text-align:center;">
      Format: ${escapeHtml(posFmtObj.label)}
    </div>
    <div class="boss-boost-output-label">Negative Output</div>
    <div class="boss-boost-output ${negWeighted ? '' : 'empty'}">${negBlock}</div>
    <div style="margin-top:4px; font-size:0.75em; color:var(--boss-text-muted); text-align:center;">
      Format: ${escapeHtml(negFmtObj.label)}
    </div>
  `;
}

// ── BoosterEditor ──────────────────────────────────────────────────────────

class BoosterEditor {
  constructor(node) {
    this.node = node;
    this.library = {
      quality: {},
      negatives: {},
      qualityLevels: [],
      negativePresets: [],
      negativeLevelsUnion: [],
      positiveDefault: { level: "" },
      negativeDefault: { preset: "", level: "" },
      positiveFormats: [],
      weightFormats: [],
      weightFormatDefault: "comfyui",
      strengthRange: { min: STRENGTH_MIN, max: STRENGTH_MAX, step: STRENGTH_STEP, default: STRENGTH_DEFAULT },
    };
    this.state = readState(node);
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/prompt_booster_pro/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const weightFormats = data.weightFormats || [];
    // Defensive: positive should always include everything negative has
    // plus BREAK. If the backend ever sends an empty/missing list (stale
    // server process, older payload shape, etc.) fall back instead of
    // rendering a dropdown with zero options.
    const positiveFormats =
      Array.isArray(data.positiveFormats) && data.positiveFormats.length
        ? data.positiveFormats
        : [...weightFormats, { key: "break", label: "BREAK" }];
    this.library = {
      quality: data.quality || {},
      negatives: data.negatives || {},
      qualityLevels: data.qualityLevels || [],
      negativePresets: data.negativePresets || [],
      negativeLevelsUnion: data.negativeLevelsUnion || [],
      positiveDefault: data.positiveDefault || { level: "" },
      negativeDefault: data.negativeDefault || { preset: "", level: "" },
      positiveFormats,
      weightFormats,
      weightFormatDefault: data.weightFormatDefault || "comfyui",
      strengthRange: data.strengthRange || { min: STRENGTH_MIN, max: STRENGTH_MAX, step: STRENGTH_STEP, default: STRENGTH_DEFAULT },
    };
  }

  open() {
    return this.fetchData().then(() => {
      this._initDefaultsFromLibrary();
      this.buildModal();
    });
  }

  _initDefaultsFromLibrary() {
    // Initialize empty state values from library defaults so preview works immediately
    if (!this.state.positiveLevel && this.library.positiveDefault.level) {
      this.state.positiveLevel = this.library.positiveDefault.level;
    }
    if (!this.state.negativePreset && this.library.negativeDefault.preset) {
      this.state.negativePreset = this.library.negativeDefault.preset;
    }
    if (!this.state.negativeLevel && this.library.negativeDefault.level) {
      this.state.negativeLevel = this.library.negativeDefault.level;
    }
    if (!this.state.positiveWeightFormat) {
      this.state.positiveWeightFormat = this.library.weightFormatDefault || "comfyui";
    }
    if (!this.state.negativeWeightFormat) {
      this.state.negativeWeightFormat = this.library.weightFormatDefault || "comfyui";
    }
    // If the stored level doesn't exist in the current preset, pick the first one
    if (this.state.negativePreset && this.library.negatives[this.state.negativePreset]) {
      const levels = Object.keys(this.library.negatives[this.state.negativePreset]);
      if (levels.length > 0 && !levels.includes(this.state.negativeLevel)) {
        this.state.negativeLevel = levels[0];
      }
    }
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
    bar.innerHTML = `<div class="boss-bar-title">Prompt Booster PRO Editor</div>`;
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
    side.className = "boss-side";

    // ── Positive Section ──────────────────────────────────────────────
    const posLabel = document.createElement("span");
    posLabel.className = "boss-label-accent";
    posLabel.textContent = "✨ Positive";
    side.appendChild(posLabel);

    side.appendChild(this.buildPositiveLevelSection());
    side.appendChild(this.buildStrengthSection("Positive Strength", "positiveStrength"));
    side.appendChild(this.buildFormatSection("Positive Weight Format", "positiveWeightFormat", this.library.positiveFormats, false));

    const posCustom = document.createElement("div");
    const posCustomLabel = document.createElement("span");
    posCustomLabel.className = "boss-label";
    posCustomLabel.textContent = "Custom Override";
    posCustom.appendChild(posCustomLabel);
    const posCustomTA = document.createElement("textarea");
    posCustomTA.className = "boss-textarea";
    posCustomTA.placeholder = "Override with your own positive prompt...";
    posCustomTA.value = this.state.positiveCustom || "";
    posCustomTA.rows = 3;
    posCustomTA.addEventListener("input", (e) => {
      this.state.positiveCustom = e.target.value;
      this.refreshPreview();
    });
    posCustom.appendChild(posCustomTA);
    side.appendChild(posCustom);

    // ── Divider ───────────────────────────────────────────────────────
    const hr = document.createElement("hr");
    hr.className = "boss-boost-divider";
    side.appendChild(hr);

    // ── Negative Section ──────────────────────────────────────────────
    const negLabel = document.createElement("span");
    negLabel.className = "boss-label-accent";
    negLabel.textContent = "🛡️ Negative";
    side.appendChild(negLabel);

    side.appendChild(this.buildNegativePresetSection());
    side.appendChild(this.buildNegativeLevelSection());
    side.appendChild(this.buildStrengthSection("Negative Strength", "negativeStrength"));
    side.appendChild(this.buildFormatSection("Negative Weight Format", "negativeWeightFormat", this.library.weightFormats, false));

    const negCustom = document.createElement("div");
    const negCustomLabel = document.createElement("span");
    negCustomLabel.className = "boss-label";
    negCustomLabel.textContent = "Extra Negatives";
    negCustom.appendChild(negCustomLabel);
    const negCustomTA = document.createElement("textarea");
    negCustomTA.className = "boss-textarea";
    negCustomTA.placeholder = "Extra negatives appended after preset/level...";
    negCustomTA.value = this.state.negativeCustom || "";
    negCustomTA.rows = 3;
    negCustomTA.addEventListener("input", (e) => {
      this.state.negativeCustom = e.target.value;
      this.refreshPreview();
    });
    negCustom.appendChild(negCustomTA);
    side.appendChild(negCustom);

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

    this.refreshPreview();
  }

  // ── Positive level dropdown ──────────────────────────────────────────────
  buildPositiveLevelSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Quality Level";
    wrap.appendChild(lbl);

    const opts = this.library.qualityLevels.map((l) => ({ value: l, label: l }));
    const dropdown = new BossDropdown({
      options: opts,
      value: this.state.positiveLevel,
      placeholder: "Select quality level...",
      onChange: (val) => {
        this.state.positiveLevel = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  // ── Negative preset dropdown ─────────────────────────────────────────────
  buildNegativePresetSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Preset";
    wrap.appendChild(lbl);

    const opts = this.library.negativePresets.map((p) => ({ value: p, label: p }));
    const dropdown = new BossDropdown({
      options: opts,
      value: this.state.negativePreset,
      placeholder: "Select preset...",
      onChange: (val) => {
        this.state.negativePreset = val;
        this._refreshNegativeLevelOptions();
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    this._negPresetDropdown = dropdown;
    return wrap;
  }

  // ── Negative level dropdown ──────────────────────────────────────────────
  buildNegativeLevelSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Level";
    wrap.appendChild(lbl);

    const levels = this._getLevelsForPreset(this.state.negativePreset);
    const opts = levels.map((l) => ({ value: l, label: l }));
    const dropdown = new BossDropdown({
      options: opts,
      value: this.state.negativeLevel,
      placeholder: "Select level...",
      onChange: (val) => {
        this.state.negativeLevel = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    this._negLevelDropdown = dropdown;
    return wrap;
  }

  _getLevelsForPreset(preset) {
    const negData = this.library.negatives;
    if (negData[preset]) {
      return Object.keys(negData[preset]).sort();
    }
    return [];
  }

  _refreshNegativeLevelOptions() {
    if (!this._negLevelDropdown) return;
    const levels = this._getLevelsForPreset(this.state.negativePreset);
    const opts = levels.map((l) => ({ value: l, label: l }));
    this._negLevelDropdown.setOptions(opts);
    if (levels.length > 0 && !levels.includes(this.state.negativeLevel)) {
      this.state.negativeLevel = levels[0];
      this._negLevelDropdown.setValue(levels[0]);
    }
  }

  // ── Strength slider + linked number ──────────────────────────────────────
  buildStrengthSection(title, stateKey) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = `${title}: ${this.state[stateKey].toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-boost-strength";
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

  // ── Weight format dropdown (generic) ─────────────────────────────────────
  buildFormatSection(title, stateKey, formats, isOptional) {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = title;
    wrap.appendChild(lbl);

    const opts = isOptional
      ? [{ value: "", label: "(use default)" }, ...formats.map((f) => ({ value: f.key, label: f.label }))]
      : formats.map((f) => ({ value: f.key, label: f.label }));
    const dropdown = new BossDropdown({
      options: opts,
      value: this.state[stateKey] || "",
      placeholder: "Select format...",
      onChange: (val) => {
        this.state[stateKey] = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  refreshPreview() {
    if (!this.cardEl) return;
    this.cardEl.innerHTML = buildPreviewHTML(this.state, this.library);
  }

  save() {
    writeState(this.node, this.state);
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
let _bossBoostLoadingGraph = false;
if (app && app.loadGraphData && !app._bossBoostLoadWrapped) {
  app._bossBoostLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossBoostLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossBoostLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.PromptBoosterPro",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PromptBoosterPRO") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossBoostHeadInfo) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "PromptBoosterPRO") return;
    setupBoosterNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────

function buildBoosterNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === "PromptBoosterPRO" || n.type === "PromptBoosterPRO") {
        index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return index;
}

function findBoosterNode(index, promptId) {
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
      if (!entry || entry.class_type !== "PromptBoosterPRO") continue;
      if (!index) index = buildBoosterNodeIndex();
      const node = findBoosterNode(index, id);
      const state = node ? readState(node) : defaultState();
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[BossPromptBoosterPro] graphToPrompt inject failed", e);
  }
  return result;
};

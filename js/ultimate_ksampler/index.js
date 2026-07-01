// Ultimate KSampler Pro - DOM widget + editor modal
// Mirrors the Prompt Master Library Pro style with a rich preview card.

import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "ksamplerState";
const HIDDEN_INPUT_NAME = "KSamplerState";

const BUILTIN_PRESETS = [
  "Fast",
  "Balanced",
  "High Quality",
  "Anime",
  "Anime V2",
  "Cinematic",
  "Experimental",
];
const CFG_PRESETS = [
  "None",
  "Low Creativity",
  "Creative",
  "Balanced",
  "Strong Prompt",
  "Very Strong",
];
const SAMPLERS = [
  "euler",
  "euler_ancestral",
  "heun",
  "heunpp2",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpm_fast",
  "dpm_adaptive",
  "dpmpp_2s_ancestral",
  "dpmpp_sde",
  "dpmpp_sde_gpu",
  "dpmpp_2m",
  "dpmpp_2m_sde",
  "dpmpp_2m_sde_gpu",
  "dpmpp_3m_sde",
  "dpmpp_3m_sde_gpu",
  "ddpm",
  "lcm",
  "ddim",
  "uni_pc",
  "uni_pc_bh2",
];
const SCHEDULERS = [
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "simple",
  "ddim_uniform",
];

const VISIBLE_NATIVE_WIDGETS = [
  "preset",
  "cfg_preset",
  "steps",
  "cfg",
  "sampler_name",
  "scheduler",
  "denoise",
  "seed",
  "override_preset",
  "save_as_favorite",
  "favorite_name",
];

// ── CSS (injected once) ──────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-ksampler-css")) return;
  const css = `
    .boss-ks-root {
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
    .boss-ks-head {
      display: flex;
      flex-direction: column;
      gap: 3px;
      line-height: 1.45;
      min-height: 36px;
    }
    .boss-ks-head .label { color: #999; }
    .boss-ks-head .value { color: #fff; font-weight: 600; }
    .boss-ks-head .value.override { color: ${BRAND}; }
    .boss-ks-open {
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
    .boss-ks-open:hover { background: #7C3AED; }
    .boss-ks-open:active { transform: translateY(1px); }
    .boss-ks-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-ks-status.is-error { color: #ff8080; }

    .boss-ks-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-ks-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-ks-bar-title {
      font-size: 14px; font-weight: 600; letter-spacing: 1px;
      text-transform: uppercase;
    }
    .boss-ks-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-ks-bar-x:hover { background: #3a3d40; }
    .boss-ks-body {
      flex: 1; display: flex; overflow: hidden; min-height: 0;
    }
    .boss-ks-side {
      width: 340px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 20px;
      display: flex; flex-direction: column; gap: 16px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-ks-workspace {
      flex: 1; overflow: hidden;
      padding: 24px;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-ks-card {
      padding: 20px;
      background: #2a2a2a00;
      border-radius: 12px;
      border: 1px solid #444;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 0 40px rgba(82, 78, 184, 0.3);
      color: #fff;
    }
    .boss-ks-card-title {
      font-size: 1.4em;
      font-weight: bold;
      text-align: center;
      margin-bottom: 16px;
      letter-spacing: 1px;
      background: linear-gradient(#ffd700, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .boss-ks-settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .boss-ks-setting {
      display: flex;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.04);
    }
    .boss-ks-setting .label {
      color: #999;
      font-weight: 500;
    }
    .boss-ks-setting .value {
      color: #fff;
      font-weight: 600;
      font-family: ui-monospace, monospace;
      font-size: 0.95em;
    }
    .boss-ks-setting .value.override { color: ${BRAND}; }
    .boss-ks-fav-summary {
      background: rgba(139,92,246,0.12);
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 3px solid ${BRAND};
      font-size: 13px;
      color: #ddd;
      text-align: center;
    }
    .boss-ks-fav-summary strong { color: ${BRAND}; }

    /* Reuse existing left-panel styles from earlier */
    .boss-ks-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-ks-input, .boss-ks-select {
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
    .boss-ks-input:focus, .boss-ks-select:focus { border-color: ${BRAND}; }
    .boss-ks-row { display: flex; align-items: center; gap: 10px; }
    .boss-ks-row .boss-ks-input { flex: 1; }
    .boss-ks-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: #ddd;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-ks-check input { width: 16px; height: 16px; accent-color: ${BRAND}; }
    .boss-ks-button {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .boss-ks-button:hover { background: #7C3AED; }
    .boss-ks-button.danger { background: #e53e3e; }
    .boss-ks-button.danger:hover { background: #c53030; }
    .boss-ks-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-ks-save {
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
    .boss-ks-save:hover { background: #7C3AED; }
    .boss-ks-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-ks-cancel:hover { background: #3a3d40; }
  `;
  const style = document.createElement("style");
  style.id = "boss-ksampler-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── Helpers ──────────────────────────────────────────────────────────

function widgetValue(node, name, fallback) {
  const w = (node.widgets || []).find((x) => x.name === name);
  return w ? w.value : fallback;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function defaultStateFromWidgets(node) {
  return {
    preset: widgetValue(node, "preset", "Balanced"),
    cfg_preset: widgetValue(node, "cfg_preset", "None"),
    steps: clamp(parseInt(widgetValue(node, "steps", 28) || 28), 1, 10000),
    cfg: parseFloat(widgetValue(node, "cfg", 7.5) || 7.5),
    sampler_name: widgetValue(node, "sampler_name", "dpmpp_2m"),
    scheduler: widgetValue(node, "scheduler", "karras"),
    denoise: parseFloat(widgetValue(node, "denoise", 1.0) || 1.0),
    seed: parseInt(widgetValue(node, "seed", 0) || 0),
    override_preset: !!widgetValue(node, "override_preset", false),
    save_as_favorite: false,
    favorite_name: "",
  };
}

function readState(node) {
  const base = defaultStateFromWidgets(node);
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") {
        const merged = { ...base, ...obj };
        merged.steps = clamp(parseInt(merged.steps) || base.steps, 1, 10000);
        merged.cfg = parseFloat(merged.cfg) || base.cfg;
        merged.denoise = parseFloat(merged.denoise) || base.denoise;
        merged.seed = parseInt(merged.seed) || 0;
        if (
          !BUILTIN_PRESETS.includes(merged.preset) &&
          !merged.preset.startsWith("---")
        ) {
          // could be a favorite; keep it
        }
        if (!CFG_PRESETS.includes(merged.cfg_preset))
          merged.cfg_preset = base.cfg_preset;
        if (!SAMPLERS.includes(merged.sampler_name))
          merged.sampler_name = base.sampler_name;
        if (!SCHEDULERS.includes(merged.scheduler))
          merged.scheduler = base.scheduler;
        return merged;
      }
    } catch {
      /* ignore */
    }
  }
  return base;
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify({
    preset: state.preset,
    cfg_preset: state.cfg_preset,
    steps: state.steps,
    cfg: state.cfg,
    sampler_name: state.sampler_name,
    scheduler: state.scheduler,
    denoise: state.denoise,
    seed: state.seed,
    override_preset: !!state.override_preset,
    save_as_favorite: !!state.save_as_favorite,
    favorite_name: state.favorite_name || "",
  });
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
        /* detached */
      }
    }
  }
}

function syncNativeWidgets(node, state) {
  setWidgetValue(node, "preset", state.preset);
  setWidgetValue(node, "cfg_preset", state.cfg_preset);
  setWidgetValue(node, "steps", state.steps);
  setWidgetValue(node, "cfg", state.cfg);
  setWidgetValue(node, "sampler_name", state.sampler_name);
  setWidgetValue(node, "scheduler", state.scheduler);
  setWidgetValue(node, "denoise", state.denoise);
  setWidgetValue(node, "seed", state.seed);
  setWidgetValue(node, "override_preset", !!state.override_preset);
  setWidgetValue(node, "save_as_favorite", !!state.save_as_favorite);
  setWidgetValue(node, "favorite_name", state.favorite_name || "");
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
  const head = node._bossKsHead;
  if (!head) return;
  const state = readState(node);
  const presetDisplay = state.preset.startsWith("---")
    ? "Balanced"
    : state.preset;
  const overrideText = state.override_preset ? " (manual)" : "";
  head.innerHTML = `
    <div>
      <span class="label">Preset:</span>
      <span class="value${state.override_preset ? " override" : ""}">${escapeHtml(presetDisplay)}${overrideText}</span>
      <span class="label" style="margin-left:12px;">Steps:</span>
      <span class="value">${state.steps}</span>
      <span class="label" style="margin-left:12px;">CFG:</span>
      <span class="value">${state.cfg}</span>
    </div>
    <div>
      <span class="label">Sampler:</span>
      <span class="value">${escapeHtml(state.sampler_name)}</span>
      <span class="label" style="margin-left:12px;">Scheduler:</span>
      <span class="value">${escapeHtml(state.scheduler)}</span>
      <span class="label" style="margin-left:12px;">Seed:</span>
      <span class="value">${state.seed || "random"}</span>
    </div>
  `;
}

function setStatus(node, text, isError = false) {
  const root = node._bossKsRoot;
  if (!root) return;
  const s = root.querySelector(".boss-ks-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// ── Build preview HTML ──────────────────────────────────────────────

function buildPreviewHTML(state) {
  const presetDisplay = state.preset.startsWith("---")
    ? "Balanced"
    : state.preset;
  const overrideFlag = state.override_preset ? " override" : "";
  const summary = `Favorite: ${state.sampler_name} / ${state.scheduler} · ${state.steps} steps · CFG ${state.cfg}`;
  return `
    <div class="boss-ks-card">
      <div class="boss-ks-card-title">⚙️ KSampler Settings</div>
      <div class="boss-ks-settings-grid">
        <div class="boss-ks-setting"><span class="label">Preset</span><span class="value${overrideFlag}">${escapeHtml(presetDisplay)}${state.override_preset ? " (manual)" : ""}</span></div>
        <div class="boss-ks-setting"><span class="label">CFG Preset</span><span class="value">${escapeHtml(state.cfg_preset)}</span></div>
        <div class="boss-ks-setting"><span class="label">Sampler</span><span class="value">${escapeHtml(state.sampler_name)}</span></div>
        <div class="boss-ks-setting"><span class="label">Scheduler</span><span class="value">${escapeHtml(state.scheduler)}</span></div>
        <div class="boss-ks-setting"><span class="label">Steps</span><span class="value">${state.steps}</span></div>
        <div class="boss-ks-setting"><span class="label">CFG</span><span class="value">${state.cfg}</span></div>
        <div class="boss-ks-setting"><span class="label">Denoise</span><span class="value">${state.denoise}</span></div>
        <div class="boss-ks-setting"><span class="label">Seed</span><span class="value">${state.seed || "random"}</span></div>
      </div>
      <div class="boss-ks-fav-summary"><strong>${summary}</strong></div>
    </div>
  `;
}

// ── Editor class ─────────────────────────────────────────────────────

class KSamplerEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.favorites = {};
    this.modal = null;
  }

  async fetchFavorites() {
    const r = await fetch("/ksampler/favorites");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.favorites = await r.json();
  }

  async saveFavorite(name, settings) {
    const r = await fetch("/ksampler/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, settings }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    await this.fetchFavorites();
  }

  async deleteFavorite(name) {
    const r = await fetch("/ksampler/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await this.fetchFavorites();
  }

  open() {
    return this.fetchFavorites().then(() => this.buildModal());
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const modal = document.createElement("div");
    modal.className = "boss-ks-modal";

    const bar = document.createElement("div");
    bar.className = "boss-ks-bar";
    bar.innerHTML = `<div class="boss-ks-bar-title">KSampler Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-ks-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-ks-body";

    const side = document.createElement("div");
    side.className = "boss-ks-side";
    // Build controls (same as before)
    side.appendChild(this.buildPresetSection());
    side.appendChild(this.buildCfgPresetSection());
    side.appendChild(this.buildManualOverrideSection());
    side.appendChild(
      this.buildSelectSection("Sampler", "sampler_name", SAMPLERS),
    );
    side.appendChild(
      this.buildSelectSection("Scheduler", "scheduler", SCHEDULERS),
    );
    side.appendChild(this.buildNumberSection("Steps", "steps", 1, 10000, 1));
    side.appendChild(this.buildNumberSection("CFG", "cfg", 0, 100, 0.1));
    side.appendChild(this.buildNumberSection("Denoise", "denoise", 0, 1, 0.01));
    side.appendChild(this.buildNumberSection("Seed", "seed", 0, 0xffffffff, 1));
    side.appendChild(this.buildFavoriteSaveSection());

    const workspace = document.createElement("div");
    workspace.className = "boss-ks-workspace";
    // Preview card will be placed here
    this.previewEl = document.createElement("div");
    workspace.appendChild(this.previewEl);
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-ks-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-ks-save";
    saveBtn.textContent = "Apply";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-ks-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshPreview();
  }

  // ── Control builders (same as before, but with event listeners that call refreshPreview) ──

  buildPresetSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ks-section-label";
    label.textContent = "Preset";
    const select = document.createElement("select");
    select.className = "boss-ks-select";
    const builtinGroup = document.createElement("optgroup");
    builtinGroup.label = "Built‑in";
    for (const p of BUILTIN_PRESETS) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (this.state.preset === p) opt.selected = true;
      builtinGroup.appendChild(opt);
    }
    select.appendChild(builtinGroup);
    const favGroup = document.createElement("optgroup");
    favGroup.label = "Favorites";
    const favNames = Object.keys(this.favorites);
    if (favNames.length) {
      for (const name of favNames) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        if (this.state.preset === name) opt.selected = true;
        favGroup.appendChild(opt);
      }
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(none)";
      opt.disabled = true;
      favGroup.appendChild(opt);
    }
    select.appendChild(favGroup);
    select.addEventListener("change", () => {
      this.state.preset = select.value;
      this.refreshPreview();
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    this.presetSelect = select;
    return wrap;
  }

  buildCfgPresetSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ks-section-label";
    label.textContent = "CFG Preset";
    const select = document.createElement("select");
    select.className = "boss-ks-select";
    for (const p of CFG_PRESETS) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (this.state.cfg_preset === p) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      this.state.cfg_preset = select.value;
      this.refreshPreview();
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    this.cfgPresetSelect = select;
    return wrap;
  }

  buildManualOverrideSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.className = "boss-ks-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!this.state.override_preset;
    input.addEventListener("change", () => {
      this.state.override_preset = !!input.checked;
      this.refreshPreview();
    });
    label.appendChild(input);
    label.appendChild(
      document.createTextNode("Override preset with manual values"),
    );
    wrap.appendChild(label);
    return wrap;
  }

  buildSelectSection(title, key, options) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ks-section-label";
    label.textContent = title;
    const select = document.createElement("select");
    select.className = "boss-ks-select";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (this.state[key] === opt) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => {
      this.state[key] = select.value;
      this.refreshPreview();
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    return wrap;
  }

  buildNumberSection(title, key, min, max, step) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ks-section-label";
    label.textContent = title;
    const row = document.createElement("div");
    row.className = "boss-ks-row";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "boss-ks-input";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = this.state[key];
    input.addEventListener("change", () => {
      let val = parseFloat(input.value);
      if (isNaN(val)) val = min;
      val = clamp(val, min, max);
      this.state[key] = val;
      input.value = val;
      this.refreshPreview();
    });
    row.appendChild(input);
    wrap.appendChild(label);
    wrap.appendChild(row);
    return wrap;
  }

  buildFavoriteSaveSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ks-section-label";
    label.textContent = "Save as Favorite";
    const row = document.createElement("div");
    row.className = "boss-ks-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "boss-ks-input";
    nameInput.placeholder = "Favorite name...";
    nameInput.value = this.state.favorite_name || "";
    nameInput.addEventListener("input", () => {
      this.state.favorite_name = nameInput.value;
    });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-ks-button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) {
        setStatus(this.node, "Enter a name", true);
        return;
      }
      if (BUILTIN_PRESETS.includes(name)) {
        setStatus(this.node, "Cannot overwrite built‑in", true);
        return;
      }
      try {
        await this.saveFavorite(name, {
          sampler_name: this.state.sampler_name,
          scheduler: this.state.scheduler,
          steps: this.state.steps,
          cfg: this.state.cfg,
        });
        this.refreshPresets();
        setStatus(this.node, `Saved "${name}"`);
      } catch (err) {
        setStatus(this.node, err.message, true);
      }
    });
    row.appendChild(nameInput);
    row.appendChild(saveBtn);
    wrap.appendChild(label);
    wrap.appendChild(row);

    // Delete section
    const delRow = document.createElement("div");
    delRow.style.marginTop = "6px";
    const delLabel = document.createElement("span");
    delLabel.className = "boss-ks-section-label";
    delLabel.textContent = "Delete Favorite";
    const delSelect = document.createElement("select");
    delSelect.className = "boss-ks-select";
    const favNames = Object.keys(this.favorites);
    if (favNames.length) {
      for (const name of favNames) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        delSelect.appendChild(opt);
      }
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(none)";
      opt.disabled = true;
      delSelect.appendChild(opt);
    }
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "boss-ks-button danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const name = delSelect.value;
      if (!name) return;
      if (!confirm(`Delete favorite "${name}"?`)) return;
      try {
        await this.deleteFavorite(name);
        this.refreshPresets();
        setStatus(this.node, `Deleted "${name}"`);
      } catch (err) {
        setStatus(this.node, err.message, true);
      }
    });
    const delRowInner = document.createElement("div");
    delRowInner.className = "boss-ks-row";
    delRowInner.appendChild(delSelect);
    delRowInner.appendChild(delBtn);
    delRow.appendChild(delLabel);
    delRow.appendChild(delRowInner);
    wrap.appendChild(delRow);
    return wrap;
  }

  refreshPresets() {
    if (this.presetSelect) {
      const current = this.state.preset;
      const newSelect = this.buildPresetSection().querySelector("select");
      this.presetSelect.parentNode.replaceChild(newSelect, this.presetSelect);
      this.presetSelect = newSelect;
      const opt = this.presetSelect.querySelector(`option[value="${current}"]`);
      if (opt) opt.selected = true;
      else {
        const first = this.presetSelect.querySelector(
          "optgroup[label='Built‑in'] option",
        );
        if (first) first.selected = true;
        this.state.preset = first ? first.value : "Balanced";
      }
      this.presetSelect.addEventListener("change", () => {
        this.state.preset = this.presetSelect.value;
        this.refreshPreview();
      });
      this.refreshPreview();
    }
  }

  refreshPreview() {
    if (!this.previewEl) return;
    this.previewEl.innerHTML = buildPreviewHTML(this.state);
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

// ── Node setup ─────────────────────────────────────────────────────────────

function setupKSamplerNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-ks-root";

  const head = document.createElement("div");
  head.className = "boss-ks-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-ks-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-ks-status";
  root.appendChild(status);

  node.addDOMWidget("ksampler_ui", "boss_ks", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossKsRoot = root;
  node._bossKsHead = head;

  const state = readState(node);
  syncNativeWidgets(node, state);
  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading...");
      const editor = new KSamplerEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[UltimateKSampler] open editor failed", err);
      setStatus(node, "Failed to load favorites. Is backend running?", true);
    }
  });
}

// ── Graph injection ─────────────────────────────────────────────────────────

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  const result = await _origGraphToPrompt(...args);
  try {
    const out = result?.output;
    if (!out) return result;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== "UltimateKSamplerPro") continue;
      const node = app.graph._nodes.find((n) => String(n.id) === id);
      if (!node) continue;
      const state = readState(node);
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[UltimateKSampler] graphToPrompt inject failed", e);
  }
  return result;
};

// ── Extension registration ───────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.UltimateKSampler",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "UltimateKSamplerPro") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossKsHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "UltimateKSamplerPro") return;
    setupKSamplerNode(node);
  },
});

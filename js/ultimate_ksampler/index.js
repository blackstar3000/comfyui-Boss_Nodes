// Ultimate KSampler Pro - DOM widget + editor modal
// Mirrors the Prompt Master Library Pro style with a rich preview card.

import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

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
const SEED_CONTROL_MODES = ["fixed", "increment", "decrement", "randomize"];
const SEED_MAX = 0xffffffff; // kept in sync with the modal's seed input range

function nextSeed(currentSeed, mode) {
  switch (mode) {
    case "increment":
      return currentSeed >= SEED_MAX ? 0 : currentSeed + 1;
    case "decrement":
      return currentSeed <= 0 ? SEED_MAX : currentSeed - 1;
    case "randomize":
      return Math.floor(Math.random() * (SEED_MAX + 1));
    case "fixed":
    default:
      return currentSeed;
  }
}

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
    /* ── Component-specific overrides ────────────────────────────── */

    /* Header multi-line layout */
    .boss-widget-head {
      display: flex;
      flex-direction: column;
      gap: 3px;
      line-height: 1.45;
      min-height: 36px;
    }
    .boss-widget-head .label { color: var(--boss-text-muted); }
    .boss-widget-head .value { color: #fff; font-weight: 600; }
    .boss-widget-head .value.override { color: var(--boss-brand); }

    /* Side panel width override */
    .boss-ks-side-custom { width: 340px; }

    /* Row layout */
    .boss-ks-row { display: flex; align-items: center; gap: 10px; }
    .boss-ks-row .boss-input { flex: 1; }

    /* Checkbox */
    .boss-ks-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--boss-text);
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-ks-check input { width: 16px; height: 16px; accent-color: var(--boss-brand); }

    /* Action buttons */
    .boss-ks-button {
      background: var(--boss-brand);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: var(--boss-radius-md);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .boss-ks-button:hover { background: var(--boss-brand-hover); }
    .boss-ks-button.danger { background: #e53e3e; }
    .boss-ks-button.danger:hover { background: #c53030; }

    /* Preview settings grid */
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
      background: var(--boss-bg-section);
    }
    .boss-ks-setting .label { color: var(--boss-text-muted); font-weight: 500; }
    .boss-ks-setting .value {
      color: #fff;
      font-weight: 600;
      font-family: var(--boss-font-mono);
      font-size: 0.95em;
    }
    .boss-ks-setting .value.override { color: var(--boss-brand); }

    /* Summary box */
    .boss-ks-fav-summary {
      background: var(--boss-bg-active);
      padding: 10px 12px;
      border-radius: var(--boss-radius-md);
      border-left: 3px solid var(--boss-brand);
      font-size: 13px;
      color: var(--boss-text);
      text-align: center;
    }
    .boss-ks-fav-summary strong { color: var(--boss-brand); }

    /* Card title gradient */
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
    seed_control: "randomize",
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
        if (!SEED_CONTROL_MODES.includes(merged.seed_control))
          merged.seed_control = base.seed_control;
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
    seed_control: state.seed_control || "randomize",
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
      <span class="value">${state.seed || "random"} (${state.seed_control || "randomize"})</span>
    </div>
  `;
}

function setStatus(node, text, isError = false) {
  const root = node._bossKsRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
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
        <div class="boss-ks-setting"><span class="label">Seed Control</span><span class="value">${escapeHtml(state.seed_control || "randomize")}</span></div>
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
    modal.className = "boss-modal";

    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">KSampler Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-btn-close";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-body";

    const side = document.createElement("div");
    side.className = "boss-side boss-ks-side-custom";
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
    side.appendChild(
      this.buildSelectSection("Seed Control", "seed_control", SEED_CONTROL_MODES),
    );
    side.appendChild(this.buildFavoriteSaveSection());

    const workspace = document.createElement("div");
    workspace.className = "boss-preview";
    // Preview card will be placed here
    this.previewEl = document.createElement("div");
    workspace.appendChild(this.previewEl);
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-btn-primary";
    saveBtn.textContent = "Apply";
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
    this.refreshPreview();
  }

  // ── Control builders (same as before, but with event listeners that call refreshPreview) ──

  buildPresetSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Preset";

    const builtinOptions = BUILTIN_PRESETS.map((p) => ({ value: p, label: p }));
    const favNames = Object.keys(this.favorites);
    const favOptions = favNames.length
      ? favNames.map((n) => ({ value: n, label: n }))
      : [{ value: "(none)", label: "(none)", disabled: true }];

    const allOptions = [
      { type: "category", label: "Built‑in" },
      ...builtinOptions,
      { type: "category", label: "Favorites" },
      ...favOptions,
    ];

    const dropdown = new BossDropdown({
      options: allOptions,
      value: this.state.preset,
      placeholder: "Select preset…",
      onChange: (val) => {
        this.state.preset = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(label);
    wrap.appendChild(dropdown.element);
    this.presetDropdown = dropdown;
    return wrap;
  }

  buildCfgPresetSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "CFG Preset";

    const dropdown = new BossDropdown({
      options: CFG_PRESETS.map((p) => ({ value: p, label: p })),
      value: this.state.cfg_preset,
      placeholder: "Select CFG preset…",
      searchable: false,
      onChange: (val) => {
        this.state.cfg_preset = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(label);
    wrap.appendChild(dropdown.element);
    this.cfgPresetDropdown = dropdown;
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
    label.className = "boss-label";
    label.textContent = title;

    const dropdown = new BossDropdown({
      options: options.map((o) => ({ value: o, label: o })),
      value: this.state[key],
      placeholder: `Select ${title.toLowerCase()}…`,
      onChange: (val) => {
        this.state[key] = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(label);
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  buildNumberSection(title, key, min, max, step) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = title;
    const row = document.createElement("div");
    row.className = "boss-ks-row";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "boss-input";
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
    label.className = "boss-label";
    label.textContent = "Save as Favorite";
    const row = document.createElement("div");
    row.className = "boss-ks-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "boss-input";
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
    delLabel.className = "boss-label";
    delLabel.textContent = "Delete Favorite";
    const favNames = Object.keys(this.favorites);
    const delOpts = favNames.length
      ? favNames.map((n) => ({ value: n, label: n }))
      : [{ value: "(none)", label: "(none)", disabled: true }];
    const delDropdown = new BossDropdown({
      options: delOpts,
      value: "",
      placeholder: "Select favorite…",
      searchable: false,
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "boss-ks-button danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const name = delDropdown.value;
      if (!name || name === "(none)") return;
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
    delRowInner.appendChild(delDropdown.element);
    delRowInner.appendChild(delBtn);
    delRow.appendChild(delLabel);
    delRow.appendChild(delRowInner);
    wrap.appendChild(delRow);
    return wrap;
  }

  refreshPresets() {
    if (this.presetDropdown) {
      const current = this.state.preset;
      const favNames = Object.keys(this.favorites);
      const builtinOptions = BUILTIN_PRESETS.map((p) => ({ value: p, label: p }));
      const favOptions = favNames.length
        ? favNames.map((n) => ({ value: n, label: n }))
        : [{ value: "(none)", label: "(none)", disabled: true }];

      const allOptions = [
        { type: "category", label: "Built‑in" },
        ...builtinOptions,
        { type: "category", label: "Favorites" },
        ...favOptions,
      ];

      this.presetDropdown.setOptions(allOptions);
      this.presetDropdown.setValue(current);
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
  root.className = "boss-widget";

  const head = document.createElement("div");
  head.className = "boss-widget-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-btn-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
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
  // Sync native widgets BEFORE original reads them for serialization
  try {
    for (const node of app.graph._nodes) {
      if (node.comfyClass !== "UltimateKSamplerPro") continue;
      const state = readState(node);
      syncNativeWidgets(node, state);
    }
  } catch (_) { /* ignore sync errors */ }

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

      // Inject the CURRENT seed - this is what actually gets used for this run.
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);

      // Advance the seed for the NEXT run (fixed/increment/decrement/randomize),
      // same as ComfyUI's native "control after generate" behavior. This has to
      // happen AFTER injecting the current state above, so this run still uses
      // the seed the person saw in the UI when they hit queue.
      const mode = state.seed_control || "randomize";
      const advanced = nextSeed(state.seed, mode);
      if (mode !== "fixed" && advanced !== state.seed) {
        const newState = { ...state, seed: advanced };
        writeState(node, newState);
        setWidgetValue(node, "seed", advanced);
        renderHeader(node);
      }

      // Add a synthetic KSampler entry for metadata viewers that only parse
      // standard node types (KSampler, KSamplerAdvanced). This node won't
      // execute because it has no outgoing connections to output nodes.
      let maxId = 0;
      for (const k in out) {
        const nid = parseInt(k);
        if (!isNaN(nid) && nid > maxId) maxId = nid;
      }
      const synId = String(maxId + 1);
      out[synId] = {
        class_type: "KSampler",
        inputs: {
          seed: state.seed,
          steps: state.steps,
          cfg: state.cfg,
          sampler_name: state.sampler_name,
          scheduler: state.scheduler,
          denoise: state.denoise,
          model: entry.inputs.model,
          positive: entry.inputs.positive,
          negative: entry.inputs.negative,
          latent_image: entry.inputs.latent_image,
        },
      };
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

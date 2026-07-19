// Ultimate Loader Pro - DOM widget + editor modal (with model preview)
import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

const STATE_PROP = "loaderState";
const HIDDEN_INPUT_NAME = "LoaderState";

const VISIBLE_NATIVE_WIDGETS = [
  "ckpt_name",
  "model_action",
  "model_preset",
  "fav_name",
  "vae_name",
  "clip_skip",
  "aspect_ratio",
  "width",
  "height",
  "batch_size",
];

// ── CSS ──────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-loader-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Header value variants */
    .boss-widget-head .label { color: var(--boss-text-muted); }
    .boss-widget-head .sep { color: var(--boss-text-faint); margin: 0 6px; }

    /* Side panel width override */
    .boss-lr-side-custom { width: 380px; }

    /* Row layout */
    .boss-lr-row { display: flex; align-items: center; gap: 10px; }
    .boss-lr-row .boss-input { flex: auto; }

    /* Checkbox */
    .boss-lr-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--boss-text);
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-lr-check input { width: 16px; height: 16px; accent-color: var(--boss-brand); }

    /* Action buttons */
    .boss-lr-btn {
      background: var(--boss-brand);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: var(--boss-radius-md);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .boss-lr-btn:hover { background: var(--boss-brand-hover); }
    .boss-lr-btn.danger { background: #e53e3e; }
    .boss-lr-btn.danger:hover { background: #c53030; }

    /* Preview grid */
    .boss-lr-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .boss-lr-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 4px;
      background: var(--boss-bg-section);
    }
    .boss-lr-item .label { color: var(--boss-text-muted); font-weight: 500; }
    .boss-lr-item .value { color: #fff; font-weight: 600; font-family: var(--boss-font-mono); }

    /* Summary box */
    .boss-lr-summary {
      background: var(--boss-bg-active);
      padding: 10px 12px;
      border-radius: var(--boss-radius-md);
      border-left: 3px solid var(--boss-brand);
      font-size: 13px;
      color: var(--boss-text);
      text-align: center;
    }
    .boss-lr-summary strong { color: var(--boss-brand); }

    /* Dimension labels (W/H) */
    .boss-lr-row > span {
      color: var(--boss-text);
      font-weight: 500;
      font-size: 13px;
    }

    /* Card title gradient */
    .boss-lr-card-title {
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

    /* Preview image */
    .boss-lr-preview-img {
      display: block;
      max-width: 100%;
      max-height: 200px;
      margin: 8px auto;
      border-radius: 8px;
      border: 1px solid var(--boss-border);
      background: var(--boss-bg-input);
      object-fit: contain;
    }
    .boss-lr-preview-img.placeholder {
      opacity: 0.4;
    }

    /* Civitai section */
    .boss-lr-civitai-loading {
      padding: 8px 10px;
      color: var(--boss-text-muted);
      font-size: 12px;
      font-style: italic;
      border-top: 1px solid var(--boss-border);
      margin-top: 8px;
    }
    .boss-lr-civitai-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .boss-lr-civitai-model {
      color: #fff;
      font-weight: 600;
      font-size: 13px;
    }
    .boss-lr-civitai-version {
      color: var(--boss-text-muted);
      font-size: 12px;
    }
    .boss-lr-civitai-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--boss-bg-active);
      color: var(--boss-brand);
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .boss-lr-civitai-stats {
      color: var(--boss-text-muted);
      font-size: 11px;
      margin-bottom: 6px;
    }
    .boss-lr-civitai-rec-title {
      color: var(--boss-brand);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 6px 0 4px;
    }
    .boss-lr-civitai-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-bottom: 8px;
    }
    .boss-lr-civitai-param {
      display: flex;
      justify-content: space-between;
      padding: 4px 6px;
      border-radius: 4px;
      background: var(--boss-bg-section);
      font-size: 11px;
    }
    .boss-lr-civitai-param .label { color: var(--boss-text-muted); }
    .boss-lr-civitai-param .value { color: #fff; font-weight: 600; font-family: var(--boss-font-mono); }
    .boss-lr-civitai-link {
      display: block;
      text-align: center;
      color: var(--boss-brand);
      font-size: 12px;
      text-decoration: none;
      padding: 6px;
      border: 1px solid var(--boss-border-strong);
      border-radius: var(--boss-radius-md);
      margin-top: 6px;
      transition: background 0.15s;
    }
    .boss-lr-civitai-link:hover { background: var(--boss-bg-hover); }
    .boss-lr-civitai-thumb-wrap {
      position: relative;
    }

    /* Civitai bar in preview card */
    .boss-lr-civitai-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      margin: 8px 0;
      border-radius: var(--boss-radius-md);
      background: var(--boss-bg-active);
      border-left: 3px solid var(--boss-brand);
      font-size: 12px;
    }
    .boss-lr-civitai-bar-name {
      color: #fff;
      font-weight: 600;
    }
    .boss-lr-civitai-bar-ver {
      color: var(--boss-text-muted);
    }
    .boss-lr-civitai-bar-base {
      color: var(--boss-brand);
      font-weight: 500;
    }
    .boss-lr-civitai-bar-link {
      margin-left: auto;
      color: var(--boss-brand);
      text-decoration: none;
      font-weight: 600;
    }
    .boss-lr-civitai-bar-link:hover { text-decoration: underline; }
  `;
  const style = document.createElement("style");
  style.id = "boss-loader-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── Helpers ──────────────────────────────────────────────────────────────

function widgetValue(node, name, fallback) {
  const w = (node.widgets || []).find((x) => x.name === name);
  return w ? w.value : fallback;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function defaultStateFromWidgets(node) {
  return {
    ckpt_name: widgetValue(node, "ckpt_name", ""),
    model_action: widgetValue(node, "model_action", "Load Model"),
    model_preset: widgetValue(node, "model_preset", "None"),
    fav_name: widgetValue(node, "fav_name", "My Main Model"),
    vae_name: widgetValue(node, "vae_name", "Baked VAE"),
    clip_skip: parseInt(widgetValue(node, "clip_skip", -1)) || -1,
    aspect_ratio: widgetValue(node, "aspect_ratio", "1024 x 1024 [S] 1:1"),
    width: parseInt(widgetValue(node, "width", 1024)) || 1024,
    height: parseInt(widgetValue(node, "height", 1024)) || 1024,
    batch_size: parseInt(widgetValue(node, "batch_size", 1)) || 1,
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
        merged.clip_skip = parseInt(merged.clip_skip) || -1;
        merged.width = parseInt(merged.width) || base.width;
        merged.height = parseInt(merged.height) || base.height;
        merged.batch_size = parseInt(merged.batch_size) || base.batch_size;
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
  node.properties[STATE_PROP] = JSON.stringify(state);
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
  setWidgetValue(node, "ckpt_name", state.ckpt_name);
  setWidgetValue(node, "model_action", state.model_action);
  setWidgetValue(node, "model_preset", state.model_preset);
  setWidgetValue(node, "fav_name", state.fav_name);
  setWidgetValue(node, "vae_name", state.vae_name);
  setWidgetValue(node, "clip_skip", state.clip_skip);
  setWidgetValue(node, "aspect_ratio", state.aspect_ratio);
  setWidgetValue(node, "width", state.width);
  setWidgetValue(node, "height", state.height);
  setWidgetValue(node, "batch_size", state.batch_size);
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
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

function renderHeader(node) {
  const head = node._bossLrHead;
  if (!head) return;
  const state = readState(node);
  const model = state.ckpt_name || "(none)";
  const dims = `${state.width}×${state.height}`;
  head.innerHTML = `
    <span class="label">Model:</span> <span class="value">${escapeHtml(model)}</span>
    <span class="sep">·</span>
    <span class="label">Size:</span> <span class="value">${dims}</span>
    <span class="sep">·</span>
    <span class="label">VAE:</span> <span class="value">${escapeHtml(state.vae_name)}</span>
  `;
}

function setStatus(node, text, isError = false) {
  const root = node._bossLrRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// ── Preview HTML ──────────────────────────────────────────────────────────

function buildPreviewHTML(state, previewUrl, civitaiInfo) {
  const model = state.ckpt_name || "(none)";
  const dims = `${state.width}×${state.height}`;
  const imgHtml = previewUrl
    ? `<img class="boss-lr-preview-img" src="${escapeHtml(previewUrl)}" alt="Model preview"
          onerror="console.warn('[UltimateLoader] Preview image failed to load:', this.src); this.style.display='none'; var f=this.nextElementSibling; if(f) f.style.display='flex';" />`
    : "";
  const fallbackHtml = `<div class="boss-lr-preview-img placeholder" style="display:${previewUrl ? "none" : "flex"};align-items:center;justify-content:center;color:#666;font-size:12px;height:60px;">⚠️ No preview available</div>`;

  // Civitai thumbnail (override local preview if available)
  let civitaiImgHtml = "";
  if (civitaiInfo && civitaiInfo.found && civitaiInfo.thumbnail_url) {
    civitaiImgHtml = `
      <div class="boss-lr-civitai-thumb-wrap">
        <img class="boss-lr-preview-img" src="${escapeHtml(civitaiInfo.thumbnail_url)}" alt="Civitai preview"
          onerror="this.parentElement.style.display='none';" />
      </div>`;
  }

  // Civitai info bar
  let civitaiBarHtml = "";
  if (civitaiInfo && civitaiInfo.found) {
    const name = escapeHtml(civitaiInfo.model_name || "");
    const ver = escapeHtml(civitaiInfo.version_name || "");
    const base = escapeHtml(civitaiInfo.base_model || "");
    const url = civitaiInfo.civitai_url || "#";
    civitaiBarHtml = `
      <div class="boss-lr-civitai-bar">
        <span class="boss-lr-civitai-bar-name">${name}</span>
        <span class="boss-lr-civitai-bar-ver">${ver}</span>
        <span class="boss-lr-civitai-bar-base">${base}</span>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="boss-lr-civitai-bar-link">Civitai ↗</a>
      </div>`;
  }

  return `
    <div class="boss-lr-card">
      <div class="boss-lr-card-title">📦 Ultimate Loader</div>
      ${civitaiImgHtml || imgHtml}
      ${!civitaiInfo?.found ? fallbackHtml : ""}
      ${civitaiBarHtml}
      <div class="boss-lr-grid">
        <div class="boss-lr-item"><span class="label">Model</span><span class="value">${escapeHtml(model)}</span></div>
        <div class="boss-lr-item"><span class="label">VAE</span><span class="value">${escapeHtml(state.vae_name)}</span></div>
        <div class="boss-lr-item"><span class="label">Clip Skip</span><span class="value">${state.clip_skip}</span></div>
        <div class="boss-lr-item"><span class="label">Aspect Ratio</span><span class="value">${escapeHtml(state.aspect_ratio)}</span></div>
        <div class="boss-lr-item"><span class="label">Width</span><span class="value">${state.width}</span></div>
        <div class="boss-lr-item"><span class="label">Height</span><span class="value">${state.height}</span></div>
        <div class="boss-lr-item"><span class="label">Batch Size</span><span class="value">${state.batch_size}</span></div>
        <div class="boss-lr-item"><span class="label">Action</span><span class="value">${escapeHtml(state.model_action)}</span></div>
      </div>
      <div class="boss-lr-summary"><strong>${escapeHtml(model)}</strong> · ${dims} · ${state.vae_name}</div>
    </div>
  `;
}

// ── Editor class ────────────────────────────────────────────────────────────

class LoaderEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.data = {
      checkpoints: [],
      vaes: [],
      model_favorites: {},
      size_presets: {},
    };
    this.modal = null;
    this.previewUrl = null;
    this.civitaiInfo = null;
    this.civitaiLoading = false;
  }

  async fetchData() {
    const r = await fetch("/ultimate_loader/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.data = await r.json();
  }

  async fetchCivitaiInfo(ckpt) {
    if (!ckpt) { this.civitaiInfo = null; return; }
    this.civitaiLoading = true;
    this.civitaiInfo = null;
    this.refreshCivitaiSection();
    try {
      const r = await fetch(`/ultimate_loader/civitai?ckpt=${encodeURIComponent(ckpt)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      this.civitaiInfo = data;
    } catch (err) {
      console.warn("[UltimateLoader] Civitai lookup failed:", err.message);
      this.civitaiInfo = { found: false, error: err.message };
    } finally {
      this.civitaiLoading = false;
      this.refreshCivitaiSection();
    }
  }

  async saveModelFavorite(name, ckpt) {
    const r = await fetch("/ultimate_loader/favorites/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ckpt }),
    });
    const result = await r.json();
    if (!r.ok) {
      throw new Error(result.error || `HTTP ${r.status}`);
    }
    this.data.model_favorites = result.favorites;
  }

  async deleteModelFavorite(name) {
    const r = await fetch("/ultimate_loader/favorites/model/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const result = await r.json();
    this.data.model_favorites = result.favorites;
  }

  async saveSizePreset(name, width, height, batch_size) {
    const r = await fetch("/ultimate_loader/favorites/size", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, width, height, batch_size }),
    });
    const result = await r.json();
    if (!r.ok) {
      throw new Error(result.error || `HTTP ${r.status}`);
    }
    this.data.size_presets = result.presets;
  }

  async deleteSizePreset(name) {
    const r = await fetch("/ultimate_loader/favorites/size/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const result = await r.json();
    this.data.size_presets = result.presets;
  }

  previewImageUrl(ckpt) {
    if (!ckpt) return null;
    // Served directly from disk by the backend - no JSON round-trip needed,
    // the browser's own onerror on the <img> tag handles a missing file.
    return `/ultimate_loader/preview_image?ckpt=${encodeURIComponent(ckpt)}`;
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

    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">Ultimate Loader Pro Editor</div>`;
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
    side.className = "boss-side boss-lr-side-custom";

    // ── Model section ──────────────────────────────────────────────
    side.appendChild(this.buildModelSection());
    // ── Civitai info ──────────────────────────────────────────────
    this.civitaiSectionEl = document.createElement("div");
    side.appendChild(this.civitaiSectionEl);
    // ── VAE & Clip ──────────────────────────────────────────────────
    side.appendChild(this.buildVAESection());
    side.appendChild(this.buildClipSkipSection());
    // ── Size section ────────────────────────────────────────────────
    side.appendChild(this.buildSizeSection());
    // ── Batch size ──────────────────────────────────────────────────
    side.appendChild(this.buildBatchSection());
    // ── Size presets management ────────────────────────────────────
    side.appendChild(this.buildSizePresetSection());

    const workspace = document.createElement("div");
    workspace.className = "boss-preview";
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
    // Set preview for initial model
    this.previewUrl = this.previewImageUrl(this.state.ckpt_name);
    this.refreshPreview();
  }

  // ── Sub‑controls ──────────────────────────────────────────────────────

  buildModelSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Model";
    wrap.appendChild(label);

    // Checkpoint dropdown
    const checkpoints = this.data.checkpoints || [];
    const ckptDropdown = new BossDropdown({
      options: checkpoints.map((c) => ({ value: c, label: c })),
      value: this.state.ckpt_name,
      placeholder: "Select checkpoint…",
      onChange: (val) => {
        this.state.ckpt_name = val;
        this.previewUrl = this.previewImageUrl(this.state.ckpt_name);
        this.refreshPreview();
        // Clear Civitai info when model changes (user must re-lookup)
        this.civitaiInfo = null;
        this.refreshCivitaiSection();
      },
    });
    wrap.appendChild(ckptDropdown.element);

    // Action dropdown + name input
    const actionRow = document.createElement("div");
    actionRow.className = "boss-lr-row";
    const actionDropdown = new BossDropdown({
      options: ["Load Model", "Save Favorite", "Delete Favorite"].map((a) => ({
        value: a,
        label: a,
      })),
      value: this.state.model_action,
      placeholder: "Select action…",
      searchable: false,
      onChange: (val) => {
        this.state.model_action = val;
        this.refreshPreview();
      },
    });
    actionRow.appendChild(actionDropdown.element);

    const favName = document.createElement("input");
    favName.type = "text";
    favName.className = "boss-input";
    favName.placeholder = "Favorite name";
    favName.value = this.state.fav_name;
    favName.addEventListener("input", () => {
      this.state.fav_name = favName.value;
    });
    actionRow.appendChild(favName);
    wrap.appendChild(actionRow);

    // Favorites preset dropdown
    const presetRow = document.createElement("div");
    const presetLabel = document.createElement("span");
    presetLabel.className = "boss-label";
    presetLabel.textContent = "Model Preset (Favorite)";
    presetRow.appendChild(presetLabel);
    const favNames = Object.keys(this.data.model_favorites || {});
    const presetOpts = ["None", ...favNames];
    const presetDropdown = new BossDropdown({
      options: presetOpts.map((p) => ({ value: p, label: p })),
      value: this.state.model_preset,
      placeholder: "Select preset…",
      onChange: (val) => {
        this.state.model_preset = val;
        if (val !== "None") {
          const ckpt = this.data.model_favorites[val];
          if (ckpt) {
            this.state.ckpt_name = ckpt;
            this.previewUrl = this.previewImageUrl(ckpt);
          }
        }
        this.civitaiInfo = null;
        this.refreshCivitaiSection();
        this.refreshPreview();
      },
    });
    presetRow.appendChild(presetDropdown.element);
    wrap.appendChild(presetRow);

    return wrap;
  }

  buildVAESection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "VAE";
    wrap.appendChild(label);

    const vaes = ["Baked VAE", ...(this.data.vaes || [])];
    const vaeDropdown = new BossDropdown({
      options: vaes.map((v) => ({ value: v, label: v })),
      value: this.state.vae_name,
      placeholder: "Select VAE…",
      onChange: (val) => {
        this.state.vae_name = val;
        this.refreshPreview();
      },
    });
    wrap.appendChild(vaeDropdown.element);
    return wrap;
  }

  buildClipSkipSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Clip Skip";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.className = "boss-lr-row";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "boss-input";
    input.min = -24;
    input.max = 0;
    input.step = 1;
    input.value = this.state.clip_skip;
    input.addEventListener("change", () => {
      let val = parseInt(input.value);
      if (isNaN(val)) val = -1;
      val = clamp(val, -24, 0);
      this.state.clip_skip = val;
      input.value = val;
      this.refreshPreview();
    });
    row.appendChild(input);
    wrap.appendChild(row);
    return wrap;
  }

  buildSizeSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Aspect Ratio";
    wrap.appendChild(label);

    const presets = this.data.size_presets || {};
    const allRatios = [
      "width x height [custom]",
      "512 x 512 [S] 1:1",
      "768 x 768 [S] 1:1",
      "910 x 910 [S] 1:1",
      "512 x 682 [P] 3:4",
      "512 x 768 [P] 2:3",
      "512 x 910 [P] 9:16",
      "682 x 512 [L] 4:3",
      "768 x 512 [L] 3:2",
      "910 x 512 [L] 16:9",
      "1024 x 1024 [S] 1:1",
      "512 x 1024 [P] 1:2",
      "1024 x 512 [L] 2:1",
      "640 x 1536 [P] 9:21",
      "704 x 1472 [P] 9:19",
      "768 x 1344 [P] 9:16",
      "768 x 1216 [P] 5:8",
      "832 x 1216 [P] 2:3",
      "896 x 1152 [P] 3:4",
      "1536 x 640 [L] 21:9",
      "1472 x 704 [L] 19:9",
      "1344 x 768 [L] 16:9",
      "1216 x 768 [L] 8:5",
      "1216 x 832 [L] 3:2",
      "1152 x 896 [L] 4:3",
      "--- Custom JSON Presets ---",
    ];
    const customKeys = Object.keys(presets);
    const fullList = [...allRatios, ...customKeys];

    const aspectDropdown = new BossDropdown({
      options: fullList.map((r) => ({ value: r, label: r })),
      value: this.state.aspect_ratio,
      placeholder: "Select aspect ratio…",
      onChange: (val) => {
        this.state.aspect_ratio = val;
        const match = val.match(/(\d+)\s*x\s*(\d+)/);
        if (match) {
          this.state.width = parseInt(match[1]);
          this.state.height = parseInt(match[2]);
          if (this._wInput) this._wInput.value = this.state.width;
          if (this._hInput) this._hInput.value = this.state.height;
        } else if (val in presets) {
          const p = presets[val];
          this.state.width = p.width;
          this.state.height = p.height;
          this.state.batch_size = p.batch_size || this.state.batch_size;
          if (this._wInput) this._wInput.value = this.state.width;
          if (this._hInput) this._hInput.value = this.state.height;
          if (this._bInput) this._bInput.value = this.state.batch_size;
        }
        this.refreshPreview();
      },
    });
    this._aspectRatioDropdown = aspectDropdown;
    wrap.appendChild(aspectDropdown.element);

    // Width/Height inputs
    const dimRow = document.createElement("div");
    dimRow.className = "boss-lr-row";
    const wLabel = document.createElement("span");
    wLabel.textContent = "W";
    const wInput = document.createElement("input");
    wInput.type = "number";
    wInput.className = "boss-input";
    wInput.name = "width";
    wInput.min = 64;
    wInput.max = 8192;
    wInput.step = 8;
    wInput.value = this.state.width;
    wInput.addEventListener("change", () => {
      let val = parseInt(wInput.value);
      if (isNaN(val)) val = 64;
      val = clamp(val, 64, 8192);
      this.state.width = val;
      wInput.value = val;
      this.state.aspect_ratio = "width x height [custom]";
      if (this._aspectRatioDropdown) {
        this._aspectRatioDropdown.setValue("width x height [custom]");
      }
      this.refreshPreview();
    });
    this._wInput = wInput;
    const hLabel = document.createElement("span");
    hLabel.textContent = "H";
    const hInput = document.createElement("input");
    hInput.type = "number";
    hInput.className = "boss-input";
    hInput.name = "height";
    hInput.min = 64;
    hInput.max = 8192;
    hInput.step = 8;
    hInput.value = this.state.height;
    hInput.addEventListener("change", () => {
      let val = parseInt(hInput.value);
      if (isNaN(val)) val = 64;
      val = clamp(val, 64, 8192);
      this.state.height = val;
      hInput.value = val;
      this.state.aspect_ratio = "width x height [custom]";
      if (this._aspectRatioDropdown) {
        this._aspectRatioDropdown.setValue("width x height [custom]");
      }
      this.refreshPreview();
    });
    this._hInput = hInput;
    dimRow.appendChild(wLabel);
    dimRow.appendChild(wInput);
    dimRow.appendChild(hLabel);
    dimRow.appendChild(hInput);
    wrap.appendChild(dimRow);

    return wrap;
  }

  buildBatchSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Batch Size";
    wrap.appendChild(label);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "boss-input";
    input.name = "batch_size";
    input.min = 1;
    input.max = 32;
    input.step = 1;
    input.value = this.state.batch_size;
    input.addEventListener("change", () => {
      let val = parseInt(input.value);
      if (isNaN(val)) val = 1;
      val = clamp(val, 1, 32);
      this.state.batch_size = val;
      input.value = val;
      this.refreshPreview();
    });
    this._bInput = input;
    wrap.appendChild(input);
    return wrap;
  }

  buildSizePresetSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Save Size Preset";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.className = "boss-lr-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "boss-input";
    nameInput.placeholder = "Name";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-lr-btn";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) {
        setStatus(this.node, "Name required", true);
        return;
      }
      try {
        await this.saveSizePreset(
          name,
          this.state.width,
          this.state.height,
          this.state.batch_size,
        );
        // Refresh aspect ratio dropdown
        this.refreshSizeDropdown();
        setStatus(this.node, `Size preset saved: ${name}`);
      } catch (err) {
        setStatus(this.node, err.message, true);
      }
    });
    row.appendChild(nameInput);
    row.appendChild(saveBtn);
    wrap.appendChild(row);

    // Delete preset section
    const delRow = document.createElement("div");
    delRow.className = "boss-lr-row";
    delRow.style.marginTop = "6px";
    const delLabel = document.createElement("span");
    delLabel.className = "boss-label";
    delLabel.textContent = "Delete Size Preset";
    const presets = this.data.size_presets || {};
    const keys = Object.keys(presets);
    const delOpts = keys.length ? keys : ["(none)"];
    const delDropdown = new BossDropdown({
      options: delOpts.map((k) => ({
        value: k,
        label: k,
        disabled: k === "(none)",
      })),
      value: "",
      placeholder: "Select preset…",
      searchable: false,
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "boss-lr-btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const name = delDropdown.value;
      if (!name) return;
      if (!confirm(`Delete size preset "${name}"?`)) return;
      try {
        await this.deleteSizePreset(name);
        this.refreshSizeDropdown();
        setStatus(this.node, `Deleted: ${name}`);
      } catch (err) {
        setStatus(this.node, err.message, true);
      }
    });
    delRow.appendChild(delDropdown.element);
    delRow.appendChild(delBtn);
    wrap.appendChild(delRow);

    return wrap;
  }

  refreshSizeDropdown() {
    const dropdown = this._aspectRatioDropdown;
    if (!dropdown) return;
    const current = this.state.aspect_ratio;
    const presets = this.data.size_presets || {};
    const allRatios = [
      "width x height [custom]",
      "512 x 512 [S] 1:1",
      "768 x 768 [S] 1:1",
      "910 x 910 [S] 1:1",
      "512 x 682 [P] 3:4",
      "512 x 768 [P] 2:3",
      "512 x 910 [P] 9:16",
      "682 x 512 [L] 4:3",
      "768 x 512 [L] 3:2",
      "910 x 512 [L] 16:9",
      "1024 x 1024 [S] 1:1",
      "512 x 1024 [P] 1:2",
      "1024 x 512 [L] 2:1",
      "640 x 1536 [P] 9:21",
      "704 x 1472 [P] 9:19",
      "768 x 1344 [P] 9:16",
      "768 x 1216 [P] 5:8",
      "832 x 1216 [P] 2:3",
      "896 x 1152 [P] 3:4",
      "1536 x 640 [L] 21:9",
      "1472 x 704 [L] 19:9",
      "1344 x 768 [L] 16:9",
      "1216 x 768 [L] 8:5",
      "1216 x 832 [L] 3:2",
      "1152 x 896 [L] 4:3",
      "--- Custom JSON Presets ---",
    ];
    const customKeys = Object.keys(presets);
    const fullList = [...allRatios, ...customKeys];
    dropdown.setOptions(fullList.map((r) => ({ value: r, label: r })));
    dropdown.setValue(current);
  }

  refreshPreview() {
    if (!this.previewEl) return;
    this.previewEl.innerHTML = buildPreviewHTML(this.state, this.previewUrl, this.civitaiInfo);
  }

  refreshCivitaiSection() {
    if (!this.civitaiSectionEl) return;
    const el = this.civitaiSectionEl;
    el.innerHTML = "";

    if (this.civitaiLoading) {
      const loading = document.createElement("div");
      loading.className = "boss-lr-civitai-loading";
      loading.textContent = "Looking up on Civitai...";
      el.appendChild(loading);
      return;
    }

    if (!this.civitaiInfo || !this.civitaiInfo.found) {
      // Show "Look up" button
      if (this.state.ckpt_name) {
        el.style.display = "";
        const label = document.createElement("span");
        label.className = "boss-label";
        label.textContent = "Civitai";
        el.appendChild(label);

        const lookupBtn = document.createElement("button");
        lookupBtn.type = "button";
        lookupBtn.className = "boss-ks-button";
        lookupBtn.style.cssText = "width:100%;margin-top:4px;";
        lookupBtn.textContent = this.civitaiInfo && this.civitaiInfo.error
          ? "Retry Civitai Lookup"
          : "Look up on Civitai";
        lookupBtn.addEventListener("click", () => this.fetchCivitaiInfo(this.state.ckpt_name));
        el.appendChild(lookupBtn);

        if (this.civitaiInfo && this.civitaiInfo.error) {
          const err = document.createElement("div");
          err.className = "boss-lr-civitai-loading";
          err.textContent = "Not found or error";
          el.appendChild(err);
        }
      } else {
        el.style.display = "none";
      }
      return;
    }

    el.style.display = "";
    const info = this.civitaiInfo;

    // Title
    const title = document.createElement("span");
    title.className = "boss-label";
    title.textContent = "Civitai Info";
    el.appendChild(title);

    // Model name + version
    const nameRow = document.createElement("div");
    nameRow.className = "boss-lr-civitai-row";
    nameRow.innerHTML = `<span class="boss-lr-civitai-model">${escapeHtml(info.model_name)}</span> <span class="boss-lr-civitai-version">${escapeHtml(info.version_name)}</span>`;
    el.appendChild(nameRow);

    // Base model badge
    if (info.base_model) {
      const badge = document.createElement("span");
      badge.className = "boss-lr-civitai-badge";
      badge.textContent = info.base_model;
      el.appendChild(badge);
    }

    // Stats row
    if (info.stats) {
      const statsRow = document.createElement("div");
      statsRow.className = "boss-lr-civitai-stats";
      const dl = info.stats.downloadCount || 0;
      const likes = info.stats.thumbsUpCount || 0;
      statsRow.innerHTML = `⬇ ${(dl / 1000).toFixed(0)}k · 👍 ${(likes / 1000).toFixed(0)}k`;
      el.appendChild(statsRow);
    }

    // Recommended params
    const rec = info.recommended || {};
    const hasRec = rec.sampler || rec.cfg || rec.steps || rec.clip_skip;
    if (hasRec) {
      const recTitle = document.createElement("div");
      recTitle.className = "boss-lr-civitai-rec-title";
      recTitle.textContent = "Recommended Settings";
      el.appendChild(recTitle);

      const recGrid = document.createElement("div");
      recGrid.className = "boss-lr-civitai-grid";
      if (rec.sampler) recGrid.innerHTML += `<div class="boss-lr-civitai-param"><span class="label">Sampler</span><span class="value">${escapeHtml(rec.sampler)}</span></div>`;
      if (rec.cfg) recGrid.innerHTML += `<div class="boss-lr-civitai-param"><span class="label">CFG</span><span class="value">${rec.cfg}</span></div>`;
      if (rec.steps) recGrid.innerHTML += `<div class="boss-lr-civitai-param"><span class="label">Steps</span><span class="value">${rec.steps}</span></div>`;
      if (rec.clip_skip) recGrid.innerHTML += `<div class="boss-lr-civitai-param"><span class="label">Clip Skip</span><span class="value">${rec.clip_skip}</span></div>`;
      el.appendChild(recGrid);

      // Apply button
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "boss-ks-button";
      applyBtn.textContent = "Apply Recommended";
      applyBtn.addEventListener("click", () => {
        if (rec.sampler) this.state.sampler_name = rec.sampler;
        if (rec.cfg) this.state.cfg = rec.cfg;
        if (rec.steps) this.state.steps = rec.steps;
        if (rec.clip_skip) this.state.clip_skip = rec.clip_skip;
        this.refreshPreview();
      });
      el.appendChild(applyBtn);
    }

    // Open on Civitai link
    if (info.civitai_url) {
      const link = document.createElement("a");
      link.href = info.civitai_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "boss-lr-civitai-link";
      link.textContent = "Open on Civitai ↗";
      el.appendChild(link);
    }
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

// ── Node setup ────────────────────────────────────────────────────────────

function setupLoaderNode(node) {
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

  node.addDOMWidget("loader_ui", "boss_loader", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossLrRoot = root;
  node._bossLrHead = head;

  const state = readState(node);
  syncNativeWidgets(node, state);
  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading...");
      const editor = new LoaderEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[UltimateLoader] open editor failed", err);
      setStatus(node, "Failed to load data. Is backend running?", true);
    }
  });
}

// ── Graph injection ──────────────────────────────────────────────────────

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  // Sync native widgets BEFORE original reads them for serialization
  try {
    for (const node of app.graph._nodes) {
      if (node.comfyClass !== "UltimateLoader") continue;
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
      if (!entry || entry.class_type !== "UltimateLoader") continue;
      const node = app.graph._nodes.find((n) => String(n.id) === id);
      if (!node) continue;
      const state = readState(node);
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[UltimateLoader] graphToPrompt inject failed", e);
  }
  return result;
};

// ── Extension registration ──────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.UltimateLoader",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "UltimateLoader") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossLrHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "UltimateLoader") return;
    setupLoaderNode(node);
  },
});

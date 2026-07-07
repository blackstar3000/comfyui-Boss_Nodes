// Ultimate Loader Pro - DOM widget + editor modal (with model preview)
import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

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
    .boss-lr-root {
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
    .boss-lr-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-lr-head .label { color: #999; }
    .boss-lr-head .value { color: #fff; font-weight: 600; }
    .boss-lr-head .sep { color: #555; margin: 0 6px; }
    .boss-lr-open {
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
    .boss-lr-open:hover { background: #7C3AED; }
    .boss-lr-open:active { transform: translateY(1px); }
    .boss-lr-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-lr-status.is-error { color: #ff8080; }

    .boss-lr-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-lr-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-lr-bar-title { font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .boss-lr-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-lr-bar-x:hover { background: #3a3d40; }

    .boss-lr-body {
      flex: 1; display: flex; overflow: hidden; min-height: 0;
    }
    .boss-lr-side {
      width: 380px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-lr-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-lr-input, .boss-lr-select {
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
    .boss-lr-input:focus, .boss-lr-select:focus { border-color: ${BRAND}; }
    .boss-lr-row { display: flex; align-items: center; gap: 10px; }
    .boss-lr-row .boss-lr-input { flex: auto; }
    .boss-lr-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: #ddd;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-lr-check input { width: 16px; height: 16px; accent-color: ${BRAND}; }
    .boss-lr-btn {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .boss-lr-btn:hover { background: #7C3AED; }
    .boss-lr-btn.danger { background: #e53e3e; }
    .boss-lr-btn.danger:hover { background: #c53030; }

    .boss-lr-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-lr-save {
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
    .boss-lr-save:hover { background: #7C3AED; }
    .boss-lr-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-lr-cancel:hover { background: #3a3d40; }

    .boss-lr-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-lr-card {
      padding: 20px;
      background: #000000;
      border-radius: 12px;
      border: 1px solid #33438775;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 0 40px rgba(82, 78, 184, 0.3);
      color: #fff;
    }
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
      background: rgba(255,255,255,0.04);
    }
    .boss-lr-item .label { color: #999; font-weight: 500; }
    .boss-lr-item .value { color: #fff; font-weight: 600; font-family: ui-monospace, monospace; }
    .boss-lr-summary {
      background: rgba(139,92,246,0.12);
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 3px solid ${BRAND};
      font-size: 13px;
      color: #ddd;
      text-align: center;
    }
    .boss-lr-summary strong { color: ${BRAND}; }
    .boss-lr-preview-img {
      display: block;
      max-width: 100%;
      max-height: 200px;
      margin: 8px auto;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: #1a1a1a;
      object-fit: contain;
    }
    .boss-lr-preview-img.placeholder {
      opacity: 0.4;
    }
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
    .replace(/'/g, "&#39;");
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
  const s = root.querySelector(".boss-lr-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// ── Preview HTML ──────────────────────────────────────────────────────────

function buildPreviewHTML(state, previewUrl) {
  const model = state.ckpt_name || "(none)";
  const dims = `${state.width}×${state.height}`;
  const imgHtml = previewUrl
    ? `<img class="boss-lr-preview-img" src="${escapeHtml(previewUrl)}" alt="Model preview"
          onerror="console.warn('[UltimateLoader] Preview image failed to load:', this.src); this.style.display='none'; var f=this.nextElementSibling; if(f) f.style.display='flex';" />`
    : "";
  const fallbackHtml = `<div class="boss-lr-preview-img placeholder" style="display:${previewUrl ? "none" : "flex"};align-items:center;justify-content:center;color:#666;font-size:12px;height:60px;">⚠️ No preview available</div>`;
  return `
    <div class="boss-lr-card">
      <div class="boss-lr-card-title">📦 Ultimate Loader</div>
      ${imgHtml}
      ${fallbackHtml}
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
  }

  async fetchData() {
    const r = await fetch("/ultimate_loader/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.data = await r.json();
  }

  async saveModelFavorite(name, ckpt) {
    const r = await fetch("/ultimate_loader/favorites/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ckpt }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    const result = await r.json();
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
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    const result = await r.json();
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
    modal.className = "boss-lr-modal";

    const bar = document.createElement("div");
    bar.className = "boss-lr-bar";
    bar.innerHTML = `<div class="boss-lr-bar-title">Ultimate Loader Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-lr-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-lr-body";

    const side = document.createElement("div");
    side.className = "boss-lr-side";

    // ── Model section ──────────────────────────────────────────────
    side.appendChild(this.buildModelSection());
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
    workspace.className = "boss-lr-preview";
    this.previewEl = document.createElement("div");
    workspace.appendChild(this.previewEl);
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-lr-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-lr-save";
    saveBtn.textContent = "Apply";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-lr-cancel";
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
    label.className = "boss-lr-section-label";
    label.textContent = "Model";
    wrap.appendChild(label);

    // Checkpoint dropdown
    const ckptSel = document.createElement("select");
    ckptSel.className = "boss-lr-select";
    const checkpoints = this.data.checkpoints || [];
    for (const ckpt of checkpoints) {
      const opt = document.createElement("option");
      opt.value = ckpt;
      opt.textContent = ckpt;
      if (ckpt === this.state.ckpt_name) opt.selected = true;
      ckptSel.appendChild(opt);
    }
    ckptSel.addEventListener("change", () => {
      this.state.ckpt_name = ckptSel.value;
      this.previewUrl = this.previewImageUrl(this.state.ckpt_name);
      this.refreshPreview();
    });
    wrap.appendChild(ckptSel);

    // Action dropdown + name input
    const actionRow = document.createElement("div");
    actionRow.className = "boss-lr-row";
    const actionSel = document.createElement("select");
    actionSel.className = "boss-lr-select";
    for (const act of ["Load Model", "Save Favorite", "Delete Favorite"]) {
      const opt = document.createElement("option");
      opt.value = act;
      opt.textContent = act;
      if (act === this.state.model_action) opt.selected = true;
      actionSel.appendChild(opt);
    }
    actionSel.addEventListener("change", () => {
      this.state.model_action = actionSel.value;
      this.refreshPreview();
    });
    actionRow.appendChild(actionSel);

    const favName = document.createElement("input");
    favName.type = "text";
    favName.className = "boss-lr-input";
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
    presetLabel.className = "boss-lr-section-label";
    presetLabel.textContent = "Model Preset (Favorite)";
    presetRow.appendChild(presetLabel);
    const presetSel = document.createElement("select");
    presetSel.className = "boss-lr-select";
    const favNames = Object.keys(this.data.model_favorites || {});
    const opts = ["None", ...favNames];
    for (const p of opts) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (p === this.state.model_preset) opt.selected = true;
      presetSel.appendChild(opt);
    }
    presetSel.addEventListener("change", () => {
      this.state.model_preset = presetSel.value;
      if (presetSel.value !== "None") {
        const ckpt = this.data.model_favorites[presetSel.value];
        if (ckpt) {
          this.state.ckpt_name = ckpt;
          // Update the checkpoint dropdown
          const ckptSel2 = wrap.querySelector("select:first-of-type");
          if (ckptSel2) {
            for (const opt of ckptSel2.options) {
              if (opt.value === ckpt) opt.selected = true;
            }
          }
          // Set preview for the loaded favorite
          this.previewUrl = this.previewImageUrl(ckpt);
        }
      }
      this.refreshPreview();
    });
    presetRow.appendChild(presetSel);
    wrap.appendChild(presetRow);

    return wrap;
  }

  buildVAESection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-lr-section-label";
    label.textContent = "VAE";
    wrap.appendChild(label);

    const sel = document.createElement("select");
    sel.className = "boss-lr-select";
    const vaes = ["Baked VAE", ...(this.data.vaes || [])];
    for (const v of vaes) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      if (v === this.state.vae_name) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      this.state.vae_name = sel.value;
      this.refreshPreview();
    });
    wrap.appendChild(sel);
    return wrap;
  }

  buildClipSkipSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-lr-section-label";
    label.textContent = "Clip Skip";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.className = "boss-lr-row";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "boss-lr-input";
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
    label.className = "boss-lr-section-label";
    label.textContent = "Aspect Ratio";
    wrap.appendChild(label);

    const sel = document.createElement("select");
    sel.className = "boss-lr-select";
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
    for (const r of fullList) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (r === this.state.aspect_ratio) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      this.state.aspect_ratio = sel.value;
      // Auto‑update width/height if it's a preset
      const match = sel.value.match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        this.state.width = parseInt(match[1]);
        this.state.height = parseInt(match[2]);
        // Update the width/height fields if they exist
        const wInput = wrap.parentNode.querySelector('input[name="width"]');
        const hInput = wrap.parentNode.querySelector('input[name="height"]');
        if (wInput) wInput.value = this.state.width;
        if (hInput) hInput.value = this.state.height;
      } else if (sel.value in presets) {
        const p = presets[sel.value];
        this.state.width = p.width;
        this.state.height = p.height;
        this.state.batch_size = p.batch_size || this.state.batch_size;
        // Update fields
        const wInput = wrap.parentNode.querySelector('input[name="width"]');
        const hInput = wrap.parentNode.querySelector('input[name="height"]');
        const bInput = wrap.parentNode.querySelector(
          'input[name="batch_size"]',
        );
        if (wInput) wInput.value = this.state.width;
        if (hInput) hInput.value = this.state.height;
        if (bInput) bInput.value = this.state.batch_size;
      }
      this.refreshPreview();
    });
    wrap.appendChild(sel);

    // Width/Height inputs
    const dimRow = document.createElement("div");
    dimRow.className = "boss-lr-row";
    const wLabel = document.createElement("span");
    wLabel.textContent = "W";
    const wInput = document.createElement("input");
    wInput.type = "number";
    wInput.className = "boss-lr-input";
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
      // Clear aspect ratio to custom
      this.state.aspect_ratio = "width x height [custom]";
      const sel2 = wrap.querySelector("select");
      if (sel2) {
        for (const opt of sel2.options) {
          if (opt.value === "width x height [custom]") opt.selected = true;
        }
      }
      this.refreshPreview();
    });
    const hLabel = document.createElement("span");
    hLabel.textContent = "H";
    const hInput = document.createElement("input");
    hInput.type = "number";
    hInput.className = "boss-lr-input";
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
      const sel2 = wrap.querySelector("select");
      if (sel2) {
        for (const opt of sel2.options) {
          if (opt.value === "width x height [custom]") opt.selected = true;
        }
      }
      this.refreshPreview();
    });
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
    label.className = "boss-lr-section-label";
    label.textContent = "Batch Size";
    wrap.appendChild(label);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "boss-lr-input";
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
    wrap.appendChild(input);
    return wrap;
  }

  buildSizePresetSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-lr-section-label";
    label.textContent = "Save Size Preset";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.className = "boss-lr-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "boss-lr-input";
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
    delLabel.className = "boss-lr-section-label";
    delLabel.textContent = "Delete Size Preset";
    const delSelect = document.createElement("select");
    delSelect.className = "boss-lr-select";
    const presets = this.data.size_presets || {};
    const keys = Object.keys(presets);
    if (keys.length) {
      for (const k of keys) {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = k;
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
    delBtn.className = "boss-lr-btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const name = delSelect.value;
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
    delRow.appendChild(delSelect);
    delRow.appendChild(delBtn);
    wrap.appendChild(delRow);

    return wrap;
  }

  refreshSizeDropdown() {
    // Rebuild the aspect ratio dropdown (the one in the size section)
    const side = this.modal?.querySelector(".boss-lr-side");
    if (!side) return;
    const sizeSection = side.querySelector(".boss-lr-section-label + select");
    if (!sizeSection) return;
    // Rebuild options
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
    // Clear existing options
    sizeSection.innerHTML = "";
    for (const r of fullList) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (r === current) opt.selected = true;
      sizeSection.appendChild(opt);
    }
  }

  refreshPreview() {
    if (!this.previewEl) return;
    this.previewEl.innerHTML = buildPreviewHTML(this.state, this.previewUrl);
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
  root.className = "boss-lr-root";

  const head = document.createElement("div");
  head.className = "boss-lr-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-lr-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-lr-status";
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

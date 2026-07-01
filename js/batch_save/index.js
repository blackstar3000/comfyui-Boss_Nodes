// Batch Save Pro - DOM widget + editor modal
import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "saveState";
const HIDDEN_INPUT_NAME = "SaveState";

const VISIBLE_NATIVE_WIDGETS = [
  "text",
  "base_filename",
  "naming_mode",
  "extension",
  "custom_key",
  "simple_mode",
  "category_folder",
  "folder_path",
  "reset_counter",
];

// ── CSS (injected once) ──────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-batch-css")) return;
  const css = `
    .boss-bs-root {
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
    .boss-bs-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-bs-head .label { color: #999; }
    .boss-bs-head .value { color: #fff; font-weight: 600; }
    .boss-bs-head .sep { color: #555; margin: 0 6px; }
    .boss-bs-open {
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
    .boss-bs-open:hover { background: #7C3AED; }
    .boss-bs-open:active { transform: translateY(1px); }
    .boss-bs-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-bs-status.is-error { color: #ff8080; }

    .boss-bs-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-bs-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-bs-bar-title { font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .boss-bs-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-bs-bar-x:hover { background: #3a3d40; }

    .boss-bs-body {
      flex: 1; display: flex; overflow: hidden; min-height: 0;
    }
    .boss-bs-side {
      width: 420px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-bs-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-bs-input, .boss-bs-select, .boss-bs-textarea {
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
    .boss-bs-input:focus, .boss-bs-select:focus, .boss-bs-textarea:focus { border-color: ${BRAND}; }
    .boss-bs-textarea {
      resize: vertical;
      min-height: 80px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .boss-bs-row { display: flex; align-items: center; gap: 10px; }
    .boss-bs-row .boss-bs-input { flex: 1; }
    .boss-bs-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: #ddd;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-bs-check input { width: 16px; height: 16px; accent-color: ${BRAND}; }

    .boss-bs-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-bs-save {
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
    .boss-bs-save:hover { background: #7C3AED; }
    .boss-bs-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-bs-cancel:hover { background: #3a3d40; }

    .boss-bs-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .boss-bs-card {
      padding: 20px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid #444;
      max-width: 600px;
      width: 100%;
      color: #fff;
    }
    .boss-bs-card-title {
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
    .boss-bs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .boss-bs-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.04);
    }
    .boss-bs-item .label { color: #999; font-weight: 500; }
    .boss-bs-item .value { color: #fff; font-weight: 600; font-family: ui-monospace, monospace; }
    .boss-bs-preview-text {
      background: rgba(255,255,255,0.06);
      padding: 12px;
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      color: #ccc;
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-batch-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── Helpers ──────────────────────────────────────────────────────────────

function widgetValue(node, name, fallback) {
  const w = (node.widgets || []).find((x) => x.name === name);
  return w ? w.value : fallback;
}

function defaultStateFromWidgets(node) {
  return {
    text: widgetValue(node, "text", ""),
    base_filename: widgetValue(node, "base_filename", "prompt"),
    naming_mode: widgetValue(node, "naming_mode", "batch_numbered"),
    extension: widgetValue(node, "extension", ".json"),
    custom_key: widgetValue(node, "custom_key", ""),
    simple_mode: !!widgetValue(node, "simple_mode", false),
    category_folder: widgetValue(node, "category_folder", ""),
    folder_path: widgetValue(node, "folder_path", ""),
    reset_counter: !!widgetValue(node, "reset_counter", false),
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
        merged.simple_mode = !!merged.simple_mode;
        merged.reset_counter = !!merged.reset_counter;
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
  setWidgetValue(node, "text", state.text);
  setWidgetValue(node, "base_filename", state.base_filename);
  setWidgetValue(node, "naming_mode", state.naming_mode);
  setWidgetValue(node, "extension", state.extension);
  setWidgetValue(node, "custom_key", state.custom_key);
  setWidgetValue(node, "simple_mode", state.simple_mode);
  setWidgetValue(node, "category_folder", state.category_folder);
  setWidgetValue(node, "folder_path", state.folder_path);
  setWidgetValue(node, "reset_counter", state.reset_counter);
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
  const head = node._bossBsHead;
  if (!head) return;
  const state = readState(node);
  const mode = state.naming_mode.replace("_", " ").toUpperCase();
  const preview = state.text
    ? state.text.slice(0, 40) + (state.text.length > 40 ? "…" : "")
    : "(empty)";
  head.innerHTML = `
    <span class="label">Mode:</span> <span class="value">${escapeHtml(mode)}</span>
    <span class="sep">·</span>
    <span class="label">File:</span> <span class="value">${escapeHtml(state.base_filename)}</span>
    <span class="sep">·</span>
    <span class="label">Preview:</span> <span class="value">${escapeHtml(preview)}</span>
  `;
}

function setStatus(node, text, isError = false) {
  const root = node._bossBsRoot;
  if (!root) return;
  const s = root.querySelector(".boss-bs-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// ── Preview HTML ──────────────────────────────────────────────────────────

function buildPreviewHTML(state, counter) {
  const mode = state.naming_mode;
  const ext = state.extension;
  const base = state.base_filename || "prompt";
  const now = new Date();
  const ts = now
    .toISOString()
    .slice(0, 19)
    .replace(/[:-]/g, "-")
    .replace("T", "_");
  const counterStr = String(counter + 1).padStart(4, "0");

  let filename = base + ext;
  if (mode === "single_append" || mode === "single_overwrite") {
    // same
  } else if (mode === "batch_numbered") {
    filename = `${base}_${counterStr}${ext}`;
  } else if (mode === "batch_timestamp") {
    filename = `${base}_${ts}${ext}`;
  } else {
    // batch_numbered_timestamp
    filename = `${base}_${counterStr}_${ts}${ext}`;
  }

  const textPreview = state.text
    ? state.text.slice(0, 120) + (state.text.length > 120 ? "…" : "")
    : "(empty)";

  return `
    <div class="boss-bs-card">
      <div class="boss-bs-card-title">📁 Batch Save Preview</div>
      <div class="boss-bs-grid">
        <div class="boss-bs-item"><span class="label">Mode</span><span class="value">${escapeHtml(mode)}</span></div>
        <div class="boss-bs-item"><span class="label">Extension</span><span class="value">${escapeHtml(ext)}</span></div>
        <div class="boss-bs-item"><span class="label">Filename</span><span class="value">${escapeHtml(filename)}</span></div>
        <div class="boss-bs-item"><span class="label">Simple mode</span><span class="value">${state.simple_mode ? "ON" : "OFF"}</span></div>
        <div class="boss-bs-item"><span class="label">Custom key</span><span class="value">${escapeHtml(state.custom_key || "(none)")}</span></div>
        <div class="boss-bs-item"><span class="label">Category folder</span><span class="value">${escapeHtml(state.category_folder || "(none)")}</span></div>
        <div class="boss-bs-item"><span class="label">Override path</span><span class="value">${escapeHtml(state.folder_path || "(default)")}</span></div>
        <div class="boss-bs-item"><span class="label">Reset counter</span><span class="value">${state.reset_counter ? "✅" : "❌"}</span></div>
      </div>
      <div class="boss-bs-section-label">Text preview</div>
      <div class="boss-bs-preview-text">${escapeHtml(textPreview)}</div>
    </div>
  `;
}

// ── Editor class ────────────────────────────────────────────────────────────

class BatchSaveEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.counter = 0;
    this.modal = null;
  }

  async fetchCounter() {
    const r = await fetch("/batch_save/counter");
    if (r.ok) {
      const data = await r.json();
      this.counter = data.counter || 0;
    } else {
      this.counter = 0;
    }
  }

  open() {
    return this.fetchCounter().then(() => this.buildModal());
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const modal = document.createElement("div");
    modal.className = "boss-bs-modal";

    const bar = document.createElement("div");
    bar.className = "boss-bs-bar";
    bar.innerHTML = `<div class="boss-bs-bar-title">Batch Save Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-bs-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-bs-body";

    const side = document.createElement("div");
    side.className = "boss-bs-side";

    // ── Text ────────────────────────────────────────────────────────────
    side.appendChild(this.buildTextSection());
    // ── Base filename ──────────────────────────────────────────────────
    side.appendChild(this.buildFilenameSection());
    // ── Naming mode ────────────────────────────────────────────────────
    side.appendChild(
      this.buildSelectSection("Naming Mode", "naming_mode", [
        "single_overwrite",
        "single_append",
        "batch_numbered",
        "batch_timestamp",
        "batch_numbered_timestamp",
      ]),
    );
    // ── Extension ──────────────────────────────────────────────────────
    side.appendChild(
      this.buildSelectSection("Extension", "extension", [
        ".txt",
        ".json",
        ".md",
        ".log",
        ".csv",
      ]),
    );
    // ── Custom key ──────────────────────────────────────────────────────
    side.appendChild(
      this.buildInputSection(
        "Custom Key",
        "custom_key",
        "e.g. Vicky, Goth Girl",
      ),
    );
    // ── Simple mode checkbox ────────────────────────────────────────────
    side.appendChild(
      this.buildCheckboxSection(
        "Simple Mode",
        "simple_mode",
        "Only the prompt text, no metadata",
      ),
    );
    // ── Category folder ──────────────────────────────────────────────────
    side.appendChild(
      this.buildInputSection(
        "Category Folder",
        "category_folder",
        "Optional subfolder",
      ),
    );
    // ── Folder path override ────────────────────────────────────────────
    side.appendChild(
      this.buildInputSection(
        "Folder Path (override)",
        "folder_path",
        "Full path override",
      ),
    );
    // ── Reset counter checkbox ──────────────────────────────────────────
    side.appendChild(
      this.buildCheckboxSection(
        "Reset Counter",
        "reset_counter",
        "Reset to 0001 on next save",
      ),
    );

    const workspace = document.createElement("div");
    workspace.className = "boss-bs-preview";
    this.previewEl = document.createElement("div");
    workspace.appendChild(this.previewEl);
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-bs-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-bs-save";
    saveBtn.textContent = "Apply";
    saveBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-bs-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshPreview();
  }

  // ── Sub‑controls ──────────────────────────────────────────────────────

  buildTextSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-bs-section-label";
    label.textContent = "Text to Save";
    wrap.appendChild(label);
    const textarea = document.createElement("textarea");
    textarea.className = "boss-bs-textarea";
    textarea.spellcheck = false;
    textarea.value = this.state.text;
    textarea.addEventListener("input", () => {
      this.state.text = textarea.value;
      this.refreshPreview();
    });
    wrap.appendChild(textarea);
    return wrap;
  }

  buildFilenameSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-bs-section-label";
    label.textContent = "Base Filename";
    wrap.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "boss-bs-input";
    input.value = this.state.base_filename;
    input.addEventListener("input", () => {
      this.state.base_filename = input.value;
      this.refreshPreview();
    });
    wrap.appendChild(input);
    return wrap;
  }

  buildSelectSection(title, key, options) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-bs-section-label";
    label.textContent = title;
    wrap.appendChild(label);
    const select = document.createElement("select");
    select.className = "boss-bs-select";
    for (const opt of options) {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      if (this.state[key] === opt) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      this.state[key] = select.value;
      this.refreshPreview();
    });
    wrap.appendChild(select);
    return wrap;
  }

  buildInputSection(title, key, placeholder) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-bs-section-label";
    label.textContent = title;
    wrap.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "boss-bs-input";
    input.placeholder = placeholder || "";
    input.value = this.state[key];
    input.addEventListener("input", () => {
      this.state[key] = input.value;
      this.refreshPreview();
    });
    wrap.appendChild(input);
    return wrap;
  }

  buildCheckboxSection(title, key, tooltip) {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.className = "boss-bs-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!this.state[key];
    input.addEventListener("change", () => {
      this.state[key] = !!input.checked;
      this.refreshPreview();
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(title));
    wrap.appendChild(label);
    if (tooltip) {
      const tip = document.createElement("div");
      tip.style.color = "#888";
      tip.style.fontSize = "11px";
      tip.style.marginTop = "4px";
      tip.textContent = tooltip;
      wrap.appendChild(tip);
    }
    return wrap;
  }

  refreshPreview() {
    if (!this.previewEl) return;
    this.previewEl.innerHTML = buildPreviewHTML(this.state, this.counter);
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

function setupBatchSaveNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-bs-root";

  const head = document.createElement("div");
  head.className = "boss-bs-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-bs-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-bs-status";
  root.appendChild(status);

  node.addDOMWidget("batch_ui", "boss_batch", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossBsRoot = root;
  node._bossBsHead = head;

  const state = readState(node);
  syncNativeWidgets(node, state);
  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading…");
      const editor = new BatchSaveEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BatchSave] open editor failed", err);
      setStatus(node, "Failed to load. Is backend running?", true);
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
      if (!entry || entry.class_type !== "BatchSaveAutoNaming") continue;
      const node = app.graph._nodes.find((n) => String(n.id) === id);
      if (!node) continue;
      const state = readState(node);
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[BatchSave] graphToPrompt inject failed", e);
  }
  return result;
};

// ── Extension registration ──────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.BatchSave",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "BatchSaveAutoNaming") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossBsHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "BatchSaveAutoNaming") return;
    setupBatchSaveNode(node);
  },
});

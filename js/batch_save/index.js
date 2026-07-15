// Batch Save Pro - DOM widget + editor modal
// Uses shared Boss Theme classes from js/boss_theme/
import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

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
    ? state.text.slice(0, 40) + (state.text.length > 40 ? "\u2026" : "")
    : "(empty)";
  head.innerHTML = `
    <span class="label">Mode:</span> <span class="value">${escapeHtml(mode)}</span>
    <span class="sep">\u00B7</span>
    <span class="label">File:</span> <span class="value">${escapeHtml(state.base_filename)}</span>
    <span class="sep">\u00B7</span>
    <span class="label">Preview:</span> <span class="value">${escapeHtml(preview)}</span>
  `;
}

function setStatus(node, text, isError = false) {
  const root = node._bossBsRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
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
    ? state.text.slice(0, 120) + (state.text.length > 120 ? "..." : "")
    : "(empty)";

  return `
    <div class="boss-card">
      <div class="boss-card-title">\u{1F4C1} Batch Save Preview</div>
      <div class="boss-grid">
        <div class="boss-grid-item"><span class="label">Mode</span><span class="value">${escapeHtml(mode)}</span></div>
        <div class="boss-grid-item"><span class="label">Extension</span><span class="value">${escapeHtml(ext)}</span></div>
        <div class="boss-grid-item"><span class="label">Filename</span><span class="value">${escapeHtml(filename)}</span></div>
        <div class="boss-grid-item"><span class="label">Simple mode</span><span class="value">${state.simple_mode ? "ON" : "OFF"}</span></div>
        <div class="boss-grid-item"><span class="label">Custom key</span><span class="value">${escapeHtml(state.custom_key || "(none)")}</span></div>
        <div class="boss-grid-item"><span class="label">Category folder</span><span class="value">${escapeHtml(state.category_folder || "(none)")}</span></div>
        <div class="boss-grid-item"><span class="label">Override path</span><span class="value" style="font-size:11px">${escapeHtml(state.folder_path || "(default)")}</span></div>
        <div class="boss-grid-item"><span class="label">Reset counter</span><span class="value">${state.reset_counter ? "\u274C" : "\u274C"}</span></div>
      </div>
      <div class="boss-label">Text Preview</div>
      <div class="boss-prompt-box">${escapeHtml(textPreview)}</div>
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
    modal.className = "boss-modal";

    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">Batch Save Pro Editor</div>`;
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
    side.className = "boss-side";

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
    this.refreshPreview();
  }

  // ── Sub-controls ──────────────────────────────────────────────────────

  buildTextSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Text to Save";
    wrap.appendChild(label);
    const textarea = document.createElement("textarea");
    textarea.className = "boss-textarea";
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
    label.className = "boss-label";
    label.textContent = "Base Filename";
    wrap.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "boss-input";
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
    const dropdown = new BossDropdown({
      label: title,
      options: options.map((o) => ({ value: o, label: o })),
      value: this.state[key],
      searchable: options.length > 5,
      onChange: (value) => {
        this.state[key] = value;
        this.refreshPreview();
      },
    });
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  buildInputSection(title, key, placeholder) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = title;
    wrap.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "boss-input";
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
    label.className = "boss-check";
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
      tip.style.color = "var(--boss-text-muted)";
      tip.style.fontSize = "var(--boss-font-size-sm)";
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
      setStatus(node, "Loading\u2026");
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

      if (state.reset_counter) {
        const newState = { ...state, reset_counter: false };
        writeState(node, newState);
        setWidgetValue(node, "reset_counter", false);
        renderHeader(node);
      }
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

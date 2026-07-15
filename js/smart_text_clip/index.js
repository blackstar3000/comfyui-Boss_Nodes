// Smart Text CLIP Encode Pro – BOSS UI
import { app } from "/scripts/app.js";

const STATE_PROP = "textState";
const HIDDEN_INPUT_NAME = "TextState";

// Widgets we will hide on canvas (they will be shown inside the editor)
const VISIBLE_NATIVE_WIDGETS = ["positive_text", "negative_text", "module"];

// ── CSS ──────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-smart-text-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Status variants */
    .boss-status.is-success { color: #4ade80; }

    /* Side panel width override */
    .boss-st-side-custom { width: 500px; min-width: 300px; }

    /* Section labels */
    .boss-st-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--boss-text-muted);
      letter-spacing: 1px;
      margin-bottom: 2px;
    }

    /* Textarea */
    .boss-st-textarea {
      width: 100%;
      padding: 8px 10px;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border);
      color: #fff;
      border-radius: var(--boss-radius-md);
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      font-family: ui-monospace, monospace;
      resize: vertical;
      min-height: 80px;
      transition: border-color 0.2s;
    }
    .boss-st-textarea:focus { border-color: var(--boss-brand); }

    /* Prompt preview box */
    .boss-st-prompt-box {
      background: rgba(0,0,0,0.4);
      padding: 12px;
      border-radius: var(--boss-radius-md);
      font-family: ui-monospace, monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid var(--boss-border);
      max-height: 400px;
      overflow-y: auto;
    }
    .boss-st-token-count {
      font-size: 11px;
      color: var(--boss-text-muted);
      margin-top: 6px;
      text-align: right;
    }

    /* Info card */
    .boss-st-info-card {
      padding: 16px;
      background: var(--boss-bg-section);
      border-radius: 12px;
      border: 1px solid var(--boss-border-strong);
      width: 120%;
      box-shadow: 0 0 40px rgba(82, 78, 184, 0.3);
      color: #fff;
    }
    .boss-st-info-card .card-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 12px;
      color: var(--boss-brand);
    }

    /* Copy preview button */
    .boss-st-copy-btn {
      background: var(--boss-bg-hover);
      color: var(--boss-text);
      border: 1px solid var(--boss-border);
      padding: 4px 12px;
      border-radius: var(--boss-radius-sm);
      font-size: 12px;
      cursor: pointer;
    }
    .boss-st-copy-btn:hover { background: var(--boss-bg-active); }
  `;
  const style = document.createElement("style");
  style.id = "boss-smart-text-css";
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
    positive_text: widgetValue(node, "positive_text", ""),
    negative_text: widgetValue(node, "negative_text", ""),
    module: widgetValue(node, "module", ""),
  };
}

function readState(node) {
  const base = defaultStateFromWidgets(node);
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") {
        return { ...base, ...obj };
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
        /* */
      }
    }
  }
}

function syncNativeWidgets(node, state) {
  const excludeNames = ["boss_smart_text", HIDDEN_INPUT_NAME];
  for (const key in state) {
    if (excludeNames.includes(key)) continue;
    setWidgetValue(node, key, state[key]);
  }
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
  const head = node._bossStHead;
  if (!head) return;
  const state = readState(node);
  const pos = state.positive_text
    ? state.positive_text.slice(0, 20) +
      (state.positive_text.length > 20 ? "…" : "")
    : "(empty)";
  const neg = state.negative_text
    ? state.negative_text.slice(0, 20) +
      (state.negative_text.length > 20 ? "…" : "")
    : "(empty)";
  head.innerHTML = `
    <span class="label">Pos:</span> <span class="value">${escapeHtml(pos)}</span>
    <span class="label">Neg:</span> <span class="value">${escapeHtml(neg)}</span>
    ${state.module ? `<span class="label">Module:</span> <span class="value">${escapeHtml(state.module)}</span>` : ""}
  `;
}

function setStatus(node, text, type = "") {
  const root = node._bossStRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.className = "boss-status";
  if (type) s.classList.add(type);
}

// ── Editor class ────────────────────────────────────────────────────────

class SmartTextEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.modal = null;
  }

  open() {
    this.buildModal();
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
    bar.innerHTML = `<div class="boss-bar-title">Smart Text CLIP Encode</div>`;
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
    side.className = "boss-side boss-st-side-custom";

    // Positive
    const posWrap = document.createElement("div");
    const posLabel = document.createElement("div");
    posLabel.className = "boss-st-section-label";
    posLabel.textContent = "Positive Prompt";
    posWrap.appendChild(posLabel);
    const posArea = document.createElement("textarea");
    posArea.className = "boss-st-textarea";
    posArea.rows = 4;
    posArea.value = this.state.positive_text;
    posArea.addEventListener("input", () => {
      this.state.positive_text = posArea.value;
      this.refreshPreview();
    });
    posWrap.appendChild(posArea);
    side.appendChild(posWrap);

    // Negative
    const negWrap = document.createElement("div");
    const negLabel = document.createElement("div");
    negLabel.className = "boss-st-section-label";
    negLabel.textContent = "Negative Prompt";
    negWrap.appendChild(negLabel);
    const negArea = document.createElement("textarea");
    negArea.className = "boss-st-textarea";
    negArea.rows = 4;
    negArea.value = this.state.negative_text;
    negArea.addEventListener("input", () => {
      this.state.negative_text = negArea.value;
      this.refreshPreview();
    });
    negWrap.appendChild(negArea);
    side.appendChild(negWrap);

    // Module
    const modWrap = document.createElement("div");
    const modLabel = document.createElement("div");
    modLabel.className = "boss-st-section-label";
    modLabel.textContent = "Module (prefix)";
    modWrap.appendChild(modLabel);
    const modInput = document.createElement("input");
    modInput.type = "text";
    modInput.className = "boss-input";
    modInput.value = this.state.module;
    modInput.addEventListener("input", () => {
      this.state.module = modInput.value;
      this.refreshPreview();
    });
    modWrap.appendChild(modInput);
    side.appendChild(modWrap);

    // Preview
    const previewContainer = document.createElement("div");
    previewContainer.style.flex = "1";
    previewContainer.style.display = "flex";
    previewContainer.style.flexDirection = "column";
    previewContainer.style.gap = "6px";
    const previewLabel = document.createElement("div");
    previewLabel.className = "boss-st-section-label";
    previewLabel.textContent = "Final Prompts (with module)";
    previewContainer.appendChild(previewLabel);
    this.previewBox = document.createElement("div");
    this.previewBox.className = "boss-st-prompt-box";
    previewContainer.appendChild(this.previewBox);
    this.tokenCount = document.createElement("div");
    this.tokenCount.className = "boss-st-token-count";
    previewContainer.appendChild(this.tokenCount);
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "boss-st-copy-btn";
    copyBtn.textContent = "📋 Copy Preview";
    copyBtn.addEventListener("click", () => {
      const text = this.previewBox.textContent || "";
      navigator.clipboard
        .writeText(text)
        .then(() => setStatus(this.node, "Copied!", "is-success"))
        .catch(() => setStatus(this.node, "Copy failed", "is-error"));
    });
    previewContainer.appendChild(copyBtn);
    side.appendChild(previewContainer);

    const workspace = document.createElement("div");
    workspace.className = "boss-preview";
    // Placeholder for future additional previews (not needed now)
    workspace.innerHTML = `<div class="boss-st-info-card"><div class="card-title">📝 Node Info</div><div style="color:#aaa;font-size:12px;">This node encodes both positive and negative prompts using the same CLIP model.<br><br>It also passes through MODEL and CLIP outputs for easy chaining.</div></div>`;
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-footer";
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "boss-btn-primary";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(applyBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshPreview();
  }

  refreshPreview() {
    if (!this.previewBox) return;
    const pos = this.state.positive_text;
    const neg = this.state.negative_text;
    const mod = this.state.module || "";
    let finalPos = mod ? (pos ? `${mod}, ${pos}` : mod) : pos;
    let finalNeg = mod ? (neg ? `${mod}, ${neg}` : mod) : neg;
    const combined = `POS: ${finalPos}\nNEG: ${finalNeg}`;
    this.previewBox.textContent = combined;
    // Rough token count (approx 1 token per 4 chars)
    const totalChars = (finalPos + finalNeg).length;
    const tokenEstimate = Math.round(totalChars / 4);
    this.tokenCount.textContent = `≈ ${tokenEstimate} tokens (estimated)`;
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

function setupSmartTextNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  // Hide the native widgets (they will be shown in the editor)
  for (const w of node.widgets || []) {
    if (VISIBLE_NATIVE_WIDGETS.includes(w.name)) {
      w.hidden = true;
      w.computeSize = () => [0, -4];
      if (!w.options) w.options = {};
      w.options.canvasOnly = true;
    }
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

  node.addDOMWidget("smart_text_ui", "boss_smart_text", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 80,
    margin: 4,
    serialize: false,
  });

  node._bossStRoot = root;
  node._bossStHead = head;

  const state = readState(node);
  syncNativeWidgets(node, state);
  renderHeader(node);

  openBtn.addEventListener("click", () => {
    try {
      const editor = new SmartTextEditor(node);
      editor.open();
    } catch (err) {
      console.error("[SmartText] open editor failed", err);
      setStatus(node, "Error opening editor", "is-error");
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
      if (!entry || entry.class_type !== "SmartTextClipEncode") continue;
      const node = app.graph._nodes.find((n) => String(n.id) === id);
      if (!node) continue;
      const state = readState(node);
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[SmartText] graphToPrompt inject failed", e);
  }
  return result;
};

// ── Extension registration ──────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.SmartTextClipEncode",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "SmartTextClipEncode") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossStHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "SmartTextClipEncode") return;
    setupSmartTextNode(node);
  },
});

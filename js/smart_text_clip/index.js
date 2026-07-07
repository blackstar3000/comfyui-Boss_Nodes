// Smart Text CLIP Encode Pro – BOSS UI
import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "textState";
const HIDDEN_INPUT_NAME = "TextState";

// Widgets we will hide on canvas (they will be shown inside the editor)
const VISIBLE_NATIVE_WIDGETS = ["positive_text", "negative_text", "module"];

// ── CSS ──────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-smart-text-css")) return;
  const css = `
    .boss-st-root {
      box-sizing: border-box;
      width: 100%;
      padding: 10px;
      background: rgba(22, 22, 24, 0.55);
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      color: #eee;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .boss-st-head {
      font-size: 11px;
      color: #ccc;
      line-height: 1.4;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 12px;
    }
    .boss-st-head .label { color: #888; }
    .boss-st-head .value { color: #fff; font-weight: 500; }
    .boss-st-open {
      background: ${BRAND};
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.2s;
      box-shadow: 0 0 12px ${BRAND_GLOW};
    }
    .boss-st-open:hover { background: #7C3AED; box-shadow: 0 0 24px ${BRAND_GLOW}; }
    .boss-st-status {
      font-size: 10px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-st-status.is-error { color: #ff8080; }
    .boss-st-status.is-success { color: #4ade80; }

    /* Modal */
    .boss-st-modal {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(12px);
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-st-bar {
      height: 56px;
      background: rgba(23, 23, 24, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-st-bar-title {
      font-size: 14px; font-weight: 600; letter-spacing: 1px;
      text-transform: uppercase;
      color: #fff;
      text-shadow: 0 0 30px ${BRAND_GLOW};
    }
    .boss-st-bar-x {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.12);
      color: #eee;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .boss-st-bar-x:hover { background: rgba(255,255,255,0.08); }

    .boss-st-body {
      flex: 1;
      display: flex;
      overflow: hidden;
      min-height: 0;
    }
    .boss-st-side {
      width: 500px;
      min-width: 300px;
      background: rgba(23, 23, 24, 0.5);
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(255,255,255,0.06);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-st-side::-webkit-scrollbar { width: 4px; }
    .boss-st-side::-webkit-scrollbar-thumb { background: ${BRAND}; border-radius: 4px; }

    .boss-st-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .boss-st-textarea {
      width: 100%;
      padding: 8px 10px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      color: #fff;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      font-family: ui-monospace, monospace;
      resize: vertical;
      min-height: 80px;
      transition: border-color 0.2s;
    }
    .boss-st-textarea:focus { border-color: ${BRAND}; }
    .boss-st-input {
      width: 100%;
      padding: 8px 10px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      color: #fff;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .boss-st-input:focus { border-color: ${BRAND}; }

    .boss-st-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .boss-st-card {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 18px;
      padding: 18px;
      color: #fff;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .boss-st-card-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 12px;
      color: ${BRAND};
    }
    .boss-st-prompt-box {
      background: rgba(0,0,0,0.4);
      padding: 12px;
      border-radius: 10px;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid rgba(255,255,255,0.04);
      max-height: 400px;
      overflow-y: auto;
    }
    .boss-st-token-count {
      font-size: 11px;
      color: #999;
      margin-top: 6px;
      text-align: right;
    }

    .boss-st-footer {
      height: 56px;
      background: rgba(23, 23, 24, 0.5);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
      justify-content: flex-end;
    }
    .boss-st-save {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 9px 22px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 0 30px ${BRAND_GLOW};
      transition: background 0.1s;
    }
    .boss-st-save:hover { background: #7C3AED; }
    .boss-st-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid rgba(255,255,255,0.15);
      padding: 9px 22px;
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .boss-st-cancel:hover { background: rgba(255,255,255,0.05); }

    .boss-st-empty {
      color: #666;
      font-style: italic;
      padding: 10px;
    }
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
  const s = root.querySelector(".boss-st-status");
  if (!s) return;
  s.textContent = text || "";
  s.className = "boss-st-status";
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
    modal.className = "boss-st-modal";

    const bar = document.createElement("div");
    bar.className = "boss-st-bar";
    bar.innerHTML = `<div class="boss-st-bar-title">Smart Text CLIP Encode</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-st-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-st-body";

    const side = document.createElement("div");
    side.className = "boss-st-side";

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
    modInput.className = "boss-st-input";
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
    copyBtn.className = "boss-st-save";
    copyBtn.textContent = "📋 Copy Preview";
    copyBtn.style.padding = "4px 12px";
    copyBtn.style.fontSize = "12px";
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
    workspace.className = "boss-st-preview";
    // Placeholder for future additional previews (not needed now)
    workspace.innerHTML = `<div class="boss-st-card"><div class="boss-st-card-title">📝 Node Info</div><div style="color:#aaa;font-size:12px;">This node encodes both positive and negative prompts using the same CLIP model.<br><br>It also passes through MODEL and CLIP outputs for easy chaining.</div></div>`;
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-st-footer";
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "boss-st-save";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-st-cancel";
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
  root.className = "boss-st-root";

  const head = document.createElement("div");
  head.className = "boss-st-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-st-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-st-status";
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

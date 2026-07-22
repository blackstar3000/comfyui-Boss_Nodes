// ╔═══════════════════════════════════════════════════════════════╗
// ║  Danbooru Tag Validator Boss — DOM widget + editor modal     ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Validates prompt text against the Danbooru tag database.
//   - On-node: summary line showing tag counts
//   - Editor modal: full prompt editor with live validation,
//     color-coded tags, suggestions, and one-click fix.

import { app } from "/scripts/app.js";

// ── Constants ──────────────────────────────────────────────────────────────

const STATE_PROP = "validatorState";
const HIDDEN_INPUT_NAME = "ValidatorState";

// ── CSS (injected once, idempotent) ────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-danbooru-css")) return;
  const css = `
    /* On-node */
    .boss-dan-stats { font-size: 11px; color: var(--boss-text-dim); margin-top: 2px; }
    .boss-dan-stats .ok { color: #3ec371; }
    .boss-dan-stats .warn { color: #ffa500; }
    .boss-dan-stats .err { color: #ff4444; }

    /* Editor modal */
    .boss-dan-modal .boss-body {
      flex-direction: column;
    }
    .boss-dan-editor-wrap {
      display: flex; flex-direction: column; gap: 12px;
      padding: 16px;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
      max-height: 50vh; overflow-y: auto;
    }
    .boss-dan-editor {
      width: 100%; min-height: 160px; max-height: 300px;
      background: transparent; border: none; outline: none;
      color: var(--boss-text-bright);
      font-family: var(--boss-font-mono);
      font-size: 13px; line-height: 1.6;
      resize: vertical;
    }

    /* Tag result rows */
    .boss-dan-section { margin-top: 12px; }
    .boss-dan-section-title {
      font-size: 12px; font-weight: 600;
      color: var(--boss-text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 6px;
    }
    .boss-dan-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .boss-dan-tag {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 10px; font-size: 11px;
      border: 1px solid var(--boss-border);
      cursor: default; transition: background 0.15s;
    }
    .boss-dan-tag.valid {
      background: #1a3d1a; border-color: #3ec371; color: #3ec371;
    }
    .boss-dan-tag.invalid {
      background: #3d1a1a; border-color: #ff4444; color: #ff4444;
    }
    .boss-dan-tag.rare {
      background: #3d2e1a; border-color: #ffa500; color: #ffa500;
    }
    .boss-dan-tag .fix-btn {
      background: none; border: none; color: inherit;
      cursor: pointer; font-size: 10px; padding: 0 2px;
      opacity: 0.6; transition: opacity 0.15s;
    }
    .boss-dan-tag .fix-btn:hover { opacity: 1; }

    /* Suggestion chips */
    .boss-dan-sugg-row { margin-top: 4px; display: flex; align-items: center; gap: 6px; }
    .boss-dan-sugg-label { font-size: 11px; color: var(--boss-text-dim); }
    .boss-dan-sugg-chip {
      padding: 2px 8px; border-radius: 8px; font-size: 11px;
      background: var(--boss-bg-hover); border: 1px solid var(--boss-border);
      cursor: pointer; color: var(--boss-text);
      transition: background 0.15s, border-color 0.15s;
    }
    .boss-dan-sugg-chip:hover {
      background: var(--boss-brand); border-color: var(--boss-brand); color: #fff;
    }

    /* Stats bar */
    .boss-dan-stats-bar {
      display: flex; gap: 16px; padding: 10px 16px;
      background: var(--boss-bg-card);
      border: 1px solid var(--boss-border);
      border-radius: var(--boss-radius-md);
      font-size: 12px; color: var(--boss-text-muted);
    }
    .boss-dan-stats-bar .stat { display: flex; align-items: center; gap: 4px; }
    .boss-dan-stats-bar .dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .boss-dan-stats-bar .dot.green { background: #3ec371; }
    .boss-dan-stats-bar .dot.red { background: #ff4444; }
    .boss-dan-stats-bar .dot.orange { background: #ffa500; }
    .boss-dan-stats-bar .dot.blue { background: #4a9eff; }

    /* Toast */
    .boss-dan-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 99999; padding: 10px 24px;
      border-radius: var(--boss-radius-md);
      font-size: 13px; font-weight: 500;
      color: #fff; pointer-events: none;
      opacity: 0; transition: opacity 0.25s;
    }
    .boss-dan-toast.show { opacity: 1; }
    .boss-dan-toast.success { background: #2d8a4e; border: 1px solid #3ec371; }
    .boss-dan-toast.error { background: #8a2d2d; border: 1px solid #ff4444; }
  `;
  const style = document.createElement("style");
  style.id = "boss-danbooru-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `boss-dan-toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 1800);
}

// Parse tags from text (mirrors Python parse_tags)
function parseTags(text) {
  if (!text) return [];
  let t = text
    .replace(/\bBREAK\b/g, " ")
    .replace(/\(([^():]+:[\d.]+)\)/g, "$1")
    .replace(/\(\(([^()]+)\)\)/g, "$1")
    .replace(/[()]/g, " ");

  // Extract wildcard options
  const wildcards = [];
  const wcRe = /\{([^{}]*)\}/g;
  let m;
  while ((m = wcRe.exec(t)) !== null) {
    m[1].split("|").forEach(opt => {
      const s = opt.trim();
      if (s) wildcards.push(s);
    });
  }
  t = t.replace(wcRe, " ");

  const raw = t.split(/[\s,]+/).filter(Boolean);
  const all = [...raw, ...wildcards];
  const seen = new Set();
  // Labels to skip (prompt structure words ending with colon)
  const skipLabels = /^(actors|action|skin|emotions|hair|accessories|body|outfits|location|details|pose|expression|background|style|camera|lighting|medium):?$/i;
  const skipValues = /^(none|n\/a|na|null|undefined)$/i;
  return all.filter(tag => {
    const low = tag.toLowerCase();
    if (seen.has(low)) return false;
    if (skipLabels.test(low) || skipLabels.test(low + ":")) return false;
    if (skipValues.test(low)) return false;
    seen.add(low);
    return true;
  });
}

// ── State helpers ──────────────────────────────────────────────────────────

function defaultState() {
  return {
    prompt: "",
    strictMode: false,
    category: "all",
  };
}

function readState(node) {
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      return { ...defaultState(), ...JSON.parse(v) };
    } catch {}
  }
  return defaultState();
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify(state);
}

function syncNativeWidgets(node, state) {
  const promptW = (node.widgets || []).find(x => x.name === "prompt");
  if (promptW && promptW.value !== state.prompt) {
    promptW.value = state.prompt;
    try { promptW.callback?.(state.prompt); } catch {}
  }
}

// ── On-node body ───────────────────────────────────────────────────────────

function renderHeader(node) {
  const head = node._bossDanHead;
  if (!head) return;
  const state = readState(node);
  const tags = parseTags(state.prompt);
  const promptW = (node.widgets || []).find(x => x.name === "prompt");
  const statsEl = node._bossDanStats;
  if (statsEl && node._lastValidation) {
    const s = node._lastValidation;
    statsEl.innerHTML =
      `<span class="ok">${s.valid} valid</span> · ` +
      `<span class="err">${s.invalid} invalid</span> · ` +
      `<span class="warn">${s.rare} rare</span>`;
  } else {
    statsEl.textContent = `${tags.length} tags`;
  }
  head.innerHTML = `<span class="label">Validator:</span> <span class="value">${tags.length} tags in prompt</span>`;
}

function setupValidatorNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const w of node.widgets || []) {
    if (w.name !== HIDDEN_INPUT_NAME) {
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

  const stats = document.createElement("div");
  stats.className = "boss-dan-stats";
  root.appendChild(stats);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-btn-open";
  openBtn.textContent = "🔍 Open Validator";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
  root.appendChild(status);

  node.addDOMWidget("danbooru_ui", "boss_danbooru", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 80,
    margin: 4,
    serialize: false,
  });

  node._bossDanRoot = root;
  node._bossDanHead = head;
  node._bossDanStats = stats;

  syncNativeWidgets(node, readState(node));
  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading…");
      const editor = new DanbooruEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[DanbooruValidator] open failed", err);
      setStatus(node, "Failed to load", true);
    }
  });
}

function hideCanvasWidget(widgets, name) {
  const w = (widgets || []).find(x => x.name === name);
  if (!w) return;
  w.hidden = true;
  w.computeSize = () => [0, -4];
  if (!w.options) w.options = {};
  w.options.canvasOnly = true;
}

function setStatus(node, text, isError = false) {
  const s = node._bossDanRoot?.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// ── DanbooruEditor ─────────────────────────────────────────────────────────

class DanbooruEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.modal = null;
    this.validation = { valid: [], invalid: [], suggestions: {}, stats: {} };
    // Debounced validation — must be defined before buildModal uses it
    let timer = null;
    this.debouncedValidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.runValidation(), 300);
    };
  }

  async open() {
    this.buildModal();
    await this.runValidation();
  }

  buildModal() {
    if (this.modal) { this.modal.remove(); this.modal = null; }

    const modal = document.createElement("div");
    modal.className = "boss-modal boss-dan-modal";

    // Bar
    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">Danbooru Tag Validator</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-btn-close";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.close());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-body";

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = "display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;";

    // Strict mode toggle
    const strictWrap = document.createElement("label");
    strictWrap.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--boss-text);";
    const strictCheck = document.createElement("input");
    strictCheck.type = "checkbox";
    strictCheck.checked = this.state.strictMode;
    strictCheck.addEventListener("change", () => {
      this.state.strictMode = strictCheck.checked;
      this.runValidation();
    });
    strictWrap.appendChild(strictCheck);
    strictWrap.appendChild(document.createTextNode("Remove invalid tags"));
    controls.appendChild(strictWrap);

    // Category filter
    const catWrap = document.createElement("label");
    catWrap.style.cssText = "display:flex;align-items:center;gap:6px;font-size:13px;color:var(--boss-text);";
    catWrap.appendChild(document.createTextNode("Category:"));
    const catSelect = document.createElement("select");
    catSelect.className = "boss-input";
    catSelect.style.cssText = "width:auto;padding:4px 8px;";
    for (const cat of ["all", "general", "artist", "character", "copyright", "meta"]) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      opt.selected = this.state.category === cat;
      catSelect.appendChild(opt);
    }
    catSelect.addEventListener("change", () => {
      this.state.category = catSelect.value;
      this.runValidation();
    });
    catWrap.appendChild(catSelect);
    controls.appendChild(catWrap);

    // Validate button
    const validateBtn = document.createElement("button");
    validateBtn.type = "button";
    validateBtn.style.cssText = "padding:6px 14px;border-radius:var(--boss-radius-md);background:var(--boss-bg-hover);border:1px solid var(--boss-border-strong);color:var(--boss-text);cursor:pointer;font-size:12px;";
    validateBtn.textContent = "🔄 Re-validate";
    validateBtn.addEventListener("click", () => this.runValidation());
    controls.appendChild(validateBtn);

    body.appendChild(controls);

    // Prompt editor
    const editorWrap = document.createElement("div");
    editorWrap.className = "boss-dan-editor-wrap";
    const textarea = document.createElement("textarea");
    textarea.className = "boss-dan-editor";
    textarea.value = this.state.prompt;
    textarea.placeholder = "Paste your prompt here…";
    textarea.spellcheck = false;
    textarea.addEventListener("input", () => {
      this.state.prompt = textarea.value;
      this.debouncedValidate();
    });
    editorWrap.appendChild(textarea);
    body.appendChild(editorWrap);

    // Results container
    this._resultsEl = document.createElement("div");
    this._resultsEl.style.cssText = "padding:0 16px;overflow-y:auto;max-height:40vh;";
    body.appendChild(this._resultsEl);

    // Stats bar
    this._statsBar = document.createElement("div");
    this._statsBar.className = "boss-dan-stats-bar";
    body.appendChild(this._statsBar);

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
    cancelBtn.addEventListener("click", () => this.close());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this._textarea = textarea;
  }

  async runValidation() {
    const prompt = this.state.prompt;
    if (!prompt.trim()) {
      this.validation = { valid: [], invalid: [], suggestions: {}, stats: { valid: 0, invalid: 0, rare: 0, total: 0, db_size: 0 } };
      this.renderResults();
      return;
    }

    try {
      const r = await fetch("/danbooru_boss/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category: this.state.category }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      this.validation = {
        valid: data.valid || [],
        invalid: data.invalid || [],
        suggestions: data.suggestions || {},
        stats: data.stats || {},
      };
    } catch (err) {
      console.error("[DanbooruEditor] validate API failed, using client-side:", err.message);
      // Fallback: client-side parse + mark all as valid (no DB on client)
      const tags = parseTags(prompt);
      this.validation = {
        valid: tags,
        invalid: [],
        suggestions: {},
        stats: { valid: tags.length, invalid: 0, rare: 0, total: tags.length, db_size: 0 },
      };
    }

    // Store on node for on-node display
    this.node._lastValidation = this.validation.stats;
    renderHeader(this.node);
    this.renderResults();
  }

  renderResults() {
    const el = this._resultsEl;
    if (!el) return;
    el.innerHTML = "";

    const { valid, invalid, suggestions, stats } = this.validation;

    // Stats bar
    this._statsBar.innerHTML = `
      <div class="stat"><span class="dot green"></span> ${stats.valid || 0} valid</div>
      <div class="stat"><span class="dot red"></span> ${stats.invalid || 0} invalid</div>
      <div class="stat"><span class="dot orange"></span> ${stats.rare || 0} rare</div>
      <div class="stat"><span class="dot blue"></span> DB: ${stats.db_size || 0} tags</div>
    `;

    if (invalid.length === 0 && valid.length === 0) {
      el.innerHTML = `<div style="text-align:center;color:var(--boss-text-dim);padding:24px;font-size:13px;">
        Paste a prompt above and it will be validated against the Danbooru tag database.
      </div>`;
      return;
    }

    // Invalid tags section
    if (invalid.length > 0) {
      const sec = document.createElement("div");
      sec.className = "boss-dan-section";
      sec.innerHTML = `<div class="boss-dan-section-title">❌ Invalid Tags (${invalid.length})</div>`;
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "boss-dan-tags";

      for (const tag of invalid) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;flex-direction:column;gap:2px;";

        const tagEl = document.createElement("span");
        tagEl.className = "boss-dan-tag invalid";
        tagEl.textContent = tag;
        row.appendChild(tagEl);

        // Suggestions
        const sims = suggestions[tag];
        if (sims && sims.length > 0) {
          const suggRow = document.createElement("div");
          suggRow.className = "boss-dan-sugg-row";
          suggRow.innerHTML = `<span class="boss-dan-sugg-label">Did you mean:</span>`;
          for (const s of sims) {
            const chip = document.createElement("span");
            chip.className = "boss-dan-sugg-chip";
            chip.textContent = s;
            chip.addEventListener("click", () => this.replaceTag(tag, s));
            suggRow.appendChild(chip);
          }
          row.appendChild(suggRow);
        }

        tagsDiv.appendChild(row);
      }
      sec.appendChild(tagsDiv);
      el.appendChild(sec);
    }

    // Valid tags section
    if (valid.length > 0) {
      const sec = document.createElement("div");
      sec.className = "boss-dan-section";
      sec.innerHTML = `<div class="boss-dan-section-title">✅ Valid Tags (${valid.length})</div>`;
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "boss-dan-tags";
      for (const tag of valid) {
        const tagEl = document.createElement("span");
        tagEl.className = "boss-dan-tag valid";
        tagEl.textContent = tag;
        tagsDiv.appendChild(tagEl);
      }
      sec.appendChild(tagsDiv);
      el.appendChild(sec);
    }
  }

  replaceTag(oldTag, newTag) {
    const regex = new RegExp(`\\b${oldTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    this.state.prompt = this.state.prompt.replace(regex, newTag);
    this._textarea.value = this.state.prompt;
    this.runValidation();
  }

  save() {
    writeState(this.node, this.state);
    syncNativeWidgets(this.node, this.state);
    renderHeader(this.node);
    this.node.setDirtyCanvas?.(true, true);
    this.close();
    showToast("Validator state saved");
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.DanbooruValidator",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "DanbooruTagValidator") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossDanHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "DanbooruTagValidator") return;
    setupValidatorNode(node);
  },
});

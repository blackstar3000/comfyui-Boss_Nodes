// ComfyUI/custom_nodes/web/metadata_extractor/index.js
// Reverse-Prompt / Metadata Extractor Pro — frontend

import { app } from "../../scripts/app.js";

// ── CSS ──────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-mx-styles")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Panel */
    .boss-mx-panel {
      background: var(--boss-bg-panel);
      border: 1px solid var(--boss-border-strong);
      border-radius: var(--boss-radius-md);
      padding: 8px 10px;
      margin-top: 4px;
      font-size: 12px;
      color: var(--boss-text);
      line-height: 1.5;
    }
    .boss-mx-panel .status { color: #4ade80; }
    .boss-mx-panel .status.is-empty { color: var(--boss-text-muted); }
    .boss-mx-panel .status.is-error { color: #f87171; }
    .boss-mx-panel .row { display: flex; justify-content: space-between; gap: 8px; }
    .boss-mx-panel .label { color: var(--boss-text-muted); }

    /* Open button */
    .boss-mx-open-btn {
      margin-top: 6px;
      width: 100%;
      background: var(--boss-brand);
      color: #fff;
      border: none;
      border-radius: var(--boss-radius-sm);
      padding: 5px 0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .boss-mx-open-btn:hover { background: var(--boss-brand-hover); }

    /* Modal bar */
    .boss-mx-modal-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--boss-border);
      font-weight: 700;
      color: #f97316;
    }
    .boss-mx-modal-bar button {
      background: var(--boss-bg-hover); color: var(--boss-text); border: none; border-radius: var(--boss-radius-sm);
      padding: 6px 12px; cursor: pointer; font-size: 12px;
    }
    .boss-mx-modal-bar button:hover { background: var(--boss-bg-active); }

    /* Fields */
    .boss-mx-field { margin-bottom: 14px; }
    .boss-mx-field-head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 4px;
    }
    .boss-mx-field-head .label { color: var(--boss-text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .boss-mx-copy-btn {
      background: var(--boss-bg-hover); color: var(--boss-text); border: none; border-radius: var(--boss-radius-sm);
      padding: 3px 8px; font-size: 11px; cursor: pointer;
    }
    .boss-mx-copy-btn:hover { background: var(--boss-bg-active); }
    .boss-mx-copy-btn.copied { background: #16a34a; color: #fff; }
    .boss-mx-field-value {
      background: var(--boss-bg-input); border: 1px solid var(--boss-border); border-radius: var(--boss-radius-md);
      padding: 8px 10px; font-size: 13px; white-space: pre-wrap; word-break: break-word;
      max-height: 160px; overflow-y: auto;
    }
    .boss-mx-field-value.empty { color: var(--boss-text-dim); font-style: italic; }

    /* Grid */
    .boss-mx-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px;
      margin-bottom: 14px;
    }
    .boss-mx-grid .item { display: flex; justify-content: space-between; font-size: 13px; }
    .boss-mx-grid .item .label { color: var(--boss-text-muted); }

    /* Raw toggle */
    .boss-mx-raw-toggle {
      background: none; border: none; color: var(--boss-brand); cursor: pointer;
      font-size: 12px; padding: 0; margin-top: 4px;
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-mx-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text ?? "");
  } catch {
    // Fallback for contexts where the Clipboard API is unavailable
    const ta = document.createElement("textarea");
    ta.value = text ?? "";
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  if (btn) {
    const original = btn.textContent;
    btn.textContent = "✓ Copied";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1200);
  }
}

function getImageWidgetValue(node) {
  const w = node.widgets?.find((w) => w.name === "image");
  return w ? w.value : null;
}

async function fetchMetadata(imageValue) {
  if (!imageValue) return null;
  const r = await fetch(`/metadata_extractor/extract?image=${encodeURIComponent(imageValue)}`);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return await r.json();
}

function renderPanel(panelEl, data, errorMsg) {
  if (errorMsg) {
    panelEl.innerHTML = `<div class="status is-error">⚠️ ${escapeHtml(errorMsg)}</div>`;
    return;
  }
  if (!data) {
    panelEl.innerHTML = `<div class="status is-empty">Select an image to extract metadata</div>`;
    return;
  }
  if (!data.found) {
    panelEl.innerHTML = `<div class="status is-empty">⚠️ ${escapeHtml(data.raw || "No metadata found")}</div>`;
    return;
  }
  panelEl.innerHTML = `
    <div class="status">✅ ${escapeHtml(data.format)} metadata found</div>
    <div class="row"><span class="label">Seed</span><span>${escapeHtml(data.seed ?? "—")}</span></div>
    <div class="row"><span class="label">Steps / CFG</span><span>${escapeHtml(data.steps ?? "—")} / ${escapeHtml(data.cfg ?? "—")}</span></div>
    <div class="row"><span class="label">Sampler</span><span>${escapeHtml(data.sampler_name || "—")}</span></div>
  `;
}

function buildField(label, value) {
  const wrap = document.createElement("div");
  wrap.className = "boss-mx-field";
  const head = document.createElement("div");
  head.className = "boss-mx-field-head";
  const lab = document.createElement("span");
  lab.className = "label";
  lab.textContent = label;
  const copyBtn = document.createElement("button");
  copyBtn.className = "boss-mx-copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => copyToClipboard(value ?? "", copyBtn));
  head.appendChild(lab);
  head.appendChild(copyBtn);
  const val = document.createElement("div");
  val.className = "boss-mx-field-value" + (value ? "" : " empty");
  val.textContent = value || "(empty)";
  wrap.appendChild(head);
  wrap.appendChild(val);
  return wrap;
}

function openModal(node, data) {
  injectCSS();
  const overlay = document.createElement("div");
  overlay.className = "boss-mx-modal-overlay";
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const modal = document.createElement("div");
  modal.className = "boss-modal";

  const bar = document.createElement("div");
  bar.className = "boss-mx-modal-bar boss-bar";
  bar.innerHTML = `<span>🔍 Metadata Details</span>`;
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => overlay.remove());
  bar.appendChild(closeBtn);
  modal.appendChild(bar);

  const body = document.createElement("div");
  body.className = "boss-mx-modal-body boss-body";

  if (!data || !data.found) {
    const empty = document.createElement("div");
    empty.style.color = "#999";
    empty.textContent = data?.raw || "No metadata found in this image.";
    body.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "boss-mx-grid";
    const gridItems = [
      ["Format", data.format],
      ["Model", data.model_name || "—"],
      ["Sampler", data.sampler_name || "—"],
      ["Scheduler", data.scheduler || "—"],
      ["Steps", data.steps ?? "—"],
      ["CFG", data.cfg ?? "—"],
      ["Seed", data.seed ?? "—"],
      ["Size", data.width && data.height ? `${data.width}×${data.height}` : "—"],
    ];
    for (const [label, value] of gridItems) {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `<span class="label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span>`;
      grid.appendChild(item);
    }
    body.appendChild(grid);

    body.appendChild(buildField("Positive Prompt", data.positive_prompt));
    body.appendChild(buildField("Negative Prompt", data.negative_prompt));

    const rawToggle = document.createElement("button");
    rawToggle.className = "boss-mx-raw-toggle";
    rawToggle.textContent = "▸ View Raw Metadata JSON";
    const rawField = document.createElement("div");
    rawField.style.display = "none";
    rawField.appendChild(buildField("Raw Metadata", data.raw));
    rawToggle.addEventListener("click", () => {
      const showing = rawField.style.display !== "none";
      rawField.style.display = showing ? "none" : "block";
      rawToggle.textContent = showing
        ? "▸ View Raw Metadata JSON"
        : "▾ Hide Raw Metadata JSON";
    });
    body.appendChild(rawToggle);
    body.appendChild(rawField);
  }

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function setupMetadataExtractorNode(node) {
  injectCSS();

  const root = document.createElement("div");
  const panel = document.createElement("div");
  panel.className = "boss-mx-panel";
  panel.innerHTML = `<div class="status is-empty">Select an image to extract metadata</div>`;
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-mx-open-btn";
  openBtn.textContent = "View Full Details";
  openBtn.disabled = true;

  root.appendChild(panel);
  root.appendChild(openBtn);

  node.addDOMWidget("boss_mx_panel", "metadata_preview", root, {
    serialize: false,
  });

  let lastData = null;

  async function refresh() {
    const imageValue = getImageWidgetValue(node);
    if (!imageValue) {
      renderPanel(panel, null);
      openBtn.disabled = true;
      lastData = null;
      return;
    }
    try {
      const data = await fetchMetadata(imageValue);
      lastData = data;
      renderPanel(panel, data);
      openBtn.disabled = false;
    } catch (err) {
      renderPanel(panel, null, err.message);
      openBtn.disabled = true;
      lastData = null;
    }
  }

  openBtn.addEventListener("click", () => {
    if (lastData) openModal(node, lastData);
  });

  const imageWidget = node.widgets?.find((w) => w.name === "image");
  if (imageWidget) {
    const origCallback = imageWidget.callback;
    imageWidget.callback = function (...args) {
      const r = origCallback?.apply(this, args);
      refresh();
      return r;
    };
  }

  // Initial fetch if a file is already selected (e.g. on workflow reload)
  setTimeout(refresh, 50);
}

app.registerExtension({
  name: "BossNodes.MetadataExtractor",

  nodeCreated(node) {
    if (node.comfyClass !== "MetadataExtractor") return;
    setupMetadataExtractorNode(node);
  },
});

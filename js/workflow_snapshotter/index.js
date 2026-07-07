// Workflow Snapshotter Pro - DOM widget + editor modal
import { app } from "/scripts/app.js";

const BRAND = "#8B5CF6";
const BRAND_GLOW = "rgba(139, 92, 246, 0.3)";

const STATE_PROP = "snapshotterState";
const HIDDEN_INPUT_NAME = "SnapshotterState";

const VISIBLE_NATIVE_WIDGETS = ["snapshot_name"];

// ── CSS ──────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-snapshotter-css")) return;
  const css = `
    .boss-ss-root {
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
    .boss-ss-head {
      font-size: 12px;
      color: #eee;
      line-height: 1.5;
      min-height: 18px;
    }
    .boss-ss-head .label { color: #999; }
    .boss-ss-head .value { color: #fff; font-weight: 600; }
    .boss-ss-open {
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
    .boss-ss-open:hover { background: #7C3AED; }
    .boss-ss-open:active { transform: translateY(1px); }
    .boss-ss-status {
      font-size: 11px;
      color: #999;
      text-align: center;
      min-height: 14px;
    }
    .boss-ss-status.is-error { color: #ff8080; }
    .boss-ss-status.is-success { color: #4ade80; }

    .boss-ss-modal {
      position: fixed; inset: 0;
      background: #131415;
      color: #eee;
      z-index: 2000;
      display: flex; flex-direction: column;
      font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    }
    .boss-ss-bar {
      height: 56px;
      background: #171718;
      border-bottom: 1px solid #3a3d40;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-ss-bar-title { font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .boss-ss-bar-x {
      background: transparent;
      border: 1px solid #3a3d40;
      color: #eee;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .boss-ss-bar-x:hover { background: #3a3d40; }

    .boss-ss-body {
      flex: 1; display: flex; overflow: hidden; min-height: 0;
    }
    .boss-ss-side {
      width: 380px;
      background: #171718;
      border-right: 1px solid #3a3d40;
      padding: 18px;
      display: flex; flex-direction: column; gap: 14px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .boss-ss-section-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #999;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .boss-ss-input, .boss-ss-select, .boss-ss-textarea {
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
    .boss-ss-input:focus { border-color: ${BRAND}; }
    .boss-ss-row { display: flex; align-items: center; gap: 10px; }
    .boss-ss-row .boss-ss-input { flex: 1; }
    .boss-ss-btn {
      background: ${BRAND};
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .boss-ss-btn:hover { background: #7C3AED; }
    .boss-ss-btn.danger { background: #e53e3e; }
    .boss-ss-btn.danger:hover { background: #c53030; }
    .boss-ss-btn:disabled { opacity: 0.5; cursor: default; }

    .boss-ss-footer {
      height: 56px;
      background: #171718;
      border-top: 1px solid #3a3d40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .boss-ss-save {
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
    .boss-ss-save:hover { background: #7C3AED; }
    .boss-ss-cancel {
      background: transparent;
      color: #eee;
      border: 1px solid #3a3d40;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .boss-ss-cancel:hover { background: #3a3d40; }

    .boss-ss-preview {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }
    .boss-ss-card {
      padding: 16px;
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid #444;
      width: 120%;
      box-shadow: 0 0 40px rgba(82, 78, 184, 0.3);
      color: #fff;
    }
    .boss-ss-card-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 12px;
      color: ${BRAND};
    }
    .boss-ss-node-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      border-bottom: 1px solid #333;
      font-size: 12px;
    }
    .boss-ss-node-item .nid { color: #999; font-family: monospace; }
    .boss-ss-node-item .ntype { color: #fff; }
    .boss-ss-node-item .nval { color: #aaa; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .boss-ss-snapshot-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .boss-ss-snapshot-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #1c1e20;
      border-radius: 6px;
      border-left: 3px solid #444;
      cursor: pointer;
      transition: background 0.1s;
    }
    .boss-ss-snapshot-item:hover { background: #282b2e; }
    .boss-ss-snapshot-item .name { flex: 1; font-weight: 600; color: #fff; }
    .boss-ss-snapshot-item .meta { color: #999; font-size: 11px; }
    .boss-ss-snapshot-item .actions {
      display: flex;
      gap: 6px;
    }
    .boss-ss-snapshot-item .actions .boss-ss-btn { padding: 4px 10px; font-size: 11px; }
    .boss-ss-empty {
      color: #999;
      font-style: italic;
      text-align: center;
      padding: 20px;
    }

    /* Diff / Confirmation overlay */
    .boss-ss-confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 2100;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .boss-ss-confirm-box {
      background: #1a1a1c;
      border: 1px solid #444;
      border-radius: 12px;
      padding: 24px;
      max-width: 800px;
      width: 95%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .boss-ss-confirm-title {
      font-size: 18px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 4px;
    }
    .boss-ss-confirm-sub {
      color: #aaa;
      font-size: 13px;
    }
    .boss-ss-confirm-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      background: #131415;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #2a2a2c;
    }
    .boss-ss-confirm-controls .select-all {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #ddd;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-ss-confirm-controls .select-all input { width: 16px; height: 16px; accent-color: ${BRAND}; }
    .boss-ss-confirm-search {
      flex: 1;
      padding: 6px 10px;
      background: #131415;
      border: 1px solid #3a3d40;
      color: #fff;
      border-radius: 4px;
      font-size: 12px;
      outline: none;
    }
    .boss-ss-confirm-search:focus { border-color: ${BRAND}; }
    .boss-ss-confirm-summary {
      color: #aaa;
      font-size: 12px;
      white-space: nowrap;
    }
    .boss-ss-confirm-list {
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-right: 4px;
    }
    .boss-ss-confirm-list::-webkit-scrollbar { width: 4px; }
    .boss-ss-confirm-list::-webkit-scrollbar-track { background: #1a1a1c; }
    .boss-ss-confirm-list::-webkit-scrollbar-thumb { background: ${BRAND}; border-radius: 2px; }

    .boss-ss-diff-node {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 8px;
      background: #1c1e20;
      border-radius: 4px;
      border-left: 2px solid #444;
      transition: background 0.1s;
    }
    .boss-ss-diff-node:hover { background: #242628; }
    .boss-ss-diff-node .diff-checkbox {
      margin-top: 2px;
      accent-color: ${BRAND};
      flex-shrink: 0;
      width: 14px;
      height: 14px;
    }
    .boss-ss-diff-node .diff-content {
      flex: 1;
      min-width: 0;
    }
    .boss-ss-diff-node .diff-header {
      display: flex;
      gap: 8px;
      align-items: center;
      font-weight: 600;
      font-size: 13px;
      color: #eee;
      cursor: pointer;
    }
    .boss-ss-diff-node .diff-header .node-id { color: #999; font-weight: normal; font-family: monospace; }
    .boss-ss-diff-node .diff-header .node-type { color: ${BRAND}; }
    .boss-ss-diff-node .diff-header .change-count { color: #aaa; font-weight: normal; font-size: 11px; }
    .boss-ss-diff-node .diff-details {
      margin-top: 4px;
      padding-left: 12px;
      font-size: 12px;
      color: #ccc;
      display: none;
    }
    .boss-ss-diff-node .diff-details.expanded { display: block; }
    .boss-ss-diff-node .diff-details .diff-change {
      padding: 2px 0;
      border-bottom: 1px solid #2a2a2c;
    }
    .boss-ss-diff-node .diff-details .diff-change .diff-widget {
      color: #ddd;
    }
    .boss-ss-diff-node .diff-details .diff-change .diff-old {
      color: #f87171;
      text-decoration: line-through;
    }
    .boss-ss-diff-node .diff-details .diff-change .diff-new {
      color: #4ade80;
    }
    .boss-ss-confirm-btns {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      border-top: 1px solid #2a2a2c;
      padding-top: 12px;
    }
    .boss-ss-confirm-btns .boss-ss-btn-restore-all {
      background: transparent;
      border: 1px solid #666;
      color: #ddd;
    }
    .boss-ss-confirm-btns .boss-ss-btn-restore-all:hover {
      background: #3a3d40;
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-snapshotter-css";
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
    snapshot_name: widgetValue(node, "snapshot_name", ""),
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
        /* detached */
      }
    }
  }
}

function syncNativeWidgets(node, state) {
  setWidgetValue(node, "snapshot_name", state.snapshot_name || "");
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
  const head = node._bossSsHead;
  if (!head) return;
  fetch("/snapshotter/list")
    .then((r) => r.json())
    .then((list) => {
      const count = list.length;
      head.innerHTML = `<span class="label">Snapshots:</span> <span class="value">${count}</span>`;
    })
    .catch(() => {
      head.innerHTML = `<span class="label">Snapshots:</span> <span class="value">❌</span>`;
    });
}

function setStatus(node, text, type = "") {
  const root = node._bossSsRoot;
  if (!root) return;
  const s = root.querySelector(".boss-ss-status");
  if (!s) return;
  s.textContent = text || "";
  s.className = "boss-ss-status";
  if (type) s.classList.add(type);
}

// ── Snapshotter Editor ────────────────────────────────────────────────────

class SnapshotterEditor {
  constructor(node) {
    this.node = node;
    this.state = readState(node);
    this.snapshots = [];
    this.selected = null;
    this.modal = null;
    this.confirmOverlay = null;
  }

  async fetchList() {
    const r = await fetch("/snapshotter/list");
    if (!r.ok) throw new Error("Failed to fetch snapshots");
    this.snapshots = await r.json();
  }

  async saveSnapshot(name, data) {
    const r = await fetch("/snapshotter/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || "Save failed");
    }
    await this.fetchList();
  }

  async deleteSnapshot(name) {
    const r = await fetch("/snapshotter/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || "Delete failed");
    }
    await this.fetchList();
  }

  async fetchSnapshot(name) {
    const r = await fetch(`/snapshotter/get/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error("Failed to load snapshot");
    return await r.json();
  }

  // ── Diff generator ─────────────────────────────────────────────────────
  generateDiff(snapshotData) {
    const diff = {};
    const graphNodes = app.graph._nodes || [];
    const snapNodes = snapshotData.nodes || {};

    for (const id in snapNodes) {
      const snapNode = snapNodes[id];
      const graphNode = graphNodes.find((n) => String(n.id) === id);
      if (!graphNode) {
        diff[id] = { class_type: snapNode.class_type, missing: true };
        continue;
      }
      const snapWidgets = snapNode.widgets || {};
      const currentWidgets = {};
      for (const w of graphNode.widgets || []) {
        currentWidgets[w.name] = w.value;
      }
      const changes = {};
      for (const wname in snapWidgets) {
        const newVal = snapWidgets[wname];
        const oldVal = currentWidgets[wname];
        if (String(oldVal) !== String(newVal)) {
          changes[wname] = { old: oldVal, new: newVal };
        }
      }
      // Also check properties (hidden state)
      const snapProps = snapNode.properties || {};
      const currentProps = graphNode.properties || {};
      for (const pname in snapProps) {
        const newVal = snapProps[pname];
        const oldVal = currentProps[pname];
        if (String(oldVal) !== String(newVal)) {
          changes[`[prop] ${pname}`] = { old: oldVal, new: newVal };
        }
      }
      // Also check position/size (rounded to avoid noisy sub-pixel diffs)
      const round = (v) => (Array.isArray(v) ? v.map((n) => Math.round(n)) : v);
      if (Array.isArray(snapNode.pos) && Array.isArray(graphNode.pos)) {
        const a = round(snapNode.pos);
        const b = round(graphNode.pos);
        if (a[0] !== b[0] || a[1] !== b[1]) {
          changes["[position]"] = { old: `${b[0]}, ${b[1]}`, new: `${a[0]}, ${a[1]}` };
        }
      }
      if (Array.isArray(snapNode.size) && Array.isArray(graphNode.size)) {
        const a = round(snapNode.size);
        const b = round(graphNode.size);
        if (a[0] !== b[0] || a[1] !== b[1]) {
          changes["[size]"] = { old: `${b[0]}×${b[1]}`, new: `${a[0]}×${a[1]}` };
        }
      }
      if (Object.keys(changes).length > 0 || diff[id]?.missing) {
        diff[id] = { class_type: snapNode.class_type, changes, missing: false };
      }
    }
    return diff;
  }

  // ── Selective restore confirmation ────────────────────────────────────
  showRestoreConfirmation(name, snapshotData) {
    const diff = this.generateDiff(snapshotData);
    const missingIds = Object.keys(diff).filter((id) => diff[id].missing);
    const nodeIds = Object.keys(diff).filter((id) => !diff[id].missing);
    const allNodeIds = nodeIds;
    // selected set starts with all
    const selectedIds = new Set(allNodeIds);

    // Remove existing overlay
    if (this.confirmOverlay) {
      this.confirmOverlay.remove();
      this.confirmOverlay = null;
    }

    const overlay = document.createElement("div");
    overlay.className = "boss-ss-confirm-overlay";

    const box = document.createElement("div");
    box.className = "boss-ss-confirm-box";

    // Title
    const title = document.createElement("div");
    title.className = "boss-ss-confirm-title";
    title.textContent = `Restore Snapshot "${name}"?`;
    box.appendChild(title);

    // Subtitle
    const sub = document.createElement("div");
    sub.className = "boss-ss-confirm-sub";
    const totalChanges = Object.values(diff).reduce(
      (acc, d) => acc + Object.keys(d.changes || {}).length,
      0,
    );
    sub.textContent = `Select which nodes to restore (${allNodeIds.length} nodes, ${totalChanges} changes total)`;
    box.appendChild(sub);

    if (missingIds.length > 0) {
      const warn = document.createElement("div");
      warn.className = "boss-ss-confirm-sub";
      warn.style.color = "#f87171";
      const missingTypes = missingIds
        .map((id) => `#${id} (${diff[id].class_type || "unknown"})`)
        .join(", ");
      warn.textContent = `⚠️ ${missingIds.length} node${missingIds.length !== 1 ? "s" : ""} from this snapshot no longer exist in the current graph and will NOT be restored: ${missingTypes}`;
      box.appendChild(warn);
    }

    // Controls row: Select All, Search, Summary
    const controls = document.createElement("div");
    controls.className = "boss-ss-confirm-controls";

    const selectAllLabel = document.createElement("label");
    selectAllLabel.className = "select-all";
    const selectAllCheck = document.createElement("input");
    selectAllCheck.type = "checkbox";
    selectAllCheck.checked = true;
    selectAllLabel.appendChild(selectAllCheck);
    selectAllLabel.appendChild(document.createTextNode("Select All"));
    controls.appendChild(selectAllLabel);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "boss-ss-confirm-search";
    searchInput.placeholder = "Filter nodes...";
    controls.appendChild(searchInput);

    const summarySpan = document.createElement("span");
    summarySpan.className = "boss-ss-confirm-summary";
    const updateSummary = () => {
      const selectedCount = selectedIds.size;
      let changeCount = 0;
      for (const id of selectedIds) {
        const d = diff[id];
        if (d && d.changes) changeCount += Object.keys(d.changes).length;
      }
      summarySpan.textContent = `${selectedCount} node${selectedCount !== 1 ? "s" : ""} selected (${changeCount} change${changeCount !== 1 ? "s" : ""})`;
    };
    updateSummary();
    controls.appendChild(summarySpan);
    box.appendChild(controls);

    // List container
    const listContainer = document.createElement("div");
    listContainer.className = "boss-ss-confirm-list";
    box.appendChild(listContainer);

    // Store references for search/filter
    let nodeElements = [];

    const renderList = (filter = "") => {
      listContainer.innerHTML = "";
      nodeElements = [];
      const lowerFilter = filter.toLowerCase();
      let visibleCount = 0;
      for (const id of allNodeIds) {
        const d = diff[id];
        if (d.missing) continue; // skip missing nodes
        const nodeType = d.class_type || "unknown";
        // Filter by id or type
        if (
          lowerFilter &&
          !id.includes(lowerFilter) &&
          !nodeType.toLowerCase().includes(lowerFilter)
        ) {
          continue;
        }
        visibleCount++;
        const div = document.createElement("div");
        div.className = "boss-ss-diff-node";
        div.dataset.nodeId = id;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "diff-checkbox";
        checkbox.checked = selectedIds.has(id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          updateSummary();
          // Update select all state
          const allChecked = allNodeIds.every((nid) => selectedIds.has(nid));
          selectAllCheck.checked = allChecked;
          selectAllCheck.indeterminate = !allChecked && selectedIds.size > 0;
        });
        div.appendChild(checkbox);

        const content = document.createElement("div");
        content.className = "diff-content";

        const header = document.createElement("div");
        header.className = "diff-header";
        const changesCount = Object.keys(d.changes || {}).length;
        header.innerHTML = `
          <span class="node-id">[${id}]</span>
          <span class="node-type">${escapeHtml(nodeType)}</span>
          <span class="change-count">(${changesCount} change${changesCount !== 1 ? "s" : ""})</span>
        `;
        // Click on header toggles expanded details
        let detailsExpanded = false;
        header.style.cursor = "pointer";
        header.addEventListener("click", () => {
          detailsExpanded = !detailsExpanded;
          detailsDiv.classList.toggle("expanded", detailsExpanded);
        });
        content.appendChild(header);

        const detailsDiv = document.createElement("div");
        detailsDiv.className = "diff-details";
        // Build changes
        const changes = d.changes || {};
        for (const wname in changes) {
          const c = changes[wname];
          const changeDiv = document.createElement("div");
          changeDiv.className = "diff-change";
          changeDiv.innerHTML = `
            <span class="diff-widget">${escapeHtml(wname)}: </span>
            <span class="diff-old">${escapeHtml(String(c.old))}</span>
            <span class="diff-new"> → ${escapeHtml(String(c.new))}</span>
          `;
          detailsDiv.appendChild(changeDiv);
        }
        // If no changes (shouldn't happen) but just in case
        if (Object.keys(changes).length === 0) {
          const none = document.createElement("div");
          none.textContent = "(no changes)";
          none.style.color = "#666";
          detailsDiv.appendChild(none);
        }
        content.appendChild(detailsDiv);
        div.appendChild(content);
        listContainer.appendChild(div);
        nodeElements.push({ id, element: div, checkbox });
      }
      if (visibleCount === 0) {
        const empty = document.createElement("div");
        empty.className = "boss-ss-empty";
        empty.textContent = "No nodes match the filter.";
        listContainer.appendChild(empty);
      }
      // Update select all state
      const allChecked = allNodeIds.every((nid) => selectedIds.has(nid));
      selectAllCheck.checked = allChecked;
      selectAllCheck.indeterminate = !allChecked && selectedIds.size > 0;
    };

    // Select All handler
    selectAllCheck.addEventListener("change", () => {
      const checked = selectAllCheck.checked;
      for (const id of allNodeIds) {
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
      }
      // Update all checkboxes in the list
      for (const { checkbox } of nodeElements) {
        checkbox.checked = checked;
      }
      updateSummary();
    });

    // Search handler
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
    });

    // Initial render
    renderList("");

    // Buttons
    const btnRow = document.createElement("div");
    btnRow.className = "boss-ss-confirm-btns";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-ss-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      this.confirmOverlay.remove();
      this.confirmOverlay = null;
    });

    const restoreSelectedBtn = document.createElement("button");
    restoreSelectedBtn.type = "button";
    restoreSelectedBtn.className = "boss-ss-save";
    restoreSelectedBtn.textContent = "Restore Selected";
    restoreSelectedBtn.addEventListener("click", async () => {
      // Gather selected node IDs
      const selectedNodeIds = Array.from(selectedIds);
      if (selectedNodeIds.length === 0) {
        setStatus(this.node, "No nodes selected for restore", "is-error");
        return;
      }
      this.confirmOverlay.remove();
      this.confirmOverlay = null;
      try {
        await this.applySnapshot(snapshotData, selectedNodeIds);
        setStatus(
          this.node,
          `✅ Restored "${name}" — ${selectedNodeIds.length} nodes updated`,
          "is-success",
        );
        this.showPreview(name);
        this.refreshList();
      } catch (err) {
        setStatus(this.node, `❌ Restore failed: ${err.message}`, "is-error");
      }
    });

    const restoreAllBtn = document.createElement("button");
    restoreAllBtn.type = "button";
    restoreAllBtn.className = "boss-ss-btn boss-ss-btn-restore-all";
    restoreAllBtn.textContent = "Restore All";
    restoreAllBtn.addEventListener("click", async () => {
      this.confirmOverlay.remove();
      this.confirmOverlay = null;
      try {
        await this.applySnapshot(snapshotData, allNodeIds);
        setStatus(
          this.node,
          `✅ Restored "${name}" — ${allNodeIds.length} nodes updated`,
          "is-success",
        );
        this.showPreview(name);
        this.refreshList();
      } catch (err) {
        setStatus(this.node, `❌ Restore failed: ${err.message}`, "is-error");
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(restoreAllBtn);
    btnRow.appendChild(restoreSelectedBtn);
    box.appendChild(btnRow);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.confirmOverlay = overlay;
  }

  // ── Apply snapshot with optional selection ────────────────────────────
  async applySnapshot(data, selectedNodeIds = null) {
    const nodes = data.nodes || {};
    const graphNodes = app.graph._nodes || [];
    let restoredCount = 0;
    const idsToRestore = selectedNodeIds ? new Set(selectedNodeIds) : null;

    for (const id in nodes) {
      // If we have a selection, skip nodes not in it
      if (idsToRestore && !idsToRestore.has(id)) continue;

      const ndata = nodes[id];
      const node = graphNodes.find((n) => String(n.id) === id);
      if (!node) continue;

      let nodeChanged = false;

      // 1. Restore widgets
      const widgets = ndata.widgets || {};
      for (const wname in widgets) {
        const val = widgets[wname];
        const w = (node.widgets || []).find((w) => w.name === wname);
        if (w) {
          if (String(w.value) !== String(val)) {
            w.value = val;
            if (typeof w.callback === "function") {
              try {
                w.callback(val);
              } catch {
                /* */
              }
            }
            nodeChanged = true;
          }
        }
      }

      // 2. Restore properties (hidden state)
      const props = ndata.properties || {};
      for (const pname in props) {
        const val = props[pname];
        if (!node.properties) node.properties = {};
        if (String(node.properties[pname]) !== String(val)) {
          node.properties[pname] = val;
          nodeChanged = true;
        }
      }

      // 2b. Restore position/size
      if (Array.isArray(ndata.pos) && Array.isArray(node.pos)) {
        if (node.pos[0] !== ndata.pos[0] || node.pos[1] !== ndata.pos[1]) {
          node.pos[0] = ndata.pos[0];
          node.pos[1] = ndata.pos[1];
          nodeChanged = true;
        }
      }
      if (Array.isArray(ndata.size) && Array.isArray(node.size)) {
        if (node.size[0] !== ndata.size[0] || node.size[1] !== ndata.size[1]) {
          node.size[0] = ndata.size[0];
          node.size[1] = ndata.size[1];
          nodeChanged = true;
        }
      }

      // 3. If the node has an onConfigure method, call it to re‑apply its internal state
      if (nodeChanged && typeof node.onConfigure === "function") {
        try {
          node.onConfigure();
        } catch {
          /* */
        }
      }

      // 4. Force a redraw of the DOM widget if available
      if (nodeChanged) {
        node.setDirtyCanvas?.(true, true);
        restoredCount++;
      }
    }
    // Final global canvas refresh
    app.graph.setDirtyCanvas(true, true);
    return restoredCount;
  }

  // ── Full restore: complete graph replace (nodes, links, positions, groups) ─
  async fullRestore(name) {
    let data;
    try {
      data = await this.fetchSnapshot(name);
    } catch (err) {
      setStatus(this.node, `❌ ${err.message}`, "is-error");
      return;
    }

    const workflow = data.workflow;
    if (!workflow || typeof workflow !== "object" || !Array.isArray(workflow.nodes)) {
      setStatus(
        this.node,
        `❌ "${name}" doesn't include full graph data (saved before Full Restore was added)`,
        "is-error",
      );
      return;
    }

    const nodeCount = workflow.nodes.length;
    const linkCount = Array.isArray(workflow.links) ? workflow.links.length : 0;
    const confirmed = confirm(
      `Full Restore "${name}"?\n\n` +
        `This REPLACES your entire current workflow with the snapshot ` +
        `(${nodeCount} nodes, ${linkCount} connections). Anything currently on ` +
        `the canvas that isn't in this snapshot will be lost.\n\n` +
        `This cannot be undone. Continue?`,
    );
    if (!confirmed) return;

    try {
      // Same mechanism ComfyUI uses to open a saved workflow file - fully
      // reconstructs nodes, connections, positions, and groups.
      await app.loadGraphData(workflow);
      setStatus(
        this.node,
        `✅ Full Restore complete: "${name}" (${nodeCount} nodes, ${linkCount} connections)`,
        "is-success",
      );
      // The graph was just fully replaced, which may have destroyed/recreated
      // this exact node instance - close rather than risk operating on a
      // stale reference.
      this.close();
    } catch (err) {
      setStatus(this.node, `❌ Full Restore failed: ${err.message}`, "is-error");
    }
  }

  // ── Open modal ──────────────────────────────────────────────────────────
  open() {
    return this.fetchList().then(() => this.buildModal());
  }

  buildModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    const modal = document.createElement("div");
    modal.className = "boss-ss-modal";

    const bar = document.createElement("div");
    bar.className = "boss-ss-bar";
    bar.innerHTML = `<div class="boss-ss-bar-title">Workflow Snapshotter</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-ss-bar-x";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    const body = document.createElement("div");
    body.className = "boss-ss-body";

    const side = document.createElement("div");
    side.className = "boss-ss-side";

    side.appendChild(this.buildSaveSection());
    side.appendChild(this.buildListSection());

    const workspace = document.createElement("div");
    workspace.className = "boss-ss-preview";
    this.previewEl = document.createElement("div");
    workspace.appendChild(this.previewEl);
    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "boss-ss-footer";
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "boss-ss-save";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this.save());
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-ss-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(applyBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshList();
    this.showPreview(null);
  }

  buildSaveSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ss-section-label";
    label.textContent = "Save Current Workflow";
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.className = "boss-ss-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "boss-ss-input";
    nameInput.placeholder = "Snapshot name...";
    nameInput.value = this.state.snapshot_name || "";
    nameInput.addEventListener("input", () => {
      this.state.snapshot_name = nameInput.value;
    });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-ss-btn";
    saveBtn.textContent = "💾 Save";
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) {
        setStatus(this.node, "Enter a snapshot name", "is-error");
        return;
      }
      setStatus(this.node, "Capturing workflow…");
      const data = await this.collectGraphData();
      try {
        await this.saveSnapshot(name, data);
        setStatus(this.node, `✅ Snapshot "${name}" saved`, "is-success");
        this.refreshList();
        this.state.snapshot_name = "";
        nameInput.value = "";
      } catch (err) {
        setStatus(this.node, `❌ ${err.message}`, "is-error");
      }
    });
    row.appendChild(nameInput);
    row.appendChild(saveBtn);
    wrap.appendChild(row);
    return wrap;
  }

  async collectGraphData() {
    const nodes = app.graph._nodes || [];
    const snapshot = {
      nodes: {},
      graphVersion: app.graph.version || 0,
    };
    for (const n of nodes) {
      const id = String(n.id);
      const widgets = {};
      if (n.widgets) {
        for (const w of n.widgets) {
          widgets[w.name] = w.value;
        }
      }
      const props = {};
      if (n.properties) {
        for (const key in n.properties) {
          props[key] = n.properties[key];
        }
      }
      snapshot.nodes[id] = {
        class_type: n.type || n.comfyClass,
        widgets: widgets,
        properties: props,
        pos: Array.isArray(n.pos) ? [n.pos[0], n.pos[1]] : null,
        size: Array.isArray(n.size) ? [n.size[0], n.size[1]] : null,
      };
    }

    // Full native graph capture - same serialization ComfyUI's own "Save
    // Workflow" uses. Includes connections/links, groups, and exact
    // positions. Used only by "Full Restore", since safely splicing
    // partial connection changes into a live graph isn't something we
    // can do reliably - a full restore instead does a complete graph
    // replace via app.loadGraphData(), the same as opening a saved
    // workflow file.
    try {
      const p = await app.graphToPrompt();
      snapshot.workflow = p.workflow;
    } catch (e) {
      console.warn(
        "[Snapshotter] Failed to capture full workflow - Full Restore will be unavailable for this snapshot",
        e,
      );
      snapshot.workflow = null;
    }

    return snapshot;
  }

  buildListSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-ss-section-label";
    label.textContent = "Saved Snapshots";
    wrap.appendChild(label);

    const list = document.createElement("div");
    list.className = "boss-ss-snapshot-list";
    wrap.appendChild(list);
    this.listEl = list;
    return wrap;
  }

  refreshList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";
    if (!this.snapshots || this.snapshots.length === 0) {
      const empty = document.createElement("div");
      empty.className = "boss-ss-empty";
      empty.textContent =
        "No snapshots yet. Use 'Save Current Workflow' above.";
      this.listEl.appendChild(empty);
      return;
    }
    for (const item of this.snapshots) {
      const div = document.createElement("div");
      div.className = "boss-ss-snapshot-item";
      if (this.selected === item.name) {
        div.style.borderLeftColor = BRAND;
      }
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = item.name;
      const meta = document.createElement("span");
      meta.className = "meta";
      const ts = item.timestamp
        ? new Date(item.timestamp).toLocaleString()
        : "unknown";
      meta.textContent = `${item.nodeCount || 0} nodes · ${ts}`;
      if (item.hasFullData) {
        const badge = document.createElement("span");
        badge.textContent = " · 📐 layout+links";
        badge.style.color = "#4ade80";
        meta.appendChild(badge);
      }
      const actions = document.createElement("div");
      actions.className = "actions";

      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.className = "boss-ss-btn";
      restoreBtn.textContent = "Restore";
      restoreBtn.title = "Selectively restore widget values, properties, and position/size for nodes still present in the graph";
      restoreBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const data = await this.fetchSnapshot(item.name);
          this.showRestoreConfirmation(item.name, data);
        } catch (err) {
          setStatus(this.node, `❌ ${err.message}`, "is-error");
        }
      });

      const fullRestoreBtn = document.createElement("button");
      fullRestoreBtn.type = "button";
      fullRestoreBtn.className = "boss-ss-btn danger";
      fullRestoreBtn.textContent = "Full Restore";
      if (item.hasFullData) {
        fullRestoreBtn.title = "Replace the ENTIRE current graph (nodes, connections, positions, groups) with this snapshot. Destructive - anything not in the snapshot is discarded.";
        fullRestoreBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.fullRestore(item.name);
        });
      } else {
        fullRestoreBtn.disabled = true;
        fullRestoreBtn.title = "This snapshot was saved before Full Restore support was added and doesn't include connection/layout data. Use Restore instead.";
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "boss-ss-btn danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete snapshot "${item.name}"?`)) return;
        try {
          await this.deleteSnapshot(item.name);
          setStatus(this.node, `🗑️ Deleted "${item.name}"`, "is-success");
          this.refreshList();
          if (this.selected === item.name) this.showPreview(null);
        } catch (err) {
          setStatus(this.node, `❌ ${err.message}`, "is-error");
        }
      });

      actions.appendChild(restoreBtn);
      actions.appendChild(fullRestoreBtn);
      actions.appendChild(deleteBtn);
      div.appendChild(nameSpan);
      div.appendChild(meta);
      div.appendChild(actions);

      div.addEventListener("click", () => {
        this.selected = item.name;
        this.showPreview(item.name);
        this.refreshList();
      });

      this.listEl.appendChild(div);
    }
  }

  async showPreview(name) {
    if (!this.previewEl) return;
    if (!name) {
      this.previewEl.innerHTML = `<div class="boss-ss-card"><div class="boss-ss-empty">Select a snapshot to preview</div></div>`;
      return;
    }
    try {
      const data = await this.fetchSnapshot(name);
      const nodes = data.nodes || {};
      const nodeKeys = Object.keys(nodes);
      const hasFullData = !!(data.workflow && Array.isArray(data.workflow.nodes));
      let html = `<div class="boss-ss-card"><div class="boss-ss-card-title">📋 ${escapeHtml(name)}</div>`;
      html += `<div style="color:#999; margin-bottom:8px;">${nodeKeys.length} nodes`;
      if (hasFullData) {
        const linkCount = Array.isArray(data.workflow.links) ? data.workflow.links.length : 0;
        html += ` · <span style="color:#4ade80;">📐 Full Restore available (${linkCount} connections)</span>`;
      } else {
        html += ` · <span style="color:#999;">values-only snapshot</span>`;
      }
      html += `</div>`;
      const displayed = nodeKeys.slice(0, 10);
      for (const id of displayed) {
        const ndata = nodes[id];
        const type = ndata.class_type || "unknown";
        const widgetCount = Object.keys(ndata.widgets || {}).length;
        const propCount = Object.keys(ndata.properties || {}).length;
        html += `<div class="boss-ss-node-item">
          <span class="nid">#${id}</span>
          <span class="ntype">${escapeHtml(type)}</span>
          <span class="nval">${widgetCount} widgets, ${propCount} props</span>
        </div>`;
      }
      if (nodeKeys.length > 10) {
        html += `<div style="color:#888; font-size:11px;">... and ${nodeKeys.length - 10} more</div>`;
      }
      html += `</div>`;
      this.previewEl.innerHTML = html;
    } catch (err) {
      this.previewEl.innerHTML = `<div class="boss-ss-card"><div class="boss-ss-empty">Error loading snapshot: ${err.message}</div></div>`;
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
    if (this.confirmOverlay) {
      this.confirmOverlay.remove();
      this.confirmOverlay = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

// ── Node setup ────────────────────────────────────────────────────────────

function setupSnapshotterNode(node) {
  hideCanvasWidget(node.widgets, HIDDEN_INPUT_NAME);
  for (const name of VISIBLE_NATIVE_WIDGETS) {
    hideCanvasWidget(node.widgets, name);
  }

  const root = document.createElement("div");
  root.className = "boss-ss-root";

  const head = document.createElement("div");
  head.className = "boss-ss-head";
  root.appendChild(head);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "boss-ss-open";
  openBtn.textContent = "Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-ss-status";
  root.appendChild(status);

  node.addDOMWidget("snapshotter_ui", "boss_snapshotter", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossSsRoot = root;
  node._bossSsHead = head;

  const state = readState(node);
  syncNativeWidgets(node, state);
  renderHeader(node);

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading…");
      const editor = new SnapshotterEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[Snapshotter] open editor failed", err);
      setStatus(node, "Failed to load. Is backend running?", "is-error");
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
      if (!entry || entry.class_type !== "WorkflowSnapshotter") continue;
      const node = app.graph._nodes.find((n) => String(n.id) === id);
      if (!node) continue;
      const state = readState(node);
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(state);
    }
  } catch (e) {
    console.warn("[Snapshotter] graphToPrompt inject failed", e);
  }
  return result;
};

// ── Extension registration ──────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.WorkflowSnapshotter",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "WorkflowSnapshotter") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossSsHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "WorkflowSnapshotter") return;
    setupSnapshotterNode(node);
  },
});

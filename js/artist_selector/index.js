// Artist Selector Boss - compact canvas face + fullscreen editor.
//
// Python keeps the native widgets for workflow compatibility. This frontend
// hides them from the canvas and owns the visible editor state on
// node.properties.artistState, then injects that state into ArtistState when
// the graph is queued.

import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

const STATE_PROP = "artistState";
const HIDDEN_INPUT_NAME = "ArtistState";

const TABS = ["All", "Favorites", "Recent"];
const SORT_MODES = ["A-Z", "Z-A", "Favorites", "Recent", "Popular"];
const OUTPUT_MODES = ["Prompt", "Names", "Both"];

const MAX_ARTISTS_DEFAULT = 3;
const MAX_ARTISTS_MIN = 1;
const MAX_ARTISTS_MAX = 100;

const ALPHA_RANGES = [
  "=(-Ak", "Ak-Ao", "Ao-Az", "B(-Bu", "Bu-Ci", "Ci-Di", "Di-En", "En-Fu",
  "Fu-Gr", "Gr-Ha", "Ha-Hi", "Hi-Ig", "Ig-Jh", "Jy-Ka", "Ka-Ka", "Ka-Ki",
  "Ki-Ko", "Ko-Ku", "Ku-Ma", "Ma-Ma", "Ma-Mi", "Mi-Mo", "Mo-Mu", "Mu-Na",
  "Na-Nn", "Nn-Ok", "Ok-Pe", "Pe-Ra", "Ra-Ro", "Ro-Sa", "Sa-Se", "Se-Sh",
  "Sh-Sq", "Sq-Ta", "Ta-Te", "Te-Tr", "Tr-Ur", "Ur-Xi", "Xi-Yo", "Yo-Yu",
  "Yu-Zz",
];

const RANGE_MAP = {
  "=(-Ak": (c) => c < "ak",
  "Ak-Ao": (c) => c >= "ak" && c < "ao",
  "Ao-Az": (c) => c >= "ao" && c < "b",
  "B(-Bu": (c) => c >= "b" && c < "bu",
  "Bu-Ci": (c) => c >= "bu" && c < "ci",
  "Ci-Di": (c) => c >= "ci" && c < "di",
  "Di-En": (c) => c >= "di" && c < "en",
  "En-Fu": (c) => c >= "en" && c < "fu",
  "Fu-Gr": (c) => c >= "fu" && c < "gr",
  "Gr-Ha": (c) => c >= "gr" && c < "ha",
  "Ha-Hi": (c) => c >= "ha" && c < "hi",
  "Hi-Ig": (c) => c >= "hi" && c < "ig",
  "Ig-Jh": (c) => c >= "ig" && c < "jy",
  "Jy-Ka": (c) => c >= "jy" && c < "ka",
  "Ka-Ka": (c) => c >= "ka" && c <= "ka",
  "Ka-Ki": (c) => c >= "ka" && c < "ki",
  "Ki-Ko": (c) => c >= "ki" && c < "ko",
  "Ko-Ku": (c) => c >= "ko" && c < "ku",
  "Ku-Ma": (c) => c >= "ku" && c < "ma",
  "Ma-Ma": (c) => c >= "ma" && c <= "ma",
  "Ma-Mi": (c) => c >= "ma" && c < "mi",
  "Mi-Mo": (c) => c >= "mi" && c < "mo",
  "Mo-Mu": (c) => c >= "mo" && c < "mu",
  "Mu-Na": (c) => c >= "mu" && c < "na",
  "Na-Nn": (c) => c >= "na" && c < "nn",
  "Nn-Ok": (c) => c >= "nn" && c < "ok",
  "Ok-Pe": (c) => c >= "ok" && c < "pe",
  "Pe-Ra": (c) => c >= "pe" && c < "ra",
  "Ra-Ro": (c) => c >= "ra" && c < "ro",
  "Ro-Sa": (c) => c >= "ro" && c < "sa",
  "Sa-Se": (c) => c >= "sa" && c < "se",
  "Se-Sh": (c) => c >= "se" && c < "sh",
  "Sh-Sq": (c) => c >= "sh" && c < "sq",
  "Sq-Ta": (c) => c >= "sq" && c < "ta",
  "Ta-Te": (c) => c >= "ta" && c < "te",
  "Te-Tr": (c) => c >= "te" && c < "tr",
  "Tr-Ur": (c) => c >= "tr" && c < "ur",
  "Ur-Xi": (c) => c >= "ur" && c < "xi",
  "Xi-Yo": (c) => c >= "xi" && c < "yo",
  "Yo-Yu": (c) => c >= "yo" && c < "yu",
  "Yu-Zz": (c) => c >= "yu",
};

const VISIBLE_NATIVE_WIDGETS = [
  "selection",
  "max_artists",
  "randomize",
  "favorites_only",
  "output_mode",
  "sort_mode",
  "force_refresh",
];

function injectCSS() {
  if (document.getElementById("boss-artist-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Header value variants */
    .boss-widget-head .value.none { color: var(--boss-text-muted); font-style: italic; }
    .boss-widget-head .value.random { color: var(--boss-brand); }

    /* Side panel width override */
    .boss-art-side-custom { width: 320px; }

    /* Row layout */
    .boss-art-row { display: flex; align-items: center; gap: 10px; }
    .boss-art-row .boss-input { flex: 1; }

    /* Tabs */
    .boss-art-tabs, .boss-art-pill {
      display: flex;
      gap: 0;
      background: var(--boss-bg-section);
      border-radius: var(--boss-radius-md);
      padding: 3px;
    }
    .boss-art-tab, .boss-art-seg {
      flex: 1;
      text-align: center;
      padding: 7px 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit;
      font-size: 12px;
      color: var(--boss-text-muted);
      cursor: pointer;
      user-select: none;
      outline: none;
    }
    .boss-art-tab:hover:not(.active), .boss-art-seg:hover:not(.active) {
      color: var(--boss-text-bright);
    }
    .boss-art-tab.active, .boss-art-seg.active {
      background: var(--boss-brand);
      color: #fff;
      font-weight: 600;
    }

    /* Checkbox */
    .boss-art-check {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--boss-text);
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .boss-art-check input { width: 16px; height: 16px; accent-color: var(--boss-brand); }

    /* Count */
    .boss-art-count {
      color: var(--boss-text-dim);
      font-size: 12px;
      text-align: center;
      min-height: 16px;
    }

    /* Artist list */
    .boss-art-workspace {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .boss-art-list {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      box-sizing: border-box;
    }
    .boss-art-item:hover { background: var(--boss-bg-active); border-color: var(--boss-border-strong); }
    .boss-art-item.selected {
      border-color: var(--boss-brand);
      background: var(--boss-bg-active);
      box-shadow: inset 0 0 0 1px var(--boss-brand);
    }
    .boss-art-fav {
      background: none;
      border: none;
      color: var(--boss-text-faint);
      cursor: pointer;
      font-size: 18px;
      padding: 0 6px;
      line-height: 1;
    }
    .boss-art-fav.active { color: var(--boss-brand); }
    .boss-art-empty {
      color: var(--boss-text-muted);
      font-size: 13px;
      padding: 20px;
      text-align: center;
    }

    /* Category chips */
    .boss-art-categories {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 6px 0;
      scrollbar-width: thin;
    }
    .boss-art-chip {
      flex-shrink: 0;
      padding: 5px 10px;
      border-radius: 14px;
      border: 1px solid var(--boss-border-input);
      background: var(--boss-bg-hover);
      color: var(--boss-text-muted);
      font-size: 11px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .boss-art-chip:hover {
      border-color: var(--boss-border-strong);
      color: var(--boss-text);
    }
    .boss-art-chip.active {
      background: var(--boss-brand);
      border-color: var(--boss-brand);
      color: #fff;
    }

    /* Thumbnail */
    .boss-art-thumb {
      width: 48px;
      height: 48px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .boss-art-thumb-placeholder {
      width: 48px;
      height: 48px;
      border-radius: 4px;
      background: var(--boss-bg-section);
      border: 1px solid var(--boss-border-input);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--boss-text-faint);
      font-size: 18px;
      flex-shrink: 0;
    }

    /* Updated item layout */
    .boss-art-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--boss-bg-hover);
      border: 1px solid var(--boss-border-input);
      border-radius: 6px;
      font-size: 14px;
      margin-bottom: 6px;
      cursor: pointer;
    }
    .boss-art-item-info {
      flex: 1;
      min-width: 0;
    }
    .boss-art-item-name {
      font-size: 14px;
      color: var(--boss-text-dim);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .boss-art-item-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
      flex-wrap: wrap;
    }
    .boss-art-item-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .boss-art-item:hover .boss-art-item-actions {
      opacity: 1;
    }
    .boss-art-item-action {
      width: 26px;
      height: 26px;
      border: 1px solid var(--boss-border-input);
      border-radius: 4px;
      background: var(--boss-bg-hover);
      color: var(--boss-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      padding: 0;
      line-height: 1;
    }
    .boss-art-item-action:hover {
      border-color: var(--boss-border-strong);
      color: var(--boss-text);
      background: var(--boss-bg-active);
    }
    .boss-art-item-action.del:hover {
      border-color: #e74c3c;
      color: #e74c3c;
    }
    .boss-art-cats {
      font-size: 10px;
      color: var(--boss-text-faint);
      white-space: nowrap;
    }
    .boss-art-posts {
      font-size: 10px;
      color: var(--boss-text-faint);
      background: var(--boss-bg-section);
      padding: 1px 5px;
      border-radius: 8px;
      white-space: nowrap;
    }

    /* ── Range tabs ─────────────────────────────────────────────────── */
    .boss-art-range-bar {
      display: flex;
      gap: 2px;
      flex-wrap: wrap;
      padding: 8px 20px;
      border-top: 1px solid var(--boss-border-input);
      background: var(--boss-bg-section);
      flex-shrink: 0;
    }
    .boss-art-range-tab {
      padding: 4px 7px;
      border: 1px solid var(--boss-border-input);
      border-radius: 4px;
      background: var(--boss-bg-hover);
      color: var(--boss-text-muted);
      font-size: 10px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      line-height: 1.2;
    }
    .boss-art-range-tab:hover {
      border-color: var(--boss-border-strong);
      color: var(--boss-text);
    }
    .boss-art-range-tab.active {
      background: var(--boss-brand);
      border-color: var(--boss-brand);
      color: #fff;
    }

    /* ── CRUD sidebar buttons ────────────────────────────────────────── */
    .boss-art-crud {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .boss-art-crud-btn {
      flex: 1;
      min-width: 70px;
      padding: 7px 10px;
      border: 1px solid var(--boss-border-input);
      border-radius: 5px;
      background: var(--boss-bg-hover);
      color: var(--boss-text);
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
      text-align: center;
    }
    .boss-art-crud-btn:hover {
      border-color: var(--boss-border-strong);
      background: var(--boss-bg-active);
    }
    .boss-art-crud-btn.primary {
      background: var(--boss-brand);
      border-color: var(--boss-brand);
      color: #fff;
    }
    .boss-art-crud-btn.primary:hover {
      filter: brightness(1.1);
    }
    .boss-art-crud-btn.danger {
      border-color: #e74c3c;
      color: #e74c3c;
    }
    .boss-art-crud-btn.danger:hover {
      background: #e74c3c;
      color: #fff;
    }
    .boss-art-crud-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    /* ── Sub-modal (Add/Edit) ───────────────────────────────────────── */
    .boss-art-submodal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .boss-art-submodal {
      background: var(--boss-bg-main, #1e1e2e);
      border: 1px solid var(--boss-border-strong);
      border-radius: 8px;
      padding: 24px;
      min-width: 400px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .boss-art-submodal h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: var(--boss-text-bright);
    }
    .boss-art-submodal label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: var(--boss-text-muted);
    }
    .boss-art-submodal input[type="text"],
    .boss-art-submodal textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--boss-border-input);
      border-radius: 5px;
      background: var(--boss-bg-hover);
      color: var(--boss-text);
      font-family: inherit;
      font-size: 13px;
      margin-bottom: 12px;
      box-sizing: border-box;
    }
    .boss-art-submodal input[type="text"]:focus,
    .boss-art-submodal textarea:focus {
      outline: none;
      border-color: var(--boss-brand);
    }
    .boss-art-submodal textarea {
      min-height: 80px;
      resize: vertical;
    }
    .boss-art-submodal .field { margin-bottom: 14px; }
    .boss-art-submodal .cat-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 12px;
    }
    .boss-art-submodal .cat-chip {
      padding: 4px 9px;
      border: 1px solid var(--boss-border-input);
      border-radius: 12px;
      background: var(--boss-bg-hover);
      color: var(--boss-text-muted);
      font-size: 11px;
      cursor: pointer;
      user-select: none;
    }
    .boss-art-submodal .cat-chip:hover {
      border-color: var(--boss-border-strong);
    }
    .boss-art-submodal .cat-chip.active {
      background: var(--boss-brand);
      border-color: var(--boss-brand);
      color: #fff;
    }
    .boss-art-submodal .btn-row {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    /* ── Toast system ────────────────────────────────────────────────── */
    .boss-art-toasts {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10001;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
      align-items: center;
    }
    .boss-art-toast {
      pointer-events: auto;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #fff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: bossToastIn 0.2s ease;
      max-width: 360px;
    }
    .boss-art-toast.success { background: #27ae60; }
    .boss-art-toast.error { background: #e74c3c; }
    .boss-art-toast.info { background: #3498db; }
    .boss-art-toast.confirm {
      background: var(--boss-bg-section, #2a2a3e);
      border: 1px solid var(--boss-border-strong);
      color: var(--boss-text);
    }
    .boss-art-toast .toast-msg { flex: 1; }
    .boss-art-toast .toast-btn {
      padding: 4px 10px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    .boss-art-toast .toast-btn:hover {
      background: rgba(255,255,255,0.15);
    }
    .boss-art-toast .toast-btn.danger {
      border-color: #e74c3c;
      color: #e74c3c;
    }
    .boss-art-toast .toast-btn.danger:hover {
      background: #e74c3c;
      color: #fff;
    }
    @keyframes bossToastIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-artist-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

function clampMaxArtists(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return MAX_ARTISTS_DEFAULT;
  return Math.max(MAX_ARTISTS_MIN, Math.min(MAX_ARTISTS_MAX, n));
}

function widgetValue(node, name, fallback) {
  const w = (node.widgets || []).find((x) => x.name === name);
  return w ? w.value : fallback;
}

function defaultStateFromWidgets(node) {
  const selection = String(widgetValue(node, "selection", "") || "");
  const selectedNames = selection
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const outputMode = widgetValue(node, "output_mode", "Prompt");
  const sortMode = widgetValue(node, "sort_mode", "A-Z");
  return {
    selectedNames,
    maxArtists: clampMaxArtists(
      widgetValue(node, "max_artists", MAX_ARTISTS_DEFAULT),
    ),
    randomize: !!widgetValue(node, "randomize", false),
    favoritesOnly: !!widgetValue(node, "favorites_only", false),
    outputMode: OUTPUT_MODES.includes(outputMode) ? outputMode : "Prompt",
    sortMode: SORT_MODES.includes(sortMode) ? sortMode : "A-Z",
    forceRefresh: !!widgetValue(node, "force_refresh", false),
    selectedCategories: [],
    rangeFilter: null,
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
        merged.selectedNames = Array.isArray(obj.selectedNames)
          ? obj.selectedNames.filter((n) => typeof n === "string" && n.trim())
          : base.selectedNames;
        merged.maxArtists = clampMaxArtists(merged.maxArtists);
        merged.randomize = !!merged.randomize;
        merged.favoritesOnly = !!merged.favoritesOnly;
        if (!OUTPUT_MODES.includes(merged.outputMode))
          merged.outputMode = base.outputMode;
        if (!SORT_MODES.includes(merged.sortMode))
          merged.sortMode = base.sortMode;
        merged.forceRefresh = !!merged.forceRefresh;
        merged.selectedCategories = Array.isArray(obj.selectedCategories)
          ? obj.selectedCategories.filter(
              (c) => typeof c === "string" && c.trim(),
            )
          : [];
        merged.rangeFilter = obj.rangeFilter || null;
        return merged;
      }
    } catch {
      /* fall through */
    }
  }
  return base;
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify({
    selectedNames: state.selectedNames || [],
    maxArtists: clampMaxArtists(state.maxArtists),
    randomize: !!state.randomize,
    favoritesOnly: !!state.favoritesOnly,
    outputMode: OUTPUT_MODES.includes(state.outputMode)
      ? state.outputMode
      : "Prompt",
    sortMode: SORT_MODES.includes(state.sortMode) ? state.sortMode : "A-Z",
    forceRefresh: !!state.forceRefresh,
    selectedCategories: state.selectedCategories || [],
    rangeFilter: state.rangeFilter || null,
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
        /* detached widget */
      }
    }
  }
}

function syncNativeWidgets(node, state) {
  setWidgetValue(node, "selection", (state.selectedNames || []).join(", "));
  setWidgetValue(node, "max_artists", clampMaxArtists(state.maxArtists));
  setWidgetValue(node, "randomize", !!state.randomize);
  setWidgetValue(node, "favorites_only", !!state.favoritesOnly);
  setWidgetValue(
    node,
    "output_mode",
    OUTPUT_MODES.includes(state.outputMode) ? state.outputMode : "Prompt",
  );
  setWidgetValue(
    node,
    "sort_mode",
    SORT_MODES.includes(state.sortMode) ? state.sortMode : "A-Z",
  );
  setWidgetValue(node, "force_refresh", !!state.forceRefresh);
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

let _toastContainer = null;
function getToastContainer() {
  if (_toastContainer && document.body.contains(_toastContainer)) return _toastContainer;
  _toastContainer = document.createElement("div");
  _toastContainer.className = "boss-art-toasts";
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

function showToast(message, type = "info", duration = 3000) {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `boss-art-toast ${type}`;
  const msg = document.createElement("span");
  msg.className = "toast-msg";
  msg.textContent = message;
  toast.appendChild(msg);
  container.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.2s";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }
  return toast;
}

function showConfirmToast(message, onYes, onNo) {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = "boss-art-toast confirm";
  const msg = document.createElement("span");
  msg.className = "toast-msg";
  msg.textContent = message;
  toast.appendChild(msg);
  const yesBtn = document.createElement("button");
  yesBtn.className = "toast-btn danger";
  yesBtn.textContent = "Yes";
  yesBtn.addEventListener("click", () => { toast.remove(); onYes(); });
  const noBtn = document.createElement("button");
  noBtn.className = "toast-btn";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", () => { toast.remove(); if (onNo) onNo(); });
  toast.appendChild(yesBtn);
  toast.appendChild(noBtn);
  container.appendChild(toast);
  return toast;
}

function renderHeader(node) {
  const head = node._bossArtHead;
  if (!head) return;
  const state = readState(node);
  let mainText;
  let mainClass = "value";
  if (state.randomize) {
    const pool = state.favoritesOnly ? "favorites" : "all artists";
    mainText = `random ${state.maxArtists} from ${pool}`;
    mainClass = "value random";
  } else if (state.selectedNames.length) {
    const visible = state.selectedNames.slice(0, 3).join(", ");
    const extra =
      state.selectedNames.length > 3
        ? ` +${state.selectedNames.length - 3}`
        : "";
    mainText = visible + extra;
  } else {
    mainText = "no artists selected";
    mainClass = "value none";
  }
  head.innerHTML =
    `<div><span class="label">Artists:</span> <span class="${mainClass}">${escapeHtml(mainText)}</span></div>` +
    `<div><span class="label">Output:</span> <span class="value">${escapeHtml(state.outputMode)}</span>` +
    ` <span class="label">Sort:</span> <span class="value">${escapeHtml(state.sortMode)}</span></div>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossArtRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

class ArtistEditor {
  constructor(node) {
    this.node = node;
    this.data = { library: {}, favorites: [], history: [] };
    this.state = readState(node);
    this.tab = "All";
    this.search = "";
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/wai_artist/data?t=" + Date.now());
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.data = await r.json();
  }

  async toggleFavorite(name) {
    const r = await fetch("/wai_artist/toggle_favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await this.fetchData();
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
    bar.innerHTML = `<div class="boss-bar-title">Artist Selector Editor</div>`;
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
    side.className = "boss-side boss-art-side-custom";
    side.appendChild(this.buildSearchSection());
    side.appendChild(this.buildTabsSection());
    side.appendChild(this.buildModeSection());
    side.appendChild(this.buildMaxSection());
    side.appendChild(
      this.buildSelectSection("Output", "outputMode", OUTPUT_MODES),
    );
    side.appendChild(this.buildSelectSection("Sort", "sortMode", SORT_MODES));
    side.appendChild(this.buildForceRefreshSection());
    side.appendChild(this.buildCategorySection());
    side.appendChild(this.buildCrudSection());
    this.countEl = document.createElement("div");
    this.countEl.className = "boss-art-count";
    side.appendChild(this.countEl);

    const workspace = document.createElement("div");
    workspace.className = "boss-art-workspace";
    const list = document.createElement("div");
    list.className = "boss-art-list";
    workspace.appendChild(list);
    workspace.appendChild(this.buildRangeBar());
    this.listEl = list;

    body.appendChild(side);
    body.appendChild(workspace);
    modal.appendChild(body);

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
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshList();
    setTimeout(() => this.searchInput?.focus(), 0);
  }

  buildSearchSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Search";
    const input = document.createElement("input");
    input.className = "boss-input";
    input.type = "text";
    input.placeholder = "Type to filter...";
    input.value = this.search;
    input.addEventListener("input", (e) => {
      this.search = e.target.value;
      this.refreshList();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    this.searchInput = input;
    return wrap;
  }

  buildTabsSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Collection";
    const tabs = document.createElement("div");
    tabs.className = "boss-art-tabs";
    for (const name of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boss-art-tab" + (this.tab === name ? " active" : "");
      btn.textContent = name;
      btn.addEventListener("click", () => {
        this.tab = name;
        tabs
          .querySelectorAll(".boss-art-tab")
          .forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        this.refreshList();
      });
      tabs.appendChild(btn);
    }
    wrap.appendChild(label);
    wrap.appendChild(tabs);
    return wrap;
  }

  buildModeSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Mode";
    const pill = document.createElement("div");
    pill.className = "boss-art-pill";
    const sync = () => {
      pill.querySelectorAll(".boss-art-seg").forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.dataset.mode === (this.state.randomize ? "random" : "manual"),
        );
      });
    };
    for (const [mode, text] of [
      ["manual", "Manual"],
      ["random", "Random"],
    ]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boss-art-seg";
      btn.dataset.mode = mode;
      btn.textContent = text;
      btn.addEventListener("click", () => {
        this.state.randomize = mode === "random";
        sync();
        this.refreshList();
      });
      pill.appendChild(btn);
    }
    const favLabel = document.createElement("label");
    favLabel.className = "boss-art-check";
    const fav = document.createElement("input");
    fav.type = "checkbox";
    fav.checked = !!this.state.favoritesOnly;
    fav.addEventListener("change", (e) => {
      this.state.favoritesOnly = !!e.target.checked;
      this.refreshList();
    });
    favLabel.appendChild(fav);
    favLabel.appendChild(document.createTextNode("Random from favorites only"));
    wrap.appendChild(label);
    wrap.appendChild(pill);
    wrap.appendChild(favLabel);
    sync();
    return wrap;
  }

  buildMaxSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Max artists";
    const row = document.createElement("div");
    row.className = "boss-art-row";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(MAX_ARTISTS_MIN);
    slider.max = String(MAX_ARTISTS_MAX);
    slider.step = "1";
    slider.value = String(this.state.maxArtists);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-input";
    num.min = String(MAX_ARTISTS_MIN);
    num.max = String(MAX_ARTISTS_MAX);
    num.step = "1";
    num.value = String(this.state.maxArtists);
    const apply = (v) => {
      this.state.maxArtists = clampMaxArtists(v);
      slider.value = String(this.state.maxArtists);
      num.value = String(this.state.maxArtists);
      this.refreshCount();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(label);
    wrap.appendChild(row);
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
      searchable: false,
      onChange: (val) => {
        this.state[key] = val;
        if (key === "sortMode") this.refreshList();
      },
    });
    wrap.appendChild(label);
    wrap.appendChild(dropdown.element);
    return wrap;
  }

  buildForceRefreshSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.className = "boss-art-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!this.state.forceRefresh;
    input.addEventListener("change", (e) => {
      this.state.forceRefresh = !!e.target.checked;
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode("Force refresh library on run"));
    wrap.appendChild(label);
    return wrap;
  }

  buildCategorySection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Categories";
    const chips = document.createElement("div");
    chips.className = "boss-art-categories";
    this.categoryChipsEl = chips;
    const categories = this.data.categories || [];
    const selectedCats = this.state.selectedCategories || [];
    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.className = "boss-art-chip" + (selectedCats.length === 0 ? " active" : "");
    allChip.textContent = "All";
    allChip.addEventListener("click", () => {
      this.state.selectedCategories = [];
      this.updateCategoryChips();
      this.refreshList();
    });
    chips.appendChild(allChip);
    for (const cat of categories) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "boss-art-chip" + (selectedCats.includes(cat) ? " active" : "");
      chip.textContent = cat;
      chip.dataset.cat = cat;
      chip.addEventListener("click", () => {
        const arr = this.state.selectedCategories || [];
        const idx = arr.indexOf(cat);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(cat);
        this.updateCategoryChips();
        this.refreshList();
      });
      chips.appendChild(chip);
    }
    wrap.appendChild(label);
    wrap.appendChild(chips);
    return wrap;
  }

  updateCategoryChips() {
    if (!this.categoryChipsEl) return;
    const selectedCats = this.state.selectedCategories || [];
    this.categoryChipsEl.querySelectorAll(".boss-art-chip").forEach((chip) => {
      if (chip.dataset.cat) {
        chip.classList.toggle("active", selectedCats.includes(chip.dataset.cat));
      } else {
        chip.classList.toggle("active", selectedCats.length === 0);
      }
    });
  }

  buildCrudSection() {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "boss-label";
    label.textContent = "Manage";
    const row = document.createElement("div");
    row.className = "boss-art-crud";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "boss-art-crud-btn primary";
    addBtn.textContent = "+ Add";
    addBtn.addEventListener("click", () => this.openAddModal());

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "boss-art-crud-btn";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await this.fetchData();
        this.refreshList();
        this.updateCrudButtons();
        showToast("Library refreshed", "success");
      } catch (e) {
        showToast("Refresh failed: " + e.message, "error");
      }
      refreshBtn.disabled = false;
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "boss-art-crud-btn";
    editBtn.textContent = "Edit";
    editBtn.disabled = true;
    editBtn.addEventListener("click", () => {
      const sel = this.state.selectedNames || [];
      if (sel.length === 1) this.openEditModal(sel[0]);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "boss-art-crud-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = true;
    deleteBtn.addEventListener("click", () => {
      const sel = this.state.selectedNames || [];
      if (sel.length === 1) this.confirmDelete(sel[0]);
    });

    row.appendChild(addBtn);
    row.appendChild(refreshBtn);
    row.appendChild(editBtn);
    row.appendChild(deleteBtn);
    wrap.appendChild(label);
    wrap.appendChild(row);
    this._editBtn = editBtn;
    this._deleteBtn = deleteBtn;
    return wrap;
  }

  updateCrudButtons() {
    const sel = this.state.selectedNames || [];
    const hasOne = sel.length === 1;
    if (this._editBtn) this._editBtn.disabled = !hasOne;
    if (this._deleteBtn) this._deleteBtn.disabled = !hasOne;
  }

  buildRangeBar() {
    const bar = document.createElement("div");
    bar.className = "boss-art-range-bar";
    this._rangeBar = bar;

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "boss-art-range-tab" + (!this.state.rangeFilter ? " active" : "");
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => {
      this.state.rangeFilter = null;
      this.updateRangeTabs();
      this.refreshList();
    });
    bar.appendChild(allBtn);

    for (const range of ALPHA_RANGES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boss-art-range-tab" + (this.state.rangeFilter === range ? " active" : "");
      btn.textContent = range;
      btn.dataset.range = range;
      btn.addEventListener("click", () => {
        this.state.rangeFilter = range;
        this.updateRangeTabs();
        this.refreshList();
      });
      bar.appendChild(btn);
    }
    return bar;
  }

  updateRangeTabs() {
    if (!this._rangeBar) return;
    this._rangeBar.querySelectorAll(".boss-art-range-tab").forEach((btn) => {
      const range = btn.dataset.range;
      if (range) {
        btn.classList.toggle("active", this.state.rangeFilter === range);
      } else {
        btn.classList.toggle("active", !this.state.rangeFilter);
      }
    });
  }

  openAddModal() {
    this._openArtistModal(null);
  }

  openEditModal(name) {
    this._openArtistModal(name);
  }

  _openArtistModal(existingName) {
    const isEdit = existingName !== null;
    const library = this.data.library || {};
    const artistCats = this.data.artist_categories || {};
    const allCategories = this.data.categories || [];

    let currentPrompt = "";
    let currentCategories = [];
    let currentPreview = "";
    let currentPostCount = null;
    if (isEdit && library[existingName]) {
      const entry = library[existingName];
      currentPrompt = typeof entry === "string" ? entry : (entry.prompt || "");
      currentPreview = typeof entry === "object" ? (entry.custom_preview || "") : "";
      currentPostCount = typeof entry === "object" ? (entry.post_count ?? null) : null;
      currentCategories = artistCats[existingName] || [];
    }

    const overlay = document.createElement("div");
    overlay.className = "boss-art-submodal-overlay";

    const modal = document.createElement("div");
    modal.className = "boss-art-submodal";

    const title = document.createElement("h3");
    title.textContent = isEdit ? `Edit: ${existingName}` : "Add Artist";
    modal.appendChild(title);

    if (!isEdit) {
      const nameField = document.createElement("div");
      nameField.className = "field";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Name";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "artist_tag_name";
      nameInput.value = "";
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);
      modal.appendChild(nameField);
      this._subNameInput = nameInput;
    } else {
      this._subNameInput = null;
    }

    const promptField = document.createElement("div");
    promptField.className = "field";
    const promptLabel = document.createElement("label");
    promptLabel.textContent = "Prompt";
    const promptInput = document.createElement("textarea");
    promptInput.placeholder = "by artist_name, ...";
    promptInput.value = currentPrompt;
    promptField.appendChild(promptLabel);
    promptField.appendChild(promptInput);
    modal.appendChild(promptField);

    const previewField = document.createElement("div");
    previewField.className = "field";
    const previewLabel = document.createElement("label");
    previewLabel.textContent = "Preview Image URL (optional)";
    const previewInput = document.createElement("input");
    previewInput.type = "text";
    previewInput.placeholder = "https://example.com/image.jpg";
    previewInput.value = currentPreview;
    previewField.appendChild(previewLabel);
    previewField.appendChild(previewInput);
    modal.appendChild(previewField);

    const postCountField = document.createElement("div");
    postCountField.className = "field";
    const postCountLabel = document.createElement("label");
    postCountLabel.textContent = "Post count (optional)";
    const postCountInput = document.createElement("input");
    postCountInput.type = "number";
    postCountInput.min = "0";
    postCountInput.placeholder = "Auto-fetched from Danbooru if empty";
    postCountInput.value = currentPostCount != null ? String(currentPostCount) : "";
    postCountField.appendChild(postCountLabel);
    postCountField.appendChild(postCountInput);
    modal.appendChild(postCountField);

    if (allCategories.length > 0) {
      const catField = document.createElement("div");
      catField.className = "field";
      const catLabel = document.createElement("label");
      catLabel.textContent = "Categories";
      const catChips = document.createElement("div");
      catChips.className = "cat-chips";
      const selectedCats = new Set(currentCategories);

      for (const cat of allCategories) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "cat-chip" + (selectedCats.has(cat) ? " active" : "");
        chip.textContent = cat;
        chip.dataset.cat = cat;
        chip.addEventListener("click", () => {
          if (selectedCats.has(cat)) selectedCats.delete(cat);
          else selectedCats.add(cat);
          chip.classList.toggle("active");
        });
        catChips.appendChild(chip);
      }
      catField.appendChild(catLabel);
      catField.appendChild(catChips);
      modal.appendChild(catField);
      this._subSelectedCats = selectedCats;
    } else {
      this._subSelectedCats = new Set(currentCategories);
    }

    const btnRow = document.createElement("div");
    btnRow.className = "btn-row";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "boss-art-crud-btn primary";
    saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", async () => {
      const name = isEdit ? existingName : (this._subNameInput?.value || "").trim();
      const prompt = promptInput.value.trim();
      const categories = Array.from(this._subSelectedCats);
      const custom_preview = previewInput.value.trim();
      const post_count = postCountInput.value.trim() ? parseInt(postCountInput.value.trim(), 10) : null;

      if (!name) { showToast("Name required", "error"); return; }
      if (!prompt) { showToast("Prompt required", "error"); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      try {
        await this.saveArtist(name, prompt, categories, custom_preview, post_count);
        overlay.remove();
        showToast(isEdit ? "Artist updated" : "Artist added", "success");
      } catch (e) {
        showToast("Save failed: " + e.message, "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
      }
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "boss-art-crud-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => overlay.remove());

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    if (this._subNameInput) this._subNameInput.focus();
    else promptInput.focus();
  }

  async saveArtist(name, prompt, categories, custom_preview, post_count) {
    const r = await fetch("/wai_artist/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, prompt, categories, custom_preview, post_count }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    await this.fetchData();
    this.refreshList();
    this.updateCrudButtons();
  }

  confirmDelete(name) {
    showConfirmToast(`Delete artist "${name}"?`, async () => {
      try {
        const r = await fetch("/wai_artist/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        this.state.selectedNames = (this.state.selectedNames || []).filter((n) => n !== name);
        await this.fetchData();
        this.refreshList();
        this.updateCrudButtons();
        showToast(`Deleted "${name}"`, "success");
      } catch (e) {
        showToast("Delete failed: " + e.message, "error");
      }
    });
  }

  createThumbPlaceholder() {
    const el = document.createElement("div");
    el.className = "boss-art-thumb-placeholder";
    el.textContent = "?";
    return el;
  }

  filteredList() {
    const lib =
      this.data.library && typeof this.data.library === "object"
        ? this.data.library
        : {};
    const favs = Array.isArray(this.data.favorites) ? this.data.favorites : [];
    const hist = Array.isArray(this.data.history) ? this.data.history : [];
    let list;
    if (this.tab === "Favorites") {
      list = favs.filter((n) => n in lib);
    } else if (this.tab === "Recent") {
      list = hist.filter((n) => n in lib);
    } else {
      list = Object.keys(lib);
    }

    const favSet = new Set(favs);
    if (this.state.sortMode === "A-Z") {
      list.sort((a, b) => a.localeCompare(b));
    } else if (this.state.sortMode === "Z-A") {
      list.sort((a, b) => b.localeCompare(a));
    } else if (this.state.sortMode === "Favorites") {
      list.sort((a, b) => favSet.has(b) - favSet.has(a) || a.localeCompare(b));
    } else if (this.state.sortMode === "Recent") {
      list.sort((a, b) => {
        const ai = hist.indexOf(a);
        const bi = hist.indexOf(b);
        const aKey = ai === -1 ? Number.POSITIVE_INFINITY : ai;
        const bKey = bi === -1 ? Number.POSITIVE_INFINITY : bi;
        return aKey - bKey || a.localeCompare(b);
      });
    } else if (this.state.sortMode === "Popular") {
      const counts = this.data.post_counts || {};
      list.sort(
        (a, b) =>
          (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b),
      );
    }

    const search = this.search.trim().toLowerCase();
    if (search) list = list.filter((n) => n.toLowerCase().includes(search));

    const selectedCats = this.state.selectedCategories || [];
    if (selectedCats.length > 0) {
      const artistCats = this.data.artist_categories || {};
      list = list.filter((n) => {
        const cats = artistCats[n] || [];
        return selectedCats.some((c) => cats.includes(c));
      });
    }

    const rangeFilter = this.state.rangeFilter;
    if (rangeFilter && RANGE_MAP[rangeFilter]) {
      const fn = RANGE_MAP[rangeFilter];
      list = list.filter((n) => fn(n.toLowerCase()));
    }

    return list;
  }

  refreshList() {
    if (!this.listEl) return;
    const selected = new Set(this.state.selectedNames || []);
    const favorites = new Set(this.data.favorites || []);
    const list = this.filteredList();
    this.listEl.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "boss-art-empty";
      empty.textContent = this.search
        ? `No artists match "${this.search}".`
        : "No artists in this collection.";
      this.listEl.appendChild(empty);
      this.refreshCount();
      return;
    }

    for (const name of list) {
      const item = document.createElement("div");
      item.className =
        "boss-art-item" + (selected.has(name) ? " selected" : "");

      const previews = this.data.previews || {};
      const libEntry = this.data.library?.[name];
      const customPreview = typeof libEntry === "object" ? libEntry?.custom_preview : null;
      const rawPreview = customPreview || previews[name];
      const preview = rawPreview && customPreview
        ? "/wai_artist/proxy_image?url=" + encodeURIComponent(rawPreview)
        : rawPreview;
      if (preview) {
        const img = document.createElement("img");
        img.className = "boss-art-thumb";
        img.src = preview;
        img.alt = name;
        img.addEventListener("error", () => {
          img.replaceWith(this.createThumbPlaceholder());
        });
        item.appendChild(img);
      } else {
        item.appendChild(this.createThumbPlaceholder());
      }

      const info = document.createElement("div");
      info.className = "boss-art-item-info";
      const nameEl = document.createElement("div");
      nameEl.className = "boss-art-item-name";
      nameEl.textContent = name;
      nameEl.title = name;
      info.appendChild(nameEl);

      const meta = document.createElement("div");
      meta.className = "boss-art-item-meta";
      const artistCats = this.data.artist_categories || {};
      const cats = artistCats[name] || [];
      if (cats.length > 0) {
        const catsEl = document.createElement("span");
        catsEl.className = "boss-art-cats";
        catsEl.textContent = cats.slice(0, 3).join(", ");
        if (cats.length > 3) catsEl.textContent += "…";
        meta.appendChild(catsEl);
      }
      const postCounts = this.data.post_counts || {};
      const count = postCounts[name];
      if (count != null) {
        const postsEl = document.createElement("span");
        postsEl.className = "boss-art-posts";
        postsEl.textContent = `${count} posts`;
        meta.appendChild(postsEl);
      }
      if (meta.childNodes.length > 0) info.appendChild(meta);
      item.appendChild(info);

      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className =
        "boss-art-fav" + (favorites.has(name) ? " active" : "");
      favBtn.textContent = "*";
      favBtn.title = favorites.has(name)
        ? "Remove from favorites"
        : "Add to favorites";
      favBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await this.toggleFavorite(name);
          this.refreshList();
        } catch (err) {
          console.error("[BossArtistSelector] favorite toggle failed", err);
        }
      });
      item.appendChild(favBtn);

      const actions = document.createElement("div");
      actions.className = "boss-art-item-actions";
      const editIcon = document.createElement("button");
      editIcon.type = "button";
      editIcon.className = "boss-art-item-action";
      editIcon.textContent = "\u270E";
      editIcon.title = "Edit artist";
      editIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openEditModal(name);
      });
      const delIcon = document.createElement("button");
      delIcon.type = "button";
      delIcon.className = "boss-art-item-action del";
      delIcon.textContent = "\u2715";
      delIcon.title = "Delete artist";
      delIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        this.confirmDelete(name);
      });
      actions.appendChild(editIcon);
      actions.appendChild(delIcon);
      item.appendChild(actions);

      item.addEventListener("click", () => {
        const next = new Set(this.state.selectedNames || []);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        this.state.selectedNames = Array.from(next);
        this.refreshList();
        this.updateCrudButtons();
      });
      this.listEl.appendChild(item);
    }
    this.refreshCount();
  }

  refreshCount() {
    if (!this.countEl) return;
    if (this.state.randomize) {
      const pool = this.state.favoritesOnly
        ? Array.isArray(this.data.favorites)
          ? this.data.favorites
          : []
        : Object.keys(
            this.data.library && typeof this.data.library === "object"
              ? this.data.library
              : {},
          );
      this.countEl.textContent = `Random pool: ${pool.length} artists`;
    } else {
      this.countEl.textContent = `Selected: ${(this.state.selectedNames || []).length} / ${this.state.maxArtists}`;
    }
  }

  save() {
    this.state.maxArtists = clampMaxArtists(this.state.maxArtists);
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

function setupArtistNode(node) {
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

  node.addDOMWidget("artist_ui", "boss_artist", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossArtRoot = root;
  node._bossArtHead = head;

  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library...");
      const editor = new ArtistEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossArtistSelector] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });

  renderHeader(node);
}

let _bossArtLoadingGraph = false;
if (app && app.loadGraphData && !app._bossArtLoadWrapped) {
  app._bossArtLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossArtLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossArtLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

app.registerExtension({
  name: "BossNodes.ArtistSelector",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "BossArtistSelector") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossArtHead) {
        syncNativeWidgets(this, readState(this));
        renderHeader(this);
      }
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "BossArtistSelector") return;
    setupArtistNode(node);
  },
});

function buildArtistNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "BossArtistSelector" ||
        n.type === "BossArtistSelector"
      ) {
        index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return index;
}

function findArtistNode(index, promptId) {
  const sId = String(promptId);
  if (index.has(sId)) return index.get(sId);
  const tail = sId.includes(":") ? sId.slice(sId.lastIndexOf(":") + 1) : null;
  if (tail && index.has(tail)) return index.get(tail);
  return null;
}

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  const result = await _origGraphToPrompt(...args);
  try {
    const out = result?.output;
    if (!out) return result;
    let index = null;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== "BossArtistSelector") continue;
      if (!index) index = buildArtistNodeIndex();
      const node = findArtistNode(index, id);
      const state = node
        ? readState(node)
        : {
            selectedNames: [],
            maxArtists: MAX_ARTISTS_DEFAULT,
            randomize: false,
            favoritesOnly: false,
            outputMode: "Prompt",
            sortMode: "A-Z",
            forceRefresh: false,
          };
      const injected = { ...state };
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify(injected);
    }
  } catch (e) {
    console.warn("[BossArtistSelector] graphToPrompt inject failed", e);
  }
  return result;
};

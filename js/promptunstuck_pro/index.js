// ╔═══════════════════════════════════════════════════════════════╗
// ║  Prompt Unstuck Pro Boss — DOM widget + editor modal         ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Mirrors comfyui-Boss_Nodes/js/camera_style_mixer/index.js and the Pixaroma
// "stateful UI" pattern (comfyui-pixaroma/js/seed/index.js):
//   - Python declares a single hidden PunstuckState STRING input.
//   - JS owns mode + intensity + flags + seed(+seedMode) on
//     node.properties.punstuckState.
//   - The graphToPrompt wrapper injects the resolved state at execution
//     time, including a fresh per-run seed in Random mode.
//   - All interactive UI (header, Open Editor button, fullscreen
//     editor with live preview) is a DOM widget via addDOMWidget.

import { app } from "/scripts/app.js";
import { BossDropdown } from "../boss_theme/index.js";

// ── Brand + constants ──────────────────────────────────────────────────────

const STATE_PROP = "punstuckState";
const HIDDEN_INPUT_NAME = "PunstuckState";

const NONE_MODE = "None";
const CHAOS_MODE = "Chaos";
const EXPLICIT_CATEGORIES = new Set([
  "fsolo",
  "ff",
  "mf",
  "ffm",
  "mfm",
  "bdsmx",
]);

const INTENSITY_MIN = 0.0;
const INTENSITY_MAX = 2.0;
const INTENSITY_DEFAULT = 1.0;
const INTENSITY_STEP = 0.05;

const SEED_MAX = 0xffffffffffffffff;

// Fragment flag registry. Mirrors DEFAULT_FLAGS in py/promptunstuck_pro.py.
const FRAGMENTS = [
  { key: "useEyes", label: "Eyes" },
  { key: "useBreast", label: "Breast" },
  { key: "useBody", label: "Body" },
  { key: "useHair", label: "Hair" },
  { key: "useClothing", label: "Clothing" },
  { key: "useLocation", label: "Location" },
  { key: "usePose", label: "Pose" },
  { key: "useView", label: "View" },
  { key: "useWeather", label: "Weather" },
  { key: "useExplicitSubjects", label: "Explicit Subject" },
];

// ── CSS (injected once, idempotent) ────────────────────────────────────────
function injectCSS() {
  if (document.getElementById("boss-punstuck-css")) return;
  const css = `
    /* ── Component-specific overrides ────────────────────────────── */

    /* Header separator */
    .boss-widget-head .sep { color: var(--boss-text-faint); margin: 0 6px; }

    /* Mode chip strip */
    .boss-pun-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .boss-pun-chip {
      padding: 5px 10px;
      font-size: var(--boss-font-size);
      border-radius: 999px;
      background: var(--boss-bg-hover);
      border: 1px solid var(--boss-border-strong);
      color: var(--boss-text);
      cursor: pointer;
      user-select: none;
      transition: background var(--boss-transition-fast), border-color var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-pun-chip:hover { background: var(--boss-bg-section); }
    .boss-pun-chip.selected,
    .boss-pun-chip.selected:hover {
      background: var(--boss-brand);
      border-color: var(--boss-brand);
      color: #fff;
      font-weight: 600;
    }
    .boss-pun-chip.special { color: var(--boss-brand); border-color: rgba(139,92,246,0.4); }
    .boss-pun-chip.special.selected,
    .boss-pun-chip.special.selected:hover {
      background: var(--boss-brand);
      color: #fff;
      border-color: var(--boss-brand);
    }

    /* Fragment toggle grid */
    .boss-pun-flags {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .boss-pun-flag {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: var(--boss-radius-md);
      background: var(--boss-bg-section);
      border: 1px solid var(--boss-border-input);
      font-size: var(--boss-font-size);
      cursor: pointer;
      user-select: none;
      transition: background var(--boss-transition-fast), border-color var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-pun-flag:hover { background: var(--boss-bg-hover); }
    .boss-pun-flag.on {
      background: var(--boss-bg-active);
      border-color: var(--boss-brand);
      color: var(--boss-text-bright);
    }
    .boss-pun-flag.disabled,
    .boss-pun-flag.disabled:hover {
      opacity: 0.35;
      cursor: not-allowed;
      background: var(--boss-bg-card);
      border-color: var(--boss-border);
    }
    .boss-pun-flag .check {
      width: 14px; height: 14px;
      border-radius: var(--boss-radius-xs);
      background: var(--boss-bg-hover);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; color: transparent;
      flex-shrink: 0;
    }
    .boss-pun-flag.on .check {
      background: var(--boss-brand);
      color: #fff;
    }

    /* Intensity slider + linked number */
    .boss-pun-strength { display: flex; align-items: center; gap: 10px; }
    .boss-pun-strength input[type=range] { flex: 1; accent-color: var(--boss-brand); }
    .boss-pun-strength input[type=number] { width: 70px; flex-shrink: 0; }

    /* Seed pill + buttons */
    .boss-pun-pill {
      display: flex; gap: 0;
      background: var(--boss-bg-hover);
      border-radius: var(--boss-radius-lg);
      padding: 3px;
    }
    .boss-pun-seg {
      flex: 1;
      text-align: center;
      padding: 6px;
      border: none;
      border-radius: 5px;
      background: transparent;
      font-family: inherit; font-size: var(--boss-font-size);
      color: var(--boss-text-muted);
      cursor: pointer; user-select: none; outline: none;
      transition: background var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-pun-seg:hover:not(.active) { color: var(--boss-text); }
    .boss-pun-seg.active { background: var(--boss-brand); color: #fff; font-weight: 500; }
    .boss-pun-seg:focus-visible { outline: 2px solid var(--boss-brand); outline-offset: -2px; }

    .boss-pun-btn {
      box-sizing: border-box;
      padding: 7px 10px;
      border-radius: var(--boss-radius-md);
      background: var(--boss-bg-hover);
      border: 1px solid var(--boss-border-strong);
      color: var(--boss-text);
      font-family: inherit; font-size: var(--boss-font-size);
      cursor: pointer; user-select: none;
      text-align: center;
      transition: background var(--boss-transition-fast), border-color var(--boss-transition-fast), color var(--boss-transition-fast);
    }
    .boss-pun-btn:hover { background: var(--boss-brand); border-color: var(--boss-brand); color: #fff; }
    .boss-pun-btn:disabled { opacity: 0.4; cursor: default; }
    .boss-pun-btn:disabled:hover {
      background: var(--boss-bg-hover);
      border-color: var(--boss-border-strong);
      color: var(--boss-text);
    }
    .boss-pun-btn.is-flashing,
    .boss-pun-btn.is-flashing:hover {
      background: #3ec371; border-color: #3ec371; color: #fff;
    }
    .boss-pun-seed-row { display: flex; gap: 6px; }
    .boss-pun-seed-row .boss-pun-btn { flex: 1; }
    .boss-pun-seed-row .boss-pun-btn.is-copy { flex: 0 0 auto; min-width: 56px; }
    .boss-pun-seed-num {
      width: 100%; box-sizing: border-box;
      height: 36px;
      background: var(--boss-bg-input);
      border: 1px solid var(--boss-border-input);
      border-radius: var(--boss-radius-md);
      padding: 6px 10px;
      color: var(--boss-text-bright);
      font-family: var(--boss-font-mono);
      font-size: 15px;
      text-align: center;
      outline: none;
    }
    .boss-pun-seed-num:focus { border-color: var(--boss-brand); }
    .boss-pun-seed-last {
      font-size: var(--boss-font-size-sm); line-height: 1.5;
      color: var(--boss-text-muted);
      text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Right preview panel */
    .boss-pun-output {
      background: var(--boss-bg-code);
      padding: 12px;
      border-radius: var(--boss-radius-lg);
      font-family: var(--boss-font-mono);
      font-size: 0.95em;
      line-height: 1.6;
      word-break: break-all;
      border: 1px solid var(--boss-border);
      white-space: pre-wrap;
    }
    .boss-pun-output .arrow { color: #ff0066; font-weight: bold; }
    .boss-pun-output.empty { color: var(--boss-text-faint); font-style: italic; }
    .boss-pun-card-sub {
      font-size: 1.05em;
      color: #ff5555;
      text-align: center;
      margin-bottom: 12px;
    }
    .boss-pun-meta {
      text-align: center;
      margin-top: 12px;
      font-size: 0.85em;
      color: var(--boss-text-muted);
    }
  `;
  const style = document.createElement("style");
  style.id = "boss-punstuck-css";
  style.textContent = css;
  document.head.appendChild(style);
}
injectCSS();

// ── State helpers ──────────────────────────────────────────────────────────

function defaultFlags() {
  return {
    useEyes: true,
    useBreast: true,
    useBody: true,
    useHair: true,
    useClothing: true,
    useLocation: true,
    usePose: true,
    useView: true,
    useWeather: true,
    useExplicitSubjects: false,
  };
}

function defaultState() {
  return {
    mode: CHAOS_MODE,
    intensity: INTENSITY_DEFAULT,
    flags: defaultFlags(),
    seed: 0,
    seedMode: "random",
  };
}

function readState(node) {
  const v = node.properties?.[STATE_PROP];
  if (typeof v === "string" && v) {
    try {
      const obj = JSON.parse(v);
      const merged = { ...defaultState(), ...obj };
      merged.intensity = clampIntensity(merged.intensity);
      merged.seed = clampSeed(merged.seed);
      if (merged.seedMode !== "random" && merged.seedMode !== "fixed") {
        merged.seedMode = "random";
      }
      if (typeof merged.mode !== "string") merged.mode = CHAOS_MODE;
      if (typeof merged.flags !== "object" || merged.flags === null) {
        merged.flags = defaultFlags();
      } else {
        merged.flags = { ...defaultFlags(), ...merged.flags };
        for (const k of Object.keys(merged.flags)) {
          merged.flags[k] = !!merged.flags[k];
        }
      }
      return merged;
    } catch {
      /* fall through */
    }
  }
  return defaultState();
}

function writeState(node, state) {
  if (!node.properties) node.properties = {};
  node.properties[STATE_PROP] = JSON.stringify(state);
}

function clampIntensity(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return INTENSITY_DEFAULT;
  return Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, n));
}

function clampSeed(s) {
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  return n;
}

function rollSeed() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function hideCanvasWidget(widgets, name) {
  const w = (widgets || []).find((x) => x.name === name);
  if (!w) return;
  w.hidden = true;
  w.computeSize = () => [0, -4];
  if (!w.options) w.options = {};
  w.options.canvasOnly = true;
}

const VISIBLE_NATIVE_WIDGETS = ["mode", "intensity", "seed", "control_after_generate", "force_refresh"];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── On-node body ───────────────────────────────────────────────────────────

function shortMode(value) {
  if (value === NONE_MODE) return { text: "(none)", cls: "value none" };
  if (value === CHAOS_MODE) return { text: "(chaos)", cls: "value chaos" };
  return { text: value, cls: "value" };
}

function enabledFragmentCount(state) {
  return FRAGMENTS.filter((f) => state.flags[f.key]).length;
}

function renderHeader(node) {
  const head = node._bossPunHead;
  if (!head) return;
  const state = readState(node);
  const m = shortMode(state.mode);
  const total = FRAGMENTS.length;
  const on = enabledFragmentCount(state);
  head.innerHTML =
    `<span class="label">Mode:</span> <span class="${m.cls}">${escapeHtml(m.text)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Intensity:</span> <span class="value">${state.intensity.toFixed(2)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="label">Fragments:</span> <span class="value">${on}/${total}</span>`;
}

function setStatus(node, text, isError = false) {
  const root = node._bossPunRoot;
  if (!root) return;
  const s = root.querySelector(".boss-status");
  if (!s) return;
  s.textContent = text || "";
  s.classList.toggle("is-error", !!isError);
}

// Mirror values into the (hidden) native widgets so Python reads the same
// values at execution time. Called on first paint and on every Save.
function syncNativeWidgets(node, state) {
  const setWidget = (name, value) => {
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
  };
  setWidget("mode", state.mode);
  setWidget("intensity", clampIntensity(state.intensity));
  setWidget("seed", clampSeed(state.seed));
}

function setupPunstuckNode(node) {
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
  openBtn.textContent = "⚡ Open Editor";
  root.appendChild(openBtn);

  const status = document.createElement("div");
  status.className = "boss-status";
  root.appendChild(status);

  node.addDOMWidget("punstuck_ui", "boss_punstuck", root, {
    getValue: () => readState(node),
    setValue: () => {},
    getMinHeight: () => 100,
    margin: 4,
    serialize: false,
  });

  node._bossPunRoot = root;
  node._bossPunHead = head;

  // Seed hidden widgets so Python reads the right values on first Run,
  // before the user has opened the editor.
  syncNativeWidgets(node, readState(node));

  openBtn.addEventListener("click", async () => {
    try {
      setStatus(node, "Loading library…");
      const editor = new PunstuckEditor(node);
      await editor.open();
      setStatus(node, "");
    } catch (err) {
      console.error("[BossPromptUnstuckPro] open editor failed", err);
      setStatus(node, "Failed to load library. Is the backend running?", true);
    }
  });

  renderHeader(node);
}

// ── JS-side preview helper (mirrors _assemble in Python) ───────────────────
//
// Pure function — given a library + mode + flags + intensity + a seed,
// returns { raw, final, categoryUsed }. Used only to render the editor's
// preview when in Fixed mode. Random mode shows a placeholder instead.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seed) {
  const r = mulberry32(seed);
  return {
    pick(items) {
      if (!items || !items.length) return "";
      return items[Math.floor(r() * items.length)];
    },
  };
}

function assemblePreview(library, mode, flags, intensity, seed) {
  if (mode === NONE_MODE) return { raw: "", final: "", categoryUsed: "None" };

  let actual = mode;
  let categoryUsed = mode;
  let rng;
  if (mode === CHAOS_MODE) {
    const catKeys = Object.keys(library.categories || {}).filter(
      (k) => k !== "universal",
    );
    if (!catKeys.length) return { raw: "", final: "", categoryUsed: "CHAOS" };
    // Deterministic Chaos pick: hash the seed through the same RNG so the
    // preview is reproducible when the user picks a Fixed seed.
    rng = rngFromSeed(seed);
    const idx = Math.floor(rng.pick([...Array(catKeys.length).keys()]) || 0);
    actual = catKeys[idx] || catKeys[0];
    categoryUsed = "CHAOS";
  } else {
    rng = rngFromSeed(seed);
  }

  const univ = library.universal || {};
  const cat = (library.categories || {})[actual] || {};
  const explicit = univ.explicitSubjects || {};

  let subject = "";
  if (EXPLICIT_CATEGORIES.has(actual) && flags.useExplicitSubjects) {
    subject = rng.pick(explicit[actual] || []);
  }
  if (!subject) subject = rng.pick(univ.subjects || []);

  const eye = flags.useEyes ? rng.pick(univ.eyes || []) : "";
  const breast = flags.useBreast ? rng.pick(univ.breasts || []) : "";
  const body = flags.useBody ? rng.pick(univ.body || []) : "";
  let hair = "";
  if (flags.useHair) {
    const hl = rng.pick(univ.hairLength || []);
    const hc = rng.pick(univ.hairColor || []);
    hair = `${hl} ${hc}`.trim();
  }
  let color = "";
  let clothing = "";
  if (flags.useClothing) {
    color = rng.pick(cat.colors || []);
    clothing = rng.pick(cat.clothing || []);
  }
  const poseCat = flags.usePose ? rng.pick(cat.poses || []) : "";
  const poseUniv = flags.usePose ? rng.pick(univ.poses || []) : "";
  const pose = poseCat || poseUniv;
  const location = flags.useLocation ? rng.pick(cat.locations || []) : "";
  const view = flags.useView ? rng.pick(univ.views || []) : "";
  const ambiance = flags.useWeather ? rng.pick(univ.weather || []) : "";

  const colorClothing = `${color} ${clothing}`.trim();
  const elements = [
    subject,
    eye,
    breast,
    body,
    hair,
    colorClothing,
    pose,
    location,
    view,
    ambiance,
  ];
  const raw = elements
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");

  let final = raw;
  if (raw && Math.abs(intensity - 1.0) >= 1e-4) {
    final = `(${raw}:${intensity.toFixed(2)})`;
  }

  return { raw, final, categoryUsed };
}

// ── Live preview HTML (replicates the v3.0 _preview) ───────────────────────

function buildPreviewHTML(state, library, lastSeed) {
  const isFixed = state.seedMode === "fixed";
  const isRandom = state.seedMode === "random";
  const intensity = clampIntensity(state.intensity);

  let subtitle, outputBlock, outputCls, rawLine;

  if (state.mode === NONE_MODE) {
    subtitle = "None → SILENCE";
    outputBlock = '<em style="color:#666">(absolute void)</em>';
    outputCls = "empty";
  } else if (isRandom) {
    // Can't resolve actual picks — show the mode + placeholder.
    const catLabel =
      state.mode === CHAOS_MODE
        ? "CHAOS → CHAOS"
        : `${state.mode.toUpperCase()} → ${state.mode.toUpperCase()}`;
    subtitle = `${state.mode} → ${state.mode === CHAOS_MODE ? "TOTAL RANDOM" : state.mode.toUpperCase()}`;
    outputBlock =
      '<em style="color:#888">(random picks on Run — switch to Fixed to preview)</em>';
    outputCls = "empty";
  } else {
    // Fixed mode → resolve a preview from the editor's own RNG.
    const result = assemblePreview(
      library,
      state.mode,
      state.flags,
      intensity,
      clampSeed(state.seed),
    );
    const realCat =
      result.categoryUsed === "CHAOS"
        ? result.categoryUsed
        : state.mode === CHAOS_MODE
          ? "TOTAL RANDOM"
          : state.mode.toUpperCase();
    subtitle = `${state.mode} → ${realCat}`;
    if (result.final) {
      outputBlock = `<span class="arrow">→</span> ${escapeHtml(result.final)}`;
      outputCls = "";
    } else {
      outputBlock = '<em style="color:#666">(empty)</em>';
      outputCls = "empty";
    }
    if (result.raw) rawLine = result.raw;
  }

  const seedLabel = isFixed
    ? `seed ${state.seed}`
    : lastSeed != null
      ? `random (last: ${lastSeed})`
      : "random";
  const meta = `intensity: ${intensity.toFixed(2)} · ${seedLabel}`;

  // Use category-specific colors (matches v3.0).
  let titleColor = "#ffd700";
  if (state.mode === CHAOS_MODE) titleColor = "#ff0066";
  else if (state.mode === NONE_MODE) titleColor = "#888888";

  return `
    <div class="boss-pun-card-title" style="color:${titleColor}; text-shadow:0 0 10px ${titleColor};">⚡ PROMPT UNSTUCK PRO BOSS</div>
    <div class="boss-pun-card-sub">${escapeHtml(subtitle)}</div>
    <div class="boss-pun-output ${outputCls}">${outputBlock}</div>
    ${rawLine ? `<div class="boss-pun-meta" style="text-align:left; margin-top:10px;">raw: ${escapeHtml(rawLine)}</div>` : ""}
    <div class="boss-pun-meta">${escapeHtml(meta)}</div>
  `;
}

// ── PunstuckEditor ─────────────────────────────────────────────────────────

class PunstuckEditor {
  constructor(node) {
    this.node = node;
    this.library = {
      universal: {},
      categories: {},
      explicitSubjects: {},
      intensityRange: {
        min: INTENSITY_MIN,
        max: INTENSITY_MAX,
        step: INTENSITY_STEP,
        default: INTENSITY_DEFAULT,
      },
      modeOptions: [NONE_MODE, CHAOS_MODE],
      explicitCategories: [],
    };
    this.state = readState(node);
    this.lastSeed = node._pixBossLastSeed ?? null;
    this.modal = null;
  }

  async fetchData() {
    const r = await fetch("/punstuck_boss/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    this.library = {
      universal: data.universal || {},
      categories: data.categories || {},
      explicitSubjects: data.explicitSubjects || {},
      intensityRange: data.intensityRange || this.library.intensityRange,
      modeOptions: data.modeOptions || [NONE_MODE, CHAOS_MODE],
      explicitCategories: data.explicitCategories || [],
    };
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

    // Top bar
    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `<div class="boss-bar-title">Prompt Unstuck Pro Editor</div>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "boss-btn-close";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", () => this.cancel());
    bar.appendChild(closeBtn);
    modal.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "boss-body";

    // Left controls
    const side = document.createElement("div");
    side.className = "boss-side";

    side.appendChild(this.buildModeSection());
    side.appendChild(this.buildIntensitySection());
    side.appendChild(this.buildFlagsSection());
    side.appendChild(this.buildSeedSection());

    body.appendChild(side);

    // Right preview
    const previewWrap = document.createElement("div");
    previewWrap.className = "boss-preview";
    const card = document.createElement("div");
    card.className = "boss-card";
    previewWrap.appendChild(card);
    body.appendChild(previewWrap);
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
    cancelBtn.addEventListener("click", () => this.cancel());
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    modal.appendChild(footer);

    document.body.appendChild(modal);
    this.modal = modal;
    this.cardEl = card;

    this.refreshPreview();
  }

  // ── Mode chip strip ───────────────────────────────────────────────────
  buildModeSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Mode";
    wrap.appendChild(lbl);

    const chips = document.createElement("div");
    chips.className = "boss-pun-chips";
    // Always include None + Chaos + whatever categories came from the backend.
    const seen = new Set();
    const addChip = (name, isSpecial) => {
      if (seen.has(name)) return;
      seen.add(name);
      const chip = document.createElement("div");
      chip.className =
        "boss-pun-chip" +
        (isSpecial ? " special" : "") +
        (this.state.mode === name ? " selected" : "");
      chip.textContent = name;
      chip.addEventListener("click", () => {
        this.state.mode = name;
        // Refresh all chips.
        chips.querySelectorAll(".boss-pun-chip").forEach((c) => {
          c.classList.toggle("selected", c.textContent === name);
        });
        // Re-render the flags grid (explicit-subject toggle only enabled
        // when the current category supports it).
        this.refreshFlagsEnabled();
        this.refreshPreview();
      });
      chips.appendChild(chip);
    };
    addChip(NONE_MODE, true);
    addChip(CHAOS_MODE, true);
    for (const m of this.library.modeOptions) {
      if (m !== NONE_MODE && m !== CHAOS_MODE) addChip(m, false);
    }
    wrap.appendChild(chips);
    return wrap;
  }

  // ── Intensity slider ──────────────────────────────────────────────────
  buildIntensitySection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = `Intensity: ${this.state.intensity.toFixed(2)}`;
    wrap.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "boss-pun-strength";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(INTENSITY_MIN);
    slider.max = String(INTENSITY_MAX);
    slider.step = String(INTENSITY_STEP);
    slider.value = String(this.state.intensity);
    const num = document.createElement("input");
    num.type = "number";
    num.className = "boss-input";
    num.min = String(INTENSITY_MIN);
    num.max = String(INTENSITY_MAX);
    num.step = String(INTENSITY_STEP);
    num.value = this.state.intensity.toFixed(2);
    row.appendChild(slider);
    row.appendChild(num);
    wrap.appendChild(row);

    const apply = (v) => {
      this.state.intensity = clampIntensity(v);
      lbl.textContent = `Intensity: ${this.state.intensity.toFixed(2)}`;
      slider.value = String(this.state.intensity);
      num.value = this.state.intensity.toFixed(2);
      this.refreshPreview();
    };
    slider.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("change", (e) => apply(e.target.value));
    return wrap;
  }

  // ── Fragments toggle grid ─────────────────────────────────────────────
  buildFlagsSection() {
    const wrap = document.createElement("div");
    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Fragments";
    wrap.appendChild(lbl);

    const grid = document.createElement("div");
    grid.className = "boss-pun-flags";
    this._flagGrid = grid;
    for (const f of FRAGMENTS) {
      const cell = document.createElement("div");
      cell.className = "boss-pun-flag";
      cell.dataset.key = f.key;
      const check = document.createElement("span");
      check.className = "check";
      check.textContent = "✓";
      const text = document.createElement("span");
      text.textContent = f.label;
      cell.appendChild(check);
      cell.appendChild(text);
      cell.addEventListener("click", () => {
        if (cell.classList.contains("disabled")) return;
        this.state.flags[f.key] = !this.state.flags[f.key];
        cell.classList.toggle("on", this.state.flags[f.key]);
        this.refreshPreview();
        this.refreshHeader();
      });
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    this.refreshFlagsEnabled();
    return wrap;
  }

  refreshFlagsEnabled() {
    if (!this._flagGrid) return;
    const explicitEnabled = stateIsExplicitCategory(this.state, this.library);
    for (const cell of this._flagGrid.children) {
      const key = cell.dataset.key;
      const isExplicit = key === "useExplicitSubjects";
      const on = !!this.state.flags[key];
      cell.classList.toggle("on", on);
      cell.classList.toggle("disabled", isExplicit && !explicitEnabled);
    }
  }

  refreshHeader() {
    if (this.node?._bossPunHead) renderHeader(this.node);
  }

  // ── Seed section ──────────────────────────────────────────────────────
  buildSeedSection() {
    const wrap = document.createElement("div");

    const lbl = document.createElement("span");
    lbl.className = "boss-label";
    lbl.textContent = "Seed";
    wrap.appendChild(lbl);

    const num = document.createElement("input");
    num.type = "text";
    num.className = "boss-pun-seed-num";
    num.value = String(this.state.seed);
    num.spellcheck = false;
    num.autocomplete = "off";
    num.inputMode = "numeric";
    const commit = () => {
      const cleaned = num.value.replace(/[^\d]/g, "");
      const v = cleaned === "" ? this.state.seed : clampSeed(cleaned);
      num.value = String(v);
      this.state.seed = v;
      this.state.seedMode = "fixed";
      syncPill();
      this.refreshLastRun();
      this.refreshPreview();
    };
    num.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        num.blur();
      }
    });
    num.addEventListener("blur", commit);
    wrap.appendChild(num);

    const pill = document.createElement("div");
    pill.className = "boss-pun-pill";
    const syncPill = () => {
      pill.querySelectorAll(".boss-pun-seg").forEach((s) => {
        s.classList.toggle("active", s.dataset.mode === this.state.seedMode);
      });
    };
    for (const [m, label] of [
      ["random", "Random"],
      ["fixed", "Fixed"],
    ]) {
      const seg = document.createElement("button");
      seg.type = "button";
      seg.className =
        "boss-pun-seg" + (this.state.seedMode === m ? " active" : "");
      seg.textContent = label;
      seg.dataset.mode = m;
      seg.addEventListener("click", () => {
        if (this.state.seedMode === m) return;
        this.state.seedMode = m;
        syncPill();
        this.refreshLastRun();
        this.refreshPreview();
      });
      pill.appendChild(seg);
    }
    wrap.appendChild(pill);

    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "boss-pun-btn";
    newBtn.textContent = "New fixed random";
    newBtn.addEventListener("click", () => {
      this.state.seed = rollSeed();
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
      this.refreshPreview();
    });
    wrap.appendChild(newBtn);

    const row = document.createElement("div");
    row.className = "boss-pun-seed-row";

    const useLast = document.createElement("button");
    useLast.type = "button";
    useLast.className = "boss-pun-btn";
    useLast.textContent = "Use last seed";
    useLast.disabled = this.lastSeed == null;
    useLast.addEventListener("click", () => {
      if (this.lastSeed == null) return;
      this.state.seed = clampSeed(this.lastSeed);
      this.state.seedMode = "fixed";
      num.value = String(this.state.seed);
      syncPill();
      this.refreshLastRun();
      this.refreshPreview();
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "boss-pun-btn is-copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = String(clampSeed(this.state.seed));
      const flash = (ok) => {
        copyBtn.classList.toggle("is-flashing", ok);
        copyBtn.textContent = ok ? "Copied" : "No clipboard";
        setTimeout(() => {
          copyBtn.classList.remove("is-flashing");
          copyBtn.textContent = "Copy";
        }, 700);
      };
      const legacy = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;";
        let ok = false;
        try {
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        } finally {
          ta.remove();
        }
        flash(ok);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => flash(true))
          .catch(legacy);
      } else {
        legacy();
      }
    });

    row.appendChild(useLast);
    row.appendChild(copyBtn);
    wrap.appendChild(row);

    this._lastRunEl = document.createElement("div");
    this._lastRunEl.className = "boss-pun-seed-last";
    wrap.appendChild(this._lastRunEl);
    this.refreshLastRun();
    syncPill();
    return wrap;
  }

  refreshLastRun() {
    if (!this._lastRunEl) return;
    if (this.state.seedMode === "fixed") {
      this._lastRunEl.textContent = "Fixed: same picks every run";
    } else if (this.lastSeed != null) {
      this._lastRunEl.textContent = `Last run seed: ${this.lastSeed}`;
    } else {
      this._lastRunEl.textContent = "Last run: not run yet";
    }
  }

  refreshPreview() {
    if (!this.cardEl) return;
    this.cardEl.innerHTML = buildPreviewHTML(
      this.state,
      this.library,
      this.lastSeed,
    );
  }

  // ── Commit / cancel ────────────────────────────────────────────────────
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

function stateIsExplicitCategory(state, library) {
  if (state.mode === CHAOS_MODE || state.mode === NONE_MODE) return false;
  if (EXPLICIT_CATEGORIES.has(state.mode)) return true;
  // Server-side explicitCategories list is authoritative if it disagrees.
  if (
    Array.isArray(library.explicitCategories) &&
    library.explicitCategories.length
  ) {
    return library.explicitCategories.includes(state.mode);
  }
  return false;
}

// ── loadGraphData 300 ms guard (same trick as the three siblings) ─────────
let _bossPunLoadingGraph = false;
if (app && app.loadGraphData && !app._bossPunLoadWrapped) {
  app._bossPunLoadWrapped = true;
  const _origLoad = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _bossPunLoadingGraph = true;
    let r;
    try {
      r = _origLoad(...args);
    } finally {
      Promise.resolve(r).finally(() =>
        setTimeout(() => {
          _bossPunLoadingGraph = false;
        }, 300),
      );
    }
    return r;
  };
}

// ── Extension registration ─────────────────────────────────────────────────

app.registerExtension({
  name: "BossNodes.PromptUnstuckPro",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PromptUnstuckPro") return;
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const r = _origConfigure?.apply(this, arguments);
      if (this._bossPunHead) renderHeader(this);
      return r;
    };
  },

  nodeCreated(node) {
    if (node.comfyClass !== "PromptUnstuckPro") return;
    setupPunstuckNode(node);
  },
});

// ── Inject resolved state into the API prompt at execution time ───────────
// Mirrors the camera_style_mixer graphToPrompt wrapper. In Random mode we
// roll a fresh seed here so Python only ever sees a committed seed value.

function buildPunstuckNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (
        n.comfyClass === "PromptUnstuckPro" ||
        n.type === "PromptUnstuckPro"
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

function findPunstuckNode(index, promptId) {
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
      if (!entry || entry.class_type !== "PromptUnstuckPro") continue;
      if (!index) index = buildPunstuckNodeIndex();
      const node = findPunstuckNode(index, id);
      const state = node ? readState(node) : defaultState();
      let runSeed;
      if (state.seedMode === "random") {
        runSeed = rollSeed();
        if (node) node._pixBossLastSeed = runSeed;
      } else {
        runSeed = clampSeed(state.seed);
      }
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify({
        ...state,
        seed: runSeed,
      });
    }
  } catch (e) {
    console.warn("[BossPromptUnstuckPro] graphToPrompt inject failed", e);
  }
  return result;
};

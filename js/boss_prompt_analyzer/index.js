// Boss Prompt Analyzer PRO — Frontend styling
import { app } from "../../scripts/app.js";

function injectCSS() {
  if (document.getElementById("boss-pa-styles")) return;
  const css = `
    /* ── Node Title ────────────────────────────────────────────── */
    .boss-pa-node .node-title {
      background: linear-gradient(135deg, var(--boss-brand), #6D28D9) !important;
      border-bottom: 1px solid var(--boss-border-strong) !important;
    }
    .boss-pa-node .node-title span {
      color: #fff !important;
      font-weight: 700 !important;
    }

    /* ── Node Body ─────────────────────────────────────────────── */
    .boss-pa-node {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border-strong) !important;
      border-radius: var(--boss-radius-md) !important;
      box-shadow: var(--boss-shadow-root) !important;
    }

    /* ── Widget Container ──────────────────────────────────────── */
    .boss-pa-node .widgets-container {
      background: transparent !important;
    }

    /* ── Widget Row (each input row) ───────────────────────────── */
    .boss-pa-node .widget {
      background: var(--boss-bg-input) !important;
      border: 1px solid var(--boss-border) !important;
      border-radius: var(--boss-radius-sm) !important;
      margin: 2px 4px !important;
      padding: 4px 6px !important;
    }
    .boss-pa-node .widget:hover {
      border-color: var(--boss-border-strong) !important;
    }

    /* ── Widget Label Text ─────────────────────────────────────── */
    .boss-pa-node .widget-label {
      color: var(--boss-text-dim) !important;
      font-size: var(--boss-font-size-sm) !important;
    }

    /* ── Boolean Toggle ────────────────────────────────────────── */
    .boss-pa-node .widget input[type="checkbox"] {
      accent-color: var(--boss-brand) !important;
    }

    /* ── Combo/Select Dropdown ─────────────────────────────────── */
    .boss-pa-node .widget select,
    .boss-pa-node .combo-widget select {
      background: var(--boss-bg-input) !important;
      color: var(--boss-text) !important;
      border: 1px solid var(--boss-border-input) !important;
      border-radius: var(--boss-radius-xs) !important;
      font-size: var(--boss-font-size-sm) !important;
    }

    /* ── Text Area ─────────────────────────────────────────────── */
    .boss-pa-node .widget textarea,
    .boss-pa-node .string-widget textarea {
      background: var(--boss-bg-input) !important;
      color: var(--boss-text) !important;
      border: 1px solid var(--boss-border-input) !important;
      border-radius: var(--boss-radius-sm) !important;
      font-family: var(--boss-font-mono) !important;
      font-size: var(--boss-font-size-sm) !important;
      padding: 6px 8px !important;
    }
    .boss-pa-node .widget textarea:focus,
    .boss-pa-node .string-widget textarea:focus {
      border-color: var(--boss-brand) !important;
      box-shadow: 0 0 0 2px var(--boss-brand-glow) !important;
      outline: none !important;
    }

    /* ── Input/Output Slots ────────────────────────────────────── */
    .boss-pa-node .node-slot {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border) !important;
      border-radius: var(--boss-radius-xs) !important;
    }
    .boss-pa-node .output .node-slot {
      border-color: var(--boss-brand) !important;
    }

    /* ── Toggle Button Styling ─────────────────────────────────── */
    .boss-pa-node .toggle-widget,
    .boss-pa-node .boolean-widget {
      background: var(--boss-bg-input) !important;
      border: 1px solid var(--boss-border) !important;
      border-radius: var(--boss-radius-sm) !important;
    }

    /* ── Value Display (right side of widget) ──────────────────── */
    .boss-pa-node .widget-value {
      color: var(--boss-text-bright) !important;
      font-weight: 600 !important;
    }
  `;
  const el = document.createElement("style");
  el.id = "boss-pa-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

// Apply class to node when created
app.registerExtension({
  name: "boss_prompt_analyzer.style",
  async nodeCreated(node) {
    if (node.comfyClass === "BossPromptAnalyzerPRO") {
      injectCSS();
      node.addClass("boss-pa-node");
    }
  },
});

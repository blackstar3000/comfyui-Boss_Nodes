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
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }

    /* ── Widget Rows ───────────────────────────────────────────── */
    .boss-pa-node .comfy-widget-row {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border) !important;
      border-radius: var(--boss-radius-sm) !important;
      margin: 2px 4px !important;
      padding: 4px 6px !important;
      transition: all var(--boss-transition-fast) !important;
    }
    .boss-pa-node .comfy-widget-row:hover {
      border-color: var(--boss-border-strong) !important;
      background: var(--boss-bg-hover) !important;
    }

    /* ── Boolean Toggle ────────────────────────────────────────── */
    .boss-pa-node .comfy-widget-row input[type="checkbox"] {
      accent-color: var(--boss-brand) !important;
    }

    /* ── Combo/Select ──────────────────────────────────────────── */
    .boss-pa-node .comfy-widget-row select {
      background: var(--boss-bg-input) !important;
      color: var(--boss-text) !important;
      border: 1px solid var(--boss-border-input) !important;
      border-radius: var(--boss-radius-xs) !important;
      padding: 2px 4px !important;
      font-size: var(--boss-font-size-sm) !important;
    }

    /* ── Text Area ─────────────────────────────────────────────── */
    .boss-pa-node textarea {
      background: var(--boss-bg-input) !important;
      color: var(--boss-text) !important;
      border: 1px solid var(--boss-border-input) !important;
      border-radius: var(--boss-radius-sm) !important;
      font-family: var(--boss-font-mono) !important;
      font-size: var(--boss-font-size-sm) !important;
      padding: 6px 8px !important;
      resize: vertical !important;
    }
    .boss-pa-node textarea:focus {
      border-color: var(--boss-brand) !important;
      box-shadow: 0 0 0 2px var(--boss-brand-glow) !important;
      outline: none !important;
    }

    /* ── Input Slots (clip, outputs) ───────────────────────────── */
    .boss-pa-node .node-slot {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border) !important;
      border-radius: var(--boss-radius-xs) !important;
    }

    /* ── Output Slots ──────────────────────────────────────────── */
    .boss-pa-node .node-output .node-slot {
      border-color: var(--boss-brand) !important;
    }

    /* ── Node Body ─────────────────────────────────────────────── */
    .boss-pa-node {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border-strong) !important;
      border-radius: var(--boss-radius-md) !important;
      box-shadow: var(--boss-shadow-root) !important;
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

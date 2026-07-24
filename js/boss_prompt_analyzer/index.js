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

    /* ── Input/Output Slots ────────────────────────────────────── */
    .boss-pa-node .node-slot {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border) !important;
      border-radius: var(--boss-radius-xs) !important;
    }
    .boss-pa-node .output .node-slot {
      border-color: var(--boss-brand) !important;
    }

    /* ── Widgets Container ─────────────────────────────────────── */
    .boss-pa-node .widgets-container {
      background: transparent !important;
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

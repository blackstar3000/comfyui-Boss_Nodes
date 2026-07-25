// Boss Prompt Analyzer PRO — Full DOM widget (Pixaroma Seed pattern)
import { app } from "/scripts/app.js";

// ── CSS ────────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-pa-dom-css")) return;
  const s = document.createElement("style");
  s.id = "boss-pa-dom-css";
  s.textContent = `
    /* ── Node chrome ──────────────────────────────────────────────── */
    .boss-pa-node .node-title {
      background: linear-gradient(135deg, #7c3aed, #6D28D9) !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    .boss-pa-node .node-title span { color: #fff !important; font-weight: 700 !important; }
    .boss-pa-node {
      background: #1a1a2e !important;
      border: 1px solid rgba(124,58,237,0.3) !important;
      border-radius: 8px !important;
    }
    .boss-pa-node .widgets-container { background: transparent !important; }

    /* ── Root ─────────────────────────────────────────────────────── */
    .boss-pa-root {
      width: 100%; box-sizing: border-box;
      padding: 10px; background: #12121e; border-radius: 6px;
      color: #ddd; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .boss-pa-root > * { flex-shrink: 0; }

    /* ── Score ring ───────────────────────────────────────────────── */
    .boss-pa-score { display: flex; align-items: center; gap: 10px; }
    .boss-pa-ring { width: 44px; height: 44px; flex-shrink: 0; position: relative; }
    .boss-pa-ring svg { transform: rotate(-90deg); }
    .boss-pa-ring-bg { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 4; }
    .boss-pa-ring-fg { fill: none; stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 0.5s ease; }
    .boss-pa-ring-lbl {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: #f2f2f2;
    }
    .boss-pa-score-txt { font-size: 11px; color: rgba(255,255,255,0.5); line-height: 1.3; }
    .boss-pa-score-txt b { color: #f2f2f2; }

    /* ── Stat pills ───────────────────────────────────────────────── */
    .boss-pa-pills { display: flex; flex-wrap: wrap; gap: 4px; }
    .boss-pa-pill {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px; padding: 2px 6px; font-size: 10px; color: rgba(255,255,255,0.5);
      white-space: nowrap;
    }
    .boss-pa-pill b { color: #f2f2f2; }

    /* ── Category bars ────────────────────────────────────────────── */
    .boss-pa-cats { display: flex; flex-direction: column; gap: 3px; }
    .boss-pa-sec { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.35); font-weight: 600; }
    .boss-pa-cat { display: flex; align-items: center; gap: 4px; font-size: 10px; }
    .boss-pa-cat-n { width: 48px; color: rgba(255,255,255,0.45); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .boss-pa-cat-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .boss-pa-cat-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
    .boss-pa-cat-c { width: 14px; text-align: right; color: rgba(255,255,255,0.35); font-size: 9px; }

    /* ── Warnings ─────────────────────────────────────────────────── */
    .boss-pa-warns { display: flex; flex-direction: column; gap: 2px; }
    .boss-pa-w {
      font-size: 10px; padding: 2px 6px; border-radius: 3px;
      background: rgba(255,255,255,0.03); border-left: 2px solid #f59e0b;
      color: #fbbf24; line-height: 1.3;
    }

    /* ── Buttons ──────────────────────────────────────────────────── */
    .boss-pa-btns { display: flex; gap: 6px; }
    .boss-pa-btn {
      flex: 1; padding: 7px 10px; border-radius: 6px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85); font-family: inherit; font-size: 11px;
      cursor: pointer; text-align: center; transition: all 0.1s;
    }
    .boss-pa-btn:hover { background: #7c3aed; border-color: #7c3aed; color: #fff; }
    .boss-pa-btn.active { background: #7c3aed; border-color: #7c3aed; color: #fff; font-weight: 500; }
    .boss-pa-btn:disabled { opacity: 0.35; cursor: default; }

    /* ── Placeholder ──────────────────────────────────────────────── */
    .boss-pa-empty {
      display: flex; align-items: center; justify-content: center;
      padding: 12px; color: rgba(255,255,255,0.3); text-align: center; font-size: 11px;
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  Character: ["girl","boy","woman","man","person","character","portrait","face","eyes","hair","body"],
  Outfit: ["dress","shirt","pants","jacket","armor","uniform","clothing","outfit","wearing","suit","robe"],
  Pose: ["standing","sitting","running","fighting","pose","action","dynamic","walking","jumping"],
  Lighting: ["lighting","light","shadow","rim light","backlight","volumetric","ambient","studio lighting","sunlight"],
  Style: ["realistic","anime","oil painting","watercolor","digital art","photorealistic","cinematic","3d render"],
  Background: ["background","bokeh","gradient","sky","forest","city","indoor","outdoor","simple background"],
};
const CAT_COLORS = ["#8b5cf6","#06b6d4","#f43f5e","#eab308","#22c55e","#f97316"];

function analyze(prompt) {
  if (!prompt || !prompt.trim()) return null;
  const clean = prompt.replace(/\([^)]+:[0-9.]+\)/g, "$1").replace(/\(\([^)]+\)\)/g, "$1").replace(/\[([^\]]+)\]/g, "$1");
  const tags = clean.split(/[,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  const wordCount = clean.split(/\s+/).length;
  const tokenEst = Math.ceil(wordCount * 1.3);
  const chunkCount = Math.max(1, Math.ceil(tokenEst / 77));
  const cats = {};
  for (const [cat, kws] of Object.entries(CATEGORIES)) {
    const count = tags.filter(t => kws.some(k => t.includes(k))).length;
    if (count > 0) cats[cat] = count;
  }
  const seen = new Map();
  tags.forEach(t => seen.set(t, (seen.get(t) || 0) + 1));
  const repeats = [...seen.entries()].filter(([, c]) => c > 1);
  let score = 70;
  if (tokenEst > 77) score -= 10;
  if (tokenEst > 150) score -= 10;
  repeats.forEach(() => score -= 5);
  if (Object.keys(cats).length >= 3) score += 10;
  if (tags.length > 5) score += 5;
  if (chunkCount > 2) score -= 5;
  score = Math.max(0, Math.min(100, score));
  return { tokenEst, chunkCount, tagCount: tags.length, cats, repeats, score };
}

function scoreColor(s) { return s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444"; }
function scoreGrade(s) { return s >= 90 ? "Excellent" : s >= 75 ? "Good" : s >= 60 ? "Fair" : "Needs Work"; }

function hideWidget(widgets, name) {
  const w = (widgets || []).find(x => x.name === name);
  if (w) {
    w.hidden = true;
    w.computeSize = () => [0, -4];
    if (!w.options) w.options = {};
    w.options.canvasOnly = true;
    const el = w.element || w.inputEl;
    if (el) el.style.display = "none";
  }
}

// ── Build DOM ──────────────────────────────────────────────────────────────

function buildBody(node, root) {
  root.innerHTML = "";
  const promptW = node.widgets?.find(w => w.name === "prompt");
  const prompt = promptW?.value || "";
  const data = analyze(prompt);

  if (!data) {
    root.innerHTML = '<div class="boss-pa-empty">Type a prompt to analyze</div>';
    return;
  }

  // Score ring
  const r = 18, C = 2 * Math.PI * r;
  const offset = C - (data.score / 100) * C;
  const color = scoreColor(data.score);

  const score = document.createElement("div");
  score.className = "boss-pa-score";
  score.innerHTML = `
    <div class="boss-pa-ring">
      <svg viewBox="0 0 44 44" width="44" height="44">
        <circle class="boss-pa-ring-bg" cx="22" cy="22" r="${r}"/>
        <circle class="boss-pa-ring-fg" cx="22" cy="22" r="${r}"
          stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="boss-pa-ring-lbl">${data.score}</div>
    </div>
    <div class="boss-pa-score-txt"><b>${scoreGrade(data.score)}</b></div>`;
  root.appendChild(score);

  // Stats
  const pills = document.createElement("div");
  pills.className = "boss-pa-pills";
  pills.innerHTML = `
    <span class="boss-pa-pill"><b>${data.tokenEst}</b> tokens</span>
    <span class="boss-pa-pill"><b>${data.chunkCount}</b> chunk${data.chunkCount > 1 ? "s" : ""}</span>
    <span class="boss-pa-pill"><b>${data.tagCount}</b> tags</span>`;
  root.appendChild(pills);

  // Categories
  const catEntries = Object.entries(data.cats);
  if (catEntries.length) {
    const cats = document.createElement("div");
    cats.className = "boss-pa-cats";
    cats.innerHTML = '<div class="boss-pa-sec">Categories</div>';
    const maxC = Math.max(...catEntries.map(([, v]) => v));
    catEntries.forEach(([name, count], i) => {
      const w = maxC > 0 ? (count / maxC) * 100 : 0;
      const row = document.createElement("div");
      row.className = "boss-pa-cat";
      row.innerHTML = `
        <span class="boss-pa-cat-n">${name}</span>
        <div class="boss-pa-cat-bar"><div class="boss-pa-cat-fill" style="width:${w}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></div></div>
        <span class="boss-pa-cat-c">${count}</span>`;
      cats.appendChild(row);
    });
    root.appendChild(cats);
  }

  // Warnings
  if (data.repeats.length) {
    const warns = document.createElement("div");
    warns.className = "boss-pa-warns";
    data.repeats.forEach(([tag, count]) => {
      const w = document.createElement("div");
      w.className = "boss-pa-w";
      w.textContent = `"${tag}" repeated ${count}\u00d7`;
      warns.appendChild(w);
    });
    root.appendChild(warns);
  }

  // Auto-fix button
  const btns = document.createElement("div");
  btns.className = "boss-pa-btns";
  const fixBtn = document.createElement("button");
  fixBtn.type = "button";
  fixBtn.className = "boss-pa-btn";
  fixBtn.textContent = "Auto-fix prompt";
  fixBtn.title = "Deduplicate tags, add BREAKs, balance chunks to ~60 tokens each.";
  fixBtn.addEventListener("click", () => {
    const pw = node.widgets?.find(w => w.name === "prompt");
    const af = node.widgets?.find(w => w.name === "auto_fix");
    if (af) af.value = true;
    // Trigger re-analysis by briefly toggling
    setTimeout(() => { if (af) af.value = false; }, 100);
  });
  btns.appendChild(fixBtn);
  root.appendChild(btns);
}

// ── Extension ──────────────────────────────────────────────────────────────

console.log("[Boss PA] Extension loading...");
app.registerExtension({
  name: "boss_prompt_analyzer.dom",

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "BossPromptAnalyzerPRO") return;

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (data) {
      const r = origConfigure?.apply(this, arguments);
      if (this._bossPARoot) buildBody(this, this._bossPARoot);
      return r;
    };
  },

  async nodeCreated(node) {
    if (node.comfyClass !== "BossPromptAnalyzerPRO") return;
    console.log("[Boss PA] Node created:", node.comfyClass);

    injectCSS();
    node.addClass("boss-pa-node");

    // Hide the extra widgets we don't need on canvas
    ["show_token_ids", "auto_fix", "export_format"].forEach(n => hideWidget(node.widgets, n));

    // Build DOM widget
    const root = document.createElement("div");
    root.className = "boss-pa-root";
    root.innerHTML = '<div class="boss-pa-empty">Type a prompt to analyze</div>';

    const domW = node.addDOMWidget("boss_pa_ui", "custom", root, {
      serialize: false,
      getMinHeight: () => 120,
    });

    node._bossPARoot = root;

    // Poll prompt for changes
    let lastP = "";
    const iv = setInterval(() => {
      const pw = node.widgets?.find(w => w.name === "prompt");
      const v = pw?.value || "";
      if (v !== lastP) { lastP = v; buildBody(node, root); }
    }, 250);
    node.onRemoved = () => clearInterval(iv);

    // Initial render
    setTimeout(() => buildBody(node, root), 100);
  },
});

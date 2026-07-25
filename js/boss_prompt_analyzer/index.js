// Boss Prompt Analyzer PRO — DOM Widget UI
// Computes stats client-side from prompt input; full analysis via STRING outputs.
import { app } from "/scripts/app.js";

// ── CSS ────────────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById("boss-pa-dom-styles")) return;
  const css = `
    /* ── Node chrome ──────────────────────────────────────────────── */
    .boss-pa-node .node-title {
      background: linear-gradient(135deg, var(--boss-brand), #6D28D9) !important;
      border-bottom: 1px solid var(--boss-border-strong) !important;
    }
    .boss-pa-node .node-title span { color: #fff !important; font-weight: 700 !important; }
    .boss-pa-node {
      background: var(--boss-bg-panel) !important;
      border: 1px solid var(--boss-border-strong) !important;
      border-radius: var(--boss-radius-md) !important;
      box-shadow: var(--boss-shadow-root) !important;
    }
    .boss-pa-node .widgets-container { background: transparent !important; }

    /* ── DOM Widget ───────────────────────────────────────────────── */
    .boss-pa-dom {
      font-family: var(--boss-font);
      font-size: var(--boss-font-size);
      color: var(--boss-text);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 100px;
    }

    /* ── Score ring ───────────────────────────────────────────────── */
    .boss-pa-score-row { display: flex; align-items: center; gap: 10px; }
    .boss-pa-ring { width: 44px; height: 44px; flex-shrink: 0; position: relative; }
    .boss-pa-ring svg { transform: rotate(-90deg); }
    .boss-pa-ring-bg { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 4; }
    .boss-pa-ring-fg { fill: none; stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 0.5s ease; }
    .boss-pa-ring-label {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: var(--boss-text-bright);
    }
    .boss-pa-score-text { font-size: 11px; color: var(--boss-text-dim); line-height: 1.3; }
    .boss-pa-score-text b { color: var(--boss-text-bright); }

    /* ── Stat pills ───────────────────────────────────────────────── */
    .boss-pa-stats { display: flex; flex-wrap: wrap; gap: 4px; }
    .boss-pa-pill {
      background: var(--boss-bg-input); border: 1px solid var(--boss-border);
      border-radius: var(--boss-radius-xs); padding: 2px 6px;
      font-size: 10px; color: var(--boss-text-dim); white-space: nowrap;
    }
    .boss-pa-pill b { color: var(--boss-text-bright); }

    /* ── Category bars ────────────────────────────────────────────── */
    .boss-pa-cats { display: flex; flex-direction: column; gap: 2px; }
    .boss-pa-cat-row { display: flex; align-items: center; gap: 4px; font-size: 10px; }
    .boss-pa-cat-name { width: 48px; color: var(--boss-text-dim); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .boss-pa-cat-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .boss-pa-cat-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
    .boss-pa-cat-count { width: 14px; text-align: right; color: var(--boss-text-dim); font-size: 9px; }

    /* ── Warnings ─────────────────────────────────────────────────── */
    .boss-pa-warns { display: flex; flex-direction: column; gap: 2px; }
    .boss-pa-warn {
      font-size: 10px; padding: 2px 6px; border-radius: var(--boss-radius-xs);
      background: rgba(255,255,255,0.03); border-left: 2px solid #f59e0b;
      color: #fbbf24; line-height: 1.3;
    }

    /* ── Placeholder ──────────────────────────────────────────────── */
    .boss-pa-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 12px; color: var(--boss-text-dim); text-align: center;
      font-size: 11px; opacity: 0.6;
    }

    /* ── Section title ────────────────────────────────────────────── */
    .boss-pa-sec {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--boss-text-dim); font-weight: 600;
    }
  `;
  const el = document.createElement("style");
  el.id = "boss-pa-dom-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

// ── Client-side analysis ───────────────────────────────────────────────────

const CATEGORIES = {
  Character: ["girl","boy","woman","man","person","character","portrait","face","eyes","hair","body"],
  Outfit: ["dress","shirt","pants","jacket","armor","uniform","clothing","outfit","wearing","suit","robe"],
  Pose: ["standing","sitting","running","fighting","pose","pose","action","dynamic","walking","jumping"],
  Lighting: ["lighting","light","shadow","rim light","backlight","volumetric","ambient","studio lighting","sunlight"],
  Style: ["realistic","anime","oil painting","watercolor","digital art","photorealistic","cinematic","3d render"],
  Background: ["background","bokeh","gradient","sky","forest","city","indoor","outdoor","simple background"],
};

function analyzePrompt(prompt) {
  if (!prompt || !prompt.trim()) return null;

  const clean = prompt.replace(/\([^)]+:[0-9.]+\)/g, "$1").replace(/\(\([^)]+\)\)/g, "$1").replace(/\[([^\]]+)\]/g, "$1");
  const tags = clean.split(/[,]/).map(t => t.trim().toLowerCase()).filter(Boolean);

  // Token estimate: ~1.3 tokens per word
  const wordCount = clean.split(/\s+/).length;
  const tokenEst = Math.ceil(wordCount * 1.3);
  const chunkCount = Math.max(1, Math.ceil(tokenEst / 77));

  // Category counts
  const cats = {};
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    const count = tags.filter(t => keywords.some(k => t.includes(k))).length;
    if (count > 0) cats[cat] = count;
  }

  // Repeats
  const seen = new Map();
  tags.forEach(t => seen.set(t, (seen.get(t) || 0) + 1));
  const repeats = [...seen.entries()].filter(([, c]) => c > 1);

  // Simple health score
  let score = 70;
  if (tokenEst > 77) score -= 10;
  if (tokenEst > 150) score -= 10;
  if (repeats.length > 0) score -= repeats.length * 5;
  if (Object.keys(cats).length >= 3) score += 10;
  if (tags.length > 5) score += 5;
  if (chunkCount > 2) score -= 5;
  score = Math.max(0, Math.min(100, score));

  return { tokenEst, chunkCount, tagCount: tags.length, cats, repeats, score };
}

// ── Render ─────────────────────────────────────────────────────────────────

function scoreColor(s) {
  if (s >= 80) return "#22c55e";
  if (s >= 60) return "#f59e0b";
  return "#ef4444";
}

function scoreGrade(s) {
  if (s >= 90) return "Excellent";
  if (s >= 75) return "Good";
  if (s >= 60) return "Fair";
  return "Needs Work";
}

const CAT_COLORS = ["#8b5cf6", "#06b6d4", "#f43f5e", "#eab308", "#22c55e", "#f97316"];

function render(container, prompt) {
  container.innerHTML = "";
  const data = analyzePrompt(prompt);

  if (!data) {
    container.innerHTML = `<div class="boss-pa-empty">Type a prompt to analyze</div>`;
    return;
  }

  // Score ring
  const r = 18, C = 2 * Math.PI * r;
  const offset = C - (data.score / 100) * C;
  const color = scoreColor(data.score);
  const row = document.createElement("div");
  row.className = "boss-pa-score-row";
  row.innerHTML = `
    <div class="boss-pa-ring">
      <svg viewBox="0 0 44 44" width="44" height="44">
        <circle class="boss-pa-ring-bg" cx="22" cy="22" r="${r}"/>
        <circle class="boss-pa-ring-fg" cx="22" cy="22" r="${r}"
          stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="boss-pa-ring-label">${data.score}</div>
    </div>
    <div class="boss-pa-score-text"><b>${scoreGrade(data.score)}</b></div>`;
  container.appendChild(row);

  // Stats
  const stats = document.createElement("div");
  stats.className = "boss-pa-stats";
  stats.innerHTML = `
    <span class="boss-pa-pill"><b>${data.tokenEst}</b> tokens</span>
    <span class="boss-pa-pill"><b>${data.chunkCount}</b> chunk${data.chunkCount > 1 ? "s" : ""}</span>
    <span class="boss-pa-pill"><b>${data.tagCount}</b> tags</span>`;
  container.appendChild(stats);

  // Categories
  const catEntries = Object.entries(data.cats);
  if (catEntries.length) {
    const cats = document.createElement("div");
    cats.className = "boss-pa-cats";
    const maxC = Math.max(...catEntries.map(([, v]) => v));
    catEntries.forEach(([name, count], i) => {
      const w = maxC > 0 ? (count / maxC) * 100 : 0;
      const r = document.createElement("div");
      r.className = "boss-pa-cat-row";
      r.innerHTML = `
        <span class="boss-pa-cat-name">${name}</span>
        <div class="boss-pa-cat-bar"><div class="boss-pa-cat-fill" style="width:${w}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></div></div>
        <span class="boss-pa-cat-count">${count}</span>`;
      cats.appendChild(r);
    });
    container.appendChild(cats);
  }

  // Warnings
  if (data.repeats.length) {
    const warns = document.createElement("div");
    warns.className = "boss-pa-warns";
    data.repeats.forEach(([tag, count]) => {
      const w = document.createElement("div");
      w.className = "boss-pa-warn";
      w.textContent = `"${tag}" repeated ${count}×`;
      warns.appendChild(w);
    });
    container.appendChild(warns);
  }
}

// ── Extension ──────────────────────────────────────────────────────────────

app.registerExtension({
  name: "boss_prompt_analyzer.dom",
  async nodeCreated(node) {
    if (node.comfyClass !== "BossPromptAnalyzerPRO") return;

    injectCSS();
    node.addClass("boss-pa-node");

    // DOM widget container
    const wrap = document.createElement("div");
    wrap.className = "boss-pa-dom";
    wrap.innerHTML = `<div class="boss-pa-empty">Type a prompt to analyze</div>`;

    node.addDOMWidget("boss_pa_report", "custom", wrap, {
      serialize: false,
      getMinHeight: () => 100,
    });

    // Find the prompt widget and re-render on change
    const getPromptWidget = () => node.widgets?.find(w => w.name === "prompt");

    const update = () => {
      const pw = getPromptWidget();
      render(wrap, pw?.value || "");
    };

    // Poll for prompt changes (simple, reliable)
    let lastPrompt = "";
    const interval = setInterval(() => {
      const pw = getPromptWidget();
      const val = pw?.value || "";
      if (val !== lastPrompt) {
        lastPrompt = val;
        update();
      }
    }, 200);

    node.onRemoved = () => clearInterval(interval);

    // Also update on first configure
    setTimeout(update, 100);
  },
});

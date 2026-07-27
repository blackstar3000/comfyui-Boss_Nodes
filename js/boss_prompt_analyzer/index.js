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

    /* ── Status badge ─────────────────────────────────────────────── */
    .boss-pa-status { font-size: 10px; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
    .boss-pa-status b { color: rgba(255,255,255,0.55); font-weight: 600; }

    /* ── Placeholder ──────────────────────────────────────────────── */
    .boss-pa-empty {
      display: flex; align-items: center; justify-content: center;
      padding: 12px; color: rgba(255,255,255,0.3); text-align: center; font-size: 11px;
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ────────────────────────────────────────────────────────────────

const analysisCache = new Map();
const CACHE_LIMIT = 100;

function normalizePrompt(prompt) {
  return prompt.trim().replace(/\s+/g, " ");
}

function cachedAnalyze(prompt) {
  const key = prompt ? normalizePrompt(prompt) : prompt;
  if (!key) return analyze(key);
  if (analysisCache.has(key)) return analysisCache.get(key);
  const data = analyze(key);
  if (analysisCache.size >= CACHE_LIMIT) {
    const firstKey = analysisCache.keys().next().value;
    analysisCache.delete(firstKey);
  }
  analysisCache.set(key, data);
  return data;
}

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

// ── Collapsible section helper ─────────────────────────────────────────────

function createCollapsibleSection({ id, title, content, node, defaultExpanded = true } = {}) {
  if (!node._bossPAExpandedSections) node._bossPAExpandedSections = new Set();
  const expanded = node._bossPAExpandedSections.has(id) ? true : defaultExpanded;
  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;gap:4px;";
  const header = document.createElement("div");
  header.style.cssText = "cursor:pointer;display:flex;align-items:center;gap:4px;padding:3px 4px;border-radius:3px;background:rgba(255,255,255,0.02);user-select:none;";
  header.addEventListener("mouseenter", () => header.style.background = "rgba(255,255,255,0.06)");
  header.addEventListener("mouseleave", () => { if (!header._hoverActive) header.style.background = "rgba(255,255,255,0.02)"; });
  const chevron = document.createElement("span");
  chevron.style.cssText = "font-size:9px;width:12px;flex-shrink:0;color:rgba(255,255,255,0.3);";
  chevron.textContent = expanded ? "\u25bc" : "\u25b6";
  const label = document.createElement("span");
  label.style.cssText = "font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.35);font-weight:600;";
  label.textContent = title;
  content.style.display = expanded ? "" : "none";
  header.appendChild(chevron);
  header.appendChild(label);
  header.addEventListener("click", () => {
    const isExpanded = content.style.display !== "none";
    content.style.display = isExpanded ? "none" : "";
    chevron.textContent = isExpanded ? "\u25b6" : "\u25bc";
    if (isExpanded) node._bossPAExpandedSections.delete(id); else node._bossPAExpandedSections.add(id);
  });
  container.appendChild(header);
  container.appendChild(content);
  return container;
}

// ── Build DOM ──────────────────────────────────────────────────────────────

function buildBody(node, root, promptText) {
  root.innerHTML = "";
  const prompt = promptText ?? "";
  const data = cachedAnalyze(prompt);
  node._bossPALiveResult = data;

  if (!data) {
    root.innerHTML = '<div class="boss-pa-empty">Type a prompt to analyze</div>';
    return;
  }

  root.insertAdjacentHTML("beforeend", '<div class="boss-pa-status"><b>\u26a1 Live Preview</b></div>');

  const summaryBody = document.createElement("div");
  summaryBody.style.cssText = "display:flex;flex-direction:column;gap:8px;";

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
  summaryBody.appendChild(score);

  const pills = document.createElement("div");
  pills.className = "boss-pa-pills";
  pills.innerHTML = `
    <span class="boss-pa-pill"><b>${data.tokenEst}</b> tokens</span>
    <span class="boss-pa-pill"><b>${data.chunkCount}</b> chunk${data.chunkCount > 1 ? "s" : ""}</span>
    <span class="boss-pa-pill"><b>${data.tagCount}</b> tags</span>`;
  summaryBody.appendChild(pills);

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
    summaryBody.appendChild(cats);
  }

  root.appendChild(createCollapsibleSection({id:"summary", title:"Summary", node, content: summaryBody, defaultExpanded: true}));

  if (data.repeats.length) {
    const warns = document.createElement("div");
    warns.className = "boss-pa-warns";
    data.repeats.forEach(([tag, count]) => {
      const w = document.createElement("div");
      w.className = "boss-pa-w";
      w.textContent = `"${tag}" repeated ${count}\u00d7`;
      warns.appendChild(w);
    });
    root.appendChild(createCollapsibleSection({id:"warnings", title:"Warnings", node, content: warns, defaultExpanded: false}));
  }

  appendButtons(node, root);
}

function appendButtons(node, root) {
  const btns = document.createElement("div");
  btns.className = "boss-pa-btns";
  const fixBtn = document.createElement("button");
  fixBtn.type = "button";
  fixBtn.className = "boss-pa-btn";
  fixBtn.textContent = "Auto-fix prompt";
  fixBtn.title = "Deduplicate tags, add BREAKs, balance chunks to ~60 tokens each.";
  const af = node.widgets?.find(w => w.name === "auto_fix");
  if (af?.value) fixBtn.classList.add("active");
  fixBtn.addEventListener("click", () => {
    if (!af) return;
    af.value = !af.value;
    fixBtn.classList.toggle("active", af.value);
  });
  btns.appendChild(fixBtn);
  root.appendChild(btns);
}

// ── Render from pre-parsed JSON (for piped output) ─────────────────────────
function renderFromJSON(node, root, data) {
  root.innerHTML = "";
  if (!data) {
    root.innerHTML = '<div class="boss-pa-empty">Type a prompt to analyze</div>';
    return;
  }

  root.insertAdjacentHTML("beforeend", '<div class="boss-pa-status"><b>\u2713 Final Analysis</b></div>');

  // Map Python JSON to DOM format
  const tokenInfo = data.token_info || {};
  const healthInfo = data.health_info || {};
  const metrics = healthInfo.metrics || {};
  const catInfo = data.category_info || {};
  const repeatInfo = data.repeat_info || {};

  // Map Python's 1-5 star score to 0-100
  const pyScore = healthInfo.score || 5;
  const score = Math.max(0, Math.min(100, pyScore * 20));

  const tokenEst = tokenInfo.total_tokens || 0;
  const chunkCount = tokenInfo.chunk_count || 1;
  const tagCount = tokenInfo.total_tags || (data.chunk_info || []).reduce((s, c) => s + (c.token_count || 0), 0);
  const cats = {};
  for (const [cat, info] of Object.entries(catInfo)) {
    cats[cat] = info.count || Math.round((info.percentage / 100) * tagCount);
  }
  const repeats = [];
  if (Array.isArray(repeatInfo)) {
    for (const r of repeatInfo) {
      repeats.push([r.concept, r.count]);
    }
  } else if (repeatInfo.tags) {
    for (const [tag, count] of Object.entries(repeatInfo.tags)) {
      repeats.push([tag, count]);
    }
  }

  const summaryBody = document.createElement("div");
  summaryBody.style.cssText = "display:flex;flex-direction:column;gap:8px;";

  const r = 18, C = 2 * Math.PI * r;
  const offset = C - (score / 100) * C;
  const color = scoreColor(score);

  const scoreEl = document.createElement("div");
  scoreEl.className = "boss-pa-score";
  scoreEl.innerHTML = `
    <div class="boss-pa-ring">
      <svg viewBox="0 0 44 44" width="44" height="44">
        <circle class="boss-pa-ring-bg" cx="22" cy="22" r="${r}"/>
        <circle class="boss-pa-ring-fg" cx="22" cy="22" r="${r}"
          stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="boss-pa-ring-lbl">${score}</div>
    </div>
    <div class="boss-pa-score-txt"><b>${scoreGrade(score)}</b></div>`;
  summaryBody.appendChild(scoreEl);

  const pills = document.createElement("div");
  pills.className = "boss-pa-pills";
  pills.innerHTML = `
    <span class="boss-pa-pill"><b>${tokenEst}</b> tokens</span>
    <span class="boss-pa-pill"><b>${chunkCount}</b> chunk${chunkCount > 1 ? "s" : ""}</span>
    <span class="boss-pa-pill"><b>${tagCount}</b> tags</span>`;
  summaryBody.appendChild(pills);

  const catEntries = Object.entries(cats);
  if (catEntries.length) {
    const catsEl = document.createElement("div");
    catsEl.className = "boss-pa-cats";
    catsEl.innerHTML = '<div class="boss-pa-sec">Categories</div>';
    const maxC = Math.max(...catEntries.map(([, v]) => v));
    catEntries.forEach(([name, count], i) => {
      const w = maxC > 0 ? (count / maxC) * 100 : 0;
      const row = document.createElement("div");
      row.className = "boss-pa-cat";
      row.innerHTML = `
        <span class="boss-pa-cat-n">${name}</span>
        <div class="boss-pa-cat-bar"><div class="boss-pa-cat-fill" style="width:${w}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></div></div>
        <span class="boss-pa-cat-c">${count}</span>`;
      catsEl.appendChild(row);
    });
    summaryBody.appendChild(catsEl);
  }

  root.appendChild(createCollapsibleSection({id:"summary", title:"Summary", node, content: summaryBody, defaultExpanded: true}));

  if (repeats.length) {
    const warns = document.createElement("div");
    warns.className = "boss-pa-warns";
    repeats.forEach(([tag, count]) => {
      const w = document.createElement("div");
      w.className = "boss-pa-w";
      w.textContent = `"${tag}" repeated ${count}\u00d7`;
      warns.appendChild(w);
    });
    root.appendChild(createCollapsibleSection({id:"warnings", title:"Warnings", node, content: warns, defaultExpanded: false}));
  }

  appendButtons(node, root);

  const finalResult = { tokenEst, chunkCount, score, repeats };
  node._bossPAFinalResult = finalResult;
  const diffs = compareAnalysis(node._bossPALiveResult, finalResult);
  const diffEl = document.createElement("div");
  diffEl.style.cssText = "display:flex;flex-direction:column;gap:2px;";
  renderDifferenceSummary(diffEl, diffs);
  root.appendChild(createCollapsibleSection({id:"differences", title:"Analysis Difference", node, content: diffEl, defaultExpanded: true}));
}

// ── Analysis comparison ────────────────────────────────────────────────────

const COMPARISON_FIELDS = [
  { label: "Tokens", get: d => d.tokenEst },
  { label: "Score", get: d => d.score },
  { label: "Chunks", get: d => d.chunkCount },
  { label: "Warnings", get: d => d.repeats?.length ?? 0 },
];

function compareAnalysis(live, final) {
  const diffs = [];
  for (const f of COMPARISON_FIELDS) {
    const liveVal = live ? f.get(live) : undefined;
    const finalVal = final ? f.get(final) : undefined;
    if (liveVal === undefined || finalVal === undefined) continue;
    if (liveVal !== finalVal) {
      diffs.push({ label: f.label, live: liveVal, final: finalVal, delta: finalVal - liveVal });
    }
  }
  return diffs;
}

function renderDifferenceSummary(root, differences) {
  const el = document.createElement("div");
  el.style.cssText = "margin-top:6px;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;font-size:10px;color:rgba(255,255,255,0.4);display:flex;flex-direction:column;gap:2px;";
  const title = document.createElement("div");
  title.style.cssText = "font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.35);font-weight:600;margin-bottom:2px;";
  title.textContent = "Analysis Difference";
  el.appendChild(title);
  if (!differences || differences.length === 0) {
    const line = document.createElement("div");
    line.style.cssText = "color:rgba(255,255,255,0.25);";
    line.textContent = "\u2713 No changes detected";
    el.appendChild(line);
    root.appendChild(el);
    return;
  }
  for (const d of differences) {
    const sign = d.delta > 0 ? "+" : "";
    const color = d.delta > 0 ? "rgba(255,255,255,0.5)" : d.delta < 0 ? "#f87171" : "rgba(255,255,255,0.4)";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;align-items:center;";
    row.innerHTML = `<span style="flex:0 0 56px;color:rgba(255,255,255,0.35)">${d.label}</span><span style="color:${color}">${sign}${d.delta}</span>`;
    el.appendChild(row);
  }
  root.appendChild(el);
}

// ── Extension ──────────────────────────────────────────────────────────────

app.registerExtension({
  name: "boss_prompt_analyzer.dom",

  setup() {
    // Listen for live analysis pushes from the Python backend during execution
    app.api?.addEventListener?.("boss_prompt_analysis", ({ detail }) => {
      if (!detail?.node_id || !detail?.json_report) return;
      const node = app.graph?.getNodeById(detail.node_id);
      if (!node || !node._bossPARoot) return;
      try {
        const data = JSON.parse(detail.json_report);
        renderFromJSON(node, node._bossPARoot, data);
      } catch (err) {
        console.error("[Boss PA] Failed to parse pushed json_report:", err);
      }
    });
  },

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "BossPromptAnalyzerPRO") return;

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = origConfigure?.apply(this, arguments);
      if (this._bossPARoot) buildBody(this, this._bossPARoot);
      return r;
    };
  },

  async nodeCreated(node) {
    if (node.comfyClass !== "BossPromptAnalyzerPRO") return;

    injectCSS();
    if (node.addClass) node.addClass("boss-pa-node");

    // Hide the extra widgets
    ["show_token_ids", "auto_fix", "export_format"].forEach(n => hideWidget(node.widgets, n));

    // Build DOM widget
    const root = document.createElement("div");
    root.className = "boss-pa-root";
    root.innerHTML = '<div class="boss-pa-empty">Type a prompt to analyze</div>';

    if (!node.addDOMWidget) { console.error("[Boss PA] addDOMWidget not available"); return; }
    const domW = node.addDOMWidget("boss_pa_ui", "custom", root, {
      serialize: false,
      getMinHeight: () => 120,
    });

    node._bossPARoot = root;

    // Read text from piped input by tracing the link chain
    function getPipedText() {
      const inp = node.inputs?.find(i => i.name === "prompt");
      if (!inp || inp.link == null) return "";
      const link = node.graph?.links?.[inp.link];
      if (!link) return "";
      const srcNode = node.graph.getNodeById(link.origin_id);
      if (!srcNode) return "";
      // Try app.nodeOutputs first (execution results)
      const nodeOuts = app.nodeOutputs?.[srcNode.id];
      if (nodeOuts) {
        for (const key of Object.keys(nodeOuts)) {
          const val = nodeOuts[key];
          if (Array.isArray(val) && val[0] && typeof val[0] === "string") return val[0];
        }
      }
      // Fallback: scan all source node widgets for any non-empty string value
      for (const w of srcNode.widgets || []) {
        if (w.value && typeof w.value === "string" && !w.hidden) return w.value;
      }
      return "";
    }

    // Throttle live preview rebuilds (immediate first, then 400ms debounce)
    let previewTimer = null;
    let pendingPrompt = null;
    function schedulePreviewUpdate(n, r, p) {
      pendingPrompt = p;
      if (previewTimer) {
        clearTimeout(previewTimer);
        previewTimer = null;
        return;
      }
      buildBody(n, r, p);
      previewTimer = setTimeout(() => {
        if (pendingPrompt !== p) {
          buildBody(n, r, pendingPrompt);
        }
        previewTimer = null;
        pendingPrompt = null;
      }, 400);
    }

    // Poll for text changes (typed or piped)
    let lastP = "";
    const pw = node.widgets?.find(w => w.name === "prompt");
    const iv = setInterval(() => {
      const typed = pw?.value || "";
      const piped = !typed ? getPipedText() : "";
      const v = typed || piped;
      if (v !== lastP) {
        lastP = v;
        schedulePreviewUpdate(node, root, v);
      }
    }, 300);
    const origRemoved = node.onRemoved;
    node.onRemoved = function () {
      clearInterval(iv);
      origRemoved?.call(this);
    };

    // onExecuted: render authoritative server-side analysis from json_report
    node.onExecuted = function (output) {
      const jsonStr =
        typeof output?.json_report === "string"
          ? output.json_report
          : typeof output?.[3] === "string"
            ? output[3]
            : null;
      if (!jsonStr) return;
      try {
        const data = JSON.parse(jsonStr);
        renderFromJSON(node, root, data);
      } catch (err) {
        console.error("[Boss PA] Failed to parse json_report:", err, jsonStr);
      }
    };

    // Initial render
    setTimeout(() => buildBody(node, root), 100);
  },
});

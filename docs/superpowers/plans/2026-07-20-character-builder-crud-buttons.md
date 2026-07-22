# Character Builder CRUD Buttons and Toast System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add toast notification system, CRUD button row (Add/Refresh), and refresh functionality to the Ultimate Character Builder Pro editor sections.

**Architecture:** Extend the existing CharEditor class with toast helper functions, CRUD button row builder, and refresh data method. Add corresponding CSS styles to the injected stylesheet.

**Tech Stack:** JavaScript (ES6+), CSS custom properties, fetch API

## Global Constraints

- Must maintain backward compatibility with existing editor functionality
- Follow existing code conventions in `js/ultimate_character_builder/index.js`
- Use existing CSS variable system (`--boss-*`)
- No external dependencies

---

### Task 1: Add CSS Styles for Toast and CRUD Elements

**Files:**
- Modify: `js/ultimate_character_builder/index.js:68-269`

**Interfaces:**
- Consumes: None (standalone CSS)
- Produces: CSS classes for `.boss-char-toast`, `.boss-char-crud-row`, `.boss-char-item`, etc.

- [ ] **Step 1: Locate CSS injection block**

Find the `injectCSS` function starting at line 66. The CSS string is defined from line 68 to line 269.

- [ ] **Step 2: Add new CSS rules**

Insert the following CSS after the existing `.boss-char-output.empty` rule (line 268) but before the closing backtick (line 269):

```css
.boss-char-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--boss-bg-card);
  border: 1px solid var(--boss-border-subtle);
  border-radius: 8px;
  padding: 10px 20px;
  color: var(--boss-text);
  font-size: 13px;
  z-index: 10000;
  animation: boss-char-toast-in 0.2s ease;
  pointer-events: auto;
}
.boss-char-toast.success { border-color: var(--boss-success); }
.boss-char-toast.error { border-color: var(--boss-danger); }
.boss-char-toast.confirm {
  display: flex;
  align-items: center;
  gap: 10px;
}
.boss-char-toast .boss-art-crud-btn {
  padding: 4px 10px;
  font-size: 11px;
}
@keyframes boss-char-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.boss-char-crud-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.boss-char-crud-row .boss-art-crud-btn {
  flex: 1;
  font-size: 10px;
  padding: 4px 6px;
}
.boss-char-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.boss-char-item:hover {
  background: var(--boss-bg-hover);
}
.boss-char-item .boss-char-thumb {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.boss-char-item .boss-char-thumb-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: var(--boss-bg-hover);
  flex-shrink: 0;
}
.boss-char-item-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 2px;
}
.boss-char-item:hover .boss-char-item-actions {
  display: flex;
}
.boss-char-item-actions button {
  background: none;
  border: none;
  color: var(--boss-text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
}
.boss-char-item-actions button:hover {
  color: var(--boss-text);
  background: var(--boss-bg-hover);
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 4: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add toast and CRUD CSS styles to Character Builder"
```

---

### Task 2: Add Toast Helper Functions

**Files:**
- Modify: `js/ultimate_character_builder/index.js:412-413`

**Interfaces:**
- Consumes: None (standalone functions)
- Produces: `showToast(message, type, duration)`, `showConfirmToast(message, onYes, onNo)`

- [ ] **Step 1: Add showToast function**

Insert after `escapeHtml` function (line 411) and before `// ── On-node body` comment (line 413):

```javascript
function showToast(message, type = "info", duration = 3000) {
  const existing = document.querySelectorAll(".boss-char-toast");
  existing.forEach((e) => e.remove());
  const toast = document.createElement("div");
  toast.className = `boss-char-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showConfirmToast(message, onYes, onNo) {
  const existing = document.querySelectorAll(".boss-char-toast");
  existing.forEach((e) => e.remove());
  const toast = document.createElement("div");
  toast.className = "boss-char-toast confirm";
  const msg = document.createElement("span");
  msg.textContent = message;
  toast.appendChild(msg);
  const yesBtn = document.createElement("button");
  yesBtn.type = "button";
  yesBtn.className = "boss-art-crud-btn primary";
  yesBtn.textContent = "Yes";
  yesBtn.addEventListener("click", () => { toast.remove(); onYes?.(); });
  toast.appendChild(yesBtn);
  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "boss-art-crud-btn";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", () => { toast.remove(); onNo?.(); });
  toast.appendChild(noBtn);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add showToast and showConfirmToast helper functions"
```

---

### Task 3: Add _buildCrudRow and _refreshData Methods to CharEditor

**Files:**
- Modify: `js/ultimate_character_builder/index.js:1258-1262` (inside CharEditor class)

**Interfaces:**
- Consumes: `showToast`, `this._refreshData`, `this._rebuildList`, `this._openItemModal`
- Produces: `_buildCrudRow(type, listContainer, searchInput, categoryDropdown, strengthSlider)`, `_refreshData()`

- [ ] **Step 1: Add _buildCrudRow method**

Insert after `refreshPreview()` method (line 1261) and before `save()` method (line 1264):

```javascript
_buildCrudRow(type, listContainer, searchInput, categoryDropdown, strengthSlider) {
  const row = document.createElement("div");
  row.className = "boss-char-crud-row";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "boss-art-crud-btn primary";
  addBtn.textContent = "+ Add";
  addBtn.addEventListener("click", () => this._openItemModal(type, null));

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "boss-art-crud-btn";
  refreshBtn.textContent = "Refresh";
  refreshBtn.addEventListener("click", async () => {
    try {
      await this._refreshData();
      this._rebuildList(type, listContainer, searchInput, categoryDropdown, strengthSlider);
      showToast(`${type} library refreshed`, "success");
    } catch (e) {
      showToast("Refresh failed", "error");
    }
  });

  row.appendChild(addBtn);
  row.appendChild(refreshBtn);
  return row;
}
```

- [ ] **Step 2: Add _refreshData method**

Insert after `_buildCrudRow` method (before `save()` method):

```javascript
async _refreshData() {
  await fetch("/char_boss/refresh", { method: "POST" });
  const r = await fetch("/char_boss/data?t=" + Date.now());
  const data = await r.json();
  this.libs = data;
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 4: Commit**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add CRUD button row and refresh method to Character Builder editor"
```

---

### Task 4: Final Verification and Commit

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Clean, working code

- [ ] **Step 1: Run syntax check**

Run: `node --check js/ultimate_character_builder/index.js`
Expected: No output (clean)

- [ ] **Step 2: Commit all changes**

```bash
git add js/ultimate_character_builder/index.js
git commit -m "feat: add toast system, CRUD button row, refresh to Character Builder editor"
```
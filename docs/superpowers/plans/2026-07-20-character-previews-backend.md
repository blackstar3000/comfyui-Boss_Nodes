# Character Previews Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/char_boss/data` to return character previews from a JSON file.

**Architecture:** Add a module-level loader for `character_previews.json` and include its contents in the existing `/char_boss/data` API response, with refresh support.

**Tech Stack:** Python, aiohttp (web routes), json, os

## Global Constraints
- None specified

---

### Task 1: Create empty character_previews.json

**Files:**
- Create: `py/character_previews.json`

**Interfaces:**
- Consumes: None
- Produces: Empty JSON object `{}`

- [ ] **Step 1: Create the file**

Create `py/character_previews.json` with contents:
```json
{}
```

- [ ] **Step 2: Commit**

```bash
git add py/character_previews.json
git commit -m "feat: create empty character_previews.json"
```

---

### Task 2: Add loader for character previews

**Files:**
- Modify: `py/ultimate_character_builder.py:57-64` (after `_EXPRESSIONS` definition)

**Interfaces:**
- Consumes: `py/character_previews.json`
- Produces: `_CHAR_PREVIEWS` global dict, `_load_char_previews()` function

- [ ] **Step 1: Add loader code**

After the existing Collection globals (`_CHARACTERS`, `_EXPRESSIONS`, `_POSES`) near the top of the file, add:

```python
_CHAR_PREVIEWS = {}
def _load_char_previews():
    global _CHAR_PREVIEWS
    p = os.path.join(os.path.dirname(__file__), "character_previews.json")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            _CHAR_PREVIEWS = json.load(f)
    else:
        _CHAR_PREVIEWS = {}

_load_char_previews()
```

- [ ] **Step 2: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: add character previews loader"
```

---

### Task 3: Add character_previews to /char_boss/data response

**Files:**
- Modify: `py/ultimate_character_builder.py:261-289` (the `@routes.get("/char_boss/data")` handler)

**Interfaces:**
- Consumes: `_CHAR_PREVIEWS` global dict
- Produces: Extended API response with `character_previews` key

- [ ] **Step 1: Add key to response dict**

Inside the `@routes.get("/char_boss/data")` handler, add `"character_previews": _CHAR_PREVIEWS` to the response dict returned by `web.json_response(...)`.

- [ ] **Step 2: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: return character_previews in /char_boss/data"
```

---

### Task 4: Add refresh support for character previews

**Files:**
- Modify: `py/ultimate_character_builder.py:294-304` (the `@routes.post("/char_boss/refresh")` handler)

**Interfaces:**
- Consumes: `_load_char_previews()` function
- Produces: Refresh endpoint also reloads character previews

- [ ] **Step 1: Add reload call**

Inside the `@routes.post("/char_boss/refresh")` handler, add `_load_char_previews()` call after the existing Collection reloads (`_load_all(force=True)`).

- [ ] **Step 2: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: reload character_previews on refresh"
```

---

### Task 5: Final verification and commit

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: None
- Produces: All changes committed

- [ ] **Step 1: Verify all files exist**

Run: `ls py/character_previews.json py/ultimate_character_builder.py`
Expected: Both files exist

- [ ] **Step 2: Verify Python syntax for entire module**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 3: Final commit of all changes**

```bash
git add py/ultimate_character_builder.py py/character_previews.json
git commit -m "feat: extend /char_boss/data to return character_previews"
```

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-20-character-previews-backend.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
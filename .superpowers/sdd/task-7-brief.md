# Task 7: JS — CollectionEditorDialog

**Files:**
- Modify: `js/boss_theme/index.js` (add after CollectionCRUDWidget, update export)

**Interfaces:**
- Consumes: CollectionModel, escapeHtml from Task 5 (for validation)
- Produces: `CollectionEditorDialog` class exported from boss_theme

**IMPORTANT**: Read the current state of `js/boss_theme/index.js` first. Tasks 5-6 added CollectionModel, CollectionController, and CollectionCRUDWidget. Add CollectionEditorDialog after CollectionCRUDWidget.

**Implementation source**: Read the full code from the plan at `docs/superpowers/plans/2026-07-22-camera-style-mixer-crud.md` lines 919-1099. Copy the CollectionEditorDialog class exactly.

- [ ] **Step 1: Add CollectionEditorDialog class** — Copy from plan lines 919-1099
- [ ] **Step 2: Update export** — Add CollectionEditorDialog to the export line
- [ ] **Step 3: Verify JS syntax** — `node --check js/boss_theme/index.js`
- [ ] **Step 4: Commit** — `git commit -m "feat(theme): add CollectionEditorDialog with validation and keyboard shortcuts"`

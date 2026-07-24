# Task 8: JS — Integrate CRUD into CameraEditor

**Files:**
- Modify: `js/camera_style_mixer/index.js` (major changes to CameraEditor class)

**Interfaces:**
- Consumes: CollectionCRUDWidget, CollectionEditorDialog, CollectionController, CollectionModel from Tasks 5-7
- Produces: CameraEditor with CRUD rows for all 3 collections

**IMPORTANT**: Read the current state of `js/camera_style_mixer/index.js` first. Read the plan for exact code: `docs/superpowers/plans/2026-07-22-camera-style-mixer-crud.md` lines 1125-1435.

**Steps** (follow plan for exact code):

1. **Update imports** — Add CollectionCRUDWidget, CollectionEditorDialog, CollectionController, CollectionModel to import
2. **Add controller** — `this.controller = new CollectionController("/camera_boss")` in constructor
3. **Update fetchData** — Use CollectionModel.normalize, build slug maps
4. **Update refreshList** — Use slug-based selection, add edit/delete icons per row
5. **Add CRUD methods** — _addEntry, _editEntry, _deleteEntry, _showConfirm, _toggleFavorite
6. **Add "Add" buttons** — After each buildListSection call in buildModal
7. **Verify JS syntax** — `node --check js/camera_style_mixer/index.js`
8. **Commit** — `git commit -m "feat(camera): integrate CRUD into CameraEditor with add/edit/delete"`

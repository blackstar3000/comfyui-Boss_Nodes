# Task 2: Python — Update `_load_library()` normalization

**Files:**
- Modify: `py/camera_style_mixer.py:134-170` (inside `_load_library()`)

**Interfaces:**
- Consumes: `_to_slug()` from Task 1
- Produces: updated `_LIB` with normalized object values + slug maps

- [ ] **Step 1: Update raw data loading to normalize strings→objects**

Replace lines 134-149 (the raw_angles/raw_framings/raw_styles block) with:

```python
    raw_angles = data.get("camera_angles", {})
    raw_framings = data.get("camera_framings", {})
    raw_styles = data.get("art_styles", {})
    if not isinstance(raw_angles, dict):
        _log("'camera_angles' must be a dict — skipped.")
        raw_angles = {}
    if not isinstance(raw_framings, dict):
        _log("'camera_framings' must be a dict — skipped.")
        raw_framings = {}
    if not isinstance(raw_styles, dict):
        _log("'art_styles' must be a dict — skipped.")
        raw_styles = {}

    def _normalize_entries(raw: dict) -> dict[str, dict]:
        """Convert legacy string values to objects, keep objects as-is."""
        out = {}
        for key, value in raw.items():
            if isinstance(value, str):
                out[key] = {
                    "name": key,
                    "prompt": value,
                    "description": "",
                    "favorite": False,
                    "preview": "",
                }
            elif isinstance(value, dict):
                value.setdefault("name", key)
                value.setdefault("prompt", "")
                value.setdefault("description", "")
                value.setdefault("favorite", False)
                value.setdefault("preview", "")
                out[key] = value
        return out

    angles = _normalize_entries(raw_angles)
    framings = _normalize_entries(raw_framings)
    styles = _normalize_entries(raw_styles)
```

- [ ] **Step 2: Update the rest of _load_library to use normalized data**

Replace lines 164-176 (the `_LIB.` assignments + log) with:

```python
    _LIB.angles = angles
    _LIB.framings = framings
    _LIB.styles = styles
    _LIB.cat_angle = sanitize_categories(raw_cat_angle, set(angles.keys()))
    _LIB.cat_framing = sanitize_categories(raw_cat_framing, set(framings.keys()))
    _LIB.cat_style = sanitize_categories(raw_cat_style, set(styles.keys()))
    _LIB.mtime = mtime

    _log(
        f"Loaded: {len(angles)} angles, {len(framings)} framings, {len(styles)} styles, "
        f"{len(_LIB.cat_angle)} angle-cats, {len(_LIB.cat_framing)} framing-cats, {len(_LIB.cat_style)} style-cats"
    )
    return _LIB
```

- [ ] **Step 3: Verify Python compiles**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile(r'F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\camera_style_mixer.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add py/camera_style_mixer.py
git commit -m "feat(camera): normalize legacy string values to objects in _load_library"
```

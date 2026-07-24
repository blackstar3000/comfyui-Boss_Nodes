# Task 1: Python — `_save_json()` + slug helpers

**Files:**
- Modify: `py/camera_style_mixer.py:26-28` (add imports)
- Modify: `py/camera_style_mixer.py` (add helpers after `_log` declaration)

**Interfaces:**
- Consumes: nothing (new utility functions)
- Produces: `_save_json(path, data)`, `_to_slug(name)`, `_unique_slug(slug, existing)`

- [ ] **Step 1: Add `re` import**

```python
import re
```

Add after existing `import json` at line 15.

- [ ] **Step 2: Add `_to_slug()` helper**

Add after `_log = make_logger("CameraStyleMixer")` (line 77):

```python
def _to_slug(name: str) -> str:
    """Lowercase, spaces→underscores, strip non-alphanumeric."""
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "entry"


def _unique_slug(slug: str, existing: set[str]) -> str:
    """Append _2, _3, ... until unique."""
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}_{n}" in existing:
        n += 1
    return f"{slug}_{n}"
```

- [ ] **Step 3: Add `_save_json()` helper**

Add after the slug helpers:

```python
def _save_json(path: Path, data: dict) -> None:
    """Atomic write: write to .tmp then os.replace."""
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)
```

- [ ] **Step 4: Verify Python compiles**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile(r'F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\camera_style_mixer.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add py/camera_style_mixer.py
git commit -m "feat(camera): add _save_json, _to_slug, _unique_slug helpers"
```

# Task 3: Python — `/camera_boss/save` and `/camera_boss/delete` endpoints

**Files:**
- Modify: `py/camera_style_mixer.py` (the `register_api_routes()` function)

**Interfaces:**
- Consumes: `_save_json()`, `_to_slug()`, `_unique_slug()` from Task 1, `_LIB` from Task 2
- Produces: two new HTTP endpoints

**IMPORTANT**: Read the current state of `py/camera_style_mixer.py` first — Tasks 1 and 2 may have changed line numbers. Match by content, not line numbers.

- [ ] **Step 1: Add the type→collection mapping and entry keys**

Add before `register_api_routes()`:

```python
# Mapping from API type name to (data_key, category_key, library_attr)
_COLLECTION_MAP = {
    "angles":  ("camera_angles",  "angle_categories",  "angles"),
    "framings": ("camera_framings", "framing_categories", "framings"),
    "styles":  ("art_styles",     "style_categories",  "styles"),
}
```

- [ ] **Step 2: Add `/camera_boss/save` endpoint**

Inside `register_api_routes()`, after the existing `/camera_boss/refresh` route, add:

```python
    @routes.post("/camera_boss/save")
    async def save_camera_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            slug = body.get("slug", "").strip()
            name = body.get("name", "").strip()
            prompt = body.get("prompt", "").strip()
            description = body.get("description", "").strip()
            favorite = bool(body.get("favorite", False))
            categories = body.get("categories", [])

            if lib_type not in _COLLECTION_MAP:
                return web.json_response({"error": "Invalid type"}, status=400)
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            if not prompt:
                return web.json_response({"error": "Prompt required"}, status=400)

            data_key, cat_key, lib_attr = _COLLECTION_MAP[lib_type]
            lib = _load_library()
            collection = getattr(lib, lib_attr)

            if not isinstance(categories, list):
                categories = []

            # Generate or validate slug
            if slug and slug in collection:
                # Updating existing entry
                is_new = False
            else:
                # New entry — generate unique slug
                slug = _unique_slug(_to_slug(name), set(collection.keys()))
                is_new = True

            entry = {
                "name": name,
                "prompt": prompt,
                "description": description,
                "favorite": favorite,
                "preview": collection.get(slug, {}).get("preview", "") if isinstance(collection.get(slug), dict) else "",
            }
            collection[slug] = entry

            # Update categories
            cat_dict = getattr(lib, f"cat_{lib_attr.split('s')[0] if lib_attr.endswith('s') else lib_attr}")
            # Ensure all requested categories exist
            for cat in categories:
                if cat and cat != ALL_CATEGORIES and cat not in cat_dict:
                    cat_dict[cat] = []
            # Update membership
            for cat, members in cat_dict.items():
                if cat == ALL_CATEGORIES:
                    continue
                if slug in members and cat not in categories:
                    members.remove(slug)
                elif slug not in members and cat in categories:
                    members.append(slug)

            # Save to disk
            try:
                with JSON_FILE.open("r", encoding="utf-8") as f:
                    disk_data = json.load(f)
            except (json.JSONDecodeError, OSError):
                disk_data = {}

            disk_data[data_key] = {k: v if isinstance(v, dict) else v for k, v in collection.items()}
            disk_data[cat_key] = cat_dict
            _save_json(JSON_FILE, disk_data)

            # Bust mtime cache
            _LIB.mtime = None

            return web.json_response({
                "slug": slug,
                "name": name,
                "is_new": is_new,
                "count": len(collection),
            })
        except Exception as e:
            _log(f"/camera_boss/save failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)
```

- [ ] **Step 3: Add `/camera_boss/delete` endpoint**

After the save route, add:

```python
    @routes.post("/camera_boss/delete")
    async def delete_camera_entry(request):
        try:
            body = await request.json()
            lib_type = body.get("type", "")
            slug = body.get("slug", "").strip()

            if lib_type not in _COLLECTION_MAP:
                return web.json_response({"error": "Invalid type"}, status=400)
            if not slug:
                return web.json_response({"error": "Slug required"}, status=400)

            data_key, cat_key, lib_attr = _COLLECTION_MAP[lib_type]
            lib = _load_library()
            collection = getattr(lib, lib_attr)

            if slug not in collection:
                return web.json_response({"error": "Not found"}, status=404)

            del collection[slug]

            # Remove from all categories
            cat_dict = getattr(lib, f"cat_{lib_attr.split('s')[0] if lib_attr.endswith('s') else lib_attr}")
            for members in cat_dict.values():
                if isinstance(members, list) and slug in members:
                    members.remove(slug)

            # Save to disk
            try:
                with JSON_FILE.open("r", encoding="utf-8") as f:
                    disk_data = json.load(f)
            except (json.JSONDecodeError, OSError):
                disk_data = {}

            disk_data[data_key] = dict(collection)
            disk_data[cat_key] = cat_dict
            _save_json(JSON_FILE, disk_data)

            # Bust mtime cache
            _LIB.mtime = None

            return web.json_response({"count": len(collection)})
        except Exception as e:
            _log(f"/camera_boss/delete failed: {e}")
            return web.json_response({"error": "Internal server error"}, status=500)
```

- [ ] **Step 4: Verify Python compiles**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile(r'F:\ComfyUI\ComfyUI\custom_nodes\comfyui-Boss_Nodes\py\camera_style_mixer.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add py/camera_style_mixer.py
git commit -m "feat(camera): add /camera_boss/save and /camera_boss/delete endpoints"
```

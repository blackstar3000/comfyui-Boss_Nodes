# Task 1: Backend — Add `/char_boss/save` Endpoint

**Files:**
- Modify: `py/ultimate_character_builder.py`

**Interfaces:**
- Consumes: `_CHARACTERS`, `_EXPRESSIONS`, `_POSES` Collection objects (already defined)
- Produces: `POST /char_boss/save` route returning `{ name, prompt, categories, custom_preview, is_new }`

- [ ] **Step 1: Read the current file to understand structure**

Read `py/ultimate_character_builder.py` to find where routes are defined and where the Collection objects are initialized. Note the `_CHARACTERS`, `_EXPRESSIONS`, `_POSES` globals and the existing `@routes.get("/char_boss/data")` and `@routes.post("/char_boss/refresh")` endpoints.

- [ ] **Step 2: Add the save endpoint after the refresh endpoint**

Find the `@routes.post("/char_boss/refresh")` handler. Add the following route immediately after it:

```python
@routes.post("/char_boss/save")
async def save_char_entry(request):
    try:
        body = await request.json()
        lib_type = body.get("type", "")
        name = body.get("name", "").strip()
        prompt = body.get("prompt", "").strip()
        categories = body.get("categories", [])
        custom_preview = body.get("custom_preview", "").strip()

        if lib_type not in ("characters", "expressions", "poses"):
            return web.json_response({"error": "Invalid type"}, status=400)
        if not name:
            return web.json_response({"error": "Name required"}, status=400)
        if not prompt:
            return web.json_response({"error": "Prompt required"}, status=400)

        coll_map = {
            "characters": _CHARACTERS,
            "expressions": _EXPRESSIONS,
            "poses": _POSES,
        }
        coll = coll_map[lib_type]

        existing = coll.items.get(name)
        is_new = existing is None

        if is_new:
            entry = {"prompt": prompt, "custom_preview": custom_preview}
        else:
            old_preview = ""
            if isinstance(existing, dict):
                old_preview = existing.get("custom_preview", "")
            entry = {
                "prompt": prompt,
                "custom_preview": custom_preview or old_preview,
            }

        coll.items[name] = entry

        if categories:
            for cat, members in coll.categories.items():
                if cat == "All":
                    continue
                if name not in members:
                    members.append(name)

        coll.save()

        return web.json_response({
            "name": name,
            "prompt": prompt,
            "categories": categories,
            "custom_preview": entry.get("custom_preview", ""),
            "is_new": is_new,
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
```

- [ ] **Step 3: Verify syntax**

Run: `F:\ComfyUI\python_embeded\python.exe -c "import py_compile; py_compile.compile('py/ultimate_character_builder.py', doraise=True)"`
Expected: No output (clean compile)

- [ ] **Step 4: Commit**

```bash
git add py/ultimate_character_builder.py
git commit -m "feat: add POST /char_boss/save endpoint for CRUD"
```

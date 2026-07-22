# Task 6: Integration testing

**Files:** Manual testing of all features

## Steps

- [ ] **Step 1: Syntax check all modified files**

Run Python syntax check:
```bash
python -c "import py_compile; py_compile.compile('py/artist_selector.py', doraise=True)"
```

Run JS syntax check (if node available):
```bash
node -c js/artist_selector/index.js
```

- [ ] **Step 2: Verify data files exist and are valid JSON**

Check that these files exist and are valid JSON:
- `py/artists.json` — should have object format entries
- `py/artist_previews.json` — should have artist -> URL mapping
- `py/artist_categories.json` — should have categories and artist_categories

- [ ] **Step 3: Verify backward compatibility**

Test that the Python code handles both formats:
```python
import sys; sys.path.insert(0, 'py')
from artist_selector import _get_artist_prompt, _get_artist_post_count, _get_artist_categories

# Test string format
assert _get_artist_prompt("by wlop") == "by wlop"
assert _get_artist_post_count("by wlop") == 0
assert _get_artist_categories("by wlop") == []

# Test dict format
entry = {"prompt": "by wlop", "post_count": 398, "categories": ["realistic"]}
assert _get_artist_prompt(entry) == "by wlop"
assert _get_artist_post_count(entry) == 398
assert _get_artist_categories(entry) == ["realistic"]

print("All backward compatibility tests passed!")
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete artist selector enrichment with previews, categories, and popularity"
```

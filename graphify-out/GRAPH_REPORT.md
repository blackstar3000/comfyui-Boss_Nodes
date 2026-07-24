# Graph Report - comfyui-Boss_Nodes  (2026-07-22)

## Corpus Check
- 116 files · ~1,031,581 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1413 nodes · 2582 edges · 79 communities (58 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2289f9cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ultimate_character_builder/index.js
- prompt_master_library_pro/index.js
- artist_selector/index.js
- DanbooruEditor
- scene_maker_pro/index.js
- prompt_lens_library/index.js
- promptunstuck_pro/index.js
- ultimate_ksampler/index.js
- outfit_selector/index.js
- LoaderEditor
- promptunstuck_pro.py
- camera_style_mixer/index.js
- prompt_master_library_pro.py
- SnapshotterEditor
- prompt_booster_pro/index.js
- prompt_booster_pro.py
- batch_save/index.js
- Artist Selector Editor Enrichment Design
- ultimate_character_builder.py
- danbooru_validator/index.js
- smart_text_clip/index.js
- prompt_lens_library.py
- camera_style_mixer.py
- Character Builder CRUD + Preview Images — Design Spec
- artist_selector.py
- BossDropdown
- ultimate_loader.py
- danbooru_validator.py
- batch_save_auto_naming.py
- fetch_artist_previews.py
- fetch_character_previews.py
- metadata_extractor.py
- scene_maker_pro.py
- Artist Selector Enrichment Implementation Plan
- File Map
- Components
- load_json
- Collection
- make_categories.py
- metadata_extractor/index.js
- fetch_artist_post_counts.py
- WorkflowSnapshotter
- _get_database
- fetch_danbooru_tags.py
- ultimate_k_sampler_pro.py
- Steps Executed
- Global Constraints
- BillionsPromptGenerator
- _build_database
- NegativeBoosterPRO
- PromptBuilderCoreWildcards
- QualityBoosterPRO
- TextConcatenatePro
- Global Constraints
- SizePresetLoader
- TagSearcher
- Task 1 Report: Backend — Add `/char_boss/save` Endpoint
- SmartTextClipEncode
- TextConcatenate
- Task 3 Report — Backend: Add `/char_boss/proxy_image` Endpoint
- Task 5 Report: Frontend Enrichment
- CLIPDualTextEncode
- curate_categories.py
- Task 4 Report: Backend enrichment of artist_selector.py
- __init__.py
- generate_danbooru_tags.py
- Task 4: Backend enrichment (`artist_selector.py`)
- Task 5: Frontend enrichment (JS)
- Artist Selector Enrichment - Progress Ledger
- Task 2: Create Danbooru post count fetcher (`fetch_artist_post_counts.py`)
- Task 3: Create category curator (`curate_categories.py`)
- Task 6: Integration testing
- file_utils.py
- utils/__init__.py
- ui_utils.py
- validation.py
- README.md
- task-1-brief.md
- task-2-report.md

## God Nodes (most connected - your core abstractions)
1. `BossDropdown` - 31 edges
2. `ArtistEditor` - 30 edges
3. `CharEditor` - 25 edges
4. `MasterEditor` - 23 edges
5. `LoaderEditor` - 23 edges
6. `DanbooruEditor` - 21 edges
7. `LensEditor` - 20 edges
8. `SceneEditor` - 20 edges
9. `SnapshotterEditor` - 20 edges
10. `OutfitEditor` - 19 edges

## Surprising Connections (you probably didn't know these)
- `_Collection` --uses--> `Collection`  [INFERRED]
  py/prompt_booster_pro.py → py/utils/cache_utils.py
- `PromptBoosterPRO` --uses--> `Collection`  [INFERRED]
  py/prompt_booster_pro.py → py/utils/cache_utils.py
- `resolve_wildcards()` --indirect_call--> `_pick()`  [INFERRED]
  py/scene_maker_pro.py → py/promptunstuck_pro.py
- `resolve_wildcards()` --indirect_call--> `_pick()`  [INFERRED]
  py/ultimate_character_builder.py → py/promptunstuck_pro.py
- `SceneMakerGOD` --uses--> `Collection`  [INFERRED]
  py/scene_maker_pro.py → py/utils/cache_utils.py

## Import Cycles
- None detected.

## Communities (79 total, 21 thin omitted)

### Community 0 - "ultimate_character_builder/index.js"
Cohesion: 0.07
Nodes (33): BOSS, escapeHtml(), applyWeightJS(), beforeRegisterNodeDef(), buildCard(), buildPreviewHTML(), CharEditor, clampSeed() (+25 more)

### Community 1 - "prompt_master_library_pro/index.js"
Cohesion: 0.07
Nodes (36): applyWeightJS(), autoNegativeJS(), beforeRegisterNodeDef(), buildCard(), buildNegativeText(), buildPreviewHTML(), clampSeed(), clampStrength() (+28 more)

### Community 2 - "artist_selector/index.js"
Cohesion: 0.09
Nodes (25): ALPHA_RANGES, ArtistEditor, beforeRegisterNodeDef(), clampMaxArtists(), defaultStateFromWidgets(), escapeHtml(), getToastContainer(), hideCanvasWidget() (+17 more)

### Community 3 - "DanbooruEditor"
Cohesion: 0.09
Nodes (17): beforeRegisterNodeDef(), BossDropdown, DanbooruEditor, defaultStateFromWidgets(), escapeHtml(), hideCanvasWidget(), nodeCreated(), _origGraphToPrompt (+9 more)

### Community 4 - "scene_maker_pro/index.js"
Cohesion: 0.09
Nodes (29): applyWeightJS(), beforeRegisterNodeDef(), buildCard(), buildPreviewHTML(), clampSeed(), clampStrength(), COLLECTION_ACCENTS, COLLECTION_LABELS (+21 more)

### Community 5 - "prompt_lens_library/index.js"
Cohesion: 0.10
Nodes (25): beforeRegisterNodeDef(), buildPreviewHTML(), buildPrompt(), clampSeed(), defaultState(), escapeHtml(), focalApertureTag(), hideCanvasWidget() (+17 more)

### Community 6 - "promptunstuck_pro/index.js"
Cohesion: 0.10
Nodes (27): assemblePreview(), beforeRegisterNodeDef(), buildPreviewHTML(), clampIntensity(), clampSeed(), defaultFlags(), defaultState(), enabledFragmentCount() (+19 more)

### Community 7 - "ultimate_ksampler/index.js"
Cohesion: 0.11
Nodes (23): beforeRegisterNodeDef(), buildPreviewHTML(), BUILTIN_PRESETS, CFG_PRESETS, clamp(), defaultStateFromWidgets(), escapeHtml(), hideCanvasWidget() (+15 more)

### Community 8 - "outfit_selector/index.js"
Cohesion: 0.11
Nodes (20): beforeRegisterNodeDef(), buildPreviewHTML(), clampSeed(), clampStrength(), debounce(), defaultState(), escapeHtml(), hideCanvasWidget() (+12 more)

### Community 9 - "LoaderEditor"
Cohesion: 0.11
Nodes (18): beforeRegisterNodeDef(), buildPreviewHTML(), clamp(), defaultStateFromWidgets(), escapeHtml(), hideCanvasWidget(), LoaderEditor, nodeCreated() (+10 more)

### Community 10 - "promptunstuck_pro.py"
Cohesion: 0.07
Nodes (29): BossOutfitSelector, _category_pool(), _load_library(), Outfit Selector Boss — pick an outfit from the WAI library, with category filte, Resolve {a|b|c} alternation groups in `text` using a seeded RNG so the     same, Read outfits.json. Returns (outfits: dict, categories: dict).      outfits:, Write outfits and categories back to outfits.json and bust the cache., Return the list of outfit names in `category`. Falls back to all     outfits wh (+21 more)

### Community 11 - "camera_style_mixer/index.js"
Cohesion: 0.11
Nodes (20): applyWeight(), beforeRegisterNodeDef(), buildPreviewHTML(), CameraEditor, clampSeed(), clampStrength(), defaultState(), escapeHtml() (+12 more)

### Community 12 - "prompt_master_library_pro.py"
Cohesion: 0.09
Nodes (30): _add_favorite(), _delete_favorite(), _fallback(), _generate_auto_negative(), _is_junk_favorite_name(), _library_payload(), _LibraryState, _load_all() (+22 more)

### Community 13 - "SnapshotterEditor"
Cohesion: 0.13
Nodes (16): beforeRegisterNodeDef(), defaultStateFromWidgets(), escapeHtml(), hideCanvasWidget(), nodeCreated(), _origGraphToPrompt, readState(), renderHeader() (+8 more)

### Community 14 - "prompt_booster_pro/index.js"
Cohesion: 0.12
Nodes (16): applyWeight(), beforeRegisterNodeDef(), BoosterEditor, buildPreviewHTML(), clampStrength(), defaultState(), escapeHtml(), hideCanvasWidget() (+8 more)

### Community 15 - "prompt_booster_pro.py"
Cohesion: 0.08
Nodes (21): _Collection, _data_payload(), _load_all(), PromptBoosterPRO, Prompt Booster PRO Boss — merge of `prompt_quality_booster.py` (positive quality, Normalize the negative library to `{preset: {level: text}}`. Accept     list-of-, Positive: custom override wins, else look up the level., Negative: preset/level lookup, then append custom if non-empty. (+13 more)

### Community 16 - "batch_save/index.js"
Cohesion: 0.14
Nodes (17): BatchSaveEditor, beforeRegisterNodeDef(), buildPreviewHTML(), defaultStateFromWidgets(), escapeHtml(), hideCanvasWidget(), nodeCreated(), _origGraphToPrompt (+9 more)

### Community 17 - "Artist Selector Editor Enrichment Design"
Cohesion: 0.07
Nodes (29): 10. Success Criteria, 1. Problem, 2. Goals, 3.1 Preview Images (nax.moe), 3.2 Post Counts (Danbooru API), 3.3 Style Categories (manual curation), 3. Data Sources, 4.1 `py/artists.json` (enriched format) (+21 more)

### Community 18 - "ultimate_character_builder.py"
Cohesion: 0.11
Nodes (18): _collection_payload(), _is_safe_proxy_url(), _load_all(), Random, Ultimate Character Builder Pro Boss — pick a character + expression + pose from, Resolve {a|b|c} alternation groups in `text` using the given rng.     Handles ne, Resolve a dropdown choice to (key, prompt_text). Handles Random,     None, and e, Flatten + sort so the editor can render one big searchable list. (+10 more)

### Community 19 - "danbooru_validator/index.js"
Cohesion: 0.18
Nodes (13): beforeRegisterNodeDef(), DanbooruEditor, defaultState(), hideCanvasWidget(), nodeCreated(), parseTags(), readState(), renderHeader() (+5 more)

### Community 20 - "smart_text_clip/index.js"
Cohesion: 0.16
Nodes (16): beforeRegisterNodeDef(), defaultStateFromWidgets(), escapeHtml(), hideCanvasWidget(), nodeCreated(), _origGraphToPrompt, readState(), renderHeader() (+8 more)

### Community 21 - "prompt_lens_library.py"
Cohesion: 0.14
Nodes (18): _all_lenses(), _all_models(), _build_prompt(), _data_payload(), _focal_aperture_tag(), _LensLibrary, _load_library(), _output_style() (+10 more)

### Community 22 - "camera_style_mixer.py"
Cohesion: 0.12
Nodes (16): CameraStyleMixer, _LibraryState, _load_library(), Random, Camera Style Mixer Boss — pick a camera angle, framing, and art style, with cate, Hot-reload the JSON file. Returns the populated `_LibraryState`.      Reads from, Resolve a dropdown choice to (key, prompt_text). Handles the random     sentinel, Loaded data shared across all node instances. Mirrors the v3.0 cache. (+8 more)

### Community 23 - "Character Builder CRUD + Preview Images — Design Spec"
Cohesion: 0.09
Nodes (21): 1. Overview, 2.1 New Endpoints, 2.2 Save Endpoint — `POST /char_boss/save`, 2.3 Delete Endpoint — `POST /char_boss/delete`, 2.4 Proxy Endpoint — `GET /char_boss/proxy_image`, 2.5 Refresh Endpoint — `POST /char_boss/refresh`, 2.6 Data Endpoint — `GET /char_boss/data`, 2. Backend Changes (+13 more)

### Community 24 - "artist_selector.py"
Cohesion: 0.12
Nodes (17): BossArtistSelector, _coerce_int(), _fetch_danbooru_post_count(), _format_output(), _get_artist_categories(), _get_artist_prompt(), _is_safe_proxy_url(), Artist Selector Boss — searchable artist selection with favorites + history. (+9 more)

### Community 26 - "ultimate_loader.py"
Cohesion: 0.15
Nodes (12): _compute_file_sha256(), _extract_recommended_params(), _fetch_civitai_by_hash(), _load_civitai_cache(), _load_json(), Extract recommended generation params from Civitai model version images., Ultimate Loader Pro — All‑in‑one checkpoint loader with favorites, aspect‑ratio, Compute SHA256 hash of a file. Streams in chunks to handle large files. (+4 more)

### Community 27 - "danbooru_validator.py"
Cohesion: 0.17
Nodes (12): clean_prompt(), DanbooruTagValidator, _load_db(), parse_tags(), Danbooru Tag Validator Boss — validate prompts against the Danbooru tag database, Find similar tags for a misspelled/invalid tag., Validate a prompt string against the Danbooru tag database.      Returns:, Remove invalid tags from a prompt string, preserving formatting. (+4 more)

### Community 28 - "batch_save_auto_naming.py"
Cohesion: 0.23
Nodes (8): _atomic_write_json(), BatchSaveAutoNaming, _load_counter(), Write JSON atomically: write to a temp file, then rename over the     target. I, _sanitize_filename(), _sanitize_folder(), _save_counter(), _save_history()

### Community 29 - "fetch_artist_previews.py"
Cohesion: 0.19
Nodes (14): fetch_page(), load_cache(), load_existing(), main(), parse_page(), Fetch artist preview images from nax.moe for the Artist Selector Editor.  Usage:, Save artist previews to file., Fetch a single gallery page from nax.moe. (+6 more)

### Community 30 - "fetch_character_previews.py"
Cohesion: 0.19
Nodes (14): fetch_page(), load_cache(), load_existing(), main(), parse_page(), Fetch character preview images from nax.moe for the Character Selector Editor., Save character previews to file., Fetch a single gallery page from nax.moe. (+6 more)

### Community 31 - "metadata_extractor.py"
Cohesion: 0.23
Nodes (9): _blank_result(), extract_metadata(), MetadataExtractor, _parse_a1111_parameters(), _parse_comfy_prompt_graph(), Best-effort extraction from a ComfyUI API-format prompt graph.     Graph shapes, Reverse-Prompt / Metadata Extractor Pro — reads embedded generation     metadata, _to_float() (+1 more)

### Community 32 - "scene_maker_pro.py"
Cohesion: 0.21
Nodes (10): _load_all(), Random, Scene Maker Pro Boss — pick a girl + a male + a scene from three sibling JSON l, Resolve a dropdown choice to (key, prompt_text). Handles Random,     None, and, Replace {girl}/{girls}/{male}/{males} in the scene text. If a token     is abse, Resolve {a|b|c} alternation groups in `text` using the given rng.     Handles n, _resolve(), resolve_wildcards() (+2 more)

### Community 33 - "Artist Selector Enrichment Implementation Plan"
Cohesion: 0.14
Nodes (13): Artist Selector Enrichment Implementation Plan, Global Constraints, Phase 1: Data Collection Scripts, Phase 2: Backend Enrichment, Phase 3: Frontend Enrichment, Phase 4: Integration Testing, Summary, Task 1: Create nax.moe scraper (`fetch_artist_previews.py`) (+5 more)

### Community 34 - "File Map"
Cohesion: 0.14
Nodes (13): Character Builder CRUD + Preview Images — Implementation Plan, File Map, Global Constraints, Task 10: Final Integration Test and Cleanup, Task 1: Backend — Add `/char_boss/save` Endpoint, Task 2: Backend — Add `/char_boss/delete` Endpoint, Task 3: Backend — Add `/char_boss/proxy_image` Endpoint, Task 4: Backend — Extend `/char_boss/data` to Return Character Previews (+5 more)

### Community 35 - "Components"
Cohesion: 0.15
Nodes (12): 1. Alphabetical Range Tabs, 2. CRUD Sidebar Section, 3. Add/Edit Sub-Modal, 4. Python Endpoint — `POST /wai_artist/save`, 5. Delete Confirmation, 6. Toast Notifications, Artist Selector CRUD + Sort Navigation, Components (+4 more)

### Community 36 - "load_json"
Cohesion: 0.21
Nodes (11): register_api_routes(), _load_history(), invalidate_database_cache(), _load_favorites(), Force the next get_database() call to rescan disk (picks up new/edited tag files, _save_favorites(), load_json(), Path (+3 more)

### Community 37 - "Collection"
Cohesion: 0.17
Nodes (8): Collection, Path, Write the current items + categories back to disk and bust mtime cache., Base class for a JSON library collection with hot-reload support.      Attribute, Return the full path to the JSON file., Return True if the collection has no items., Process loaded JSON data. Returns True on success.          Override this method, Hot-reload the collection's JSON file.          Reads from disk only when the fi

### Community 38 - "make_categories.py"
Cohesion: 0.29
Nodes (11): ask_tags(), create_category_dirs(), create_root_folder(), generate_main_files(), generate_sub_files(), main(), Create <category>/main/ and <category>/sub/ and return their paths., Convert 'a|b|c' input into one-tag-per-line file content. (+3 more)

### Community 39 - "metadata_extractor/index.js"
Cohesion: 0.33
Nodes (8): buildField(), copyToClipboard(), escapeHtml(), injectCSS(), nodeCreated(), openModal(), renderPanel(), setupMetadataExtractorNode()

### Community 40 - "fetch_artist_post_counts.py"
Cohesion: 0.25
Nodes (10): enrich_artists(), fetch_tags_by_names(), load_artists(), main(), Fetch Danbooru post counts for all artists and enrich artists.json.  Usage:, Load artists.json and return the artists dict., Save the full artists.json structure., Fetch tags for a batch of artist names using search[name_normalize]. (+2 more)

### Community 41 - "WorkflowSnapshotter"
Cohesion: 0.18
Nodes (6): _load_snapshots(), Workflow Snapshotter Pro — Save and restore complete workflow snapshots directly, Load all snapshots from the JSON file., Save the snapshots dictionary to disk (with backup, atomically)., _save_snapshots(), WorkflowSnapshotter

### Community 42 - "_get_database"
Cohesion: 0.20
Nodes (10): _get_artist_categories_file(), _get_artist_post_count(), _get_database(), _get_previews(), Load and cache artist_categories.json. Returns (categories_list, artist_categori, Load and cache the artist database. Returns 7-tuple:     (library, favorites, h, Update cache + persist. Used by the /wai_artist/toggle_favorite route., Return post count from a dict artist entry (0 for strings). (+2 more)

### Community 43 - "fetch_danbooru_tags.py"
Cohesion: 0.31
Nodes (9): fetch_all_tags(), fetch_page(), load_existing(), main(), Fetch Danbooru tag database for the Danbooru Tag Validator node.  Usage:     pyt, Fetch a single page of tags, sorted by post count descending., Load existing tags from file if it exists., Fetch tags sorted by popularity (most posts first). (+1 more)

### Community 44 - "ultimate_k_sampler_pro.py"
Cohesion: 0.31
Nodes (5): _get_preset(), _load_favorites(), Ultimate KSampler Pro — Advanced sampling node with presets, favorites, and hidd, _save_favorites(), UltimateKSamplerPro

### Community 45 - "Steps Executed"
Cohesion: 0.20
Nodes (9): Git Log (relevant commits), Status: DONE, Step 1: Syntax Check, Step 2: Data File Validation, Step 3: Backward Compatibility, Step 4: Final Commit, Steps Executed, Summary (+1 more)

### Community 46 - "Global Constraints"
Cohesion: 0.22
Nodes (8): Character Previews Backend Implementation Plan, Execution Handoff, Global Constraints, Task 1: Create empty character_previews.json, Task 2: Add loader for character previews, Task 3: Add character_previews to /char_boss/data response, Task 4: Add refresh support for character previews, Task 5: Final verification and commit

### Community 48 - "_build_database"
Cohesion: 0.25
Nodes (6): _build_database(), DanbooruTagBuilder, get_database(), _load_tag_file(), Load a tag file with caching., Scan the TAG_FOLDER and build a full database dict.

### Community 52 - "TextConcatenatePro"
Cohesion: 0.25
Nodes (3): Ultimate text concatenator: smart cleaning, smart delimiters, smart everything., TextConcatenatePro, TextConcatenateSimple

### Community 53 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Character Builder CRUD Buttons and Toast System, Global Constraints, Task 1: Add CSS Styles for Toast and CRUD Elements, Task 2: Add Toast Helper Functions, Task 3: Add _buildCrudRow and _refreshData Methods to CharEditor, Task 4: Final Verification and Commit

### Community 56 - "Task 1 Report: Backend — Add `/char_boss/save` Endpoint"
Cohesion: 0.29
Nodes (6): Commit, Files Changed, Self-Review Findings, Task 1 Report: Backend — Add `/char_boss/save` Endpoint, What I Implemented, What I Tested and Results

### Community 59 - "Task 3 Report — Backend: Add `/char_boss/proxy_image` Endpoint"
Cohesion: 0.33
Nodes (5): Changes Made, Commits, Concerns, Task 3 Report — Backend: Add `/char_boss/proxy_image` Endpoint, Test Summary

### Community 60 - "Task 5 Report: Frontend Enrichment"
Cohesion: 0.33
Nodes (5): Changes Made, Commit, Self-Review Checklist, Task 5 Report: Frontend Enrichment, Verification

### Community 62 - "curate_categories.py"
Cohesion: 0.70
Nodes (4): load_artists(), load_existing_categories(), main(), save()

### Community 63 - "Task 4 Report: Backend enrichment of artist_selector.py"
Cohesion: 0.40
Nodes (4): Changes Made, Commit, Task 4 Report: Backend enrichment of artist_selector.py, Verification

### Community 64 - "__init__.py"
Cohesion: 1.00
Nodes (3): _load_module_from_file(), load_nodes_from_subdirectory(), _load_utils_package()

### Community 65 - "generate_danbooru_tags.py"
Cohesion: 0.67
Nodes (3): build_database(), main(), Generate a comprehensive Danbooru tag database from built-in data.  This replace

### Community 66 - "Task 4: Backend enrichment (`artist_selector.py`)"
Cohesion: 0.50
Nodes (3): Key Requirements, Steps, Task 4: Backend enrichment (`artist_selector.py`)

### Community 67 - "Task 5: Frontend enrichment (JS)"
Cohesion: 0.50
Nodes (3): Key Requirements, Steps, Task 5: Frontend enrichment (JS)

## Knowledge Gaps
- **156 isolated node(s):** `TABS`, `ALPHA_RANGES`, `RANGE_MAP`, `VISIBLE_NATIVE_WIDGETS`, `_origGraphToPrompt` (+151 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BossDropdown` connect `BossDropdown` to `ultimate_character_builder/index.js`, `prompt_master_library_pro/index.js`, `artist_selector/index.js`, `scene_maker_pro/index.js`, `prompt_lens_library/index.js`, `promptunstuck_pro/index.js`, `ultimate_ksampler/index.js`, `outfit_selector/index.js`, `LoaderEditor`, `camera_style_mixer/index.js`, `SnapshotterEditor`, `prompt_booster_pro/index.js`, `batch_save/index.js`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `TABS`, `ALPHA_RANGES`, `RANGE_MAP` to the rest of the system?**
  _156 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ultimate_character_builder/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07043650793650794 - nodes in this community are weakly interconnected._
- **Should `prompt_master_library_pro/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0706605222734255 - nodes in this community are weakly interconnected._
- **Should `artist_selector/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08590441621294616 - nodes in this community are weakly interconnected._
- **Should `DanbooruEditor` be split into smaller, more focused modules?**
  _Cohesion score 0.08636363636363636 - nodes in this community are weakly interconnected._
- **Should `scene_maker_pro/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08823529411764706 - nodes in this community are weakly interconnected._
# Task 5 Report: JS — CollectionModel + CollectionController

## Status: DONE

### What was done
Added `CollectionModel` and `CollectionController` classes to `js/boss_theme/index.js`.

**CollectionModel** — static utility class:
- `normalize(rawData)` — converts server response to standardized entry objects
- `toSlug(name, existingSlugs)` — generates unique slug from name
- `validate(item, existingSlugs, excludeSlug)` — validates name/prompt required + uniqueness

**CollectionController** — instance class with configurable `baseUrl`:
- `add(type, item, categories)` — POST /save (no slug)
- `edit(type, slug, item, categories)` — POST /save (with slug)
- `delete(type, slug)` — POST /delete
- `refresh()` — POST /refresh
- `_post(path, body)` — internal fetch helper with error handling

### Commit
`4b34029` feat(theme): add CollectionModel and CollectionController shared components

### Test summary
`node --check` passed — JS syntax valid.

### Notes
- File had inline exports (`export class`, `export function`, `export const`), not a closing `export {}` block. Added a new `export { CollectionModel, CollectionController }` at the end. Existing inline exports remain untouched.

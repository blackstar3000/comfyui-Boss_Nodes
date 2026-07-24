import json
from pathlib import Path
from graphify.cache import save_semantic_cache

new = json.loads(Path('graphify-out/.graphify_chunk_01.json').read_text(encoding='utf-8'))
uncached = [line for line in Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').splitlines() if line]
spec = str(Path('C:/Users/Kilo/.config/opencode/skills/graphify/references/extraction-spec.md'))
saved = save_semantic_cache(new.get('nodes', []), new.get('edges', []), new.get('hyperedges', []), root='./docs', allowed_source_files=uncached, prompt_file=spec)
print(f'Cached {saved} files')

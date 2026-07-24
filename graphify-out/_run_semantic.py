import json
from pathlib import Path
from graphify.cache import check_semantic_cache, save_semantic_cache

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
all_files = [f for cat in ('document', 'paper', 'image') for f in detect['files'].get(cat, [])]

spec = Path('C:/Users/Kilo/.config/opencode/skills/graphify/references/extraction-spec.md')

cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(all_files, root='./docs', prompt_file=str(spec))

if cached_nodes or cached_edges or cached_hyperedges:
    Path('graphify-out/.graphify_cached.json').write_text(json.dumps({'nodes': cached_nodes, 'edges': cached_edges, 'hyperedges': cached_hyperedges}, ensure_ascii=False), encoding='utf-8')
else:
    Path('graphify-out/.graphify_cached.json').unlink(missing_ok=True)
Path('graphify-out/.graphify_uncached.txt').write_text('\n'.join(uncached), encoding='utf-8')
print(f'Cache: {len(all_files)-len(uncached)} files hit, {len(uncached)} files need extraction')

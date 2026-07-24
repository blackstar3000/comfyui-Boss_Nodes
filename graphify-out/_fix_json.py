import re
import json

with open('graphify-out/.graphify_chunk_01.json', encoding='utf-8') as f:
    content = f.read()

# Fix all bare relation lines: "relation_name", -> "relation": "relation_name",
relations = ['calls', 'implements', 'references', 'cites', 'conceptually_related_to', 'shares_data_with', 'semantically_similar_to', 'rationale_for']
for rel in relations:
    # Match lines with just the relation name (no "relation": prefix)
    content = re.sub(r'"' + rel + r'",\s*\n', f'"relation": "{rel}",\n', content)

# Also fix any double-prefixed ones
content = content.replace('"relation": "relation": ', '"relation": ')

with open('graphify-out/.graphify_chunk_01.json', 'w', encoding='utf-8') as f:
    f.write(content)

# Validate
d = json.loads(open('graphify-out/.graphify_chunk_01.json', encoding='utf-8').read())
print(f"Fixed and validated: {len(d.get('nodes',[]))} nodes, {len(d.get('edges',[]))} edges")

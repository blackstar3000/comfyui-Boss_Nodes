import json
d = json.loads(open('graphify-out/.graphify_chunk_01.json', encoding='utf-8').read())
print(f"JSON valid: {len(d.get('nodes',[]))} nodes, {len(d.get('edges',[]))} edges")

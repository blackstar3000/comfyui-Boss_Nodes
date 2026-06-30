# ComfyUI/custom_nodes/tag_searcher.py
import json
import os
import random

class TagSearcher:
    """
    A node that searches a local JSON database of tags (like Danbooru).
    Type a keyword (e.g. 'blue') and it finds matching tags.
    """
    
    # Cache the database so we don't reload it every single execution
    _db_cache = None
    _db_path = None

    @classmethod
    def INPUT_TYPES(cls):
        folder = os.path.dirname(__file__)
        db_file = os.path.join(folder, "danbooru_tags.json")
        
        # Determine available categories
        categories = ["All"]
        if os.path.exists(db_file):
            try:
                data = cls._load_db(db_file)
                categories.extend(list(data.keys()))
            except:
                pass
        
        return {
            "required": {
                "search_term": ("STRING", {"default": ""}),
                "category": (categories, {"default": "General"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "mode": (["First Match", "Random Match"], {"default": "Random Match"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING",)
    RETURN_NAMES = ("tag", "all_matches",)
    FUNCTION = "search"
    CATEGORY = "prompting/ultimate"
    OUTPUT_NODE = True

    @classmethod
    def _load_db(cls, path):
        if cls._db_cache is not None and cls._db_path == path:
            return cls._db_cache
        
        if not os.path.exists(path):
            raise FileNotFoundError(f"Tag database not found at: {path}")
            
        with open(path, "r", encoding="utf-8") as f:
            cls._db_cache = json.load(f)
            cls._db_path = path
        return cls._db_cache

    def search(self, search_term, category, seed, mode="Random Match"):
        search_term = search_term.lower().strip()
        
        try:
            folder = os.path.dirname(__file__)
            db = self._load_db(os.path.join(folder, "danbooru_tags.json"))
        except Exception as e:
            return (f"Error: {str(e)}", "")

        # Select the list of tags to search
        if category == "All":
            # Combine all categories (flatten)
            all_tags = []
            for cat_list in db.values():
                if isinstance(cat_list, list):
                    all_tags.extend(cat_list)
            search_pool = all_tags
        else:
            search_pool = db.get(category, [])

        # Filter matches
        matches = [tag for tag in search_pool if search_term in tag.lower()]

        if not matches:
            return ("", "No matches found")

        # Determine output based on mode/seed
        if seed == 0:
            random.seed() # Truly random
        else:
            random.seed(seed)

        if mode == "First Match":
            selected_tag = matches[0]
        else:
            selected_tag = random.choice(matches)

        # Return the selected tag and a debug string of all matches (limited)
        matches_preview = ", ".join(matches[:10])
        if len(matches) > 10:
            matches_preview += f" ... (+{len(matches)-10} more)"

        return (selected_tag, matches_preview)

    @classmethod
    def IS_CHANGED(cls, search_term, category, seed, mode):
        return float(seed)

NODE_CLASS_MAPPINGS = {"TagSearcher": TagSearcher}
NODE_DISPLAY_NAME_MAPPINGS = {"TagSearcher": "Tag Searcher (Danbooru)"}

print("Tag Searcher Node Loaded!")
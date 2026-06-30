# danbooru_tag_builder.py - FINAL UPDATED & CLEAN VERSION
# Features: Main + Sub categories, "None" skips generation, file-loading
# Save in: ComfyUI/custom_nodes/
# Folder: custom_nodes/danbooru_tags/ (with your .txt files)

import os

class DanbooruTagBuilder:
    TAG_FOLDER = os.path.join(os.path.dirname(__file__), "danbooru_tags")

    @classmethod
    def INPUT_TYPES(s):
        # Auto-detect main categories from files (always add "None")
        hair_options      = s._get_file_options("hair")      or ["Female", "Male", "Unisex"]
        lips_options      = s._get_file_options("lips")      or ["Female", "Male", "Unisex"]
        skin_options      = s._get_file_options("skin")      or ["Dark",  "Light", "Exotic"]
        outfit_options    = s._get_file_options("outfits")   or ["Casual", "NSFW", "Formal"]
        makeup_options    = s._get_file_options("makeup")    or ["Female", "Male", "Unisex"]
        accessory_options = s._get_file_options("accessory") or ["Female", "Male", "Unisex"]
        body_options      = s._get_file_options("body")      or ["Female", "Male", "Unisex"]

        # Always force "None" for skippable categories
        makeup_options    = makeup_options + ["None"]
        accessory_options = accessory_options + ["None"]
        body_options      = body_options + ["None"]
        outfit_options    = outfit_options + ["None"]

        # Sub-categories (auto-detected)
        body_sub_options      = s._get_sub_category_options("body")      or ["Breasts", "Ass", "Hips", "Thighs", "Full Body"]
        makeup_sub_options    = s._get_sub_category_options("makeup")    or ["Natural", "Glam", "Gothic", "No Makeup"]
        outfit_sub_options    = s._get_sub_category_options("outfits")   or ["Headwear", "General", "Bottomwear", "Shoes"]
        accessory_sub_options = s._get_sub_category_options("accessory") or ["Head", "Neck", "Arms", "Legs", "Jewelry", "Bags", "Decorations", "Misc"]

        return {
            "required": {
                "characters": (["1girl solo", "2girls duo", "3girls", "4girls", "5girls", "6+girls", "1boy solo", "2boys", "3boys", "4boys", "5boys", "6+boys", "multiple girls and boys"], {"default": "1girl solo"}),
                "skin_category":      (skin_options,      {"default": "Dark"}),
                "body_category":      (body_options,      {"default": "None"}),
                "body_sub_category":  (body_sub_options,  {"default": "Breasts"}),
                "hair_category":      (hair_options,      {"default": "Unisex"}),
                "lips_category":      (lips_options,      {"default": "Unisex"}),
                "makeup_category":    (makeup_options,    {"default": "None"}),
                "makeup_sub_category":(makeup_sub_options,{"default": "Natural"}),
                "accessory_category": (accessory_options, {"default": "None"}),
                "accessory_sub_category": (accessory_sub_options, {"default": "Head"}),
                "outfit_category":    (outfit_options,    {"default": "Casual"}),
                "outfit_sub_category":(outfit_sub_options,{"default": "Headwear"}),
                "quality_tags":       ("STRING", {"default": "masterpiece, best quality, ultra detailed, realistic, photorealistic, 8k"}),
            },
            "optional": {
                "custom_tags": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    @classmethod
    def _get_file_options(cls, prefix):
        if not os.path.exists(cls.TAG_FOLDER):
            return None
        files = [f for f in os.listdir(cls.TAG_FOLDER) if f.endswith(".txt") and prefix in f.lower()]
        options = []
        for f in files:
            cleaned = f.replace(".txt", "").lower()
            if cleaned.endswith(prefix):
                name = cleaned[:-len(prefix)].rstrip("_").capitalize()
            else:
                name = cleaned.replace(prefix + "_", "", 1).capitalize()
            if name and name != "":
                options.append(name)
        return sorted(set(options)) or None

    @classmethod
    def _get_sub_category_options(cls, main_prefix):
        if not os.path.exists(cls.TAG_FOLDER):
            return None
        files = [f for f in os.listdir(cls.TAG_FOLDER) if f.startswith(main_prefix + "_") and f.endswith(".txt")]
        options = []
        for f in files:
            name = f.replace(main_prefix + "_", "").replace(".txt", "").capitalize()
            options.append(name)
        return sorted(set(options)) or None

    @classmethod
    def _load_tags(cls, category, prefix):
        if not os.path.exists(cls.TAG_FOLDER):
            return ""
        filename = os.path.join(cls.TAG_FOLDER, f"{category.lower()}_{prefix}.txt")
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return "{" + content + "}"
        return ""

    def _load_tags_from_file(self, filename):
        full_path = os.path.join(self.TAG_FOLDER, filename)
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return "{" + content + "}"
        return ""

    RETURN_TYPES = ("STRING",)
    FUNCTION = "build_prompt"
    CATEGORY = "Danbooru Tags"

    def build_prompt(self, characters, skin_category, body_category, body_sub_category, hair_category, lips_category, makeup_category, makeup_sub_category, accessory_category, accessory_sub_category, outfit_category, outfit_sub_category, quality_tags, custom_tags=""):
        parts = [characters]

        # Skin (always included, no None option)
        skin = self._load_tags(skin_category, "skin")
        if skin:
            parts.append(skin)

        # Body main + sub
        body = ""
        if body_category != "None":
            body_main = self._load_tags(body_category, "body") or ""
            body_sub = ""
            if body_sub_category:
                body_sub_file = f"body_{body_sub_category.lower()}.txt"
                body_sub = self._load_tags_from_file(body_sub_file) or ""
            body = f"{body_main}, {body_sub}".strip(", ")
        if body:
            parts.append(body)

        # Hair
        hair = self._load_tags(hair_category, "hair")
        if hair:
            parts.append(hair)

        # Lips
        lips = self._load_tags(lips_category, "lips")
        if lips:
            parts.append(lips)

        # Makeup main + sub
        makeup = ""
        if makeup_category != "None":
            makeup_main = self._load_tags(makeup_category, "makeup") or ""
            makeup_sub = ""
            if makeup_sub_category:
                makeup_sub_file = f"makeup_{makeup_sub_category.lower()}.txt"
                makeup_sub = self._load_tags_from_file(makeup_sub_file) or ""
            makeup = f"{makeup_main}, {makeup_sub}".strip(", ")
        if makeup:
            parts.append(makeup)

        # Accessory sub
        accessory = ""
        if accessory_sub_category:
            accessory_file = f"accessory_{accessory_sub_category.lower()}.txt"
            accessory = self._load_tags_from_file(accessory_file) or ""
        if accessory:
            parts.append(accessory)

        # Outfits main + sub
        outfit = ""
        if outfit_category != "None":
            outfit_main = self._load_tags(outfit_category, "outfits") or ""
            outfit_sub = ""
            if outfit_sub_category:
                outfit_sub_file = f"outfits_{outfit_sub_category.lower()}.txt"
                outfit_sub = self._load_tags_from_file(outfit_sub_file) or ""
            outfit = f"{outfit_main}, {outfit_sub}".strip(", ")
        if outfit:
            parts.append(f"BREAK Outfits: {outfit}")

        # Final prompt
        prompt = ", ".join(parts) + f", {quality_tags}"
        if custom_tags:
            prompt += f", {custom_tags}"

        return (prompt,)

NODE_CLASS_MAPPINGS = {
    "DanbooruTagBuilder": DanbooruTagBuilder
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DanbooruTagBuilder": "Danbooru Tag Builder (File-Loading + All Categories)"
}
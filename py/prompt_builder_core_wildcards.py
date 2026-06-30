# ComfyUI/custom_nodes/MyCustomPack/py/prompt_builder_core_wildcards.py
# PROMPT BUILDER CORE — TXT + YAML SUPPORT

import os
import random
import re
import yaml  # Requires: pip install pyyaml

class PromptBuilderCoreWildcards:
    def __init__(self):
        self.wildcard_dir = os.path.join(os.path.dirname(__file__), "wildcards")
        os.makedirs(self.wildcard_dir, exist_ok=True)
        self.cache = {}  # Cache: "filename" or "filename/key" -> list of strings

    def load_wildcard(self, name):
        # Return cached result if available
        cache_key = name
        if cache_key in self.cache:
            return self.cache[cache_key]

        # --- 1. Try Specific File Match (Subfolder + File) ---
        # Example: __colors/neon__ -> wildcards/colors/neon.txt OR wildcards/colors/neon.yaml
        path_parts = name.split("/")
        file_path_txt = os.path.join(self.wildcard_dir, *path_parts) + ".txt"
        file_path_yaml = os.path.join(self.wildcard_dir, *path_parts) + ".yaml"
        # Also check .yml extension
        file_path_yml = os.path.join(self.wildcard_dir, *path_parts) + ".yml"

        # Case A: Found a specific .txt file
        if os.path.exists(file_path_txt):
            lines = self._read_txt(file_path_txt)
            self.cache[cache_key] = lines
            return lines

        # Case B: Found a specific .yaml file (Root is a list)
        if os.path.exists(file_path_yaml) or os.path.exists(file_path_yml):
            path = file_path_yaml if os.path.exists(file_path_yaml) else file_path_yml
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                if isinstance(data, list):
                    self.cache[cache_key] = data
                    return data
                else:
                    print(f"[PromptBuilder] YAML file {path} is not a list. Use __filename/key__ syntax.")
            except Exception as e:
                print(f"[PromptBuilder] Error reading YAML {path}: {e}")

        # --- 2. Try YAML Dictionary Lookup ---
        # Example: __characters/female__ -> wildcards/characters.yaml -> key: "female"
        if len(path_parts) >= 2:
            folder_name = path_parts[-2] # The file name (without extension)
            key_name = path_parts[-1]     # The key inside the file
            
            # Reconstruct path to the YAML file
            # If input is "colors/red", we look for "colors.yaml" -> key "red"
            # This is tricky with folders.
            # Let's assume the last part is the key, and everything before is the filename path.
            
            yaml_filename = "/".join(path_parts[:-1]) # e.g. "colors"
            yaml_path = os.path.join(self.wildcard_dir, yaml_filename + ".yaml")
            yaml_path_yml = os.path.join(self.wildcard_dir, yaml_filename + ".yml")
            
            target_path = None
            if os.path.exists(yaml_path): target_path = yaml_path
            elif os.path.exists(yaml_path_yml): target_path = yaml_path_yml
            
            if target_path:
                try:
                    with open(target_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                    
                    if isinstance(data, dict) and key_name in data:
                        result = data[key_name]
                        # Ensure result is a list
                        if isinstance(result, list):
                            self.cache[cache_key] = result
                            return result
                        else:
                            # If it's a single string, wrap in list
                            self.cache[cache_key] = [str(result)]
                            return [str(result)]
                except Exception as e:
                    print(f"[PromptBuilder] Error reading YAML dict {target_path}: {e}")

        # --- 3. Fallback ---
        print(f"[PromptBuilder] Could not find wildcard: {name}")
        return [f"__{name}__"]

    def _read_txt(self, path):
        with open(path, "r", encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip() and not line.startswith("#")]

    def replace_wildcards(self, text):
        if not text or "__" not in text:
            return text

        def repl(match):
            wildcard = match.group(1)
            options = self.load_wildcard(wildcard)
            if not options:
                return match.group(0)
            return random.choice(options)

        return re.sub(r"__(.*?)__", repl, text)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "quality": ("STRING", {
                    "default": "masterpiece, best quality, ultra-detailed, 8k",
                    "multiline": True,
                    "dynamicPrompts": True
                }),
                "subject": ("STRING", {
                    "default": "a girl with __colors/hair__, wearing __outfits/casual__",
                    "multiline": True,
                    "dynamicPrompts": True
                }),
                "style": ("STRING", {
                    "default": "artstyle __art/mode__",
                    "multiline": True,
                    "dynamicPrompts": True
                }),
                "extra": ("STRING", {"default": "", "multiline": True, "dynamicPrompts": True}),
                "negative": ("STRING", {
                    "default": "blurry, ugly, deformed, lowres",
                    "multiline": True,
                    "dynamicPrompts": True
                }),
                "global_weight": ("FLOAT", {"default": 1.0, "min": 0.5, "max": 2.0, "step": 0.05}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive", "negative")
    FUNCTION = "build"
    CATEGORY = "🌟 Pro Tools/Prompting"

    def build(self, seed=0, quality="", subject="", style="", extra="", negative="", global_weight=1.0):
        if seed != 0:
            random.seed(seed)
        else:
            random.seed()

        quality = self.replace_wildcards(quality.strip())
        subject = self.replace_wildcards(subject.strip())
        style = self.replace_wildcards(style.strip())
        extra = self.replace_wildcards(extra.strip())
        negative = self.replace_wildcards(negative.strip())

        parts = []
        if quality: parts.append(quality)
        if subject: parts.append(subject)
        if extra: parts.append(extra)
        if style: parts.append(style)

        positive = ", ".join(parts)
        if global_weight != 1.0:
            positive = f"({positive}:{global_weight:.2f})"

        return (positive, negative)


NODE_CLASS_MAPPINGS = {"PromptBuilderCoreWildcards": PromptBuilderCoreWildcards}
NODE_DISPLAY_NAME_MAPPINGS = {"PromptBuilderCoreWildcards": "🔠 Prompt Builder (TXT + YAML)"}
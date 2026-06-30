import html
import json
import os
import random


class BillionsPromptGenerator:
    @classmethod
    def INPUT_TYPES(cls):
        folder = os.path.dirname(__file__)
        try:
            data = cls._load_json(folder, "billions_prompts.json")
            categories = cls._discover_categories(data)
        except Exception as e:
            print(f"[BillionsPromptGenerator] Warning: Could not load JSON: {e}")
            categories = ["Bo/random/anything"]

        return {
            "required": {
                "category": (
                    categories,
                    {"default": categories[0] if categories else "Bo/random/anything"},
                ),
                "variant": ("INT", {"default": 0, "min": 0, "max": 99, "step": 1}),
                "strength": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05},
                ),
            },
            "optional": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF}),
                "show_preview": ("BOOLEAN", {"default": True}),
                "control_after_generate": (
                    ["fixed", "increment", "decrement", "randomize"],
                    {"default": "randomize"},
                ),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "generate"
    CATEGORY = "🌟 Pro Tools/Prompting"
    OUTPUT_NODE = True

    @staticmethod
    def _load_json(folder, filename):
        path = os.path.join(folder, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"{filename} not found in {folder}")
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @classmethod
    def _discover_categories(cls, data, prefix=""):
        """
        Recursively discovers categories.
        Now handles both Lists (multiple prompts) and Strings (single static prompt).
        """
        cats = []
        for key, value in data.items():
            path = f"{prefix}{key}" if prefix else key

            if isinstance(value, dict):
                # Go deeper into the folder structure
                cats.extend(cls._discover_categories(value, path + "/"))

            elif isinstance(value, list) and value:
                # Found a list of prompts
                cats.append(path)

            elif isinstance(value, str) and value.strip():
                # Found a single string prompt (e.g. your specific chars)
                cats.append(path)

        return sorted(cats)

    def _resolve_path(self, data, path):
        keys = path.split("/")
        current = data
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            else:
                return None
        return current

    def generate(
        self,
        category,
        variant=0,
        strength=1.0,
        seed=0,
        show_preview=True,
        control_after_generate="randomize",
    ):
        # Seed logic
        if seed == 0 and control_after_generate == "randomize":
            random.seed()
        elif seed != 0:
            random.seed(seed)

        folder = os.path.dirname(__file__)
        try:
            data = self._load_json(folder, "billions_prompts.json")
        except Exception as e:
            prompt = f"(Error loading JSON: {str(e)})"
            return (
                prompt,
                {
                    "ui": {
                        "text": [
                            f"<div style='color:red'>JSON Error: {html.escape(str(e))}</div>"
                        ]
                    }
                },
            )

        options = self._resolve_path(data, category)

        if not options:
            prompt = f"(no prompts found for category: {category})"
            count = 0

        elif isinstance(options, list):
            # Logic for multiple variants (lists)
            count = len(options)
            selected = options[variant % count]
            prompt = selected.strip()

        elif isinstance(options, str):
            # Logic for single static strings
            count = 1
            prompt = options.strip()
            # Note: 'variant' integer is ignored for single strings,
            # but the seed logic remains consistent.

        else:
            prompt = "(invalid data type)"
            count = 0

        if strength != 1.0 and prompt:
            prompt = f"({prompt}:{strength:.2f})"

        ui = {}
        if show_preview:
            ui["text"] = [self._preview(prompt, category, count)]

        return (prompt, {"ui": ui})

    def _preview(self, prompt, category, count):
        safe = html.escape(prompt)
        return f"""
<div style="padding:15px; background:#1a1a2e; border-radius:12px; border:2px solid #ee82ee; font-family:sans-serif;">
    <div style="font-size:1.5em; color:#ee82ee; font-weight:bold; text-align:center; margin-bottom:12px;">
        🌌 Billions of Characters & Worlds
    </div>
    <div style="color:#aaa; text-align:center; margin-bottom:10px;">
        Category: {html.escape(category)} ({count} variant{"s" if count != 1 else ""})
    </div>
    <div style="background:#16213e; padding:15px; border-radius:8px; font-family:monospace; white-space:pre-wrap; color:#fff; font-size:0.95em;">
        {safe}
    </div>
</div>
        """.strip()


NODE_CLASS_MAPPINGS = {"BillionsPromptGenerator": BillionsPromptGenerator}
NODE_DISPLAY_NAME_MAPPINGS = {
    "BillionsPromptGenerator": "Billions of Characters & Worlds"
}

print("\nBillions of Characters & Worlds v2.2 (JSON Hybrid) LOADED!")
print("   • Supports Lists (randomizable)")
print("   • Supports Strings (static)")
print("   • Compatible with Bo/random wildcards")

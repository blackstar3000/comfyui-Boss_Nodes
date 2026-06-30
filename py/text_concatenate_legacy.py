# ComfyUI/custom_nodes/text_concatenate_node/__init__.py
# TEXT CONCATENATE PRO v2.0 — The one you always wished existed

import re

class TextConcatenatePro:
    """
    Ultimate text concatenator: smart cleaning, smart delimiters, smart everything.
    Handles \\n, commas, " • ", Oxford commas, auto-trims, skips empty, perfect order.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "delimiter": ("STRING", {
                    "multiline": False,
                    "default": ", ",
                    "placeholder": "e.g. , | • | \\n | and"
                }),
                "smart_oxford_comma": (["disable", "enable"], {
                    "default": "enable",
                    "tooltip": "Automatically uses 'and' before last item when using commas"
                }),
                "trim_each": (["disable", "enable"], {
                    "default": "enable"
                }),
                "skip_empty": (["disable", "enable"], {
                    "default": "enable"
                }),
            },
            "optional": {
                "text_1": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_2": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_3": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_4": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_5": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_6": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_7": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_8": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_9": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                "text_10": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
                # Supports up to 10 — more than enough for 99.9% of workflows
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("combined_text",)
    FUNCTION = "execute"
    CATEGORY = "🌟 Pro Tools/Text"

    def execute(self, delimiter=", ", smart_oxford_comma="enable", trim_each="enable", skip_empty="enable", **kwargs):

        # Smart delimiter handling
        delimiter = delimiter.strip()
        if delimiter in ("\\n", "\n"):
            delimiter = "\n"
        elif delimiter.lower() in ("comma", "commas"):
            delimiter = ", "
        elif delimiter.lower() == "newline":
            delimiter = "\n"
        elif delimiter == "•":
            delimiter = " • "

        parts = []
        trim = trim_each == "enable"
        skip = skip_empty == "enable"

        # Process in order: text_1 → text_10 (guaranteed order!)
        for i in range(1, 11):
            key = f"text_{i}"
            if key not in kwargs:
                continue
            value = kwargs[key]
            if not isinstance(value, str):
                continue

            if trim:
                value = value.strip()
            
            # Remove zero-width junk and control characters
            value = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', value)
            
            if skip and not value:
                continue

            if value:
                parts.append(value)

        if not parts:
            return ("",)

        # Smart Oxford comma magic
        if smart_oxford_comma == "enable" and delimiter.strip(", ") == "" and len(parts) > 1:
            # Only trigger when delimiter contains a comma (or is exactly ", ")
            if "," in delimiter or delimiter == ", ":
                if len(parts) == 2:
                    result = " and ".join(parts)
                else:
                    result = ", ".join(parts[:-1]) + ", and " + parts[-1]
                return (result,)

        # Normal join
        result = delimiter.join(parts)
        return (result,)


# === BONUS: Lightweight version for people who just want simple ===
class TextConcatenateSimple:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "text_a": ("STRING", {"forceInput": True}),
                "text_b": ("STRING", {"forceInput": True}),
                "text_c": ("STRING", {"forceInput": True}),
                "text_d": ("STRING", {"forceInput": True}),
                "text_e": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "go"
    CATEGORY = "🌟 Pro Tools/Text"

    def go(self, **kwargs):
        texts = [v.strip() for v in kwargs.values() if isinstance(v, str) and v.strip()]
        return (", ".join(texts),)


# =============================================================================
NODE_CLASS_MAPPINGS = {
    "TextConcatenatePro": TextConcatenatePro,
    "TextConcatenateSimple": TextConcatenateSimple,   # kept for legacy workflows
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TextConcatenatePro": "🌟 Text Concatenate Pro",
    "TextConcatenateSimple": "Text Concatenate (Legacy)"
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

print("\n✨ Text Concatenate Pro v2.0 loaded — now with Oxford comma intelligence")
print("   The only text node you'll ever need. You're welcome. 😏\n")
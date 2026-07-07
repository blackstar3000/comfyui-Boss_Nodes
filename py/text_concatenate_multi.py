# text_concatenate_node/__init__.py

class TextConcatenate:
    """
    Concatenates multiple optional text inputs with a configurable delimiter.
    Optionally cleans whitespace from each input and skips empty strings.
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "delimiter": ("STRING", {
                    "default": ", ",
                    "multiline": False
                }),
                "clean_whitespace": (["true", "false"], {
                    "default": "true"
                }),
            },
            "optional": {
                "text_a": ("STRING", {"forceInput": True}),
                "text_b": ("STRING", {"forceInput": True}),
                "text_c": ("STRING", {"forceInput": True}),
                "text_d": ("STRING", {"forceInput": True}),
                "text_e": ("STRING", {"forceInput": True}),
                "text_f": ("STRING", {"forceInput": True}),
                "text_g": ("STRING", {"forceInput": True}),
                # Add more if you frequently need them (up to text_z is common)
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "concatenate"
    CATEGORY = "👑 Boss Nodes/📝 Text"

    def concatenate(self, delimiter=", ", clean_whitespace="true", **kwargs):
        # Special handling for newline representations
        if delimiter.strip() in ("\\n", "\n"):
            delimiter = "\n"

        texts = []
        clean = clean_whitespace == "true"

        # Process inputs in alphabetical order (a -> b -> c ...) for predictable output
        for key in sorted(kwargs.keys()):
            value = kwargs[key]
            if not isinstance(value, str):
                continue

            if clean:
                value = value.strip()

            # Skip completely empty strings after cleaning
            if value:
                texts.append(value)

        result = delimiter.join(texts)
        return (result,)


# Required for ComfyUI to discover the node
NODE_CLASS_MAPPINGS = {
    "TextConcatenate": TextConcatenate
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TextConcatenate": "📝 Text Concatenate (Multi)"
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']
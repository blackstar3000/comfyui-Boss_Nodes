import json
import os

class SizePresetLoader:
    """
    A node that allows you to save and load custom resolution (Width/Height/Batch) presets.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        folder = os.path.dirname(__file__)
        json_path = os.path.join(folder, "size_presets.json")
        
        # Load existing presets to populate the dropdown
        custom_presets = []
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    custom_presets = list(data.keys())
            except:
                pass
        
        # Combine Hardcoded Defaults with Custom Presets
        all_presets = [
            "Custom",
            "--- Standard ---",
            "1024x1024 (Square)",
            "768x1344 (Portrait)",
            "1344x768 (Landscape)",
            "896x1152 (Close-up)",
            "512x512 (SD1.5)",
            "--- Saved Presets ---"
        ] + custom_presets

        return {
            "required": {
                "action": (["Use Settings", "Save Current", "Delete Preset"], {"default": "Use Settings"}),
                "preset_selector": (all_presets, {"default": "Custom"}),
                "custom_name": ("STRING", {"default": "My Awesome Preset"}),
                "width": ("INT", {"default": 1024, "min": 64, "max": 8192}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 8192}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 64}),
            },
        }

    RETURN_TYPES = ("INT", "INT", "INT", "STRING")
    RETURN_NAMES = ("width", "height", "batch_size", "status")
    FUNCTION = "run"
    CATEGORY = "🌟 Pro Tools/Prompting"

    def _get_presets_dict(self):
        folder = os.path.dirname(__file__)
        json_path = os.path.join(folder, "size_presets.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def run(self, action, preset_selector, custom_name, width, height, batch_size):
        folder = os.path.dirname(__file__)
        json_path = os.path.join(folder, "size_presets.json")
        status_msg = "Ready"

        # 1. HANDLE SAVING
        if action == "Save Current":
            if not custom_name:
                status_msg = "Error: Name cannot be empty"
                return (width, height, batch_size, status_msg)
            
            data = self._get_presets_dict()
            data[custom_name] = {
                "width": width,
                "height": height,
                "batch_size": batch_size
            }
            
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            
            status_msg = f"Saved '{custom_name}'! Refresh UI to see in dropdown."
            return (width, height, batch_size, status_msg)

        # 2. HANDLE DELETING
        if action == "Delete Preset":
            data = self._get_presets_dict()
            if custom_name in data:
                del data[custom_name]
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                status_msg = f"Deleted '{custom_name}'."
            else:
                status_msg = f"Preset '{custom_name}' not found."
            return (width, height, batch_size, status_msg)

        # 3. HANDLE LOADING / USING SETTINGS
        # Check if the selected preset is a hardcoded one
        if preset_selector == "1024x1024 (Square)":
            return (1024, 1024, batch_size, "Loaded: 1024x1024")
        elif preset_selector == "768x1344 (Portrait)":
            return (768, 1344, batch_size, "Loaded: 768x1344")
        elif preset_selector == "1344x768 (Landscape)":
            return (1344, 768, batch_size, "Loaded: 1344x768")
        elif preset_selector == "896x1152 (Close-up)":
            return (896, 1152, batch_size, "Loaded: 896x1152")
        elif preset_selector == "512x512 (SD1.5)":
            return (512, 512, batch_size, "Loaded: 512x512")
        
        # Check if the selected preset is from JSON
        elif preset_selector != "Custom" and not preset_selector.startswith("---"):
            data = self._get_presets_dict()
            if preset_selector in data:
                p = data[preset_selector]
                return (p["width"], p["height"], p["batch_size"], f"Loaded: {preset_selector}")

        # Default: Return manual inputs
        return (width, height, batch_size, status_msg)

    @classmethod
    def IS_CHANGED(cls, action, preset_selector, custom_name, width, height, batch_size):
        return float("nan") # Always allow re-execution for button clicks

NODE_CLASS_MAPPINGS = {"SizePresetLoader": SizePresetLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"SizePresetLoader": "Size Preset Loader"}
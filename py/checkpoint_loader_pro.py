import os
import json
import folder_paths
import comfy.sd
import comfy.model_management

class CheckpointLoaderPro:
    """
    A Checkpoint Loader with a Favorites/Presets system.
    Allows you to save specific models to a quick-access list.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # 1. Get the list of all checkpints in your folder
        try:
            checkpoint_files = folder_paths.get_filename_list("checkpoints")
        except:
            checkpoint_files = []

        # 2. Load saved favorites from JSON
        json_path = os.path.join(os.path.dirname(__file__), "checkpoint_favorites.json")
        favorites = []
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    favorites = list(data.keys())
            except:
                pass

        # 3. Combine into the dropdown
        preset_options = ["None"] + favorites

        return {
            "required": {
                "ckpt_name": (checkpoint_files, {"default": checkpoint_files[0] if checkpoint_files else ""}),
                "action": (["Load Model", "Save to Favorites", "Remove Favorite"], {"default": "Load Model"}),
                "preset_selector": (preset_options, {"default": "None"}),
                "favorite_name": ("STRING", {"default": "My Main Model"}),
            },
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "STRING")
    RETURN_NAMES = ("model", "clip", "vae", "status")
    FUNCTION = "load_checkpoint"
    CATEGORY = "🌟 Pro Tools/Prompting"

    def load_checkpoint(self, ckpt_name, action, preset_selector, favorite_name):
        json_path = os.path.join(os.path.dirname(__file__), "checkpoint_favorites.json")
        
        # --- ACTION: SAVE ---
        if action == "Save to Favorites":
            if not ckpt_name:
                return (None, None, None, "Error: No checkpoint selected")
            
            data = {}
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            
            name_to_save = favorite_name if favorite_name else ckpt_name
            data[name_to_save] = ckpt_name
            
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                
            return (None, None, None, f"Saved '{name_to_save}' as favorite! (Refresh UI to see in list)")

        # --- ACTION: DELETE ---
        if action == "Remove Favorite":
            if os.path.exists(json_path):
                data = {}
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                if favorite_name in data:
                    del data[favorite_name]
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                    return (None, None, None, f"Removed '{favorite_name}'")
                elif preset_selector in data:
                    # If user didn't type name, delete the selected preset
                    del data[preset_selector]
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                    return (None, None, None, f"Removed '{preset_selector}'")

            return (None, None, None, "Favorite not found")

        # --- ACTION: LOAD ---
        # Determine which checkpoint to load
        # Priority 1: Use Preset if selected
        # Priority 2: Use ckpt_name dropdown
        if preset_selector != "None":
            # Load the actual filename from the favorites list
            actual_ckpt_name = self._get_filename_from_preset(preset_selector)
            if actual_ckpt_name:
                ckpt_name = actual_ckpt_name
                status = f"Loaded Favorite: {preset_selector}"
            else:
                return (None, None, None, "Error: Favorite data corrupted")
        else:
            status = f"Loaded: {ckpt_name}"

        if not ckpt_name:
            return (None, None, None, "No checkpoint selected")

        # Perform the standard ComfyUI loading logic
        try:
            out = comfy.sd.load_checkpoint_guess_config(
                folder_paths.get_full_path("checkpoints", ckpt_name),
                output_vae=True,
                output_clip=True,
                embedding_directory=folder_paths.get_folder_paths("embeddings")
            )
            # out is [model, clip, vae, clip_vision]
            return (out[0], out[1], out[2], status)
        except Exception as e:
            return (None, None, None, f"Error: {str(e)}")

    def _get_filename_from_preset(self, preset_name):
        json_path = os.path.join(os.path.dirname(__file__), "checkpoint_favorites.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data.get(preset_name)
            except:
                return None
        return None

    @classmethod
    def IS_CHANGED(cls, ckpt_name, action, preset_selector, favorite_name):
        # Force update so buttons (Save/Remove) can be clicked multiple times
        return float("nan")

NODE_CLASS_MAPPINGS = {"CheckpointLoaderPro": CheckpointLoaderPro}
NODE_DISPLAY_NAME_MAPPINGS = {"CheckpointLoaderPro": "Checkpoint Loader Pro"}
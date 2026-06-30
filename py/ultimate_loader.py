import os
import json
import re
import torch
import folder_paths
import comfy.sd
import comfy.sample
import comfy.model_management

class UltimateLoader:
    """
    Ultimate Loader v3 - Hybrid Edition (Fixed Latent).
    Combines TTN Aspect Ratios, VAE Selection, Clip Skip, with JSON Favorites.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # 1. Checkpoints
        try:
            checkpoint_files = folder_paths.get_filename_list("checkpoints")
        except:
            checkpoint_files = []

        # 2. Model Favorites (JSON)
        json_path_models = os.path.join(os.path.dirname(__file__), "checkpoint_favorites.json")
        model_favs = []
        if os.path.exists(json_path_models):
            try:
                with open(json_path_models, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        model_favs = list(data.keys())
            except:
                pass

        # 3. Size Presets (JSON + TTN Hardcoded)
        json_path_sizes = os.path.join(os.path.dirname(__file__), "size_presets.json")
        
        aspect_ratios = [
            "width x height [custom]",
            "512 x 512 [S] 1:1",
            "768 x 768 [S] 1:1",
            "910 x 910 [S] 1:1",
            "512 x 682 [P] 3:4",
            "512 x 768 [P] 2:3",
            "512 x 910 [P] 9:16",
            "682 x 512 [L] 4:3",
            "768 x 512 [L] 3:2",
            "910 x 512 [L] 16:9",
            "1024 x 1024 [S] 1:1",                        
            "512 x 1024 [P] 1:2",
            "1024 x 512 [L] 2:1",
            "640 x 1536 [P] 9:21",
            "704 x 1472 [P] 9:19",
            "768 x 1344 [P] 9:16",
            "768 x 1216 [P] 5:8",
            "832 x 1216 [P] 2:3",
            "896 x 1152 [P] 3:4",
            "1536 x 640 [L] 21:9",
            "1472 x 704 [L] 19:9",
            "1344 x 768 [L] 16:9",
            "1216 x 768 [L] 8:5",
            "1216 x 832 [L] 3:2",
            "1152 x 896 [L] 4:3",
            "--- Custom JSON Presets ---" 
        ]
        
        if os.path.exists(json_path_sizes):
            try:
                with open(json_path_sizes, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        aspect_ratios.extend(list(data.keys()))
            except:
                pass

        # 4. VAE List
        try:
            vae_list = folder_paths.get_filename_list("vae")
        except:
            vae_list = []

        return {
            "required": {
                # --- MODEL CONTROLS ---
                "ckpt_name": (checkpoint_files, {"default": checkpoint_files[0] if checkpoint_files else ""}),
                "model_action": (["Load Model", "Save Favorite", "Delete Favorite"], {"default": "Load Model"}),
                "model_preset": (["None"] + model_favs, {"default": "None"}),
                "fav_name": ("STRING", {"default": "My Main Model"}),
                
                # --- VAE & CLIP ---
                "vae_name": (["Baked VAE"] + vae_list, {"default": "Baked VAE"}),
                "clip_skip": ("INT", {"default": -1, "min": -24, "max": 0, "step": 1}),
                
                # --- SIZE CONTROLS ---
                "aspect_ratio": (aspect_ratios, {"default": "1024 x 1024 [S] 1:1"}),
                "width": ("INT", {"default": 1024, "min": 64, "max": 8192}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 8192}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 32}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "LATENT", "INT", "INT", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "VAE", "LATENT", "WIDTH", "HEIGHT", "STATUS")
    FUNCTION = "load"
    CATEGORY = "Ultimate Loader"

    def load(self, ckpt_name, model_action, model_preset, fav_name, vae_name, clip_skip, aspect_ratio, width, height, batch_size):
        json_path_models = os.path.join(os.path.dirname(__file__), "checkpoint_favorites.json")
        json_path_sizes = os.path.join(os.path.dirname(__file__), "size_presets.json")

        # 1. Handle Model Favorites
        json_data = self._get_safe_json(json_path_models)
        
        if model_action == "Save Favorite":
            json_data[fav_name] = ckpt_name
            with open(json_path_models, "w") as f:
                json.dump(json_data, f, indent=4)
            return (None, None, None, None, width, height, f"Saved: {fav_name}")

        if model_action == "Delete Favorite":
            if fav_name in json_data:
                del json_data[fav_name]
                with open(json_path_models, "w") as f:
                    json.dump(json_data, f, indent=4)
            return (None, None, None, None, width, height, f"Deleted: {fav_name}")

        # 2. Determine Checkpoint
        if model_preset != "None":
            actual_ckpt = self._get_json_val(json_path_models, model_preset)
            if actual_ckpt: ckpt_name = actual_ckpt

        # 3. Determine Size
        if aspect_ratio.startswith("width x height"):
            pass  # Use manual width/height inputs
        elif aspect_ratio.startswith("---"):
            pass  # Use manual inputs
        else:
            # Try to parse TTN string (e.g., "512 x 768 [P]")
            match = re.search(r"(\d+)\s*x\s*(\d+)", aspect_ratio)
            if match:
                width = int(match.group(1))
                height = int(match.group(2))
            else:
                # Try JSON preset
                size_data = self._get_json_val(json_path_sizes, aspect_ratio)
                if size_data:
                    width = size_data.get("width", width)
                    height = size_data.get("height", height)
                    batch_size = size_data.get("batch_size", batch_size)

        # 4. Load Model & CLIP
        try:
            out = comfy.sd.load_checkpoint_guess_config(
                folder_paths.get_full_path("checkpoints", ckpt_name),
                output_vae=True,
                output_clip=True,
                embedding_directory=folder_paths.get_folder_paths("embeddings")
            )
            model = out[0]
            clip = out[1]
            vae = out[2]
        except Exception as e:
            return (None, None, None, None, width, height, f"Load Error: {e}")

        # 5. Load External VAE (if selected)
        if vae_name != "Baked VAE":
            try:
                vae_path = folder_paths.get_full_path("vae", vae_name)
                vae = comfy.sd.VAE(ckpt_path=vae_path)
            except Exception as e:
                return (model, clip, vae, None, width, height, f"VAE Error: {e}")

        # 6. Clip Skip (FIXED for ModelPatcher)
        if clip_skip != -1:
            try:
                # Unwrap if patched
                clip_model = model.clip if hasattr(model, "clip") else model.model.clip if hasattr(model, "model") else None
                if clip_model:
                    clip_model = clip_model.clone().clip(clip_skip)
                    if hasattr(model, "clip"):
                        model.clip = clip_model
                    elif hasattr(model, "model"):
                        model.model.clip = clip_model
                else:
                    print("[UltimateLoader] No clip model found for skip")
            except Exception as e:
                print(f"[UltimateLoader] Clip Skip error: {e}")

        # 7. Generate Latent (Standard Method)
        try:
            device = comfy.model_management.get_torch_device()
            
            # Latent resolution is 1/8th of the image resolution
            latent_width = width // 8
            latent_height = height // 8
            
            samples = torch.zeros([batch_size, 4, latent_height, latent_width], device=device)
            latent = {"samples": samples}
            
        except Exception as e:
            return (model, clip, vae, None, width, height, f"Latent Error: {e}")

        status = f"Loaded: {ckpt_name} | VAE: {vae_name} | Size: {width}x{height}"
        return (model, clip, vae, latent, width, height, status)

    # --- Helpers ---
    def _get_safe_json(self, path):
        data = {}
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f: data = json.load(f)
            except:
                data = {}
        return data

    def _get_json_val(self, path, key):
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data.get(key)
            except:
                return None
        return None

    @classmethod
    def IS_CHANGED(cls, *args, **kwargs):
        return float("nan")

NODE_CLASS_MAPPINGS = {"UltimateLoader": UltimateLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"UltimateLoader": "Ultimate Loader v3 (Hybrid)"}
# ComfyUI/custom_nodes/ultimate_loader.py
# Ultimate Loader Pro - Hybrid Edition (Boss style) with model preview

import os
import json
import re
import torch
import folder_paths
import comfy.sd
import comfy.sample
import comfy.model_management
from urllib.parse import quote

# ── Constants ───────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(__file__)
MODEL_FAV_FILE = os.path.join(BASE_DIR, "checkpoint_favorites.json")
SIZE_PRESET_FILE = os.path.join(BASE_DIR, "size_presets.json")

# ── Helpers for JSON I/O ──────────────────────────────────────────────────

def _load_json(path, default=None):
    if not os.path.exists(path):
        return default if default is not None else {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default if default is not None else {}

def _save_json(path, data):
    import tempfile
    try:
        dir_name = os.path.dirname(path) or "."
        fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            # Backup existing file
            if os.path.exists(path):
                bak_path = path + ".bak"
                try:
                    os.replace(path, bak_path)
                except OSError:
                    pass
            os.replace(tmp_path, path)
            return True
        except Exception:
            # Clean up temp file on failure
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            return False
    except Exception:
        return False

# ── API routes ──────────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/ultimate_loader/data")
    async def get_data(request):
        try:
            checkpoints = folder_paths.get_filename_list("checkpoints")
            vaes = folder_paths.get_filename_list("vae")
            model_favs = _load_json(MODEL_FAV_FILE, {})
            size_presets = _load_json(SIZE_PRESET_FILE, {})
            return web.json_response({
                "checkpoints": checkpoints,
                "vaes": vaes,
                "model_favorites": model_favs,
                "size_presets": size_presets,
            })
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.get("/ultimate_loader/preview")
    async def get_preview(request):
        """Return the preview URL for a given checkpoint."""
        ckpt = request.query.get("ckpt")
        if not ckpt:
            return web.json_response({"error": "Missing ckpt"}, status=400)

        def to_forward_slashes(p):
            # Don't rely on os.sep matching what's actually in the string -
            # on some setups (e.g. WSL-hosted ComfyUI with Windows-style
            # checkpoint names) os.sep won't match the literal backslashes
            # present in the path, silently leaving them unconverted.
            return p.replace("\\", "/").replace(os.sep, "/")

        # Get checkpoint folders
        folders = folder_paths.get_folder_paths("checkpoints")
        full_path = os.path.normpath(ckpt)

        # Find which folder contains this checkpoint
        folder_index = None
        rel_path = None
        for i, folder in enumerate(folders):
            norm_folder = os.path.normpath(folder)
            if full_path.startswith(norm_folder + os.sep) or full_path == norm_folder:
                folder_index = i
                rel_path = os.path.relpath(full_path, norm_folder)
                rel_path = to_forward_slashes(rel_path)
                break

        if folder_index is None:
            # Fallback: try to match by checking if the checkpoint is a file in any folder
            for i, folder in enumerate(folders):
                norm_folder = os.path.normpath(folder)
                # Check if the path is under this folder
                try:
                    common = os.path.commonpath([norm_folder, full_path])
                    if common == norm_folder:
                        folder_index = i
                        rel_path = os.path.relpath(full_path, norm_folder)
                        rel_path = to_forward_slashes(rel_path)
                        break
                except ValueError:
                    continue

        if folder_index is None:
            # Last resort: treat the whole ckpt as relative to the first folder
            if folders:
                folder_index = 0
                rel_path = to_forward_slashes(ckpt)
            else:
                return web.json_response({"error": "No checkpoint folders found"}, status=400)

        # URL-encode each path segment (preserves the '/' separators)
        rel_path_encoded = "/".join(quote(seg) for seg in rel_path.split("/"))
        preview_url = f"/api/experiment/models/preview/checkpoints/{folder_index}/{rel_path_encoded}.webp?format=webp"
        return web.json_response({"url": preview_url})

    # Preview image extensions to look for, in priority order
    _PREVIEW_EXTS = (".webp", ".png", ".jpg", ".jpeg")

    @routes.get("/ultimate_loader/preview_image")
    async def get_preview_image(request):
        """
        Serve a checkpoint's preview image directly from disk, bypassing
        ComfyUI's private/experimental preview API. Looks for a file with
        the same name as the checkpoint but an image extension, sitting
        right next to it (e.g. mymodel.safetensors -> mymodel.webp).
        """
        ckpt = request.query.get("ckpt")
        if not ckpt:
            return web.Response(status=400, text="Missing ckpt")

        full_path = folder_paths.get_full_path("checkpoints", ckpt)
        if not full_path or not os.path.isfile(full_path):
            return web.Response(status=404, text="Checkpoint file not found")

        # Security: ensure resolved path is within a known checkpoint folder
        norm_path = os.path.normpath(full_path)
        folders = folder_paths.get_folder_paths("checkpoints")
        in_valid_folder = False
        for folder in folders:
            norm_folder = os.path.normpath(folder)
            try:
                if os.path.commonpath([norm_folder, norm_path]) == norm_folder:
                    in_valid_folder = True
                    break
            except ValueError:
                continue
        if not in_valid_folder:
            return web.Response(status=403, text="Path outside checkpoint directories")

        base, _ = os.path.splitext(full_path)
        for ext in _PREVIEW_EXTS:
            candidate = base + ext
            if os.path.isfile(candidate):
                return web.FileResponse(candidate)

        return web.Response(status=404, text="No preview image found next to checkpoint")

    @routes.post("/ultimate_loader/favorites/model")
    async def save_model_fav(request):
        try:
            data = await request.json()
            name = (data.get("name") or "").strip()
            ckpt = (data.get("ckpt") or "").strip()
            if not name or not ckpt:
                return web.json_response({"error": "Name and checkpoint required"}, status=400)
            if len(name) > 200:
                return web.json_response({"error": "Name too long (max 200 chars)"}, status=400)
            favs = _load_json(MODEL_FAV_FILE, {})
            favs[name] = ckpt
            _save_json(MODEL_FAV_FILE, favs)
            return web.json_response({"success": True, "favorites": favs})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/ultimate_loader/favorites/model/delete")
    async def delete_model_fav(request):
        try:
            data = await request.json()
            name = (data.get("name") or "").strip()
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            favs = _load_json(MODEL_FAV_FILE, {})
            if name in favs:
                del favs[name]
                _save_json(MODEL_FAV_FILE, favs)
                return web.json_response({"success": True, "favorites": favs})
            return web.json_response({"error": "Not found"}, status=404)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/ultimate_loader/favorites/size")
    async def save_size_preset(request):
        try:
            data = await request.json()
            name = (data.get("name") or "").strip()
            width = data.get("width")
            height = data.get("height")
            batch_size = data.get("batch_size", 1)
            if not name or width is None or height is None:
                return web.json_response({"error": "Name, width, height required"}, status=400)
            if len(name) > 200:
                return web.json_response({"error": "Name too long (max 200 chars)"}, status=400)
            width = int(width); height = int(height); batch_size = int(batch_size)
            presets = _load_json(SIZE_PRESET_FILE, {})
            presets[name] = {"width": width, "height": height, "batch_size": batch_size}
            _save_json(SIZE_PRESET_FILE, presets)
            return web.json_response({"success": True, "presets": presets})
        except (ValueError, TypeError) as e:
            return web.json_response({"error": f"Invalid numeric value: {e}"}, status=400)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/ultimate_loader/favorites/size/delete")
    async def delete_size_preset(request):
        try:
            data = await request.json()
            name = (data.get("name") or "").strip()
            if not name:
                return web.json_response({"error": "Name required"}, status=400)
            presets = _load_json(SIZE_PRESET_FILE, {})
            if name in presets:
                del presets[name]
                _save_json(SIZE_PRESET_FILE, presets)
                return web.json_response({"success": True, "presets": presets})
            return web.json_response({"error": "Not found"}, status=404)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

register_api_routes()

# ── Node class ─────────────────────────────────────────────────────────────

class UltimateLoader:
    """
    Ultimate Loader Pro — All‑in‑one checkpoint loader with favorites, aspect‑ratio presets, and hidden state.
    """

    @classmethod
    def INPUT_TYPES(cls):
        try:
            checkpoints = folder_paths.get_filename_list("checkpoints") or []
        except Exception:
            checkpoints = []
        try:
            vaes = folder_paths.get_filename_list("vae") or []
        except Exception:
            vaes = []

        model_favs = list(_load_json(MODEL_FAV_FILE, {}).keys())

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
        size_presets = _load_json(SIZE_PRESET_FILE, {})
        aspect_ratios.extend(list(size_presets.keys()))

        return {
            "required": {
                "ckpt_name": (checkpoints, {"default": checkpoints[0] if checkpoints else ""}),
                "model_action": (["Load Model", "Save Favorite", "Delete Favorite"], {"default": "Load Model"}),
                "model_preset": (["None"] + model_favs, {"default": "None"}),
                "fav_name": ("STRING", {"default": "My Main Model"}),
                "vae_name": (["Baked VAE"] + vaes, {"default": "Baked VAE"}),
                "clip_skip": ("INT", {"default": -1, "min": -24, "max": 0, "step": 1}),
                "aspect_ratio": (aspect_ratios, {"default": "1024 x 1024 [S] 1:1"}),
                "width": ("INT", {"default": 1024, "min": 64, "max": 8192}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 8192}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 32}),
            },
            "hidden": {
                "LoaderState": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "LATENT", "INT", "INT", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "VAE", "LATENT", "WIDTH", "HEIGHT", "STATUS")
    FUNCTION = "load"
    CATEGORY = "👑 Boss Nodes/📦 Loaders"

    @classmethod
    def IS_CHANGED(cls, LoaderState, **kwargs):
        return LoaderState

    def load(self, ckpt_name, model_action, model_preset, fav_name,
             vae_name, clip_skip, aspect_ratio, width, height, batch_size,
             LoaderState="{}"):

        try:
            state = json.loads(LoaderState) if isinstance(LoaderState, str) else {}
        except (json.JSONDecodeError, ValueError):
            state = {}
        if isinstance(state, dict):
            ckpt_name = state.get("ckpt_name", ckpt_name)
            model_action = state.get("model_action", model_action)
            model_preset = state.get("model_preset", model_preset)
            fav_name = state.get("fav_name", fav_name)
            vae_name = state.get("vae_name", vae_name)
            try:
                clip_skip = int(state.get("clip_skip", clip_skip))
            except (ValueError, TypeError):
                clip_skip = -1
            aspect_ratio = state.get("aspect_ratio", aspect_ratio)
            try:
                width = int(state.get("width", width))
            except (ValueError, TypeError):
                width = 1024
            try:
                height = int(state.get("height", height))
            except (ValueError, TypeError):
                height = 1024
            try:
                batch_size = int(state.get("batch_size", batch_size))
            except (ValueError, TypeError):
                batch_size = 1

        if model_preset != "None":
            model_favs = _load_json(MODEL_FAV_FILE, {})
            if model_preset in model_favs:
                ckpt_name = model_favs[model_preset]

        if model_action in ("Save Favorite", "Delete Favorite"):
            json_data = _load_json(MODEL_FAV_FILE, {})
            if model_action == "Save Favorite":
                if fav_name.strip():
                    json_data[fav_name] = ckpt_name
                    _save_json(MODEL_FAV_FILE, json_data)
                    status = f"Saved: {fav_name}"
                else:
                    status = "Error: Favorite name empty"
                return (None, None, None, None, width, height, status)
            else:
                if fav_name in json_data:
                    del json_data[fav_name]
                    _save_json(MODEL_FAV_FILE, json_data)
                    status = f"Deleted: {fav_name}"
                else:
                    status = "Error: Favorite not found"
                return (None, None, None, None, width, height, status)

        if aspect_ratio.startswith("width x height") or aspect_ratio.startswith("---"):
            pass
        else:
            match = re.search(r"(\d+)\s*x\s*(\d+)", aspect_ratio)
            if match:
                width = int(match.group(1))
                height = int(match.group(2))
            else:
                presets = _load_json(SIZE_PRESET_FILE, {})
                if aspect_ratio in presets:
                    p = presets[aspect_ratio]
                    width = p.get("width", width)
                    height = p.get("height", height)
                    batch_size = p.get("batch_size", batch_size)

        try:
            ckpt_path = folder_paths.get_full_path("checkpoints", ckpt_name)
            out = comfy.sd.load_checkpoint_guess_config(
                ckpt_path,
                output_vae=True,
                output_clip=True,
                embedding_directory=folder_paths.get_folder_paths("embeddings")
            )
            model, clip, vae = out[0], out[1], out[2]
        except Exception as e:
            return (None, None, None, None, width, height, f"Load error: {e}")

        if vae_name != "Baked VAE":
            try:
                vae_path = folder_paths.get_full_path("vae", vae_name)
                vae = comfy.sd.VAE(ckpt_path=vae_path)
            except Exception as e:
                return (model, clip, vae, None, width, height, f"VAE error: {e}")

        clip_skip_warning = ""
        if clip_skip != -1:
            try:
                clip_model = None
                if hasattr(model, "clip"):
                    clip_model = model.clip
                elif hasattr(model, "model") and hasattr(model.model, "clip"):
                    clip_model = model.model.clip
                if clip_model:
                    clip_model = clip_model.clone().clip(clip_skip)
                    if hasattr(model, "clip"):
                        model.clip = clip_model
                    elif hasattr(model, "model") and hasattr(model.model, "clip"):
                        model.model.clip = clip_model
                else:
                    clip_skip_warning = " | Warning: No clip model found for skip"
            except Exception as e:
                clip_skip_warning = f" | Warning: Clip Skip error: {e}"

        try:
            device = comfy.model_management.get_torch_device()
            latent = {
                "samples": torch.zeros([batch_size, 4, height // 8, width // 8], device=device)
            }
        except Exception as e:
            return (model, clip, vae, None, width, height, f"Latent error: {e}")

        status = f"Loaded: {ckpt_name} | VAE: {vae_name} | {width}x{height}{clip_skip_warning}"
        return (model, clip, vae, latent, width, height, status)

NODE_CLASS_MAPPINGS = {"UltimateLoader": UltimateLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"UltimateLoader": "Ultimate Loader Pro"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
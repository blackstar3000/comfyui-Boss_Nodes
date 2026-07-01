# ComfyUI/custom_nodes/ultimate_loader.py
# Ultimate Loader v3 - Hybrid Edition (Boss style)

import os
import json
import re
import torch
import folder_paths
import comfy.sd
import comfy.sample
import comfy.model_management

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
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                old = f.read()
            with open(path + ".bak", "w", encoding="utf-8") as f:
                f.write(old)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
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

    @routes.post("/ultimate_loader/favorites/model")
    async def save_model_fav(request):
        try:
            data = await request.json()
            name = (data.get("name") or "").strip()
            ckpt = (data.get("ckpt") or "").strip()
            if not name or not ckpt:
                return web.json_response({"error": "Name and checkpoint required"}, status=400)
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
            width = int(width); height = int(height); batch_size = int(batch_size)
            presets = _load_json(SIZE_PRESET_FILE, {})
            presets[name] = {"width": width, "height": height, "batch_size": batch_size}
            _save_json(SIZE_PRESET_FILE, presets)
            return web.json_response({"success": True, "presets": presets})
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

    This node loads a checkpoint (model + CLIP + baked VAE), optionally loads an external VAE,
    applies CLIP skip, and creates an empty latent with the chosen dimensions. It supports:

    - Model favorites: save/delete named shortcuts to your favourite checkpoints.
    - Aspect ratio presets: choose from a large set of TTN‑style presets or custom JSON‑defined presets.
    - Manual width/height override when using the custom option.
    - Hidden state (`LoaderState`) for UI synchronization (mirrors the Boss‑style stateful pattern).
    - REST API routes for fetching checkpoints/VAEs and managing favorites/presets.
    - Outputs: MODEL, CLIP, VAE, LATENT, WIDTH, HEIGHT, and a STATUS string.

    **Usage:**
    - Connect the outputs to your sampler and other nodes.
    - Select a checkpoint, VAE, and aspect ratio.
    - Use the `model_action` dropdown to save or delete a favorite (the node will return early with a status).
    - The `model_preset` allows you to load a favorite directly.
    - The `LoaderState` hidden input can be used by custom UIs to push/pull all widget values.

    The node also returns a status message indicating what was loaded or which action was performed.
    """
    DESCRIPTION = (
        "Ultimate Loader Pro — All‑in‑one checkpoint loader with favorites, aspect‑ratio presets, and hidden state.\n\n"
        "This node loads a checkpoint (model + CLIP + baked VAE), optionally loads an external VAE,\n"
        "applies CLIP skip, and creates an empty latent with the chosen dimensions. It supports:\n\n"
        "- Model favorites: save/delete named shortcuts to your favourite checkpoints.\n"
        "- Aspect ratio presets: choose from a large set of TTN‑style presets or custom JSON‑defined presets.\n"
        "- Manual width/height override when using the custom option.\n"
        "- Hidden state (`LoaderState`) for UI synchronization (mirrors the Boss‑style stateful pattern).\n"
        "- REST API routes for fetching checkpoints/VAEs and managing favorites/presets.\n"
        "- Outputs: MODEL, CLIP, VAE, LATENT, WIDTH, HEIGHT, and a STATUS string.\n\n"
        "**Usage:**\n"
        "- Connect the outputs to your sampler and other nodes.\n"
        "- Select a checkpoint, VAE, and aspect ratio.\n"
        "- Use the `model_action` dropdown to save or delete a favorite (the node will return early with a status).\n"
        "- The `model_preset` allows you to load a favorite directly.\n"
        "- The `LoaderState` hidden input can be used by custom UIs to push/pull all widget values.\n\n"
        "The node also returns a status message indicating what was loaded or which action was performed."
    )

    @classmethod
    def INPUT_TYPES(cls):
        # Dynamic lists (re‑evaluated each time)
        try:
            checkpoints = folder_paths.get_filename_list("checkpoints") or []
        except:
            checkpoints = []
        try:
            vaes = folder_paths.get_filename_list("vae") or []
        except:
            vaes = []

        model_favs = list(_load_json(MODEL_FAV_FILE, {}).keys())

        # Build aspect ratio dropdown with TTN presets + JSON presets
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
        # Re‑execute when the JS state changes
        return LoaderState

    def load(self, ckpt_name, model_action, model_preset, fav_name,
             vae_name, clip_skip, aspect_ratio, width, height, batch_size,
             LoaderState="{}"):

        # ── Parse hidden state (override widgets) ─────────────────────────
        try:
            state = json.loads(LoaderState) if isinstance(LoaderState, str) else {}
        except:
            state = {}
        if isinstance(state, dict):
            # Override all inputs with state values if present
            ckpt_name = state.get("ckpt_name", ckpt_name)
            model_action = state.get("model_action", model_action)
            model_preset = state.get("model_preset", model_preset)
            fav_name = state.get("fav_name", fav_name)
            vae_name = state.get("vae_name", vae_name)
            clip_skip = int(state.get("clip_skip", clip_skip))
            aspect_ratio = state.get("aspect_ratio", aspect_ratio)
            width = int(state.get("width", width))
            height = int(state.get("height", height))
            batch_size = int(state.get("batch_size", batch_size))

        # ── Resolve model from preset if needed ──────────────────────────
        if model_preset != "None":
            model_favs = _load_json(MODEL_FAV_FILE, {})
            if model_preset in model_favs:
                ckpt_name = model_favs[model_preset]

        # ── Handle model favorite actions ─────────────────────────────────
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
            else:  # Delete
                if fav_name in json_data:
                    del json_data[fav_name]
                    _save_json(MODEL_FAV_FILE, json_data)
                    status = f"Deleted: {fav_name}"
                else:
                    status = "Error: Favorite not found"
                return (None, None, None, None, width, height, status)

        # ── Resolve aspect ratio ──────────────────────────────────────────
        if aspect_ratio.startswith("width x height") or aspect_ratio.startswith("---"):
            pass  # use manual width/height
        else:
            # Try to parse TTN string first
            match = re.search(r"(\d+)\s*x\s*(\d+)", aspect_ratio)
            if match:
                width = int(match.group(1))
                height = int(match.group(2))
            else:
                # Try JSON preset
                presets = _load_json(SIZE_PRESET_FILE, {})
                if aspect_ratio in presets:
                    p = presets[aspect_ratio]
                    width = p.get("width", width)
                    height = p.get("height", height)
                    batch_size = p.get("batch_size", batch_size)

        # ── Load checkpoint ──────────────────────────────────────────────
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

        # ── Load external VAE ─────────────────────────────────────────────
        if vae_name != "Baked VAE":
            try:
                vae_path = folder_paths.get_full_path("vae", vae_name)
                vae = comfy.sd.VAE(ckpt_path=vae_path)
            except Exception as e:
                return (model, clip, vae, None, width, height, f"VAE error: {e}")

        # ── Clip Skip ────────────────────────────────────────────────────
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

        # ── Latent ──────────────────────────────────────────────────────
        try:
            device = comfy.model_management.get_torch_device()
            latent = {
                "samples": torch.zeros([batch_size, 4, height // 8, width // 8], device=device)
            }
        except Exception as e:
            return (model, clip, vae, None, width, height, f"Latent error: {e}")

        status = f"Loaded: {ckpt_name} | VAE: {vae_name} | {width}x{height}"
        return (model, clip, vae, latent, width, height, status)


NODE_CLASS_MAPPINGS = {"UltimateLoader": UltimateLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"UltimateLoader": "Ultimate Loader Pro"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
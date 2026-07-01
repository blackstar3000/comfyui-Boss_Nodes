# ComfyUI/custom_nodes/ultimate_k_sampler_pro.py
# ULTIMATE KSampler Pro — with hidden state + API routes (Boss style)

import json
import os
import folder_paths
from nodes import common_ksampler, VAEDecode
import comfy.samplers

# ── Constants ───────────────────────────────────────────────────────────────

PRESETS = {
    "Fast": {"sampler_name": "euler", "scheduler": "normal", "steps": 20, "cfg": 7.0},
    "Balanced": {"sampler_name": "dpmpp_2m", "scheduler": "karras", "steps": 28, "cfg": 7.5},
    "High Quality": {"sampler_name": "dpmpp_3m_sde", "scheduler": "karras", "steps": 40, "cfg": 8.0},
    "Anime": {"sampler_name": "dpmpp_2m", "scheduler": "karras", "steps": 25, "cfg": 6.0},
    "Anime V2": {"sampler_name": "euler_ancestral", "scheduler": "karras", "steps": 20, "cfg": 7.0},
    "Cinematic": {"sampler_name": "dpmpp_2m_sde", "scheduler": "karras", "steps": 35, "cfg": 8.5},
    "Experimental": {"sampler_name": "uni_pc", "scheduler": "normal", "steps": 30, "cfg": 7.0},
}

CFG_PRESETS = {
    "None": None,
    "Low Creativity": 4.0,
    "Creative": 6.0,
    "Balanced": 7.5,
    "Strong Prompt": 9.0,
    "Very Strong": 12.0,
}

FAVORITES_FILE = os.path.join(os.path.dirname(__file__), "ksampler_favorites.json")

# ── Favorites I/O ───────────────────────────────────────────────────────────

def _load_favorites():
    if not os.path.exists(FAVORITES_FILE):
        return {}
    try:
        with open(FAVORITES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("favorites", {})
    except Exception:
        return {}

def _save_favorites(favorites):
    try:
        if os.path.exists(FAVORITES_FILE):
            with open(FAVORITES_FILE, "r", encoding="utf-8") as f:
                old = f.read()
            with open(FAVORITES_FILE + ".bak", "w", encoding="utf-8") as f:
                f.write(old)
        with open(FAVORITES_FILE, "w", encoding="utf-8") as f:
            json.dump({"favorites": favorites}, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False

def _get_preset(name):
    if name in PRESETS:
        return PRESETS[name]
    fav = _load_favorites()
    if name in fav:
        return fav[name]
    return PRESETS["Balanced"]

# ── API routes ──────────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/ksampler/favorites")
    async def get_favorites(request):
        return web.json_response(_load_favorites())

    @routes.post("/ksampler/favorites")
    async def save_favorite(request):
        try:
            data = await request.json()
        except:
            return web.json_response({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        if not name:
            return web.json_response({"error": "Name required"}, status=400)
        if name in PRESETS:
            return web.json_response({"error": "Cannot overwrite built‑in preset"}, status=400)
        settings = data.get("settings")
        if not isinstance(settings, dict):
            return web.json_response({"error": "Settings object required"}, status=400)
        favs = _load_favorites()
        favs[name] = settings
        _save_favorites(favs)
        return web.json_response({"success": True, "favorites": favs})

    @routes.delete("/ksampler/favorites")
    async def delete_favorite(request):
        try:
            data = await request.json()
        except:
            return web.json_response({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        if not name:
            return web.json_response({"error": "Name required"}, status=400)
        favs = _load_favorites()
        if name in favs:
            del favs[name]
            _save_favorites(favs)
            return web.json_response({"success": True, "favorites": favs})
        return web.json_response({"error": "Not found"}, status=404)

register_api_routes()

# ── Node class ──────────────────────────────────────────────────────────────

class UltimateKSamplerPro:
    @classmethod
    def INPUT_TYPES(cls):
        favorites = _load_favorites()
        preset_list = ["--- Built-in ---"] + list(PRESETS.keys())
        if favorites:
            preset_list += ["--- Favorites ---"] + list(favorites.keys())

        return {
            "required": {
                "preset": (preset_list, {"default": "Balanced"}),
                "cfg_preset": (list(CFG_PRESETS.keys()), {"default": "None"}),
                "steps": ("INT", {"default": 28, "min": 1, "max": 10000}),
                "cfg": ("FLOAT", {"default": 7.5, "min": 0.0, "max": 100.0, "step": 0.1}),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS, {"default": "dpmpp_2m"}),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS, {"default": "karras"}),
                "model": ("MODEL",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent_image": ("LATENT",),
                "vae": ("VAE",),
                "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "override_preset": ("BOOLEAN", {"default": False}),
                "save_as_favorite": ("BOOLEAN", {
                    "default": False,
                    "label_on": "ON",
                    "label_off": "OFF",
                }),
                "favorite_name": ("STRING", {"default": ""}),
            },
            "hidden": {
                "KSamplerState": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ("LATENT", "IMAGE")
    RETURN_NAMES = ("latent", "image")
    FUNCTION = "sample"
    CATEGORY = "👑 Boss Nodes/🧬 Sampling"

    @classmethod
    def IS_CHANGED(cls, KSamplerState, **kwargs):
        # Re‑execute when the JS state changes
        return KSamplerState

    def sample(self, model, positive, negative, latent_image, vae,
               preset="Balanced", cfg_preset="None",
               steps=28, cfg=7.5, sampler_name="dpmpp_2m", scheduler="karras",
               denoise=1.0, seed=0, override_preset=False,
               save_as_favorite=False, favorite_name="",
               KSamplerState="{}"):

        # ── Parse hidden state ────────────────────────────────────────────
        try:
            state = json.loads(KSamplerState) if isinstance(KSamplerState, str) else {}
        except:
            state = {}
        if isinstance(state, dict):
            # Override widget values with state if present
            if "preset" in state and state["preset"]:
                preset = state["preset"]
            if "cfg_preset" in state and state["cfg_preset"]:
                cfg_preset = state["cfg_preset"]
            if "steps" in state:
                steps = int(state["steps"])
            if "cfg" in state:
                cfg = float(state["cfg"])
            if "sampler_name" in state and state["sampler_name"]:
                sampler_name = state["sampler_name"]
            if "scheduler" in state and state["scheduler"]:
                scheduler = state["scheduler"]
            if "denoise" in state:
                denoise = float(state["denoise"])
            if "seed" in state:
                seed = int(state["seed"])
            if "override_preset" in state:
                override_preset = bool(state["override_preset"])
            if "save_as_favorite" in state:
                save_as_favorite = bool(state["save_as_favorite"])
            if "favorite_name" in state:
                favorite_name = state["favorite_name"]

        # ── Save favorite if requested ──────────────────────────────────
        if save_as_favorite and favorite_name.strip():
            name = favorite_name.strip()
            if name in PRESETS:
                print(f"[Ultimate KSampler] Cannot save built‑in '{name}'")
            else:
                favs = _load_favorites()
                favs[name] = {
                    "sampler_name": sampler_name,
                    "scheduler": scheduler,
                    "steps": steps,
                    "cfg": cfg,
                }
                _save_favorites(favs)
                print(f"✓ Saved favorite: {name}")

        # ── Resolve effective parameters ──────────────────────────────
        if override_preset:
            # Use manual values
            eff_sampler = sampler_name
            eff_scheduler = scheduler
            eff_steps = steps
            eff_cfg = cfg if cfg_preset == "None" else CFG_PRESETS.get(cfg_preset, cfg)
        else:
            p = _get_preset(preset)
            eff_sampler = p["sampler_name"]
            eff_scheduler = p["scheduler"]
            eff_steps = p["steps"]
            if cfg_preset != "None":
                eff_cfg = CFG_PRESETS[cfg_preset]
            else:
                eff_cfg = p["cfg"]

        # ── Run sampler ─────────────────────────────────────────────────
        result = common_ksampler(
            model=model,
            seed=seed,
            steps=eff_steps,
            cfg=eff_cfg,
            sampler_name=eff_sampler,
            scheduler=eff_scheduler,
            positive=positive,
            negative=negative,
            latent=latent_image,
            denoise=denoise,
            disable_noise=False,
            start_step=0,
            last_step=eff_steps,
            force_full_denoise=True
        )
        latent_out = result[0]

        # ── Decode ──────────────────────────────────────────────────────
        decoder = VAEDecode()
        image_out = decoder.decode(samples=latent_out, vae=vae)[0]

        # ── UI preview ─────────────────────────────────────────────────
        favs = _load_favorites()
        status = f"{len(favs)} favorites" if favs else "No favorites"
        preview_lines = [
            f"🎯 Preset: {preset}",
            f"⚙️ {eff_sampler} | {eff_scheduler}",
            f"📊 Steps: {eff_steps} | CFG: {eff_cfg:.1f} | Denoise: {denoise:.2f}",
            f"🌱 Seed: {seed if seed != 0 else 'Random'}",
            f"⭐ {status}"
        ]
        return {"result": (latent_out, image_out), "ui": {"text": preview_lines}}


NODE_CLASS_MAPPINGS = {"UltimateKSamplerPro": UltimateKSamplerPro}
NODE_DISPLAY_NAME_MAPPINGS = {"UltimateKSamplerPro": "🧬 Ultimate KSampler Pro"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
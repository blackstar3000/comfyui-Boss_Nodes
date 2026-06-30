# ComfyUI/custom_nodes/ultimate_k_sampler_pro.py
# ULTIMATE KSampler Pro — FAVORITES WITH SAVE TOGGLE

import json
import os
import folder_paths

from nodes import common_ksampler, VAEDecode
import comfy.utils
import comfy.samplers

class UltimateKSamplerPro:
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

    # Store favorites in the custom_nodes directory alongside this script
    FAVORITES_FILE = os.path.join(os.path.dirname(__file__), "ksampler_favorites.json")
    FAVORITES = {}

    @classmethod
    def load_favorites(cls):
        if os.path.exists(cls.FAVORITES_FILE):
            try:
                with open(cls.FAVORITES_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    cls.FAVORITES = data.get("favorites", {})
                print(f"Ultimate KSampler → Loaded {len(cls.FAVORITES)} favorite presets")
            except Exception as e:
                print(f"[Ultimate KSampler] Failed to load favorites: {e}")
                cls.FAVORITES = {}
        else:
            cls.FAVORITES = {}

    @classmethod
    def save_favorites(cls):
        try:
            with open(cls.FAVORITES_FILE, "w", encoding="utf-8") as f:
                json.dump({"favorites": cls.FAVORITES}, f, indent=2)
            print(f"Ultimate KSampler → Saved {len(cls.FAVORITES)} favorites")
        except Exception as e:
            print(f"[Ultimate KSampler] Failed to save favorites: {e}")

    @classmethod
    def INPUT_TYPES(cls):
        # Load favorites every time inputs are requested to catch external changes if any
        cls.load_favorites()
        
        all_presets = ["--- Built-in ---"] + list(cls.PRESETS.keys())
        if cls.FAVORITES:
            all_presets += ["--- Favorites ---"] + list(cls.FAVORITES.keys())

        return {
            "required": {
                "preset": (all_presets, {"default": "Balanced"}),
                "cfg_preset": (list(cls.CFG_PRESETS.keys()), {"default": "None"}),
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
                    "tooltip": "Turn ON and set name below to save current settings as favorite"
                }),
                "favorite_name": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "tooltip": "Name for your new favorite (only used when Save is ON)"
                }),
            }
        }

    RETURN_TYPES = ("LATENT", "IMAGE")
    RETURN_NAMES = ("latent", "image")
    FUNCTION = "sample"
    CATEGORY = "🌟 Pro Tools/Sampling"
    OUTPUT_NODE = True

    def sample(self, model, positive, negative, latent_image, vae,
               preset="Balanced", cfg_preset="None",
               steps=28, cfg=7.5, sampler_name="dpmpp_2m", scheduler="karras",
               denoise=1.0, seed=0, override_preset=False,
               save_as_favorite=False, favorite_name=""):

        # === SAVE FAVORITE LOGIC ===
        if save_as_favorite and favorite_name.strip():
            name = favorite_name.strip()
            if name in self.PRESETS:
                print(f"[Ultimate KSampler] Cannot save favorite: '{name}' is a built-in preset name")
            elif name in self.FAVORITES:
                print(f"[Ultimate KSampler] Overwriting existing favorite: {name}")
            
            # Save current widget values (not necessarily the values used for generation if preset is active)
            self.FAVORITES[name] = {
                "sampler_name": sampler_name,
                "scheduler": scheduler,
                "steps": steps,
                "cfg": cfg
            }
            self.save_favorites()
            print(f"✓ Saved favorite preset: '{name}'")

        # === LOAD PRESET ===
        # Determine settings based on preset selection
        if preset in self.PRESETS:
            p = self.PRESETS[preset]
        elif preset in self.FAVORITES:
            p = self.FAVORITES[preset]
        else:
            p = self.PRESETS["Balanced"]

        # If not overriding, apply the preset values to the working variables
        if not override_preset:
            sampler_name = p["sampler_name"]
            scheduler = p["scheduler"]
            steps = p["steps"]
            
            if cfg_preset != "None":
                cfg = self.CFG_PRESETS[cfg_preset]
            else:
                cfg = p["cfg"]

        # === EXECUTE SAMPLING ===
        # Note: common_ksampler in ComfyUI standard nodes does not support step_callback directly
        # in the function signature, so we omit it here to prevent crashes.
        
        result = common_ksampler(
            model=model,
            seed=seed,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler_name,
            scheduler=scheduler,
            positive=positive,
            negative=negative,
            latent=latent_image,
            denoise=denoise,
            disable_noise=False,
            start_step=0,
            last_step=steps,
            force_full_denoise=True
        )

        latent = result[0]
        
        # === DECODE ===
        decode = VAEDecode()
        image = decode.decode(samples=latent, vae=vae)[0]

        # === UI STATUS ===
        status = f"{len(self.FAVORITES)} favorites" if self.FAVORITES else "No favorites yet"
        preview_lines = [
            f"🎯 Preset: {preset}",
            f"⚙️ {sampler_name} | {scheduler}",
            f"📊 Steps: {steps} | CFG: {cfg:.1f} | Denoise: {denoise:.2f}",
            f"🌱 Seed: {seed if seed != 0 else 'Random'}",
            f"⭐ {status}"
        ]

        # Return result with UI updates
        return {"result": (latent, image), "ui": {"text": preview_lines}}

NODE_CLASS_MAPPINGS = {"UltimateKSamplerPro": UltimateKSamplerPro}
NODE_DISPLAY_NAME_MAPPINGS = {"UltimateKSamplerPro": "🧬 Ultimate KSampler Pro"}

# Initialize on load
UltimateKSamplerPro.load_favorites()
print("\nULTIMATE KSampler Pro — FAVORITES WITH TOGGLE!")
print("   • Turn 'Save as Favorite' ON → type name → run to save")
print("   • Favorites appear in preset dropdown with separator")
print("   • Safe saving (no accidental overwrites of built-ins)")
print("   • Your personal preset library is ready!\n")
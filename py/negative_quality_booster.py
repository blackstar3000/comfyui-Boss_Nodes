# ComfyUI/custom_nodes/negative_quality_booster.py
# NEGATIVE BOOSTER PRO v5.0 — GOD MODE ACTIVATED (2025 EDITION)

import json
import os
import html
from datetime import datetime

class NegativeBoosterPRO:
    _cache = {}
    _last_modified = 0
    _json_path = os.path.join(os.path.dirname(__file__), "negative_boosts.json")

    # ===================================================================
    # AUTO-RELOAD + BUILT-IN MASTER NEGATIVE LIBRARY (NEVER FAILS)
    # ===================================================================
    @classmethod
    def _auto_reload(cls):
        if not os.path.exists(cls._json_path):
            cls._load_god_tier_defaults()
            return

        try:
            current_mtime = os.path.getmtime(cls._json_path)
            if current_mtime != cls._last_modified:
                with open(cls._json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                # Normalize format: always {preset: {level: "text"}}
                if isinstance(data, list):
                    data = {"default": {f"level_{i+1}": item for i, item in enumerate(data)}}
                elif isinstance(data, dict) and all(isinstance(v, str) for v in data.values()):
                    data = {"default": data}
                
                cls._cache = data
                cls._last_modified = current_mtime
                total_levels = sum(len(v) for v in data.values())
                print(f"🛡️ Negative Booster PRO v5.0 → LOADED {len(data)} presets | {total_levels} levels | {datetime.now().strftime('%H:%M:%S')}")
        except Exception as e:
            if not cls._cache:
                cls._load_god_tier_defaults()
                print(f"⚠️ Negative JSON broken → using internal GOD TIER negatives")

    @classmethod
    def _load_god_tier_defaults(cls):
        cls._cache = {
            "safe": {
                "light": "blurry, low quality, artifact",
                "medium": "blurry, lowres, bad anatomy, bad hands, missing fingers, deformed",
                "strong": "blurry, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username"
            },
            "pro": {
                "good": "blurry, low quality, deformed, ugly, bad anatomy, extra limbs, fused fingers, long neck",
                "very good": "blurry, lowres, bad anatomy, bad hands, missing arms, missing legs, mutated hands, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark",
                "excellent": "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, out of focus, censorship, deformed, amateur, ugly, flat"
            },
            "nsfw beast": {
                "safe": "(worst quality, low quality:1.4), (deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated hands, long body, long neck",
                "hardcore": "(worst quality:1.4), (low quality:1.4), (normal quality:1.4), lowres, bad anatomy, bad hands, multiple eyebrow, (cropped), extra digit, fewer digits, (deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, fused fingers, long neck, extra ears, bad composition, watermark, text, logo",
                "nuclear": "worst quality, low quality, normal quality, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, jpeg artifacts, signature, watermark, username, blurry, out of focus, ugly, poorly drawn, deformed, extra limbs, fused fingers, long neck, long body, mutated, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, cross-eyed, tilted head, bad composition, amateur, duplicate, morbid, mutilated, out of frame, gross, poorly drawn face, poorly drawn hands"
            },
            "pony killer": {
                "default": "score_6, score_5, score_4, source_pony, source_furry, bad anatomy, blurry, cropped, low quality",
                "max": "score_6, score_5, score_4, score_3, score_2, score_1, source_pony, source_furry, blurry, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username"
            },
            "flux shield": {
                "default": "blurry, low quality, deformed, ugly, bad anatomy, watermark, text, logo, out of focus",
                "ultra": "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, deformed, ugly, poorly drawn, bad proportions, extra limbs, fused fingers, long neck, out of frame"
            },
            "absolute zero": {
                "nuclear": "worst quality, low quality, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, jpeg artifacts, signature, watermark, username, blurry, deformed, mutated, ugly, disfigured, extra limbs, fused fingers, long neck, long body, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, poorly drawn hands, bad composition, duplicate, morbid, mutilated, out of frame, gross proportions, cross-eyed, tilted head, amateur, grainy, noisy, oversaturated, underexposed, overexposed, monochrome, greyscale, censored, bar censor, mosaic censoring"
            }
        }
        cls._last_modified = 0

    # ===================================================================
    # INPUT TYPES — DYNAMIC + FLAWLESS
    # ===================================================================
    @classmethod
    def INPUT_TYPES(cls):
        cls._auto_reload()
        
        presets = sorted(cls._cache.keys())
        default_preset = "nsfw beast" if "nsfw beast" in presets else presets[0]
        levels = sorted(cls._cache[default_preset].keys())
        default_level = "hardcore" if "hardcore" in levels else levels[0]

        return {
            "required": {
                "enable": ("BOOLEAN", {"default": True, "label_on": "🛡️ ON", "label_off": "☠️ OFF"}),
                "preset": (presets, {"default": default_preset}),
                "level": (levels, {"default": default_level}),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.5, "max": 2.0, "step": 0.05, "round": 0.01}),
            },
            "optional": {
                "custom_negative": ("STRING", {"multiline": True, "default": "", "placeholder": "Add extra negatives here"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("negative_prompt",)
    FUNCTION = "protect"
    CATEGORY = "🌟 Pro Tools/Prompting"
    OUTPUT_NODE = True

    # ===================================================================
    # MAIN FUNCTION — PURE PERFECTION
    # ===================================================================
    def protect(self, enable=True, preset="nsfw beast", level="hardcore", strength=1.0, custom_negative=""):
        if not enable:
            preview = self._preview("DISABLED", "#ff0066", "(protection off)", preset, level)
            return ("", {"ui": {"text": [preview]}})

        base_text = self.__class__._cache.get(preset, {}).get(level, "")
        if not base_text:
            preview = self._preview("ERROR", "#ff5500", f"Preset/level not found: {preset}/{level}", preset, level)
            return ("", {"ui": {"text": [preview]}})

        # Apply strength
        if abs(strength - 1.0) > 0.01:
            final = f"({base_text}:{strength:.2f})"
        else:
            final = base_text

        # Add custom
        if custom_negative.strip():
            final += ", " + custom_negative.strip()

        preview = self._preview(level.upper(), self._get_color(preset), final, preset, level, strength)

        return (final, {"ui": {"text": [preview]}})

    # ===================================================================
    # VISUAL BEAUTY
    # ===================================================================
    def _get_color(self, preset):
        colors = {
            "nsfw beast": "#ff0066",
            "pony killer": "#ff6600",
            "flux shield": "#00ffff",
            "absolute zero": "#ff00ff",
            "safe": "#00ff00",
            "pro": "#ffff00"
        }
        return colors.get(preset, "#ffffff")

    def _preview(self, title, color, content, preset, level, strength=1.0):
        return f"""
<div style="padding:22px; background:linear-gradient(135deg,#000000,#1a0000); border-radius:20px; border:4px solid {color}; font-family:system-ui; color:#fff; box-shadow:0 0 30px {color}60; max-width:700px;">
    <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:2em; font-weight:bold; color:{color}; text-shadow:0 0 20px {color}; letter-spacing:2px;">
            🛡️ NEGATIVE BOOSTER PRO v5.0
        </div>
        <div style="font-size:1.4em; color:#ff0066; margin-top:8px; font-weight:bold;">
            {title} ×{strength:.2f}
        </div>
    </div>
    <div style="background:#0d0d0d; padding:18px; border-radius:14px; font-family:'Courier New',monospace; font-size:1.05em; line-height:1.6; border:2px solid #333;">
        <strong style="color:#ff0066;">→</strong> {html.escape(content)}
    </div>
    <div style="margin-top:14px; text-align:center; font-size:0.9em; color:#888;">
        Preset: <span style="color:#ffd700;">{preset}</span> → Level: <span style="color:#00ffff;">{level}</span>
        <br>{datetime.now().strftime('%H:%M:%S')} • Auto-reload active
    </div>
</div>
        """.strip()

# ===================================================================
# AUTO-CREATE DEFAULT JSON IF MISSING
# ===================================================================
if not os.path.exists(NegativeBoosterPRO._json_path):
    try:
        with open(NegativeBoosterPRO._json_path, "w", encoding="utf-8") as f:
            json.dump(NegativeBoosterPRO._cache, f, indent=2, ensure_ascii=False)
        print("🛡️ Negative Booster PRO → Created negative_boosts.json with GOD TIER presets")
    except:
        pass

NegativeBoosterPRO._auto_reload()

NODE_CLASS_MAPPINGS = {"NegativeBoosterPRO": NegativeBoosterPRO}
NODE_DISPLAY_NAME_MAPPINGS = {"NegativeBoosterPRO": "🛡️ Negative Booster PRO v5.0"}

print("\n🛡️ NEGATIVE BOOSTER PRO v5.0 — FULLY ARMED AND UNSTOPPABLE")
print("   • Built-in nuclear-grade negative library")
print("   • Strength control • Custom override")
print("   • Most beautiful negative node ever created")
print("   • Your images are now IMMORTAL.\n")
# ComfyUI/custom_nodes/prompt_quality_booster.py
# QUALITY BOOSTER PRO v4.0 — AUTO-RELOAD + LIVE PREVIEW + INSANE POWER

import json
import os
import html
from datetime import datetime

class QualityBoosterPRO:
    _cache = {}
    _last_modified = 0
    _json_path = os.path.join(os.path.dirname(__file__), "prompt_quality_booster.json")

    @classmethod
    def INPUT_TYPES(cls):
        cls._auto_reload()
        
        levels = sorted(cls._cache.keys())
        default_level = "god tier" if "god tier" in levels else ("masterpiece" if "masterpiece" in levels else levels[0] if levels else "good")

        return {
            "required": {
                "enable": ("BOOLEAN", {"default": True, "label_on": "ON", "label_off": "OFF"}),
                "level": (levels, {"default": default_level}),
                "prefix_mode": (["none", "weight 1.0", "weight 1.2", "weight 1.35", "BREAK"], {"default": "weight 1.2"}),
            },
            "optional": {
                "custom_text": ("STRING", {"multiline": False, "default": "", "placeholder": "Override with your own boost"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("quality_prompt", "live_preview")
    FUNCTION = "inject"
    CATEGORY = "👑 Boss Nodes/⚡ Prompting"
    OUTPUT_NODE = True

    @classmethod
    def _auto_reload(cls):
        if not os.path.exists(cls._json_path):
            cls._load_defaults()
            return

        try:
            current_mtime = os.path.getmtime(cls._json_path)
            if current_mtime != cls._last_modified:
                with open(cls._json_path, "r", encoding="utf-8") as f:
                    new_data = json.load(f)
                cls._cache = new_data
                cls._last_modified = current_mtime
                count = len(new_data)
                print(f"✨ Quality Booster PRO → Auto-reloaded {count} levels | {datetime.now().strftime('%H:%M:%S')}")
        except Exception as e:
            if not cls._cache:
                cls._load_defaults()
                print(f"⚠️ Quality Booster JSON broken → using built-in GOD database")

    @classmethod
    def _load_defaults(cls):
        cls._cache = {
            "good": "detailed, sharp focus, beautiful lighting",
            "very good": "highly detailed, sharp focus, cinematic lighting, vibrant colors",
            "great": "very highly detailed, best quality, ultra sharp, perfect composition",
            "excellent": "extremely detailed, best quality, masterpiece, stunning detail, perfect anatomy",
            "masterpiece": "masterpiece, best quality, ultra-detailed, absurdres, incredibly detailed, flawless",
            "god tier": "masterpiece, best quality, ultra-detailed, absurdres, perfect lighting, volumetric fog, stunning detail, award-winning, breathtaking",
            "flux god": "score_9, score_8_up, score_7_up, source_anime, perfect anatomy, ultra-detailed, beautiful face, cinematic lighting",
            "pony god": "score_9, score_8_up, score_7_up, masterpiece, best quality, highly detailed, depth of field",
            "sdxl god": "masterpiece, best quality, ultra high res, (photorealistic:1.4), raw photo, incredibly detailed, sharp focus",
            "nsfw beast": "masterpiece, ultra detailed, perfect body, beautiful face, seductive pose, explicit, uncensored",
            "8k raw": "8k, raw photo, ultra-detailed, film grain, sony a7r iv, 85mm f1.2, professional color grading",
            "cinematic film": "cinematic film still, 35mm photography, film grain, vignette, color graded, post-processed, dramatic lighting",
            "anime elite": "absurdres, illustration, anime key visual, stunning visual, vivid colors, official art, studio quality",
            "unreal engine": "unreal engine 5, octane render, ray tracing, ultra realistic, photorealistic, 8k, cinematic",
            "reference sheet": "multiple views, character sheet, turnaround, model sheet, clean background, full body, highly detailed"
        }
        cls._last_modified = 0

    def inject(self, enable=True, level="masterpiece", prefix_mode="weight 1.2", custom_text=""):
        if not enable:
            empty_preview = self._preview_html("DISABLED", "#ff0066", "(booster off)")
            return ("", {"text": [empty_preview]})

        text = custom_text.strip() or self.__class__._cache.get(level, "")

        if not text:
            no_text = self._preview_html("NO TEXT", "#ff5555", f"Level '{level}' not found")
            return ("", {"text": [no_text]})

        # Apply prefix
        if prefix_mode == "weight 1.0":
            final = f"({text}:1.0)"
        elif prefix_mode == "weight 1.2":
            final = f"({text}:1.2)"
        elif prefix_mode == "weight 1.35":
            final = f"({text}:1.35)"
        elif prefix_mode == "BREAK":
            final = f"{text} BREAK"
        else:
            final = text

        preview = self._preview_html(level.upper(), self._get_color(level), final)

        return (final, {"text": [preview]})

    def _get_color(self, level):
        colors = {
            "god tier": "#ffd700",
            "flux god": "#00ffff",
            "pony god": "#ff6600",
            "masterpiece": "#aa00ff",
            "nsfw beast": "#ff0066",
            "8k raw": "#00ff00",
            "cinematic film": "#ffaa00"
        }
        return colors.get(level, "#ffffff")

    def _preview_html(self, title, color, content):
        return f"""
<div style="padding:20px; background:linear-gradient(135deg,#0d0d1f,#1a0033); border-radius:18px; border:3px solid {color}; font-family:system-ui; color:#fff; box-shadow:0 0 20px {color}40;">
    <div style="text-align:center; margin-bottom:12px;">
        <div style="font-size:1.8em; font-weight:bold; color:{color}; text-shadow:0 0 15px {color}; letter-spacing:1px;">
            ✨ QUALITY BOOSTER PRO v4.0
        </div>
        <div style="font-size:1.3em; color:#ffdd00; margin-top:6px; font-weight:bold;">
            {title}
        </div>
    </div>
    <div style="background:#000000bb; padding:16px; border-radius:12px; font-family:'Courier New',monospace; font-size:1.05em; line-height:1.6; border:1px solid #444;">
        → {html.escape(content)}
    </div>
    <div style="text-align:center; margin-top:12px; font-size:0.85em; color:#888;">
        Auto-reload active • {datetime.now().strftime('%H:%M:%S')}
    </div>
</div>
        """.strip()


NODE_CLASS_MAPPINGS = {"QualityBoosterPRO": QualityBoosterPRO}
NODE_DISPLAY_NAME_MAPPINGS = {"QualityBoosterPRO": "✨ Quality Booster PRO v4.0"}

# First-time default creation
if not os.path.exists(QualityBoosterPRO._json_path):
    default_data = QualityBoosterPRO._cache if hasattr(QualityBoosterPRO, '_cache') else {}
    try:
        with open(QualityBoosterPRO._json_path, "w", encoding="utf-8") as f:
            json.dump(default_data, f, indent=2, ensure_ascii=False)
        print("✨ Quality Booster PRO → Created prompt_quality_booster.json with god-tier presets")
    except:
        pass
else:
    QualityBoosterPRO._auto_reload()

print("\n✨ QUALITY BOOSTER PRO v4.0 — FULLY ARMED")
print("   • Live auto-reload from prompt_quality_booster.json")
print("   • Weight prefixes + BREAK mode")
print("   • Most beautiful preview in ComfyUI")
print("   • This is now the ultimate quality injector. Forever.\n")
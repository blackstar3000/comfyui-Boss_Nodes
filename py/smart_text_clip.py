# ComfyUI/custom_nodes/smart_text_clip_encode.py
# Smart Text CLIP Encode Pro — BOSS EDITION with UI.

import json
import comfy.sd
import torch

class SmartTextClipEncode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "positive_text": ("STRING", {"multiline": True, "default": "", "placeholder": "Positive prompt…"}),
                "negative_text": ("STRING", {"multiline": True, "default": "", "placeholder": "Negative prompt…"}),
            },
            "optional": {
                "module": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "placeholder": "Prefix (e.g. masterpiece, best quality)",
                    "tooltip": "Prepended to both prompts"
                }),
            },
            "hidden": {
                "TextState": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("positive", "negative", "model", "clip", "text")
    FUNCTION = "encode"
    CATEGORY = "👑 Boss Nodes/🧵 Text"

    @classmethod
    def IS_CHANGED(cls, TextState, **kwargs):
        return TextState

    def encode(self, model, clip, positive_text, negative_text, module="", TextState="{}"):
        # Parse hidden state (overrides widget values)
        try:
            state = json.loads(TextState) if isinstance(TextState, str) else {}
        except:
            state = {}
        # Override with state if present
        positive_text = state.get("positive_text", positive_text)
        negative_text = state.get("negative_text", negative_text)
        module = state.get("module", module)

        # Apply module (prefix)
        if module.strip():
            full_pos = f"{module.strip()}, {positive_text}" if positive_text else module.strip()
            full_neg = f"{module.strip()}, {negative_text}" if negative_text else module.strip()
        else:
            full_pos = positive_text
            full_neg = negative_text

        pos_cond = self._encode_text(clip, full_pos)
        neg_cond = self._encode_text(clip, full_neg)

        combined_text = f"POS: {full_pos}\nNEG: {full_neg}"
        return (pos_cond, neg_cond, model, clip, combined_text)

    def _encode_text(self, clip, text):
        tokens = clip.tokenize(text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        return [[cond, {"pooled_output": pooled}]]

NODE_CLASS_MAPPINGS = {"SmartTextClipEncode": SmartTextClipEncode}
NODE_DISPLAY_NAME_MAPPINGS = {"SmartTextClipEncode": "🧠 Smart Text CLIP Encode"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
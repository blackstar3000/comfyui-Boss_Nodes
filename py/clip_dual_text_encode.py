# ComfyUI/custom_nodes/clip_dual_text_encode.py
# CLIP DUAL TEXT ENCODE — FINAL + LIVE PREVIEW EDITION

import html

import torch


class CLIPDualTextEncode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "positive": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "masterpiece, best quality",
                        "dynamicPrompts": True,
                    },
                ),
                "negative": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "blurry, ugly, deformed",
                        "dynamicPrompts": True,
                    },
                ),
            },
            "optional": {
                "pos_g": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01},
                ),
                "pos_n": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01},
                ),
                "neg_g": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01},
                ),
                "neg_n": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01},
                ),
                "clip_skip": ("INT", {"default": -1, "min": -24, "max": -1, "step": 1}),
                "disable_negative": ("BOOLEAN", {"default": False}),
                "show_preview": ("BOOLEAN", {"default": True}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF}),
            },
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
    RETURN_NAMES = ("POSITIVE", "NEGATIVE")
    FUNCTION = "encode"
    CATEGORY = "🌟 Pro Tools/Conditioning"
    OUTPUT_NODE = True  # Enables live preview

    DESCRIPTION = "Advanced dual CLIP encoding with G/N weights, clip skip, and safe negative handling."

    def encode(
        self,
        clip,
        positive,
        negative,
        pos_g=1.0,
        pos_n=1.0,
        neg_g=1.0,
        neg_n=1.0,
        clip_skip=-1,
        disable_negative=False,
        show_preview=True,
        seed=None,
        **kwargs,
    ):
        if clip_skip != -1 and hasattr(clip, "clone"):
            clip = clip.clone()
            clip.clip_layer(clip_skip)

        def encode_single(text, g_weight=1.0, n_weight=1.0):
            text = text.strip()
            tokens = clip.tokenize(text if text else "")
            cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
            if pooled is None:
                pooled = torch.zeros(
                    (1, cond.shape[-1]), device=cond.device, dtype=cond.dtype
                )
            return [
                [
                    cond,
                    {
                        "pooled_output": pooled,
                        "global_weight": g_weight,
                        "noise_weight": n_weight,
                    },
                ]
            ]

        pos_cond = encode_single(positive, pos_g, pos_n)

        if disable_negative or not negative.strip():
            zero_cond = torch.zeros_like(pos_cond[0][0])
            zero_pooled = torch.zeros_like(pos_cond[0][1]["pooled_output"])
            neg_cond = [
                [
                    zero_cond,
                    {
                        "pooled_output": zero_pooled,
                        "global_weight": 1.0,
                        "noise_weight": 1.0,
                    },
                ]
            ]
        else:
            neg_cond = encode_single(negative, neg_g, neg_n)

        ui = {}
        if show_preview:
            ui["text"] = [
                self._preview(
                    positive,
                    negative,
                    pos_g,
                    pos_n,
                    neg_g,
                    neg_n,
                    disable_negative,
                    clip_skip,
                )
            ]

        return {"ui": ui, "result": (pos_cond, neg_cond)}

    def _preview(self, pos, neg, pg, pn, ng, nn, disable_negative, skip):
        pos = pos.strip() or "(empty)"
        neg = neg.strip() or "(empty)"
        safe_pos = html.escape(pos)
        safe_neg = html.escape(neg)

        skip_text = f"Clip Skip: {skip}" if skip != -1 else "Clip Skip: Off"
        neg_status = "DISABLED" if disable_negative else "Active"

        return f"""
<div style="padding:10px; background:#2a2a2a; border-radius:8px; font-family:-apple-system,system-ui,sans-serif; border:1px solid #444; min-width:300px;">
    <div style="font-weight:bold; color:#ffd700; margin-bottom:6px;">Positive Prompt</div>
    <div style="background:#1e1e1e; padding:8px; border-radius:6px; font-family:monospace; font-size:0.88em; max-height:100px; overflow-y:auto; white-space:pre-wrap; word-break:break-word;">
        {safe_pos}
    </div>

    <div style="display:flex; gap:12px; margin:10px 0; font-size:0.9em;">
        <span style="color:#ffaa00;">G: {pg:.2f}</span>
        <span style="color:#88ccff;">N: {pn:.2f}</span>
    </div>

    <div style="font-weight:bold; color:#ff6666; margin-bottom:6px;">Negative Prompt ({neg_status})</div>
    <div style="background:#1e1e1e; padding:8px; border-radius:6px; font-family:monospace; font-size:0.88em; max-height:80px; overflow-y:auto; white-space:pre-wrap; word-break:break-word;">
        {safe_neg}
    </div>

    <div style="display:flex; gap:12px; margin-top:10px; font-size:0.9em; color:#888;">
        <span>G: {ng:.2f} | N: {nn:.2f}</span>
        <span style="margin-left:auto;">{skip_text}</span>
    </div>

    <div style="color:#888; font-size:0.8em; margin-top:12px; text-align:right;">
        CLIP Dual Text Encode • Unbreakable
    </div>
</div>
        """.strip()


# === MUST BE OUTSIDE THE CLASS ===
NODE_CLASS_MAPPINGS = {"CLIPDualTextEncode": CLIPDualTextEncode}
NODE_DISPLAY_NAME_MAPPINGS = {"CLIPDualTextEncode": "CLIP Text Encode (Dual + Weights)"}

print("\033[92mCLIP Text Encode (Dual + Weights) — FINAL + LIVE PREVIEW LOADED!\033[0m")

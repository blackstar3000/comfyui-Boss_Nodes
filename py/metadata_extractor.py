# ComfyUI/custom_nodes/metadata_extractor.py
# Reverse-Prompt / Metadata Extractor Pro — BOSS EDITION

import os
import re
import json
import hashlib
import folder_paths
from PIL import Image

VERSION = "1.0"

_SAMPLER_NODE_TYPES = {
    "KSampler", "KSamplerAdvanced", "SamplerCustom", "SamplerCustomAdvanced",
}
_CLIP_ENCODE_TYPES = {"CLIPTextEncode", "CLIPTextEncodeSDXL"}
_MODEL_LOADER_TYPES = {
    "CheckpointLoaderSimple": "ckpt_name",
    "CheckpointLoader": "ckpt_name",
    "unCLIPCheckpointLoader": "ckpt_name",
    "UNETLoader": "unet_name",
    "UnetLoaderGGUF": "unet_name",
    "UnetLoaderGGUFAdvanced": "unet_name",
    "CheckpointLoaderGGUF": "ckpt_name",
}
_LATENT_SIZE_TYPES = {"EmptyLatentImage", "EmptySD3LatentImage"}
# Text-value candidate keys to try when walking an unrecognized node's inputs
_TEXT_CANDIDATE_KEYS = (
    "text", "positive", "negative", "string", "prompt", "value", "conditioning",
)


def _to_int(v):
    try:
        return int(float(str(v).strip()))
    except (TypeError, ValueError):
        return None


def _to_float(v):
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


def _blank_result():
    return {
        "found": False,
        "format": "none",
        "positive_prompt": "",
        "negative_prompt": "",
        "steps": None,
        "sampler_name": "",
        "cfg": None,
        "scheduler": "",
        "seed": None,
        "model_name": "",
        "width": None,
        "height": None,
        "raw": "",
    }


# ── A1111 / Civitai "parameters" text block parser ─────────────────────────

def _parse_a1111_parameters(text: str) -> dict:
    result = _blank_result()
    result["raw"] = text
    if not text:
        return result

    neg_idx = text.find("Negative prompt:")
    steps_idx = text.find("Steps:")

    if neg_idx != -1:
        result["positive_prompt"] = text[:neg_idx].strip()
        neg_end = steps_idx if steps_idx != -1 else len(text)
        result["negative_prompt"] = text[neg_idx + len("Negative prompt:"):neg_end].strip()
    elif steps_idx != -1:
        result["positive_prompt"] = text[:steps_idx].strip()
    else:
        result["positive_prompt"] = text.strip()

    if steps_idx != -1:
        tail = text[steps_idx:]
        # "Key: Value, Key: Value, ..." - values may be quoted and contain commas
        for m in re.finditer(r'([A-Za-z ]+):\s*("(?:[^"\\]|\\.)*"|[^,]+)', tail):
            key = m.group(1).strip().lower()
            val = m.group(2).strip().strip('"')
            if key == "steps":
                result["steps"] = _to_int(val)
            elif key == "sampler":
                result["sampler_name"] = val
            elif key == "cfg scale":
                result["cfg"] = _to_float(val)
            elif key == "seed":
                result["seed"] = _to_int(val)
            elif key == "size":
                wh = val.lower().split("x")
                if len(wh) == 2:
                    result["width"] = _to_int(wh[0])
                    result["height"] = _to_int(wh[1])
            elif key == "model":
                result["model_name"] = val
            elif key == "schedule type":
                result["scheduler"] = val
    return result


# ── ComfyUI native "prompt" graph parser ────────────────────────────────────

def _parse_comfy_prompt_graph(prompt_json: str) -> dict:
    """
    Best-effort extraction from a ComfyUI API-format prompt graph.
    Graph shapes vary a lot across workflows and custom nodes, so this
    walks known node types rather than assuming a fixed structure, and
    takes the first sampler/checkpoint/latent-size node it finds.
    """
    result = _blank_result()
    result["raw"] = prompt_json
    try:
        graph = json.loads(prompt_json)
    except (TypeError, ValueError):
        return result
    if not isinstance(graph, dict):
        return result

    def node_input(node, key, default=None):
        val = (node.get("inputs") or {}).get(key, default)
        # Wired inputs are [node_id, output_index] pairs, not literal values.
        return default if isinstance(val, list) else val

    def resolve_text(ref, depth=0, visited=None):
        """
        Follow a wired reference (or literal) to find the text it actually
        resolves to, walking through common text-utility custom nodes
        rather than stopping at the first hop. Real workflows often chain
        prompts through several nodes (e.g. KSampler -> FluxGuidance ->
        CLIPTextEncode -> Text Concatenate -> prompt-building nodes)
        before reaching a literal string.
        """
        if depth > 10:
            return ""
        if isinstance(ref, str):
            return ref
        if not isinstance(ref, list) or not ref:
            return ""
        node_id = str(ref[0])
        if visited is None:
            visited = set()
        if node_id in visited:
            return ""  # cycle guard
        visited = visited | {node_id}

        node = graph.get(node_id)
        if not isinstance(node, dict):
            return ""
        class_type = node.get("class_type", "")
        inputs = node.get("inputs") or {}

        # Known text-utility nodes we understand structurally
        if class_type == "Text Concatenate":
            delim = inputs.get("delimiter", ", ")
            if not isinstance(delim, str):
                delim = ", "
            parts = []
            for key in ("text_a", "text_b", "text_c", "text_d"):
                if key in inputs:
                    t = resolve_text(inputs[key], depth + 1, visited)
                    if t:
                        parts.append(t)
            return delim.join(parts)

        if class_type == "ShowText|pysssss":
            # These cache the last resolved value as a numbered widget
            # input (e.g. text_0) alongside the wired "text" passthrough -
            # prefer that literal cache since it's already fully resolved.
            for key, val in inputs.items():
                if key != "text" and isinstance(val, str) and val:
                    return val
            return resolve_text(inputs.get("text"), depth + 1, visited)

        # Generic pass-through: commit to whichever known candidate key is
        # present, even if it resolves to an empty string - an explicitly
        # empty "text" field (e.g. a blank negative prompt) is a real
        # answer, not a signal to go wandering into unrelated sibling
        # inputs like a wired CLIP model reference.
        for key in _TEXT_CANDIDATE_KEYS:
            if key in inputs:
                return resolve_text(inputs[key], depth + 1, visited)

        # No canonical key present at all on this node - fall back to
        # trying any wired input, then any literal string input.
        for val in inputs.values():
            if isinstance(val, list):
                t = resolve_text(val, depth + 1, visited)
                if t:
                    return t
        for val in inputs.values():
            if isinstance(val, str) and val:
                return val

        return ""

    sampler_node = None
    for node in graph.values():
        if not isinstance(node, dict):
            continue
        if node.get("class_type") in _SAMPLER_NODE_TYPES:
            sampler_node = node
            break

    if sampler_node:
        result["seed"] = _to_int(
            node_input(sampler_node, "seed", node_input(sampler_node, "noise_seed"))
        )
        result["steps"] = _to_int(node_input(sampler_node, "steps"))
        result["cfg"] = _to_float(node_input(sampler_node, "cfg"))
        result["sampler_name"] = node_input(sampler_node, "sampler_name", "") or ""
        result["scheduler"] = node_input(sampler_node, "scheduler", "") or ""

        pos_ref = (sampler_node.get("inputs") or {}).get("positive")
        neg_ref = (sampler_node.get("inputs") or {}).get("negative")
        if pos_ref is not None:
            result["positive_prompt"] = resolve_text(pos_ref)
        if neg_ref is not None:
            result["negative_prompt"] = resolve_text(neg_ref)

    if not result["positive_prompt"] and not result["negative_prompt"]:
        # Fallback: grab the two longest CLIPTextEncode texts we can find.
        # Longest-first is a heuristic (positive prompts are usually longer
        # than negatives) - not guaranteed correct, but reasonable when the
        # sampler wiring above couldn't be resolved.
        texts = []
        for node in graph.values():
            if not isinstance(node, dict):
                continue
            if node.get("class_type") in _CLIP_ENCODE_TYPES:
                t = node_input(node, "text", "")
                if t:
                    texts.append(t)
        texts.sort(key=len, reverse=True)
        if len(texts) >= 1:
            result["positive_prompt"] = texts[0]
        if len(texts) >= 2:
            result["negative_prompt"] = texts[1]

    for node in graph.values():
        if not isinstance(node, dict):
            continue
        loader_key = _MODEL_LOADER_TYPES.get(node.get("class_type"))
        if loader_key:
            result["model_name"] = node_input(node, loader_key, "") or ""
            break

    for node in graph.values():
        if not isinstance(node, dict):
            continue
        if node.get("class_type") in _LATENT_SIZE_TYPES:
            result["width"] = _to_int(node_input(node, "width"))
            result["height"] = _to_int(node_input(node, "height"))
            break

    return result


# ── Main extraction entrypoint ──────────────────────────────────────────────

def extract_metadata(image_path: str) -> dict:
    if not image_path or not os.path.isfile(image_path):
        result = _blank_result()
        result["raw"] = "Image file not found."
        return result

    try:
        with Image.open(image_path) as img:
            info = dict(img.info or {})
    except Exception as e:
        result = _blank_result()
        result["raw"] = f"Failed to open image: {e}"
        return result

    if "prompt" in info:
        parsed = _parse_comfy_prompt_graph(info["prompt"])
        parsed["found"] = True
        parsed["format"] = "comfyui"
        if "workflow" in info:
            # Kept available for a "view raw workflow" panel; not needed
            # for the basic breakdown above.
            parsed["workflow_raw"] = info["workflow"]
        return parsed

    if "parameters" in info:
        parsed = _parse_a1111_parameters(info["parameters"])
        parsed["found"] = True
        parsed["format"] = "a1111"
        return parsed

    result = _blank_result()
    result["raw"] = "No embedded generation metadata found in this image."
    return result


# ── API routes (live preview without needing to queue the graph) ───────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/metadata_extractor/extract")
    async def extract_api(request):
        image = request.query.get("image", "")
        if not image:
            return web.json_response({"error": "Missing image"}, status=400)
        try:
            image_path = folder_paths.get_annotated_filepath(image)
        except Exception:
            image_path = None
        if not image_path or not os.path.isfile(image_path):
            return web.json_response({"error": "Image not found"}, status=404)
        return web.json_response(extract_metadata(image_path))

register_api_routes()

# ── Node class ────────────────────────────────────────────────────────────

class MetadataExtractor:
    """
    Reverse-Prompt / Metadata Extractor Pro — reads embedded generation
    metadata from an uploaded/selected image and breaks it down into
    reusable outputs (prompts, seed, steps, cfg, sampler, scheduler,
    model, width, height, raw JSON).

    Supports two formats:
    - ComfyUI's native embedded 'prompt' graph JSON (best-effort parse -
      graph shapes vary, so this walks known node types rather than
      assuming a fixed layout).
    - A1111/Civitai-style 'parameters' text block, for images generated
      outside ComfyUI.

    Use the API preview endpoint (wired up by the companion frontend) to
    see the breakdown immediately after picking a file, without needing
    to queue the graph.
    """
    DESCRIPTION = (
        "Reverse-Prompt / Metadata Extractor Pro — reads embedded generation "
        "metadata (ComfyUI's own format or A1111/Civitai 'parameters' text) "
        "from an image and outputs the positive/negative prompt, seed, steps, "
        "cfg, sampler, scheduler, model name, width, height, and raw JSON as "
        "individually wireable outputs."
    )

    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        try:
            files = [
                f for f in os.listdir(input_dir)
                if os.path.isfile(os.path.join(input_dir, f))
            ]
        except OSError:
            files = []
        return {
            "required": {
                "image": (sorted(files), {"image_upload": True}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "INT", "INT", "FLOAT", "STRING", "STRING", "STRING", "INT", "INT", "STRING")
    RETURN_NAMES = (
        "positive_prompt", "negative_prompt", "seed", "steps", "cfg",
        "sampler_name", "scheduler", "model_name", "width", "height", "raw_metadata",
    )
    FUNCTION = "extract"
    CATEGORY = "👑 Boss Nodes/🔍 Metadata"

    @classmethod
    def VALIDATE_INPUTS(cls, image):
        if not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True

    @classmethod
    def IS_CHANGED(cls, image, **kwargs):
        # Hash file contents (not just the filename) so overwriting an
        # upload with the same name is still detected as a real change,
        # matching ComfyUI's own LoadImage behavior.
        try:
            image_path = folder_paths.get_annotated_filepath(image)
            m = hashlib.sha256()
            with open(image_path, "rb") as f:
                m.update(f.read())
            return m.hexdigest()
        except (OSError, TypeError):
            return image

    def extract(self, image):
        image_path = folder_paths.get_annotated_filepath(image)
        data = extract_metadata(image_path)

        positive = data.get("positive_prompt") or ""
        negative = data.get("negative_prompt") or ""
        seed = data.get("seed") if data.get("seed") is not None else 0
        steps = data.get("steps") if data.get("steps") is not None else 0
        cfg = data.get("cfg") if data.get("cfg") is not None else 0.0
        sampler_name = data.get("sampler_name") or ""
        scheduler = data.get("scheduler") or ""
        model_name = data.get("model_name") or ""
        width = data.get("width") if data.get("width") is not None else 0
        height = data.get("height") if data.get("height") is not None else 0
        raw = json.dumps(data, indent=2, ensure_ascii=False)

        if data.get("found"):
            preview_lines = [
                f"✅ Found {data.get('format')} metadata",
                f"🌱 Seed: {seed} | Steps: {steps} | CFG: {cfg}",
                f"⚙️ {sampler_name or '(none)'} | {scheduler or '(none)'}",
            ]
            if model_name:
                preview_lines.append(f"📦 Model: {model_name}")
        else:
            preview_lines = [f"⚠️ {data.get('raw') or 'No metadata found'}"]

        return {
            "ui": {"text": preview_lines},
            "result": (
                positive, negative, seed, steps, cfg,
                sampler_name, scheduler, model_name, width, height, raw,
            ),
        }


NODE_CLASS_MAPPINGS = {"MetadataExtractor": MetadataExtractor}
NODE_DISPLAY_NAME_MAPPINGS = {"MetadataExtractor": f"🔍 Reverse-Prompt / Metadata Extractor Pro v{VERSION}"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

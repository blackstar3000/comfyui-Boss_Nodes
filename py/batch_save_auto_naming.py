# ComfyUI/custom_nodes/batch_save_auto_naming.py
# BATCH SAVE WITH AUTO‑NAMING PRO — BOSS EDITION

import os
import json
import re
from datetime import datetime
import folder_paths

VERSION = "3.0"
BASE_DIR = os.path.dirname(__file__)
COUNTER_FILE = os.path.join(BASE_DIR, ".batch_save_counter.json")
HISTORY_FILE = os.path.join(BASE_DIR, ".batch_save_history.json")
HISTORY_LIMIT = 50


def _atomic_write_json(path, data):
    """Write JSON atomically: write to a temp file, then rename over the
    target. If the process dies mid-write (crash, power loss, kill -9),
    the original file is left untouched instead of being left truncated
    or corrupted."""
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)

# ── Counter I/O ──────────────────────────────────────────────────────────────

def _load_counter() -> int:
    try:
        with open(COUNTER_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return int(data.get("counter", 0))
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        return 0

def _save_counter(value: int) -> None:
    _atomic_write_json(COUNTER_FILE, {"counter": value})

# ── History I/O ─────────────────────────────────────────────────────────────

def _load_history() -> list:
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def _save_history(history: list) -> None:
    _atomic_write_json(HISTORY_FILE, history[-HISTORY_LIMIT:])

# ── Sanitizers ──────────────────────────────────────────────────────────────

def _sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name).strip("._") or "file"

def _sanitize_folder(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name.strip()) or "misc"

# ── API routes (for history and counters) ──────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/batch_save/history")
    async def get_history(request):
        return web.json_response({"history": _load_history()})

    @routes.get("/batch_save/counter")
    async def get_counter(request):
        return web.json_response({"counter": _load_counter()})

register_api_routes()

# ── Node class ──────────────────────────────────────────────────────────────

class BatchSaveAutoNaming:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "tooltip": "The main text/prompt to save."
                }),
                "base_filename": ("STRING", {
                    "default": "prompt",
                    "tooltip": "Base name for the file."
                }),
                "naming_mode": ([
                    "single_overwrite",
                    "single_append",
                    "batch_numbered",
                    "batch_timestamp",
                    "batch_numbered_timestamp"
                ], {
                    "default": "batch_numbered",
                    "tooltip": "How to generate the filename."
                }),
                "extension": ([".txt", ".json", ".md", ".log", ".csv"], {
                    "default": ".json",
                    "tooltip": "File extension."
                }),
            },
            "optional": {
                "custom_key": ("STRING", {
                    "default": "",
                    "placeholder": "e.g. Vicky, Goth Girl, Scene 1",
                    "tooltip": "Optional label for this save."
                }),
                "simple_mode": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Simple: Just the prompt",
                    "label_off": "Full: With metadata",
                    "tooltip": "ON → saves only the prompt text (clean & minimal)."
                }),
                "category_folder": ("STRING", {
                    "default": "",
                    "placeholder": "Optional subfolder (e.g. cyberpunk)",
                    "tooltip": "Creates a subfolder inside saved_prompts/ for organization."
                }),
                "folder_path": ("STRING", {
                    "default": "",
                    "placeholder": "Full override path (rarely needed)",
                    "tooltip": "Completely override the save location."
                }),
                "reset_counter": ("BOOLEAN", {
                    "default": False,
                    "label_on": "✅ Will reset to 0001 on NEXT save",
                    "label_off": "Counter running normally",
                    "tooltip": "Toggle ON to reset the file counter back to 0001."
                }),
            },
            "hidden": {
                "SaveState": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("save_path",)
    FUNCTION = "save"
    OUTPUT_NODE = True
    CATEGORY = "👑 Boss Nodes/📁 Utilities"

    @classmethod
    def IS_CHANGED(cls, SaveState, **kwargs):
        # Re‑execute when the JS state changes (or any input changes)
        return SaveState

    def save(self, text, base_filename, naming_mode, extension,
             custom_key="", simple_mode=False, category_folder="",
             folder_path="", reset_counter=False, SaveState="{}"):

        # ── Parse hidden state (override widgets) ─────────────────────
        try:
            state = json.loads(SaveState) if isinstance(SaveState, str) else {}
        except:
            state = {}
        if isinstance(state, dict):
            # Override all inputs with state values if present
            if "text" in state: text = state["text"]
            if "base_filename" in state: base_filename = state["base_filename"]
            if "naming_mode" in state: naming_mode = state["naming_mode"]
            if "extension" in state: extension = state["extension"]
            if "custom_key" in state: custom_key = state["custom_key"]
            if "simple_mode" in state: simple_mode = bool(state["simple_mode"])
            if "category_folder" in state: category_folder = state["category_folder"]
            if "folder_path" in state: folder_path = state["folder_path"]
            if "reset_counter" in state: reset_counter = bool(state["reset_counter"])

        # ── Guard: empty input ─────────────────────────────────────────
        if not text.strip():
            msg = "⚠️ Empty text — nothing saved."
            return {"ui": {"text": [msg]}, "result": (msg,)}

        # ── Resolve output directory ────────────────────────────────────
        comfy_output_dir = folder_paths.output_directory
        base_dir = folder_path.strip() or os.path.join(comfy_output_dir, "saved_prompts")
        os.makedirs(base_dir, exist_ok=True)

        if category_folder.strip():
            base_dir = os.path.join(base_dir, _sanitize_folder(category_folder))
            os.makedirs(base_dir, exist_ok=True)

        # ── Sanitize base filename ──────────────────────────────────────
        safe_base = _sanitize_filename(base_filename)
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

        # ── Determine filename & write mode ─────────────────────────────
        counter = _load_counter()
        write_mode = "w"
        if naming_mode == "single_overwrite":
            filename = f"{safe_base}{extension}"
            write_mode = "w"
        elif naming_mode == "single_append":
            filename = f"{safe_base}{extension}"
            write_mode = "a"
        elif naming_mode == "batch_numbered":
            counter += 1
            filename = f"{safe_base}_{counter:04d}{extension}"
            write_mode = "w"
        elif naming_mode == "batch_timestamp":
            filename = f"{safe_base}_{timestamp_str}{extension}"
            write_mode = "w"
        else:  # batch_numbered_timestamp
            counter += 1
            filename = f"{safe_base}_{counter:04d}_{timestamp_str}{extension}"
            write_mode = "w"

        # ── Persist counter BEFORE writing ──────────────────────────────
        if naming_mode in ("batch_numbered", "batch_numbered_timestamp"):
            _save_counter(counter)

        # ── Truncate oversized filenames ────────────────────────────────
        max_len = 180
        if len(filename) > max_len:
            stem = filename[: max_len - len(extension) - 1]
            filename = f"{stem}~{extension}"

        filepath = os.path.join(base_dir, filename)

        # ── Write file ──────────────────────────────────────────────────
        try:
            if extension.lower() in (".txt", ".md", ".log", ".csv"):
                self._save_text(text.strip(), filepath, write_mode, custom_key=custom_key.strip())
            else:
                self._save_json(text.strip(), filepath, write_mode,
                                custom_key=custom_key.strip(),
                                simple_mode=simple_mode,
                                filename=filename)
        except OSError as e:
            err = f"❌ Save failed: {e}"
            return {"ui": {"text": [err]}, "result": (err,)}

        # ── Handle counter reset ────────────────────────────────────────
        if reset_counter:
            _save_counter(0)

        # ── Update history ──────────────────────────────────────────────
        history = _load_history()
        entry = {
            "filepath": filepath,
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "text_preview": text.strip()[:100] + ("…" if len(text) > 100 else "")
        }
        history.insert(0, entry)
        _save_history(history)

        # ── Build UI feedback ────────────────────────────────────────────
        rel_path = os.path.relpath(filepath, comfy_output_dir)
        result_lines = [
            f"✅ Saved:    {filename}",
            f"📁 Location: {rel_path}",
            f"🕙 Time:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        ]
        if custom_key.strip():
            result_lines.insert(1, f"✨ Label:    \"{custom_key.strip()}\"")
        if reset_counter:
            result_lines.append("🔢 Counter will reset to 0001 on next save.")

        return {"ui": {"text": result_lines}, "result": (filepath,)}

    # ── File writers ──────────────────────────────────────────────────────

    def _save_text(self, text, filepath, mode, custom_key=""):
        file_exists_nonempty = os.path.exists(filepath) and os.path.getsize(filepath) > 0
        with open(filepath, mode, encoding="utf-8") as f:
            if mode == "a" and file_exists_nonempty:
                f.write("\n\n" + "-" * 50 + "\n\n")
            if custom_key:
                f.write(f"# {custom_key}\n\n")
            f.write(text.rstrip() + "\n")

    def _save_json(self, text, filepath, mode, custom_key="", simple_mode=False, filename=""):
        if simple_mode:
            entry = {custom_key or "prompt": text}
        else:
            entry = {
                "text": text,
                "saved_at": datetime.now().isoformat(),
                "filename": filename,
            }
            if custom_key:
                entry["name"] = custom_key

        if mode == "a" and os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                data = existing if isinstance(existing, list) else [existing]
            except (json.JSONDecodeError, OSError):
                data = []
        else:
            data = []

        data.append(entry)
        _atomic_write_json(filepath, data)


NODE_CLASS_MAPPINGS = {"BatchSaveAutoNaming": BatchSaveAutoNaming}
NODE_DISPLAY_NAME_MAPPINGS = {"BatchSaveAutoNaming": f"📁 Batch Save Pro v{VERSION}"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
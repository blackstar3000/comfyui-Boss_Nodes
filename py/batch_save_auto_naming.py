# ComfyUI/custom_nodes/batch_save_auto_naming.py
# BATCH SAVE WITH AUTO-NAMING PRO v2.2 — Stable & Bug-Fixed

import os
import json
import re
from datetime import datetime
import folder_paths

COUNTER_FILE = os.path.join(os.path.dirname(__file__), ".batch_save_counter.json")
VERSION = "2.2"


def _load_counter() -> int:
    """Load persistent counter from disk."""
    try:
        with open(COUNTER_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return int(data.get("counter", 0))
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        return 0


def _save_counter(value: int) -> None:
    """Persist counter to disk so it survives ComfyUI restarts."""
    with open(COUNTER_FILE, "w", encoding="utf-8") as f:
        json.dump({"counter": value}, f)


def _sanitize_filename(name: str) -> str:
    """Remove characters that are unsafe in filenames across all OS."""
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name).strip("._") or "file"


def _sanitize_folder(name: str) -> str:
    """Remove characters unsafe in folder names."""
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name.strip()) or "misc"


class BatchSaveAutoNaming:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "tooltip": (
                        "The main text/prompt to save.\n"
                        "Can be a full prompt, tags, or any notes."
                    )
                }),
                "base_filename": ("STRING", {
                    "default": "prompt",
                    "tooltip": (
                        "Base name for the file.\n"
                        "Will be combined with counter/timestamp depending on naming_mode.\n"
                        "Unsafe characters are automatically replaced with underscores."
                    )
                }),
                "naming_mode": ([
                    "single_overwrite",
                    "single_append",
                    "batch_numbered",
                    "batch_timestamp",
                    "batch_numbered_timestamp"
                ], {
                    "default": "batch_numbered",
                    "tooltip": (
                        "• single_overwrite: Always same filename (overwrites previous)\n"
                        "• single_append: Adds new entry to existing file\n"
                        "• batch_numbered: prompt_0001.json, prompt_0002.json ...\n"
                        "• batch_timestamp: prompt_2025-12-28_14-30-22.json\n"
                        "• batch_numbered_timestamp: prompt_0001_2025-12-28.json\n\n"
                        "Counter persists across ComfyUI restarts."
                    )
                }),
                "extension": ([".txt", ".json", ".md", ".log", ".csv"], {
                    "default": ".json",
                    "tooltip": (
                        ".json → Structured data with metadata (recommended)\n"
                        ".txt / .md / .log → Plain text, human-readable\n"
                        ".csv → Comma-separated (good for spreadsheets)"
                    )
                }),
            },
            "optional": {
                "custom_key": ("STRING", {
                    "default": "",
                    "placeholder": "e.g. Vicky, Goth Girl, Scene 1",
                    "tooltip": (
                        "Optional label for this save.\n"
                        "Appears as 'name' in JSON or as a header in text files."
                    )
                }),
                "simple_mode": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Simple: Just the prompt",
                    "label_off": "Full: With metadata",
                    "tooltip": (
                        "ON  → Saves only the prompt text (clean & minimal)\n"
                        "OFF → Saves full metadata: text, timestamp, filename, custom_key\n\n"
                        "⚠️ Mixing simple/full mode in the same append file is not recommended."
                    )
                }),
                "category_folder": ("STRING", {
                    "default": "",
                    "placeholder": "Optional subfolder (e.g. cyberpunk)",
                    "tooltip": (
                        "Creates a subfolder inside saved_prompts/ for organization.\n"
                        "Example: 'portraits' → saved_prompts/portraits/"
                    )
                }),
                "folder_path": ("STRING", {
                    "default": "",
                    "placeholder": "Full override path (rarely needed)",
                    "tooltip": (
                        "Completely override the save location.\n"
                        "Leave blank to use: ComfyUI/output/saved_prompts/\n"
                        "Use carefully — no validation is done on custom paths."
                    )
                }),
                "reset_counter": ("BOOLEAN", {
                    "default": False,
                    "label_on": "✅ Will reset to 0001 on NEXT save",
                    "label_off": "Counter running normally",
                    "tooltip": (
                        "Toggle ON to reset the file counter back to 0001.\n"
                        "The reset takes effect on the NEXT save operation.\n"
                        "The current save still uses the existing counter value."
                    )
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("save_path",)
    FUNCTION = "save"
    OUTPUT_NODE = True
    CATEGORY = "🌟 Pro Tools/Utilities"

    # ------------------------------------------------------------------ #
    #  Main save method                                                    #
    # ------------------------------------------------------------------ #

    def save(
        self,
        text: str,
        base_filename: str,
        naming_mode: str = "batch_numbered",
        extension: str = ".json",
        custom_key: str = "",
        simple_mode: bool = False,
        category_folder: str = "",
        folder_path: str = "",
        reset_counter: bool = False,
    ):
        # ── Guard: empty input ──────────────────────────────────────────
        if not text.strip():
            msg = "⚠️ Empty text — nothing saved."
            return {"ui": {"text": [msg]}, "result": (msg,)}

        # ── Resolve output directory ────────────────────────────────────
        comfy_output_dir = folder_paths.output_directory
        base_dir = (
            folder_path.strip()
            or os.path.join(comfy_output_dir, "saved_prompts")
        )

        os.makedirs(base_dir, exist_ok=True)

        if category_folder.strip():
            base_dir = os.path.join(base_dir, _sanitize_folder(category_folder))
            os.makedirs(base_dir, exist_ok=True)

        # ── Sanitize filename base ──────────────────────────────────────
        safe_base = _sanitize_filename(base_filename)
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

        # ── Determine filename & write mode ─────────────────────────────
        counter = _load_counter()

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

        # ── Persist counter BEFORE writing (safe order) ─────────────────
        if naming_mode in ("batch_numbered", "batch_numbered_timestamp"):
            _save_counter(counter)

        # ── Truncate oversized filenames safely ─────────────────────────
        max_len = 180
        if len(filename) > max_len:
            # Keep the extension intact — only trim the stem
            stem = filename[: max_len - len(extension) - 1]
            filename = f"{stem}~{extension}"

        filepath = os.path.join(base_dir, filename)

        # ── Write file ──────────────────────────────────────────────────
        try:
            if extension.lower() in (".txt", ".md", ".log", ".csv"):
                self._save_text(
                    text.strip(),
                    filepath,
                    write_mode,
                    header=custom_key.strip(),
                )
            else:
                self._save_json(
                    text.strip(),
                    filepath,
                    write_mode,
                    custom_key=custom_key.strip(),
                    simple_mode=simple_mode,
                    filename=filename,
                )

        except OSError as e:
            err = f"❌ Save failed: {e}"
            return {"ui": {"text": [err]}, "result": (err,)}

        # ── Handle counter reset (takes effect NEXT save) ────────────────
        if reset_counter:
            _save_counter(0)

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

    # ------------------------------------------------------------------ #
    #  File writers                                                        #
    # ------------------------------------------------------------------ #

    def _save_text(
        self,
        text: str,
        filepath: str,
        mode: str,
        header: str = "",
    ) -> None:
        """
        Write plain-text formats (.txt, .md, .log, .csv).
        Appends a separator when adding to an existing non-empty file.
        """
        file_exists_and_nonempty = (
            os.path.exists(filepath) and os.path.getsize(filepath) > 0
        )

        with open(filepath, mode, encoding="utf-8") as f:
            if mode == "a" and file_exists_and_nonempty:
                f.write("\n\n" + "-" * 50 + "\n\n")

            if header:
                f.write(f"# {header}\n\n")

            f.write(text.rstrip() + "\n")

    def _save_json(
        self,
        text: str,
        filepath: str,
        mode: str,
        custom_key: str = "",
        simple_mode: bool = False,
        filename: str = "",
    ) -> None:
        """
        Write JSON format.
        Always maintains a top-level list so append mode works cleanly.
        simple_mode and full mode are kept consistent per-entry.
        """
        # Build this entry
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

        # Load existing data if appending
        if mode == "a" and os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    existing = json.load(f)

                data: list = existing if isinstance(existing, list) else [existing]

            except (json.JSONDecodeError, OSError):
                # Corrupted or unreadable — start fresh rather than silently losing data
                data = []
        else:
            data = []

        data.append(entry)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


# ── ComfyUI registration ─────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "BatchSaveAutoNaming": BatchSaveAutoNaming
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BatchSaveAutoNaming": f"🌟 Batch Save with Auto-Naming Pro v{VERSION}"
}

# ── Startup message ──────────────────────────────────────────────────────────

print(f"\n{'='*55}")
print(f"  🌟 Batch Save with Auto-Naming Pro v{VERSION} LOADED!")
print( "     • Counter persists across ComfyUI restarts")
print( "     • Filenames are sanitized for cross-OS safety")
print( "     • Tooltips on every field — hover ℹ︎ to read")
print( "     • Returns save path as an output string")
print(f"{'='*55}\n")
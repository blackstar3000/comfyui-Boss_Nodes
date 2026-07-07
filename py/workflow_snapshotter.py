# ComfyUI/custom_nodes/workflow_snapshotter.py
# Workflow Snapshotter Pro — BOSS EDITION

import os
import json
from datetime import datetime
import folder_paths

VERSION = "1.0"
BASE_DIR = os.path.dirname(__file__)
SNAPSHOTS_FILE = os.path.join(BASE_DIR, "snapshots.json")

# ── Snapshot I/O ────────────────────────────────────────────────────────────

def _load_snapshots() -> dict:
    """Load all snapshots from the JSON file."""
    try:
        with open(SNAPSHOTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _save_snapshots(snapshots: dict) -> None:
    """Save the snapshots dictionary to disk (with backup, atomically)."""
    if os.path.exists(SNAPSHOTS_FILE):
        with open(SNAPSHOTS_FILE, "r", encoding="utf-8") as f:
            old = f.read()
        with open(SNAPSHOTS_FILE + ".bak", "w", encoding="utf-8") as f:
            f.write(old)
    tmp_path = SNAPSHOTS_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(snapshots, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, SNAPSHOTS_FILE)

# ── API routes ──────────────────────────────────────────────────────────────

def register_api_routes():
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return

    routes = PromptServer.instance.routes

    @routes.get("/snapshotter/list")
    async def list_snapshots(request):
        snapshots = _load_snapshots()
        # Return a summary list
        summary = []
        for name, data in snapshots.items():
            summary.append({
                "name": name,
                "timestamp": data.get("timestamp", ""),
                "nodeCount": data.get("nodeCount", 0),
                "preview": data.get("preview", ""),
                "hasFullData": bool(data.get("workflow")),
            })
        return web.json_response(summary)

    @routes.get("/snapshotter/get/{name}")
    async def get_snapshot(request):
        name = request.match_info.get("name", "")
        snapshots = _load_snapshots()
        if name not in snapshots:
            return web.json_response({"error": "Snapshot not found"}, status=404)
        return web.json_response(snapshots[name])

    @routes.post("/snapshotter/save")
    async def save_snapshot(request):
        try:
            data = await request.json()
        except:
            return web.json_response({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        if not name:
            return web.json_response({"error": "Snapshot name required"}, status=400)
        snapshot_data = data.get("data")
        if not isinstance(snapshot_data, dict):
            return web.json_response({"error": "Invalid snapshot data"}, status=400)
        # Add metadata
        snapshot_data["timestamp"] = datetime.now().isoformat()
        snapshot_data["nodeCount"] = len(snapshot_data.get("nodes", {}))
        # Generate a preview (first few nodes)
        preview_nodes = list(snapshot_data.get("nodes", {}).keys())[:5]
        preview = f"{len(preview_nodes)} nodes" if preview_nodes else "No nodes"
        snapshot_data["preview"] = preview

        snapshots = _load_snapshots()
        snapshots[name] = snapshot_data
        _save_snapshots(snapshots)
        return web.json_response({"success": True, "name": name})

    @routes.post("/snapshotter/delete")
    async def delete_snapshot(request):
        try:
            data = await request.json()
        except:
            return web.json_response({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        if not name:
            return web.json_response({"error": "Snapshot name required"}, status=400)
        snapshots = _load_snapshots()
        if name not in snapshots:
            return web.json_response({"error": "Snapshot not found"}, status=404)
        del snapshots[name]
        _save_snapshots(snapshots)
        return web.json_response({"success": True})

register_api_routes()

# ── Node class ──────────────────────────────────────────────────────────────

class WorkflowSnapshotter:
    """
    Workflow Snapshotter Pro — Save and restore complete workflow snapshots directly from the UI.

    This node acts as a controller for the snapshot system. It does not affect execution;
    instead, it provides a UI panel (via the "Workflow Snapshotter" tab) to save the
    current workflow state to a named snapshot, and later restore it. Two restore modes
    are available:

    - Selective Restore (Restore / Restore Selected / Restore All): reviews a per-node
      diff and lets you pick which nodes to update. Restores widget values, properties,
      and position/size for nodes that still exist in the current graph (matched by node
      ID). Nodes deleted since the snapshot was taken are listed as missing and skipped.
      Does not touch node connections/links.
    - Full Restore: replaces the ENTIRE current graph (nodes, connections, positions,
      groups) with the snapshot's captured workflow, the same way opening a saved
      workflow file does. This is destructive - anything on the canvas not in the
      snapshot is discarded. Only available for snapshots saved after this feature was
      added (older snapshots lack the required data and will show Full Restore disabled).

    Snapshots are stored in snapshots.json in the custom node directory, with metadata
    (timestamp, node count, preview). The UI allows listing, viewing, deleting, and
    restoring snapshots.

    Use the "snapshot_name" input to pre‑fill the name field in the UI (optional).
    """
    DESCRIPTION = (
        "Workflow Snapshotter Pro — Save and load complete workflow snapshots directly "
        "from the UI.\n\n"
        "This node acts as a controller for the snapshot system. It does not affect "
        "execution; instead, it provides a UI panel (via the 'Workflow Snapshotter' tab) "
        "to save the current workflow state to a named snapshot, and later restore it.\n\n"
        "Two restore modes: Selective Restore reviews a per-node diff (widgets, "
        "properties, position/size) for nodes still present in the graph; Full Restore "
        "replaces the entire graph - including connections - the same way opening a "
        "saved workflow file does.\n\n"
        "Snapshots are stored in snapshots.json in the custom node directory, with metadata "
        "(timestamp, node count, preview). The UI allows listing, viewing, deleting, and "
        "restoring snapshots.\n\n"
        "Use the 'snapshot_name' input to pre‑fill the name field in the UI (optional)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # No required inputs; it's a control node.
                # But we can add a text input for new snapshot name directly on the node if desired.
                # We'll leave it empty and handle naming in the editor.
            },
            "optional": {
                "snapshot_name": ("STRING", {
                    "default": "",
                    "placeholder": "Enter snapshot name",
                    "tooltip": "Name for the snapshot (used when saving)."
                }),
            },
            "hidden": {
                "SnapshotterState": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    OUTPUT_NODE = True
    CATEGORY = "👑 Boss Nodes/📁 Utilities"

    @classmethod
    def IS_CHANGED(cls, SnapshotterState, **kwargs):
        return SnapshotterState

    def noop(self, snapshot_name="", SnapshotterState="{}"):
        # This node does nothing on execution; all logic is in the UI.
        # We return an empty UI message.
        return {"ui": {"text": ["Workflow Snapshotter ready."]}}

NODE_CLASS_MAPPINGS = {"WorkflowSnapshotter": WorkflowSnapshotter}
NODE_DISPLAY_NAME_MAPPINGS = {"WorkflowSnapshotter": f"📦 Workflow Snapshotter Pro v{VERSION}"}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
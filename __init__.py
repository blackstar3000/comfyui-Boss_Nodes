import os
import sys
import types
import importlib.util
import traceback

# Initialize the global mappings
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# web directory for loading js files
WEB_DIRECTORY = "./js"

def _load_module_from_file(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module
    return None

def _load_utils_package(utils_dir):
    utils_pkg = types.ModuleType("utils")
    utils_pkg.__path__ = [utils_dir]
    utils_pkg.__package__ = "utils"
    sys.modules["utils"] = utils_pkg

    # Load in dependency order: modules with no utils.* deps first,
    # then modules that depend on them.
    #   constants, logging_utils, json_utils, file_utils, ui_utils, validation
    #   → prompt_utils (needs constants)
    #   → cache_utils (needs logging_utils, json_utils)
    dep_order = [
        "constants", "logging_utils", "json_utils", "file_utils",
        "ui_utils", "validation", "prompt_utils", "cache_utils",
    ]
    loaded = set()
    for sub_name in dep_order:
        file_path = os.path.join(utils_dir, sub_name + ".py")
        if os.path.isfile(file_path):
            try:
                _load_module_from_file(f"utils.{sub_name}", file_path)
                loaded.add(sub_name)
            except Exception as e:
                print(f"   ⚠ Failed to load utils submodule utils.{sub_name}: {e}")

    # Load any remaining utils modules not in dep_order
    for filename in sorted(os.listdir(utils_dir)):
        if filename.endswith(".py") and filename != "__init__.py":
            sub_name = filename[:-3]
            if sub_name not in loaded:
                file_path = os.path.join(utils_dir, filename)
                try:
                    _load_module_from_file(f"utils.{sub_name}", file_path)
                except Exception as e:
                    print(f"   ⚠ Failed to load utils submodule utils.{sub_name}: {e}")

def load_nodes_from_subdirectory():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    py_dir = os.path.join(current_dir, "py")

    if not os.path.exists(py_dir):
        print(f"[MyCustomPack] Warning: 'py' directory not found at {py_dir}")
        return

    utils_dir = os.path.join(py_dir, "utils")
    if os.path.isdir(utils_dir):
        _load_utils_package(utils_dir)

    print(f"\n[MyCustomPack] Loading nodes from '{py_dir}'...")

    for filename in os.listdir(py_dir):
        if filename.endswith(".py") and filename != "__init__.py":
            module_name = filename[:-3]
            file_path = os.path.join(py_dir, filename)

            try:
                module = _load_module_from_file(module_name, file_path)

                if module:
                    if hasattr(module, "NODE_CLASS_MAPPINGS"):
                        NODE_CLASS_MAPPINGS.update(module.NODE_CLASS_MAPPINGS)
                    if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
                        NODE_DISPLAY_NAME_MAPPINGS.update(module.NODE_DISPLAY_NAME_MAPPINGS)
                    print(f"   ✔ Loaded node: {filename}")

            except Exception as e:
                print(f"   ❌ Failed to load {filename}: {e}")
                traceback.print_exc()

# Run the loader
load_nodes_from_subdirectory()

# Print summary
print(f"[MyCustomPack] Total nodes loaded: {len(NODE_CLASS_MAPPINGS)}\n")

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
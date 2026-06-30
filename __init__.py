import os
import sys
import importlib.util
import traceback

# Initialize the global mappings
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# web directory for loading js files
WEB_DIRECTORY = "./js"

def load_nodes_from_subdirectory():
    # Get the directory where this __init__.py file is located
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Define the path to the 'py' subfolder
    py_dir = os.path.join(current_dir, "py")

    # Check if the 'py' folder exists
    if not os.path.exists(py_dir):
        print(f"[MyCustomPack] Warning: 'py' directory not found at {py_dir}")
        return

    print(f"\n[MyCustomPack] Loading nodes from '{py_dir}'...")

    # Loop through all files in the 'py' directory
    for filename in os.listdir(py_dir):
        # Only process .py files and ignore __init__.py
        if filename.endswith(".py") and filename != "__init__.py":
            module_name = filename[:-3] # Remove .py extension
            file_path = os.path.join(py_dir, filename)

            try:
                # 1. Load the module specification
                spec = importlib.util.spec_from_file_location(module_name, file_path)
                
                if spec and spec.loader:
                    # 2. Create the module
                    module = importlib.util.module_from_spec(spec)
                    
                    # 3. Register the module in sys.modules (helps with relative imports)
                    sys.modules[module_name] = module
                    
                    # 4. Execute the module
                    spec.loader.exec_module(module)

                    # 5. Extract the Mappings
                    if hasattr(module, "NODE_CLASS_MAPPINGS"):
                        NODE_CLASS_MAPPINGS.update(module.NODE_CLASS_MAPPINGS)
                    if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
                        NODE_DISPLAY_NAME_MAPPINGS.update(module.NODE_DISPLAY_NAME_MAPPINGS)
                        
                    print(f"   ✔ Loaded node: {filename}")

            except Exception as e:
                print(f"   ❌ Failed to load {filename}: {e}")
                # Uncomment the line below to debug errors in detail
                # traceback.print_exc()

# Run the loader
load_nodes_from_subdirectory()

# Print summary
print(f"[MyCustomPack] Total nodes loaded: {len(NODE_CLASS_MAPPINGS)}\n")

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
# make_categories.py - Create main + sub-categories for Danbooru Tag Builder
# Run this script in Python (e.g. python make_categories.py)

import os

# Where to save files (change this to your actual folder if needed)
OUTPUT_FOLDER = "danbooru_tags"  # Will create this folder in current directory

# Default gender splits for main categories
GENDERS = ["female", "male", "unisex"]

def create_folder():
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)
        print(f"Created folder: {OUTPUT_FOLDER}")
    else:
        print(f"Using existing folder: {OUTPUT_FOLDER}")

def ask_tags(prompt_text="Enter tags (separated by |, or leave empty for default): "):
    tags = input(prompt_text).strip()
    if not tags:
        return ""  # Empty = use fallback in node
    return tags

def generate_main_files(main_name):
    """Create main category files like body_female.txt"""
    print(f"\nCreating main files for '{main_name}'...")
    for gender in GENDERS:
        filename = f"{main_name.lower()}_{gender}.txt"
        full_path = os.path.join(OUTPUT_FOLDER, filename)
        
        print(f"→ {filename}")
        tags = ask_tags(f"Tags for {gender} {main_name} (e.g. makeup|eyeliner|blush): ")
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(tags)
        print(f"  Saved: {full_path}\n")

def generate_sub_files(main_name, sub_categories):
    """Create sub-category files like body_breasts.txt"""
    print(f"\nCreating sub-category files for '{main_name}'...")
    for sub in sub_categories:
        filename = f"{main_name.lower()}_{sub.lower().replace(' ', '_')}.txt"
        full_path = os.path.join(OUTPUT_FOLDER, filename)
        
        print(f"→ {filename}")
        tags = ask_tags(f"Tags for '{sub}' (e.g. large breasts|huge breasts): ")
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(tags)
        print(f"  Saved: {full_path}\n")

def main():
    print("=== Danbooru Tag Builder - Category Generator ===\n")
    print("This script creates main + sub-category .txt files for your node.\n")
    
    create_folder()
    
    while True:
        main_cat = input("Enter MAIN category name (e.g. Body, Makeup, Accessory) or 'quit' to exit: ").strip()
        if main_cat.lower() == "quit":
            break
        if not main_cat:
            print("Please enter a name.")
            continue
        
        # 1. Create main files (female/male/unisex)
        generate_main_files(main_cat)
        
        # 2. Ask for sub-categories
        print(f"\nNow add SUB-categories for '{main_cat}' (e.g. Breasts, Ass, Hips)")
        print("Enter one per line. Empty line + Enter when finished.")
        
        subs = []
        while True:
            sub = input("Sub-category: ").strip()
            if not sub:
                break
            subs.append(sub)
        
        if subs:
            generate_sub_files(main_cat, subs)
        else:
            print("No sub-categories added.\n")
        
        print("\nDone! You can run again for more categories.\n")

    print("Finished! All files saved in:", os.path.abspath(OUTPUT_FOLDER))
    print("Restart ComfyUI → new dropdowns/sub-dropdowns will appear automatically!")

if __name__ == "__main__":
    main()
# make_categories.py - Create main + sub-categories for Danbooru Tag Builder
# Run this script in Python (e.g. python make_categories.py)
#
# Output layout matches what danbooru_tag_builder.py's _build_database()
# expects:
#
#   danbooru_tags/
#     <category>/
#       main/
#         female.txt
#         male.txt
#         unisex.txt
#       sub/
#         breasts.txt
#         ass.txt
#         hips.txt
#
# Each .txt file holds one tag per line (the format the node's tag loader
# reads reliably). You still type tags separated by | at the prompt for
# convenience - this script converts that into one-per-line on save.

import os

# Where to save files (change this to your actual folder if needed)
OUTPUT_FOLDER = "danbooru_tags"  # Will create this folder in current directory

# Default gender splits for main categories
GENDERS = ["female", "male", "unisex"]


def create_root_folder():
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)
        print(f"Created folder: {OUTPUT_FOLDER}")
    else:
        print(f"Using existing folder: {OUTPUT_FOLDER}")


def create_category_dirs(main_name):
    """Create <category>/main/ and <category>/sub/ and return their paths."""
    cat_dir = os.path.join(OUTPUT_FOLDER, main_name.lower())
    main_dir = os.path.join(cat_dir, "main")
    sub_dir = os.path.join(cat_dir, "sub")
    os.makedirs(main_dir, exist_ok=True)
    os.makedirs(sub_dir, exist_ok=True)
    return main_dir, sub_dir


def ask_tags(prompt_text="Enter tags (separated by |, or leave empty to skip): "):
    tags = input(prompt_text).strip()
    return tags


def write_tag_file(path, pipe_separated_tags):
    """Convert 'a|b|c' input into one-tag-per-line file content."""
    tags = [t.strip().replace(" ", "_") for t in pipe_separated_tags.split("|") if t.strip()]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(tags))
    return len(tags)


def generate_main_files(main_name, main_dir):
    """Create one file per gender inside <category>/main/, e.g. main/female.txt"""
    print(f"\nCreating MAIN options for '{main_name}' (one per gender)...")
    for gender in GENDERS:
        filename = f"{gender}.txt"
        full_path = os.path.join(main_dir, filename)

        tags_input = ask_tags(f"Tags for {gender} {main_name} (e.g. makeup|eyeliner|blush), or leave empty to skip: ")
        if not tags_input:
            print(f"  Skipped: {gender} (no tags entered)\n")
            continue

        count = write_tag_file(full_path, tags_input)
        print(f"  Saved: {full_path} ({count} tags)\n")


def generate_sub_files(main_name, sub_categories, sub_dir):
    """Create one file per sub-category inside <category>/sub/, e.g. sub/breasts.txt"""
    print(f"\nCreating SUB options for '{main_name}'...")
    for sub in sub_categories:
        filename = f"{sub.lower().replace(' ', '_')}.txt"
        full_path = os.path.join(sub_dir, filename)

        tags_input = ask_tags(f"Tags for '{sub}' (e.g. large_breasts|huge_breasts), or leave empty to skip: ")
        if not tags_input:
            print(f"  Skipped: {sub} (no tags entered)\n")
            continue

        count = write_tag_file(full_path, tags_input)
        print(f"  Saved: {full_path} ({count} tags)\n")


def main():
    print("=== Danbooru Tag Builder - Category Generator ===\n")
    print("This script creates <category>/main/*.txt and <category>/sub/*.txt files for your node.\n")

    create_root_folder()

    while True:
        main_cat = input("Enter MAIN category name (e.g. Body, Makeup, Accessory) or 'quit' to exit: ").strip()
        if main_cat.lower() == "quit":
            break
        if not main_cat:
            print("Please enter a name.")
            continue

        main_dir, sub_dir = create_category_dirs(main_cat)

        # 1. Create main options (female/male/unisex)
        generate_main_files(main_cat, main_dir)

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
            generate_sub_files(main_cat, subs, sub_dir)
        else:
            print("No sub-categories added.\n")

        print("\nDone! You can run again for more categories.\n")

    print("Finished! All files saved in:", os.path.abspath(OUTPUT_FOLDER))
    print("Click '🔄 REFRESH TAGS' in the node's editor (or restart ComfyUI) to pick up the new categories.")


if __name__ == "__main__":
    main()
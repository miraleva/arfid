import os
import glob
from markitdown import MarkItDown

def convert_pdfs_to_markdown():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, "documents")
    output_dir = os.path.join(base_dir, "markdown_output")

    os.makedirs(output_dir, exist_ok=True)
    
    pdf_files = glob.glob(os.path.join(docs_dir, "*.pdf"))
    md = MarkItDown()

    processed_count = 0
    total_characters = 0

    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        base_name = os.path.splitext(filename)[0]
        md_filename = f"{base_name}.md"
        md_path = os.path.join(output_dir, md_filename)

        if os.path.exists(md_path):
            print(f"Skipped (already converted): {filename}")
            # Count characters of existing file for statistics
            with open(md_path, "r", encoding="utf-8") as f:
                total_characters += len(f.read())
            continue

        print(f"Converting: {filename} ...")
        try:
            result = md.convert(pdf_path)
            markdown_content = result.text_content

            with open(md_path, "w", encoding="utf-8") as f:
                f.write(markdown_content)

            processed_count += 1
            char_len = len(markdown_content)
            total_characters += char_len
            print(f"Successfully converted {filename} -> {md_filename} ({char_len} chars)")
        except Exception as e:
            print(f"Error converting {filename}: {e}")

    print(f"\n--- CONVERSION SUMMARY ---")
    print(f"Newly processed files: {processed_count}")
    print(f"Total markdown character count: {total_characters}")

if __name__ == "__main__":
    convert_pdfs_to_markdown()

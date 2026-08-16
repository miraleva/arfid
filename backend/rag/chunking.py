import os
import glob
import re

def chunk_text_by_markdown(text, source_name, page_number=None, chunk_size=500, overlap=50):
    """
    Paragraph and heading aware markdown chunking with fallback overlap.
    """
    # Split by headings (#, ##, ###) or double newlines (paragraphs)
    raw_sections = re.split(r'(\n#{1,6}\s+|\n\n+)', text)
    
    sections = []
    current_sec = ""
    for s in raw_sections:
        if re.match(r'^\n#{1,6}\s+$', s) or re.match(r'^\n\n+$', s):
            if current_sec.strip():
                sections.append(current_sec.strip())
            current_sec = ""
        else:
            current_sec += s
    if current_sec.strip():
        sections.append(current_sec.strip())

    chunks = []
    current_chunk = ""

    for sec in sections:
        if len(current_chunk) + len(sec) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{sec}".strip() if current_chunk else sec
        else:
            if current_chunk:
                chunks.append({
                    "text": current_chunk,
                    "source": source_name,
                    "page_number": page_number
                })
            # If section itself is bigger than chunk_size, split by character window
            if len(sec) > chunk_size:
                start = 0
                while start < len(sec):
                    end = start + chunk_size
                    chunks.append({
                        "text": sec[start:end],
                        "source": source_name,
                        "page_number": page_number
                    })
                    start += (chunk_size - overlap)
                current_chunk = ""
            else:
                current_chunk = sec

    if current_chunk:
        chunks.append({
            "text": current_chunk,
            "source": source_name,
            "page_number": page_number
        })

    return chunks

def load_and_chunk_all_markdowns(chunk_size=500, overlap=50):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    md_dir = os.path.join(base_dir, "markdown_output")
    md_files = glob.glob(os.path.join(md_dir, "*.md"))

    all_chunks = []
    for md_path in md_files:
        filename = os.path.basename(md_path)
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

        # MarkItDown preserves page boundaries via form-feed (\x0c / \f)
        pages = content.split('\x0c')
        for p_num, page_text in enumerate(pages, start=1):
            if not page_text.strip():
                continue
            file_chunks = chunk_text_by_markdown(
                page_text, 
                filename, 
                page_number=p_num, 
                chunk_size=chunk_size, 
                overlap=overlap
            )
            all_chunks.extend(file_chunks)

    return all_chunks

if __name__ == "__main__":
    chunks = load_and_chunk_all_markdowns()
    print(f"Total chunks created across all markdowns: {len(chunks)}")
    if chunks:
        print("\n--- SAMPLE CHUNK ---")
        print(f"Source: {chunks[0]['source']}")
        print(f"Page: {chunks[0].get('page_number')}")
        print(f"Content:\n{chunks[0]['text'][:300]}...")

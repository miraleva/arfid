import os
import sys
import time
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from chunking import load_and_chunk_all_markdowns

# Note: Pinecone metadata size limit is 40KB per vector.
# Our chunks are ~500 characters (~0.5KB), well below the 40KB metadata limit.

def embed_and_store():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, "..", ".env")
    load_dotenv(env_path)

    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX_NAME", "arfid-knowledge")

    if not api_key:
        raise ValueError("PINECONE_API_KEY is not set in .env")

    print("Loading embedding model 'all-MiniLM-L6-v2'...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    print("Loading and chunking markdown files (page-aware)...")
    chunks = load_and_chunk_all_markdowns()
    print(f"Total chunks to process: {len(chunks)}")

    if not chunks:
        print("No chunks found to embed.")
        return

    print("Initializing Pinecone client...")
    pc = Pinecone(api_key=api_key)

    # Check if index exists, create if not
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    if index_name not in existing_indexes:
        print(f"Creating Pinecone serverless index '{index_name}'...")
        pc.create_index(
            name=index_name,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        time.sleep(5)

    index = pc.Index(index_name)

    # Clean existing vectors for a fresh, clean index
    print(f"Clearing old vectors from index '{index_name}'...")
    try:
        index.delete(delete_all=True)
        print("Existing vectors cleared successfully.")
    except Exception as e:
        print(f"Note on index clearing: {e}")

    print("Generating embeddings and upserting vectors to Pinecone...")
    batch_size = 100
    total_upserted = 0

    for i in range(0, len(chunks), batch_size):
        batch_chunks = chunks[i:i + batch_size]
        texts = [c["text"] for c in batch_chunks]
        embeddings = model.encode(texts).tolist()

        vectors_to_upsert = []
        for idx, (c, emb) in enumerate(zip(batch_chunks, embeddings)):
            vector_id = f"chunk_{i + idx}"
            metadata = {
                "text": c["text"],
                "source": c["source"]
            }
            if c.get("page_number") is not None:
                metadata["page_number"] = c["page_number"]

            vectors_to_upsert.append({
                "id": vector_id,
                "values": emb,
                "metadata": metadata
            })

        index.upsert(vectors=vectors_to_upsert)
        total_upserted += len(vectors_to_upsert)
        print(f"Upserted {total_upserted}/{len(chunks)} vectors...")

    print(f"\n--- UPSERT COMPLETE ---")
    print(f"Successfully upserted {total_upserted} vectors to index '{index_name}'.")

if __name__ == "__main__":
    embed_and_store()

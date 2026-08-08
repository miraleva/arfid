import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone

base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, "..", ".env")
load_dotenv(env_path)

api_key = os.getenv("PINECONE_API_KEY")
index_name = os.getenv("PINECONE_INDEX_NAME", "arfid-knowledge")

if not api_key:
    raise ValueError("PINECONE_API_KEY is not set in .env")

print("Initializing SentenceTransformer model for retrieval...")
model = SentenceTransformer('all-MiniLM-L6-v2')

print("Initializing Pinecone client for retrieval...")
pc = Pinecone(api_key=api_key)
index = pc.Index(index_name)

app = FastAPI(title="ARFID RAG Retrieval API")

class QueryRequest(BaseModel):
    query: str
    top_k: int = 4

def query_rag(text: str, top_k: int = 4):
    query_vector = model.encode(text).tolist()
    res = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True
    )

    chunks = []
    for match in res.get("matches", []):
        metadata = match.get("metadata", {})
        chunks.append({
            "text": metadata.get("text", ""),
            "source": metadata.get("source", ""),
            "score": match.get("score", 0.0)
        })
    return chunks

@app.post("/retrieve")
def retrieve_endpoint(request: QueryRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    try:
        chunks = query_rag(request.query, top_k=request.top_k)
        return {"chunks": chunks}
    except Exception as e:
        print(f"Retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Retrieval FastAPI server on port 5001...")
    uvicorn.run(app, host="0.0.0.0", port=5001)

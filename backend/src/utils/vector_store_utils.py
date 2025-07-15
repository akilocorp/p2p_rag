from pymongo import MongoClient
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch

def initialize_vector_store(db, config_id, embeddings):
    """Initialize and return a properly configured vector store."""
    collection_name = "vector_collection"
    
    # Create collection if it doesn't exist
    if collection_name not in db.list_collection_names():
        db.create_collection(collection_name)
    
    # Create vector index if it doesn't exist
    index_info = db[collection_name].index_information()
    if "vector" not in index_info:
        db[collection_name].create_index(
            [("embedding", "vectorSearch")],
            name="vector",
            vectorSearchParameters={
                "indexType": "HNSW",
                "metricType": "cosineSimilarity",
                "dimensions": 1536  # Adjust based on your embedding model
            }
        )
    
    # Create vector store
    vector_store = MongoDBAtlasVectorSearch(
        collection=db[collection_name],
        embedding=embeddings,
        index_name="vector",
    )
    
    return vector_store

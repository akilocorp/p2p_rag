import os
import shutil
import time
import logging
from typing import List, Optional, Dict, Any
from flask import current_app
from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_core.documents import Document

# Configure logger
logger = logging.getLogger(__name__)
from pymongo import MongoClient

def get_document_loader(file_path):
    """
    Returns the appropriate LangChain document loader based on the file extension.
    
    Args:
        file_path (str): The path to the file.

    Returns:
        A LangChain DocumentLoader instance or None if the file type is not supported.
    """
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    # Check file size
    if os.path.getsize(file_path) > MAX_FILE_SIZE:
        current_app.logger.warning(f"File too large: {file_path}. Maximum size is 50MB.")
        return None
    
    _, file_extension = os.path.splitext(file_path)
    file_extension = file_extension.lower()
    
    # Mapping of file extensions to their respective loaders
    loader_map = {
        '.docx': Docx2txtLoader,
        '.pdf': PyPDFLoader,
        '.txt': TextLoader,
        '.md': TextLoader,
    }
    
    loader_class = loader_map.get(file_extension)
    if loader_class:
        return loader_class(file_path=file_path)
    else:
        current_app.logger.warning(f"Unsupported file type: {file_extension}. Skipping file: {file_path}")
        return None

def handle_cleanup_error(func, path, exc_info):
    """
    Error handler for shutil.rmtree. Logs errors instead of raising them.
    """
    current_app.logger.error(f"Error during cleanup of {path}: {exc_info}")

def create_hnsw_index_if_not_exists(db, collection_name, index_name, dimensions):
    if collection_name not in db.list_collection_names():
        current_app.logger.info(f"Collection '{collection_name}' does not exist. Creating it now.")
        db.create_collection(collection_name)
        current_app.logger.info(f"Collection '{collection_name}' created.")

    collection = db[collection_name]
    index_model = {
        "name": index_name,
        "type": "vectorSearch",
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": dimensions,
                    "similarity": "cosine"
                },
                {
                    "type": "filter",
                    "path": "config_id"
                }
            ]
        }
    }

    existing_indexes = collection.list_search_indexes()
    for index in existing_indexes:
        if index['name'] == index_name:
            current_app.logger.info(f"Search index '{index_name}' already exists.")
            return

    current_app.logger.info(f"Creating search index '{index_name}'...")
    collection.create_search_index(model=index_model)
    current_app.logger.info(f"Search index '{index_name}' created successfully.")
    
    # Wait for the index to be ready
    current_app.logger.info(f"Waiting for index '{index_name}' to be ready...")
    max_wait_time = 120  # 2 minutes
    wait_interval = 5    # 5 seconds
    elapsed_time = 0
    
    while elapsed_time < max_wait_time:
        time.sleep(wait_interval)
        elapsed_time += wait_interval
        
        # Check if index is ready by looking for it in the list
        current_indexes = collection.list_search_indexes()
        for idx in current_indexes:
            if idx['name'] == index_name and idx.get('status') == 'READY':
                current_app.logger.info(f"Index '{index_name}' is now ready!")
                return
        
        current_app.logger.info(f"Index '{index_name}' not ready yet. Waiting... ({elapsed_time}s elapsed)")
    
    current_app.logger.warning(f"Index '{index_name}' may not be fully ready after {max_wait_time}s. Proceeding anyway.")

def process_files_and_create_vector_store(temp_file_paths, user_id, collection_name, config_id):
    """
    Processes multiple uploaded documents and stores them in a single shared MongoDB collection.
    This version uses a single collection for all configs to reduce MongoDB Atlas costs.

    Args:
        temp_file_paths (list): A list of paths to the temporary uploaded files.
        user_id (str): The ID of the user.
        collection_name (str): IGNORED - uses fixed 'documents' collection for all configs.
        config_id (str): The config ID used to filter documents in the shared collection.

    Returns:
        MongoDBAtlasVectorSearch: The vector store instance, or None if an error occurs.
    """
    
    
    all_splits = []

    try:
        db = current_app.config['MONGO_DB']
        
        # Use single shared collection for all configs (cost-effective for MongoDB Atlas)
        shared_collection_name = "documents"
        logger.info(f"📦 Using shared collection '{shared_collection_name}' for config_id: {config_id}")

        # --- 1. Document Processing Phase ---
        logger.info(f"🚀 Starting document processing for {len(temp_file_paths)} files")
        processing_start = time.time()
        
        for file_index, temp_file_path in enumerate(temp_file_paths, 1):
            file_start_time = time.time()
            filename = os.path.basename(temp_file_path)
            file_size = os.path.getsize(temp_file_path) / (1024 * 1024)  # Size in MB
            
            logger.info(f"📄 Processing file {file_index}/{len(temp_file_paths)}: {filename} ({file_size:.2f}MB)")
            
            # Get appropriate document loader
            loader = get_document_loader(temp_file_path)
            if not loader:
                logger.warning(f"⚠️ Skipping unsupported file: {filename}")
                continue

            try:
                # Load document pages
                pages = loader.load()
                load_time = time.time() - file_start_time
                logger.info(f"✅ Loaded {len(pages)} pages from {filename} in {load_time:.2f}s")
                
                # Split document into chunks
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=500, 
                    chunk_overlap=20,
                    length_function=len,
                    separators=["\n\n", "\n", " ", ""]
                )
                
                splits = splitter.split_documents(pages)
                
                # Enrich metadata for each chunk
                for chunk_index, split in enumerate(splits):
                    split.metadata.update({
                        'user_id': user_id,
                        'config_id': str(config_id),
                        'collection_name': shared_collection_name,  # Use shared collection
                        'original_file': filename,
                        'chunk_index': chunk_index,
                        'total_chunks': len(splits),
                        'file_size_mb': round(file_size, 2),
                        'processing_timestamp': time.time()
                    })
                
                all_splits.extend(splits)
                
                # Log processing results
                file_process_time = time.time() - file_start_time
                avg_chunk_size = sum(len(split.page_content) for split in splits) / len(splits) if splits else 0
                
                logger.info(f"📊 File {filename} processed: {len(splits)} chunks, "
                          f"avg chunk size: {avg_chunk_size:.0f} chars, "
                          f"time: {file_process_time:.2f}s")
                
                if splits:
                    logger.debug(f"📝 Sample chunk from {filename}: {splits[0].page_content[:100]}...")
                    
            except Exception as e:
                logger.error(f"❌ Failed to process {filename}: {str(e)}", exc_info=True)
                continue

        # Validate processing results
        processing_time = time.time() - processing_start
        
        if not all_splits:
            logger.error(f"❌ No documents could be processed from {len(temp_file_paths)} files after {processing_time:.2f}s")
            return None
            
        # Log processing summary
        total_chars = sum(len(doc.page_content) for doc in all_splits)
        avg_chunk_size = total_chars / len(all_splits)
        
        logger.info(f"✅ Document processing complete: {len(all_splits)} chunks from {len(temp_file_paths)} files")
        logger.info(f"📈 Processing stats: {total_chars:,} total chars, "
                   f"avg chunk: {avg_chunk_size:.0f} chars, "
                   f"time: {processing_time:.2f}s")

        # --- 2. Vector Store Creation Phase ---
        logger.info(f"🔧 Starting vector store creation for {len(all_splits)} chunks")
        vector_start_time = time.time()
        
        try:
            # Initialize embeddings
            embeddings = current_app.config['EMBEDDINGS']
            
            # Detect embedding dimensions dynamically
            logger.info("🔍 Detecting embedding dimensions...")
            dimension_start = time.time()
            sample_embedding = embeddings.embed_query("dimension test")
            dimensions = len(sample_embedding)
            dimension_time = time.time() - dimension_start
            
            logger.info(f"📏 Detected embedding dimensions: {dimensions} (took {dimension_time:.2f}s)")
            
            # Create or verify HNSW index on shared collection
            index_name = "hnsw_index"
            logger.info(f"🏗️ Creating HNSW index '{index_name}' with {dimensions} dimensions on shared collection '{shared_collection_name}'...")
            create_hnsw_index_if_not_exists(db, shared_collection_name, index_name, dimensions)
            
            # Final metadata enrichment
            logger.info("📝 Enriching document metadata...")
            for doc in all_splits:
                doc.metadata["config_id"] = str(config_id)
                doc.metadata["embedding_dimensions"] = dimensions
                doc.metadata["index_name"] = index_name
            
            # Insert documents into shared vector store
            logger.info(f"⬆️ Inserting {len(all_splits)} documents into shared MongoDB Atlas collection '{shared_collection_name}' for config_id: {config_id}...")
            insert_start = time.time()
            
            vector_store = MongoDBAtlasVectorSearch.from_documents(
                documents=all_splits,
                embedding=embeddings,
                collection=db[shared_collection_name],
                index_name=index_name
            )
            
            insert_time = time.time() - insert_start
            total_vector_time = time.time() - vector_start_time
            
            # Log success metrics
            logger.info(f"✅ Vector store creation successful!")
            logger.info(f"📊 Insertion metrics: {len(all_splits)} docs in {insert_time:.2f}s "
                       f"({len(all_splits)/insert_time:.1f} docs/sec)")
            logger.info(f"🎯 Total vector processing time: {total_vector_time:.2f}s")
            
            return vector_store
            
        except Exception as e:
            vector_time = time.time() - vector_start_time
            logger.error(f"❌ Vector store creation failed after {vector_time:.2f}s: {str(e)}", exc_info=True)
            raise
       
        # --- 3. Upload the Entire Vector Store Directory to S3 ---
        
       
    except Exception as e:
        total_time = time.time() - processing_start
        logger.error(f"❌ Vector store processing failed after {total_time:.2f}s: {str(e)}", exc_info=True)
        return None
        
    finally:
        # Clean up temporary files
        cleanup_start = time.time()
        cleaned_files = 0
        
        for temp_file_path in temp_file_paths:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    cleaned_files += 1
                    logger.debug(f"🗑️ Cleaned up: {os.path.basename(temp_file_path)}")
                except Exception as cleanup_error:
                    logger.warning(f"⚠️ Failed to cleanup {temp_file_path}: {cleanup_error}")
        
        cleanup_time = time.time() - cleanup_start
        if cleaned_files > 0:
            logger.info(f"🧹 Cleanup complete: {cleaned_files} files removed in {cleanup_time:.2f}s")
        
        # Log final processing summary
        total_process_time = time.time() - processing_start
        logger.info(f"🏁 Total processing time: {total_process_time:.2f}s for {len(temp_file_paths)} files")
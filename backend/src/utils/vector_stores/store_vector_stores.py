import os
import shutil
from flask import current_app
from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

import time
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch

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
    
    loader_class = loader_class = loader_map.get(file_extension)
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

def process_files_and_create_vector_store(temp_file_paths, user_id, collection_name, config_id):
    """
    Processes multiple uploaded documents, combines their content, creates a single 
    Chroma vector store, uploads it to S3, and cleans up local files.

    Args:
        temp_file_paths (list): A list of paths to the temporary uploaded files.
        user_id (str): The ID of the user.
        collection_name (str): The name for the ChromaDB collection.

    Returns:
        str: The S3 path to the created vector store, or None if an error occurs.
    """
    
    
    all_splits = []

    try:
        db = current_app.config['MONGO_DB']
        mongo_collection = db['vector_collection']

        # --- 1. Load and Split Documents from All Files ---
        for temp_file_path in temp_file_paths:
            loader = get_document_loader(temp_file_path)
            if not loader:
                continue  # Skip unsupported file types

            current_app.logger.info(f"Loading document: {temp_file_path}")
            try:
                pages = loader.load()
                current_app.logger.info(f"Successfully loaded {len(pages)} pages from {temp_file_path}")
            except Exception as e:
                current_app.logger.error(f"Error loading document {temp_file_path}: {str(e)}")
                continue


            # Split the document and add its chunks to the master list
            recursive_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=20)
            splits = recursive_splitter.split_documents(pages)
            for split in splits:
                split.metadata['user_id'] = user_id
                split.metadata['config_id'] = str(config_id) # Link chunk to the config
                split.metadata['collection_name'] = collection_name
                split.metadata['original_file'] = os.path.basename(temp_file_path)

            
            all_splits.extend(splits)
            current_app.logger.info(f"Processed {len(splits)} chunks from {os.path.basename(temp_file_path)}. First chunk content: {splits[0].page_content[:100] if splits else 'No chunks'}")

        if not all_splits:
            current_app.logger.error("No documents could be processed from the provided files.")
            return None

        # --- 2. Create a Single Vector Store from All Combined Splits ---
        current_app.logger.info(f"Inserting {len(all_splits)} document chunks into Atlas for collection '{collection_name}'")
        # Note: Ensure you have your OpenAI API key set in your environment for this to work
        embeddings = current_app.config['EMBEDDINGS']
        
        MongoDBAtlasVectorSearch.from_documents(
            documents=all_splits,
            embedding=embeddings,
            collection=mongo_collection,
            index_name="vector_index"
        )
        current_app.logger.info("Successfully inserted vectors into MongoDB Atlas.")
       
        # --- 3. Upload the Entire Vector Store Directory to S3 ---
        
       
    except Exception as e:
        current_app.logger.error(f"Error during vector store processing/upload: {e}")
        return None
        
    finally:
        for temp_file_path in temp_file_paths:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                current_app.logger.info(f"Cleaned up temporary upload file: {temp_file_path}")
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
import logging
import re
import json
import time
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_mongodb.chat_message_histories import MongoDBChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.messages import BaseMessage, messages_from_dict, message_to_dict
from models.config import Config
from bson import ObjectId
from langchain_community.chat_models import ChatTongyi
from langchain_deepseek import ChatDeepSeek

logger = logging.getLogger(__name__)
chat_bp = Blueprint('chat_routes', __name__)

# --- DB Collections ---
# 1. chat_session_metadata: Stores one document per chat session with user_id and config_id.
# 2. message_store: Stores all messages from all sessions, using LangChain's standard format.

@chat_bp.route('/history/<string:chat_id>', methods=['GET'])
def get_chat_history(chat_id):
    """Retrieves the message history for a specific chat session."""
    try:
        history = MongoDBChatMessageHistory(
            connection_string=current_app.config['MONGO_URI'],
            session_id=chat_id,
            database_name=current_app.config['MONGO_DB'].name,
            collection_name="message_store"
        )
        history_dicts = [message_to_dict(m) for m in history.messages]
        return jsonify({"history": history_dicts}), 200
    except Exception as e:
        logger.error(f"Error fetching history for chat {chat_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

@chat_bp.route('/chat/list/<string:config_id>', methods=['GET'])
@jwt_required()
def get_chat_list(config_id):
    try:
        user_id = get_jwt_identity()
        db = current_app.config['MONGO_DB']
        metadata_collection = db["chat_session_metadata"]

        # This pipeline does all the heavy lifting in the database.
        pipeline = [
            {
                '$match': {
                    '$or': [
                        {'user_id': user_id},
                        {'user_id': "anonymous"}
                    ],
                    'config_id': config_id
                }
            },
            {'$sort': {'_id': -1}},
           
            {
                '$lookup': {
                    'from': 'message_store',
                    'let': {'session_id_str': '$session_id'},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$SessionId', '$$session_id_str']}}},
                        {'$sort': {'_id': 1}},
                        {'$limit': 1},
                        {'$project': {'History': 1, '_id': 0}}
                    ],
                    'as': 'first_message_info'
                }
            },
            {
                '$project': {
                    '_id': 1, # Keep _id for timestamp and updates
                    'session_id': '$session_id',
                    'user_id': '$user_id',
                    'timestamp': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S.%LZ', 'date': '$_id'}},
                    'first_message_history': {'$arrayElemAt': ['$first_message_info.History', 0]}
                }
            }
        ]

        # 1. Execute the single, efficient pipeline
        sessions_from_db = list(metadata_collection.aggregate(pipeline))
        
        sessions_list = []
        # 2. Loop through the results just to create the title and claim anonymous chats
        for session in sessions_from_db:
            
            # If the chat is anonymous, claim it for the current user
            if session.get('user_id') == 'anonymous':
                 metadata_collection.update_one(
                    {"_id": session["_id"]}, # Use the _id we kept in the pipeline
                    {"$set": {"user_id": user_id}}
                )
                 print(f"✅ Claimed anonymous chat {session['session_id']} for user {user_id}")


            title = "New Chat"
            try:
                # Use the correct field name from the pipeline: 'first_message_history'
                if session.get('first_message_history'):
                    history_data = json.loads(session['first_message_history'])
                    if history_data.get("data", {}).get("content"):
                        title = history_data["data"]["content"]
            except (json.JSONDecodeError, TypeError):
                pass  # Ignore malformed history

            sessions_list.append({
                'session_id': session['session_id'],
                'title': title[:100],
                'timestamp': session['timestamp']
            })

        # 3. The return statement is OUTSIDE and AFTER the loop
        return jsonify({"sessions": sessions_list}), 200
    except Exception as e:
        logger.error(f"Error fetching chat list for config {config_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

class CustomMongoDBChatMessageHistory(MongoDBChatMessageHistory):
    """Custom history class to save user_id and config_id with each message."""
    def __init__(self, connection_string: str, session_id: str, database_name: str, collection_name: str, user_id: str, config_id: str):
        super().__init__(connection_string, session_id, database_name, collection_name)
        self.user_id = user_id
        self.config_id = config_id

    def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in MongoDB."""
        self.collection.insert_one(
            {
                "SessionId": self.session_id,
                "user_id": self.user_id,
                "config_id": self.config_id,
                "History": json.dumps(message_to_dict(message)),
            }
        )

def get_session_history(session_id: str, user_id: str, config_id: str) -> CustomMongoDBChatMessageHistory:
    """Factory function to create a message history object and ensure session metadata exists."""
    db = current_app.config['MONGO_DB']
    metadata_collection = db["chat_session_metadata"]
    
    metadata_collection.update_one(
        {"session_id": session_id},
        {"$setOnInsert": {"user_id": user_id, "config_id": config_id, "session_id": session_id}},
        upsert=True
    )

    return CustomMongoDBChatMessageHistory(
        connection_string=current_app.config['MONGO_URI'],
        session_id=session_id,
        database_name=db.name,
        collection_name="message_store",
        user_id=user_id,
        config_id=config_id
    )

@chat_bp.route('/chat/<string:config_id>/<string:chat_id>', methods=['POST'])
def chat(config_id, chat_id):
    """Main endpoint for handling chat interactions."""
    data = request.get_json()
    if not data or 'input' not in data:
        return jsonify({"message": "Missing 'input' field"}), 400
    user_input = data['input']

    try:
        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id)})
        if not config_document:
            return jsonify({"message": "Configuration not found"}), 404

        is_public = config_document.get("is_public", False)
        owner_id = str(config_document.get("user_id"))
        
        user_id_for_history = "anonymous"
        if not is_public:
            try:
                verify_jwt_in_request()
                jwt_user_id = get_jwt_identity()
                if owner_id != jwt_user_id:
                    return jsonify({"message": "Access denied to this chatbot"}), 403
                user_id_for_history = jwt_user_id
            except Exception as e:
                return jsonify(message="Authorization error: " + str(e)), 401
        
        db = current_app.config['MONGO_DB']
        collection_name = config_document.get("collection_name")
        if not collection_name:
            logger.error(f"❌ Configuration {config_id} is missing the 'collection_name' field.")
            return jsonify({"message": "Configuration is missing collection name."}), 400

        vector_store = MongoDBAtlasVectorSearch(
            collection=db[collection_name],
            embedding=current_app.config['EMBEDDINGS'],
            index_name="hnsw_index",
            text_key="text",
            embedding_key="embedding"
        )
        
        # Log vector store initialization
        logger.info(f"📊 Initialized HNSW vector store: collection='{collection_name}', index='hnsw_index'")
        
        # Create optimized retriever with clean logging
        def filtered_retriever(query):
            """Perform HNSW vector search with config-based filtering."""
            import time
            start_time = time.time()
            
            try:
                # Perform filtered vector search
                docs = vector_store.similarity_search(
                    query=query,
                    k=3,
                    pre_filter={"config_id": {"$eq": config_id}}
                )
                
                search_time = time.time() - start_time
                
                # Log search results
                if docs:
                    logger.info(f"✅ Found {len(docs)} relevant documents in {search_time:.3f}s")
                    # Log first result preview for context verification
                    preview = docs[0].page_content[:100].replace('\n', ' ')
                    logger.info(f"📄 Top result: {preview}...")
                else:
                    logger.warning(f"⚠️ No documents found for config {config_id} in {search_time:.3f}s")
                
                return docs
                
            except Exception as e:
                search_time = time.time() - start_time
                logger.error(f"❌ Vector search failed after {search_time:.3f}s: {str(e)}")
                return []
        

        
        system_prompt_template = re.sub(r'Question:.*', '', config_document.get("prompt_template", "")).strip()
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt_template + "\n\nContext:\n{context}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])
        
        model_name = config_document.get("model_name")
        temperature = config_document.get("temperature")
        llm = None
        
        if model_name.startswith('gpt'):
            llm = ChatOpenAI(model=model_name, temperature=temperature, api_key=current_app.config.get("OPENAI_API_KEY"))
        elif model_name.startswith('qwen'):
            llm = ChatTongyi(model=model_name, api_key=current_app.config.get("QWEN_API_KEY"))
        elif model_name.startswith('deepseek'):
            llm = ChatDeepSeek(model=model_name, temperature=temperature, api_key=current_app.config.get("DEEPSEEK_API_KEY"))
        
        if not llm:
            return jsonify({"message": f"Unsupported model: {model_name}"}), 400

        def format_docs(docs):
            """Format retrieved documents into context for the LLM."""
            if not docs:
                logger.warning("⚠️ No documents to format - empty context will be sent to LLM")
                return ""
            
            context = "\n\n".join(doc.page_content for doc in docs)
            logger.info(f"📝 Formatted context: {len(docs)} docs, {len(context):,} chars")
            
            # Log context preview (first 200 chars) for debugging
            preview = context[:200].replace('\n', ' ') if context else "(empty)"
            logger.debug(f"🔍 Context preview: {preview}...")
            
            return context

        # Convert functions to runnables
        question_to_retriever = RunnableLambda(lambda x: x["question"])
        retriever_runnable = RunnableLambda(filtered_retriever)
        format_docs_runnable = RunnableLambda(format_docs)
        
        rag_chain = (
            RunnablePassthrough.assign(
                context=question_to_retriever | retriever_runnable | format_docs_runnable
            )
            | prompt
            | llm
            | StrOutputParser()
        )

        chain_with_history = RunnableWithMessageHistory(
            rag_chain,
            lambda session_id: get_session_history(session_id, user_id_for_history, config_id),
            input_messages_key="question",
            history_messages_key="history",
        )

        # Retrieve relevant documents and generate response
        logger.info(f"💬 Processing chat query: '{user_input[:50]}{'...' if len(user_input) > 50 else ''}'")
        
        # Get relevant documents
        docs = filtered_retriever(user_input)
        context = format_docs(docs)
        
        # Generate LLM response
        logger.info(f"🤖 Generating LLM response with {len(context):,} chars of context...")
        llm_start = time.time()
        
        try:
            response_content = chain_with_history.invoke(
                {"question": user_input, "context": context},
                config={"configurable": {"session_id": chat_id}}
            )
            
            llm_time = time.time() - llm_start
            logger.info(f"✅ LLM response generated in {llm_time:.2f}s ({len(response_content)} chars)")
            
            # Prepare source information
            sources = []
            for doc in docs:
                source_info = {
                    "source": doc.metadata.get("original_file", doc.metadata.get("source", "Unknown")),
                    "page_content": doc.page_content[:200] + ("..." if len(doc.page_content) > 200 else ""),
                    "chunk_index": doc.metadata.get("chunk_index", 0)
                }
                sources.append(source_info)
            
            logger.info(f"📊 Chat completed successfully: {len(docs)} sources, response length: {len(response_content)}")
            
            return jsonify({
                "response": response_content,
                "sources": sources,
                "metadata": {
                    "documents_found": len(docs),
                    "context_length": len(context),
                    "response_time": round(llm_time, 2)
                }
            })
            
        except Exception as llm_error:
            llm_time = time.time() - llm_start
            logger.error(f"❌ LLM generation failed after {llm_time:.2f}s: {str(llm_error)}")
            return jsonify({
                "error": "Failed to generate response",
                "message": "An error occurred while processing your request."
            }), 500

    except Exception as e:
        logger.error(f"❌ Unexpected error in chat endpoint: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": "An unexpected error occurred while processing your request."
        }), 500

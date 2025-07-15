from flask import Flask, Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
import logging
import re
from langchain_openai import OpenAIEmbeddings

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_mongodb import MongoDBChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from models.config import Config # Your configuration model
from bson import ObjectId
from langchain_community.chat_models import ChatTongyi
from langchain_deepseek import ChatDeepSeek
from langchain_core.messages import HumanMessage, AIMessage
from src.utils.vector_store_utils import initialize_vector_store

# --- Setup ---
logger = logging.getLogger(__name__)
chat_bp = Blueprint('chat_routes', __name__)

@chat_bp.route('/history/<string:chat_id>', methods=['GET'])
def get_chat_history(chat_id):
    """
    Retrieves the message history for a specific chat session.
    """
    try:
        db = current_app.config['MONGO_DB']
        history_collection = db["chat_histories"]
        history_doc = history_collection.find_one({"session_id": chat_id})
        
        if history_doc:
            return jsonify({"history": history_doc.get("history", [])}), 200
        else:
            return jsonify({"history": []}), 200
            
    except Exception as e:
        logger.error(f"Error fetching history for chat {chat_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

@chat_bp.route('/chat/list/<string:config_id>', methods=['GET'])
@jwt_required()
def get_chat_list(config_id):
    """
    Retrieves a list of all chat sessions for a specific configuration
    belonging to the authenticated user.
    """
    try:
        user_id = get_jwt_identity()
        db = current_app.config['MONGO_DB']
        history_collection = db["chat_histories"]
        
        chat_sessions = history_collection.find(
            {"user_id": user_id, "config_id": config_id},
            {"session_id": 1, "history.content": {"$slice": 1}, "_id": 0} 
        )
        
        sessions_list = []
        for session in chat_sessions:
            first_message = "New Chat"
            if session.get("history"):
                # Ensure history and its first element are not empty
                if session["history"][0].get("data"):
                     first_message = session["history"][0]["data"].get("content", "New Chat")
            
            sessions_list.append({
                "session_id": session.get("session_id"),
                "title": first_message[:50]
            })

        return jsonify({"sessions": sessions_list}), 200
            
    except Exception as e:
        logger.error(f"Error fetching chat list for config {config_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

def get_session_history(session_id: str, user_id: str, config_id: str):
    """
    Factory function to create a message history object.
    It now also handles setting initial metadata for new chats.
    """
    db = current_app.config['MONGO_DB']
    history = MongoDBChatMessageHistory(
        session_id=session_id,
        connection_string=current_app.config['MONGO_URI'],
        database_name=db.name,
        collection_name="chat_histories",
    )
    
    # ✅ OPTIMIZATION: For new chats, add metadata here.
    # This runs only if no history exists for the session_id.
    if not history.messages:
        history_collection = db["chat_histories"]
        history_collection.update_one(
            {"session_id": session_id},
            {"$setOnInsert": {"user_id": user_id, "config_id": config_id}},
            upsert=True
        )
    return history

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
        owner_id = config_document.get("user_id")
        
        if not is_public:
            verify_jwt_in_request()
            jwt_user_id = get_jwt_identity()
            if owner_id != jwt_user_id:
                return jsonify({"message": "Access denied to this chatbot"}), 403
        
        db = current_app.config['MONGO_DB']
        vector_store = initialize_vector_store(
            db=db,
            config_id=config_id,
            embeddings=current_app.config['EMBEDDINGS']
        )
        
        retriever = vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={"k": 3, "pre_filter": {"config_id": {"$eq": config_id}}}
        )
        
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
            logger.info(f"✅ Retriever fetched {len(docs)} documents.")
            return "\n\n".join(doc.page_content for doc in docs)

        # ✅ OPTIMIZATION: Simplified RAG chain structure
        rag_chain = (
            RunnablePassthrough.assign(
                context=(lambda x: x["question"]) | retriever | format_docs
            )
            | prompt
            | llm
            | StrOutputParser()
        )

        # ✅ OPTIMIZATION: Let RunnableWithMessageHistory handle everything.
        # No more manual history fetching or saving in this endpoint.
        chain_with_history = RunnableWithMessageHistory(
            rag_chain,
            lambda session_id: get_session_history(session_id, owner_id, config_id),
            input_messages_key="question",
            history_messages_key="history",
        )

        response_content = chain_with_history.invoke(
            {"question": user_input},
            config={"configurable": {"session_id": chat_id}}
        )

        return jsonify({"response": response_content})

    except Exception as e:
        logger.error(f"An unexpected error occurred in the chat endpoint: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

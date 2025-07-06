from flask import Flask, Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
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
# --- Setup ---
logger = logging.getLogger(__name__)
chat_bp = Blueprint('chat_routes', __name__)
# ✅ NEW: Endpoint to fetch chat history
@chat_bp.route('/history/<string:chat_id>', methods=['GET'])
@jwt_required()
def get_chat_history(chat_id):
    """
    Retrieves the message history for a specific chat session,
    ensuring it belongs to the authenticated user.
    """
    try:
        user_id = get_jwt_identity()
        db = current_app.config['MONGO_DB']
        history_collection = db["chat_histories"]
        
        # Find the history document, ensuring it matches the user
        history_doc = history_collection.find_one({
            "session_id": chat_id,
            "user_id": user_id 
        })
        
        if history_doc:
            # Return the list of messages
            return jsonify({"history": history_doc.get("history", [])}), 200
        else:
            # If no history is found (e.g., new chat), return an empty list
            return jsonify({"history": []}), 200
            
    except Exception as e:
        logger.error(f"Error fetching history for chat {chat_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

@chat_bp.route('chat/list/<string:config_id>', methods=['GET'])
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
        
        # Find all sessions matching the user and config, but only return
        # the session_id and the first message for the sidebar title.
        chat_sessions = history_collection.find(
            {"user_id": user_id, "config_id": config_id},
            # Projection: 1 means include, 0 means exclude
            {"session_id": 1, "history.content": {"$slice": 1}, "_id": 0} 
        )
        
        sessions_list = []
        for session in chat_sessions:
            first_message = "New Chat"
            if session.get("history"):
                first_message = session["history"][0].get("content", "New Chat")
            
            sessions_list.append({
                "session_id": session.get("session_id"),
                "title": first_message[:50] # Truncate title for display
            })

        return jsonify({"sessions": sessions_list}), 200
            
    except Exception as e:
        logger.error(f"Error fetching chat list for config {config_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

@chat_bp.route('chat/<string:config_id>/<string:chat_id>', methods=['POST'])
@jwt_required()
def chat(config_id, chat_id):
    """
    Handles a user's chat message using MongoDB Atlas Vector Search for RAG
    and manages conversation history.
    """
    # 1. Get data from the JSON request body
    data = request.get_json()
    if not data:
        return jsonify({"message": "No JSON data received"}), 400

    user_input = data.get('input')
    user_id = get_jwt_identity()

    if not all([user_input, chat_id, config_id]):
        return jsonify({"message": "Missing required fields: query, chat_id, or config_id"}), 400

    try:
        # 2. Fetch the specific configuration from the database
        config_document = Config.get_collection().find_one({
            "_id": ObjectId(config_id),
        })

        if not config_document:
            return jsonify({"message": "Configuration not found or access denied"}), 404

        # 3. Initialize Atlas Vector Search and create a retriever
        db = current_app.config['MONGO_DB']
        mongo_collection = db['vector_collection']
        embeddings = current_app.config['EMBEDDINGS']
        logger.info(f"Mongo Collection {mongo_collection}",exc_info=True)
        vector_store = MongoDBAtlasVectorSearch(
            collection=mongo_collection,
            embedding=embeddings,
            index_name="vector_index",

        )
        retriever = vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
            "k": 3,           # Number of documents to retrieve
            "lambda_mult": 0.5,
             "fetch_k":5,
             "pre_filter": {
                    "$and": [
                        {"config_id": {"$eq": config_id}},
                        {"user_id": {"$eq": user_id}}
                    ]
                }
        }
        )
        logger.info(f"retriever {retriever}", exc_info=True)
        try:
            retrieved_docs = retriever.invoke(user_input)

            logger.info(f"--- Retrieved {len(retrieved_docs)} documents for query (no filter): '{user_input}' ---")
            for i, doc in enumerate(retrieved_docs):
                logger.info(f"Doc {i+1}: {doc.page_content[:100]}...")
        except Exception as e:
            logger.error(f"Error during retrieval: {e}", exc_info=True)
            retrieved_docs = []

        # ✅ FIX: Dynamically clean the prompt template to remove the redundant question part.
        # This makes the prompt compatible with the chat history structure.
        base_template = config_document.get("prompt_template", "")
        # Remove any lines starting with "Question:" and the {query} or {question} placeholders
        system_prompt_template = re.sub(r'Question:.*', '', base_template.replace("{query}", "{question}")).strip()


        # 4. Define a new, conversational prompt template
        # This includes a placeholder for the chat history.
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt_template),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])
        model_name=config_document.get("model_name")
        temperature=config_document.get("temperature")
        llm = None

        if model_name.startswith('gpt'):
            api_key = current_app.config.get("OPENAI_API_KEY")
            if not api_key:
                return jsonify({"message": "OpenAI API key is not configured on the server."}), 500
            # Assumes OPENAI_API_KEY is set in your environment
            llm = ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
        elif model_name.startswith('qwen'):
            api_key = current_app.config.get("QWEN_API_KEY")
            if not api_key:
                return jsonify({"message": "Dashscope (Qwen) API key is not configured on the server."}), 501
            
            # Assumes DASHSCOPE_API_KEY is set in your environment
            llm = ChatTongyi(model=model_name, api_key=api_key)
        elif model_name.startswith('deepseek'):
             api_key = current_app.config.get("DEEPSEEK_API_KEY")
             if not api_key:
                return jsonify({"message": "DeepSeek API key is not configured on the server."}), 501
            # Assumes DEEPSEEK_API_KEY is set in your environment
             llm = ChatDeepSeek(model=model_name, temperature=temperature, api_key=api_key)
        
        if not llm:
            return jsonify({"message": f"Unsupported or unknown model: {model_name}"}), 400

        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        # 5. Create the core RAG chain
        rag_chain = (
            RunnablePassthrough.assign(
                 context= (lambda x: x["question"]) | retriever | format_docs
                 )
            | prompt
            | llm
            | StrOutputParser()
            
        )
        db = current_app.config['MONGO_DB']
        history_collection = db["chat_histories"]
        history_doc = history_collection.find_one({"session_id": chat_id})
        chat_history = history_doc.get("history", []) if history_doc else []

        langchain_history = []
        for msg in chat_history:
            if msg.get('type') == 'human':
                langchain_history.append(HumanMessage(content=msg.get('content')))
            elif msg.get('type') == 'ai':
                langchain_history.append(AIMessage(content=msg.get('content')))

        response_content = rag_chain.invoke({
            "question": user_input,
            "history": langchain_history
        })

        # 4. Append the new turn to the history list
        chat_history.append({"type": "human", "content": user_input})
        chat_history.append({"type": "ai", "content": response_content})
        history_collection.update_one(
            {"session_id": chat_id},
            {"$set": {"history": chat_history, "user_id": user_id, "config_id": config_id}},
            upsert=True
        )

        # 8. Return the AI response
        return jsonify({"response": response_content})

    except Exception as e:
        logger.error(f"An unexpected error occurred in the chat endpoint: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 501

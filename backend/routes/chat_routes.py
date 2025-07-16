from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
import logging
import re
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
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
    """Retrieves a list of all chat sessions, ensuring backward compatibility."""
    try:
        user_id = get_jwt_identity()
        db = current_app.config['MONGO_DB']
        metadata_collection = db["chat_session_metadata"]
        message_collection = db["message_store"]

        # Step 1: Find all unique session IDs from the message_store for this user.
        # This ensures we find all chats, even old ones without metadata.
        pipeline = [
            {'$match': {'History': {'$exists': True}}},
            {'$project': {'SessionId': 1, 'History': 1, '_id': 1}},
            {'$sort': {'_id': 1}},
            {'$group': {
                '_id': '$SessionId',
                'first_message_doc': {'$first': '$$ROOT'}
            }}
        ]
        all_sessions = list(message_collection.aggregate(pipeline))

        # Step 2: For each session, ensure metadata exists and fetch title.
        sessions_list = []
        for session_group in all_sessions:
            session_id = session_group['_id']
            if not session_id:
                continue

            # Ensure metadata exists, creating it if it's missing (for old chats).
            metadata_doc = metadata_collection.find_one_and_update(
                {"session_id": session_id},
                {"$setOnInsert": {"user_id": user_id, "config_id": config_id, "session_id": session_id}},
                upsert=True,
                return_document=True
            )

            # Step 3: Only include sessions that belong to the current user and config.
            if metadata_doc.get('user_id') == user_id and metadata_doc.get('config_id') == config_id:
                title = "New Chat"
                first_message_doc = session_group['first_message_doc']
                try:
                    history_data = json.loads(first_message_doc["History"])
                    if history_data.get("data", {}).get("content"):
                        title = history_data["data"]["content"]
                except (json.JSONDecodeError, TypeError):
                    pass # Ignore malformed history

                sessions_list.append({
                    'session_id': session_id,
                    'title': title[:100],
                    'timestamp': metadata_doc['_id'].generation_time.isoformat()
                })
        
        # Sort sessions by timestamp descending
        sessions_list.sort(key=lambda s: s['timestamp'], reverse=True)

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
        vector_store = MongoDBAtlasVectorSearch(
            collection=db['vector_collection'],
            embedding=current_app.config['EMBEDDINGS'],
            index_name="vector_index"
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
            return "\n\n".join(doc.page_content for doc in docs)

        rag_chain = (
            RunnablePassthrough.assign(
                context=(lambda x: x["question"]) | retriever | format_docs
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

        response_content = chain_with_history.invoke(
            {"question": user_input},
            config={"configurable": {"session_id": chat_id}}
        )

        return jsonify({"response": response_content})

    except Exception as e:
        logger.error(f"An unexpected error occurred in the chat endpoint: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred."}), 500

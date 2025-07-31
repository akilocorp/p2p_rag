from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from bson import ObjectId
import logging
import time
from models.config import Config
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.messages import BaseMessage, messages_from_dict, message_to_dict, AIMessage
from langchain_community.chat_models import ChatTongyi
from langchain_deepseek import ChatDeepSeek
from .chat_routes import get_session_history

logger = logging.getLogger(__name__)

survey_chat_bp = Blueprint('survey_chat_routes', __name__)

@survey_chat_bp.route('/survey-chat/<string:config_id>/init', methods=['POST'])
def init_survey_chat(config_id):
    """
    Initialize a survey chat by returning a welcome message.
    This endpoint is called when a survey chat page is first loaded.
    """
    try:
        if not ObjectId.is_valid(config_id):
            return jsonify({"error": "Invalid configuration ID format"}), 400

        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id)})
        if not config_document:
            return jsonify({"error": "Configuration not found"}), 404

        if config_document.get('config_type') != 'survey':
            return jsonify({"error": "This endpoint is only for survey chats"}), 400

        user_id = "public_user"
        if not config_document.get("is_public", False):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                if config_document.get("user_id") != user_id:
                    return jsonify({"error": "Access denied"}), 403
            except Exception:
                return jsonify({"error": "Authentication required"}), 401

        bot_name = config_document.get('bot_name', 'your assistant')
        welcome_message = f"Hello, I am {bot_name}. I'm here to conduct a survey. Would you like to begin?"

        chat_id = str(ObjectId())
        history = get_session_history(chat_id, user_id, config_id)
        history.add_message(AIMessage(content=welcome_message))

        return jsonify({"response": welcome_message, "chat_id": chat_id}), 200

    except Exception as e:
        logger.error(f"Error initializing survey chat for config {config_id}: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500


@survey_chat_bp.route('/survey-chat/<string:config_id>/<string:chat_id>', methods=['POST'])
def survey_chat(config_id, chat_id):
    """
    Handle survey chat messages with full LLM and vector integration.
    Survey-specific: AI initiates first message and guides survey flow.
    """
    try:
        data = request.get_json()
        user_input = data.get('input', '').strip()
        if not user_input:
            return jsonify({"error": "Input is required"}), 400

        if not ObjectId.is_valid(config_id):
            return jsonify({"error": "Invalid configuration ID format"}), 400

        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id)})
        if not config_document:
            return jsonify({"error": "Configuration not found"}), 404

        if config_document.get('config_type') != 'survey':
            return jsonify({"error": "This endpoint is only for survey chats"}), 400

        user_id = "public_user"
        user_id_for_history = "public_user"
        if not config_document.get("is_public", False):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                user_id_for_history = user_id
                if config_document.get("user_id") != user_id:
                    return jsonify({"error": "Access denied"}), 403
            except Exception:
                return jsonify({"error": "Authentication required"}), 401

        # --- LLM Configuration ---
        logger.info(f"🤖 Initializing LLM for survey chat...")
        llm_provider = config_document.get('llm_provider', 'openai')
        llm_type = config_document.get('model_name', 'gpt-3.5-turbo')
        temperature = config_document.get('temperature', 0.7)
        logger.info(f"Initializing LLM: {llm_type} with temperature: {temperature}")

        if llm_type == 'qwen-turbo':
            llm = ChatTongyi(model_name=llm_type, temperature=temperature)
        elif llm_type == 'deepseek-chat':
            llm = ChatDeepSeek(model_name=llm_type, temperature=temperature)
        else: # Default to OpenAI
            llm = ChatOpenAI(model_name=llm_type, temperature=temperature)

        # --- Dynamic Prompt Creation ---
        prompt_template_str = config_document.get('prompt_template')
        instructions = config_document.get('instructions')

        if prompt_template_str:
            logger.info("Using advanced prompt template for survey chat.")
            prompt = ChatPromptTemplate.from_messages([
                ('system', prompt_template_str),
                MessagesPlaceholder(variable_name="history"),
                ('human', '{question}'),
            ])
        elif instructions:
            logger.info("Using instructions for survey chat.")
            prompt = ChatPromptTemplate.from_messages([
                ('system', f"{instructions}\n\nContext:\n{{context}}"),
                MessagesPlaceholder(variable_name="history"),
                ('human', '{{question}}'),
            ])
        else:
            logger.info("Using default prompt for survey chat.")
            prompt = ChatPromptTemplate.from_messages([
                ("system", (
                    "You are a professional and engaging survey conductor. Your primary role is to guide the user through a survey based on the provided context.\n"
                    "The context contains the survey questions and related information. You must use this context to ask questions, clarify user responses, and guide the conversation.\n"
                    "If the user's answer is unclear or too short, gently ask for more detail. If the user asks a question, answer it concisely using the context before returning to the survey.\n"
                    "Maintain a polite, encouraging, and neutral tone throughout the survey. Your goal is to collect complete and accurate information from the user.\n"
                    "If this is the first turn, start with the first question from the context. Otherwise, continue the survey based on the chat history.\n"
                    "Context:\n{context}"
                )),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{question}"),
            ])

        # --- Vector Store Setup ---
        logger.info(f"🔍 Setting up vector store for survey...")
        
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
        
        logger.info(f"📊 Initialized HNSW vector store: collection='{collection_name}', index='hnsw_index'")
        
        # --- Survey-Specific Retriever ---
        def filtered_retriever(query):
            """Perform HNSW vector search with config-based filtering for survey content."""
            try:
                collection_name = config_document.get('collection_name', 'default_collection')
                index_name = "hnsw_index"
                collection = current_app.db[collection_name]
                embeddings = current_app.config['EMBEDDINGS']

                vector_store = MongoDBAtlasVectorSearch(
                    collection=collection,
                    embedding=embeddings,
                    index_name=index_name
                )
                
                # Define the filter for the vector search
                search_filter = {"config_id": config_id}
                logger.info(f"🔍 Performing HNSW search in collection '{collection_name}' with filter: {search_filter}")

                # Perform the search
                retriever = vector_store.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": 3, "pre_filter": {"term": {"query": config_id, "path": "config_id"}}}
                )
                
                docs = retriever.get_relevant_documents(query)
                logger.info(f"✅ HNSW search completed. Found {len(docs)} documents.")
                return docs

            except Exception as e:
                logger.error(f"❌ HNSW search failed: {str(e)}", exc_info=True)
                return []

        def format_docs(docs):
            """Format retrieved documents into context for the survey LLM."""
            if not docs:
                logger.warning("⚠️ No documents to format - empty context will be sent to LLM")
                return ""
            
            context = "\n\n".join(doc.page_content for doc in docs)
            logger.info(f"📝 Formatted survey context: {len(docs)} docs, {len(context):,} chars")
            
            # Log context preview for debugging
            preview = context[:200].replace('\n', ' ') if context else "(empty)"
            logger.debug(f"🔍 Survey context preview: {preview}...")
            
            return context

        # --- Survey RAG Chain ---
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

        # --- Generate Survey Response ---
        logger.info(f"💬 Processing survey interaction: '{user_input[:50]}{'...' if len(user_input) > 50 else ''}'")
        
        # Get relevant survey documents
        docs = filtered_retriever(user_input)
        context = format_docs(docs)
        
        # Generate LLM response for survey
        logger.info(f"🤖 Generating survey response with {len(context):,} chars of context...")
        llm_start = time.time()
        
        try:
            response_content = chain_with_history.invoke(
                {"question": user_input, "context": context},
                config={"configurable": {"session_id": chat_id}}
            )
            
            llm_time = time.time() - llm_start
            logger.info(f"✅ Survey response generated in {llm_time:.2f}s ({len(response_content)} chars)")
            
            # Prepare source information for survey
            sources = []
            for doc in docs:
                source_info = {
                    "source": doc.metadata.get("original_file", doc.metadata.get("source", "Survey Document")),
                    "page_content": doc.page_content[:200] + ("..." if len(doc.page_content) > 200 else ""),
                    "chunk_index": doc.metadata.get("chunk_index", 0)
                }
                sources.append(source_info)
            
            logger.info(f"📊 Survey interaction completed: {len(docs)} sources, response length: {len(response_content)}")
            
            return jsonify({
                "response": response_content,
                "sources": sources,
                "metadata": {
                    "documents_found": len(docs),
                    "context_length": len(context),
                    "response_time": round(llm_time, 2),
                    "survey_mode": True
                }
            })
            
        except Exception as llm_error:
            llm_time = time.time() - llm_start
            logger.error(f"❌ Survey LLM generation failed after {llm_time:.2f}s: {str(llm_error)}")
            return jsonify({
                "error": "Failed to generate survey response",
                "message": "An error occurred while processing your survey response."
            }), 500

    except Exception as e:
        logger.error(f"❌ Unexpected error in survey chat endpoint: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": "An unexpected error occurred while processing your survey request."
        }), 500

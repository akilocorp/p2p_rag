from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from bson import ObjectId
import logging
import pymongo
import re
import json
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

        # For public surveys, check if user is authenticated but still allow access
        user_id = "public_user"
        try:
            verify_jwt_in_request(optional=True)  # Make JWT verification optional
            current_user = get_jwt_identity()
            if current_user:
                user_id = current_user  # Use authenticated user's ID if available
                
            # Check if this is a private survey and user is not the owner
            if not config_document.get("is_public", False) and config_document.get("user_id") != user_id:
                return jsonify({"error": "Access denied"}), 403
        except Exception as e:
            # If JWT is invalid but survey is public, continue with public_user
            if not config_document.get("is_public", False):
                return jsonify({"error": "Authentication required"}), 401

        bot_name = config_document.get('bot_name', 'your assistant')
        use_advanced_template = config_document.get('use_advanced_template', False)
        
        # Create smart hardcoded greeting that works for both template types
        chat_id = str(ObjectId())
        
        # Get survey purpose from config or show placeholder
        survey_purpose = config_document.get('survey_purpose')
        purpose_text = f"about {survey_purpose} " if survey_purpose else "(survey purpose) "
        
        # Generate welcome message with survey purpose
        welcome_message = f"Hello! I'm {bot_name}. I'm here to conduct a survey {purpose_text}Your input will help us improve our services. Would you like to begin?"
        
        # Save the greeting to chat history
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

        # For public surveys, check if user is authenticated but still allow access
        user_id = "public_user"
        user_id_for_history = "public_user"
        try:
            verify_jwt_in_request(optional=True)  # Make JWT verification optional
            current_user = get_jwt_identity()
            if current_user:
                user_id = current_user  # Use authenticated user's ID if available
                user_id_for_history = current_user
                
            # Check if this is a private survey and user is not the owner
            if not config_document.get("is_public", False) and config_document.get("user_id") != user_id:
                return jsonify({"error": "Access denied"}), 403
        except Exception as e:
            # If JWT is invalid but survey is public, continue with public_user
            if not config_document.get("is_public", False):
                return jsonify({"error": "Authentication required"}), 401

        # --- LLM Configuration ---
        logger.info(f"ðŸ¤– Initializing LLM for survey chat...")
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
        instructions = config_document.get('instructions')
        use_advanced_template = config_document.get('use_advanced_template', False)

        if use_advanced_template:
            logger.info("Using hard-coded advanced template for survey chat.")
            # Get survey parameters from config (with defaults)
            bot_name = config_document.get('bot_name', 'Survey Bot')
            survey_purpose = config_document.get('survey_purpose', 'gathering feedback')
            target_audience = config_document.get('target_audience', 'general users')
            creativity_rate = config_document.get('creativity_rate', 3)
            # Survey questions come from uploaded documents
            survey_questions = 'questions from uploaded documents'
            
            # Comprehensive survey AI bot template
            advanced_template = (
                f"You are {bot_name}, a professional survey conductor. Your role is to conduct a comprehensive survey based on the questions provided in the context.\n\n"
                f"**SURVEY CONTEXT:**\n"
                f"- Survey Purpose: {survey_purpose}\n"
                f"- Target Audience: {target_audience}\n"
                f"- Creativity Level: {creativity_rate}/5 (1=strict, 5=highly creative)\n\n"
                f"**SURVEY BEHAVIOR INSTRUCTIONS:**\n"
                f"1. **Question Source**: Use ONLY the questions from the uploaded documents in the context below. Do NOT create your own questions.\n"
                f"2. **Systematic Coverage**: Ask ALL questions from the context systematically. Keep track of which questions you have asked.\n"
                f"3. **One Question at a Time**: Present one question at a time and wait for the user's response before proceeding.\n"
                f"4. **Question Format**: Present questions exactly as they appear in the context, including all answer choices if provided.\n"
                f"5. **Audience Adaptation**: Adapt your language and tone to suit the {target_audience} audience.\n"
                f"6. **Creativity Application**: Apply creativity level {creativity_rate}/5 to your question presentation style:\n"
                f"   - Level 1-2: Direct, formal presentation\n"
                f"   - Level 3-4: Friendly, conversational approach\n"
                f"   - Level 5: Engaging, creative question delivery\n"
                f"7. **Progress Tracking**: Keep mental track of survey progress and inform users of their progress occasionally.\n"
                f"8. **Final Report**: After all questions are completed, provide a comprehensive summary report listing all questions asked and the user's responses.\n"
                f"9. **Early Completion**: If the user wants to stop early, provide a partial report of questions asked so far.\n\n"
                f"**IMPORTANT**: Your responses will be automatically converted to interactive format. Simply present the questions naturally - the system will handle the interactive elements.\n\n"
                f"**CONTEXT WITH SURVEY QUESTIONS:**\n"
                f"{{context}}\n\n"
                f"Present the next appropriate survey question or provide a summary report if the survey is complete. Remember to maintain the appropriate creativity level and audience focus."
            )
            prompt = ChatPromptTemplate.from_messages([
                ('system', advanced_template),
                MessagesPlaceholder(variable_name="history"),
                ('human', '{question}'),
            ])
        elif instructions:
            logger.info("Using instructions for survey chat.")
            enhanced_instructions = (
                f"{instructions}\n\n"
                "=== SURVEY CHAT BEHAVIOR ===\n"
                "You are conducting a comprehensive survey. Follow these critical rules:\n\n"
                "QUESTION TRACKING & SYSTEMATIC COVERAGE:\n"
                "* You MUST use ALL the exact questions provided in the context below from the uploaded survey documents.\n"
                "* DO NOT create your own questions. Only use questions that appear in the context.\n"
                "* Work through questions systematically - keep mental track of which questions you've asked.\n"
                "* Do NOT end the survey until you have asked EVERY question from the context.\n"
                "* If you're unsure if you've asked all questions, continue asking until you've covered everything.\n\n"
                "FINAL SURVEY REPORT:\n"
                "* Once ALL questions have been asked, provide a comprehensive summary report.\n"
                "* The final report should list every question asked and the user's answer.\n"
                "* Format the final report as regular text with clear structure.\n"
                "* Example final report format:\n"
                "  'Thank you for completing the survey! Here's a summary of your responses:\n\n"
                "  Question 1: [question text]\n"
                "  Your answer: [user's answer]\n\n"
                "  Question 2: [question text]\n"
                "  Your answer: [user's answer]\n\n"
                "  ... (continue for all questions)'\n"
                "* If the user requests to stop early, provide a partial report of questions answered so far.\n\n"
                "IMPORTANT: Your responses will be automatically converted to interactive format. Simply present the questions naturally - the system will handle the interactive elements.\n\n"
                "Context from uploaded documents:\n{{context}}\n\n"
                "CRITICAL: Only ask questions that appear in the context above. Work through ALL questions systematically."
            )
            prompt = ChatPromptTemplate.from_messages([
                ('system', enhanced_instructions),
                MessagesPlaceholder(variable_name="history"),
                ('human', '{{question}}'),
            ])
        else:
            logger.error("No prompt template or instructions provided for survey chat.")
            return jsonify({"error": "Survey configuration must include either instructions or use advanced template"}), 400

        # --- Vector Store Setup ---
        logger.info(f"ðŸ” Setting up vector store for survey...")
        
        db = current_app.config['MONGO_DB']
        # Use single shared collection for all configs (cost-effective for MongoDB Atlas)
        shared_collection_name = "documents"
        
        vector_store = MongoDBAtlasVectorSearch(
            collection=db[shared_collection_name],
            embedding=current_app.config['EMBEDDINGS'],
            index_name="hnsw_index",
            text_key="text",
            embedding_key="embedding"
        )
        
        logger.info(f"ðŸ“Š Initialized HNSW vector store: shared collection='{shared_collection_name}', config_id='{config_id}', index='hnsw_index'")
        
        # --- Survey-Specific Retriever (Shared Collection) ---
        def filtered_retriever(query):
            """Perform HNSW vector search with config-based filtering for survey content."""
            try:
                collection_name = config_document.get('collection_name', 'default_collection')
                index_name = "hnsw_index"
                # Create MongoDB connection and get collection
                mongo_client = pymongo.MongoClient(current_app.config["MONGO_URI"], serverSelectionTimeoutMS=5000)
                db = mongo_client[current_app.config["MONGO_DB_NAME"]]
                # Use shared collection for all configs
                shared_collection_name = "documents"
                collection = db[shared_collection_name]
                embeddings = current_app.config['EMBEDDINGS']

                vector_store = MongoDBAtlasVectorSearch(
                    collection=collection,
                    embedding=embeddings,
                    index_name=index_name
                )
                
                # Define the filter for the vector search
                search_filter = {"config_id": config_id}
                logger.info(f"ðŸ” Performing HNSW search in shared collection '{shared_collection_name}' with filter: {search_filter}")

                # First, count ALL documents for this config to determine k dynamically
                total_docs = collection.count_documents({"config_id": config_id})
                logger.info(f"ðŸ“Š Found {total_docs} total documents for config {config_id}")
                
                # Use the total count as k to retrieve ALL documents for this survey
                # Add buffer of +10 in case of any edge cases
                k_value = max(total_docs + 10, 20)  # Minimum 20, but scale up as needed
                logger.info(f"ðŸŽ¯ Setting k={k_value} to retrieve all survey questions")

                # Perform the search with dynamic k value
                retriever = vector_store.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": k_value, "pre_filter": {"config_id": {"$eq": config_id}}}
                )
                
                docs = retriever.invoke(query)
                logger.info(f"âœ… HNSW search completed. Found {len(docs)} documents.")
                
                # Log the content of retrieved documents for debugging
                for i, doc in enumerate(docs):
                    content_preview = doc.page_content[:200].replace('\n', ' ') if doc.page_content else '(empty)'
                    logger.info(f"ðŸ“ Document {i+1}: {content_preview}{'...' if len(doc.page_content) > 200 else ''}")
                
                return docs

            except Exception as e:
                logger.error(f"âŒ HNSW search failed: {str(e)}", exc_info=True)
                logger.info(f"ðŸ”„ Survey will continue without vector context for collection '{collection_name}'")
                return []

        def format_docs(docs):
            """Format retrieved documents into context for the survey LLM with better structure."""
            if not docs:
                logger.warning("âš ï¸ No documents to format - empty context will be sent to LLM")
                return ""
            
            # Format with clear numbering and separators to help AI track progress
            formatted_chunks = []
            for i, doc in enumerate(docs, 1):
                chunk_content = f"=== DOCUMENT CHUNK {i} ===\n{doc.page_content}\n=== END CHUNK {i} ==="
                formatted_chunks.append(chunk_content)
            
            context = "\n\n".join(formatted_chunks)
            context = f"TOTAL DOCUMENT CHUNKS: {len(docs)}\n\n{context}\n\nREMINDER: You must work through ALL {len(docs)} chunks systematically to ensure no questions are missed."
            
            logger.info(f"ðŸ“ Formatted survey context: {len(docs)} docs, {len(context):,} chars")
            
            # Log context preview for debugging
            preview = context[:300].replace('\n', ' ') if context else "(empty)"
            logger.info(f"ðŸ” Survey context preview: {preview}...")
            
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
        logger.info(f"ðŸ’¬ Processing survey interaction: '{user_input[:50]}{'...' if len(user_input) > 50 else ''}'")
        
        # Get relevant survey documents
        docs = filtered_retriever(user_input)
        context = format_docs(docs)
        
        # Generate LLM response for survey
        logger.info(f"ðŸ¤– Generating survey response with {len(context):,} chars of context...")
        llm_start = time.time()
        
        try:
            response_content = chain_with_history.invoke(
                {"question": user_input, "context": context},
                config={"configurable": {"session_id": chat_id}}
            )
            
            llm_time = time.time() - llm_start
            logger.info(f"âœ… Survey response generated in {llm_time:.2f}s ({len(response_content)} chars)")

            # --- Universal Interactive Response Converter ---
            # Convert ANY survey question to interactive JSON format, regardless of template
            logger.info(f"ðŸ” Raw AI response: {response_content[:300]}{'...' if len(response_content) > 300 else ''}")
            
            def convert_to_interactive_json(text):
                """Convert survey questions to interactive JSON format automatically."""
                import re
                
                # If already JSON, return as-is
                if text.strip().startswith('{') and text.strip().endswith('}'):
                    try:
                        json.loads(text)
                        return text
                    except:
                        pass
                
                # Detect multiple choice questions
                mc_pattern = r'(.+?)\?[\s\n]*([A-Z]\)\s*.+?)(?:\n[A-Z]\)\s*.+?)*'
                if re.search(r'[A-Z]\)\s*', text) and '?' in text:
                    lines = text.split('\n')
                    question = ''
                    options = []
                    
                    for line in lines:
                        line = line.strip()
                        if '?' in line and not line.startswith(('A)', 'B)', 'C)', 'D)', 'E)', 'F)')):
                            question = line
                        elif re.match(r'^[A-Z]\)\s*', line):
                            option = re.sub(r'^[A-Z]\)\s*', '', line)
                            options.append(option)
                    
                    if question and options:
                        return json.dumps({
                            "type": "multiple_choice",
                            "question": question,
                            "options": options,
                            "required": True
                        })
                
                # Detect scale questions (1-5 or 1-10)
                scale_1_5 = re.search(r'scale.*1.*5|1.*5.*scale|rate.*1.*5|1.*5.*rate', text, re.IGNORECASE)
                scale_1_10 = re.search(r'scale.*1.*10|1.*10.*scale|rate.*1.*10|1.*10.*rate', text, re.IGNORECASE)
                
                if scale_1_5 or scale_1_10:
                    question_match = re.search(r'(.+?)(?:scale|rate)', text, re.IGNORECASE)
                    if not question_match:
                        # Try to find question before scale mention
                        question_lines = [line.strip() for line in text.split('\n') if '?' in line]
                        if question_lines:
                            question = question_lines[0]
                        else:
                            question = text.split('\n')[0].strip()
                    else:
                        question = question_match.group(1).strip()
                    
                    if question:
                        if scale_1_10:
                            return json.dumps({
                                "type": "scale",
                                "question": question,
                                "scale_min": 1,
                                "scale_max": 10,
                                "scale_labels": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
                                "required": True
                            })
                        else:
                            return json.dumps({
                                "type": "scale",
                                "question": question,
                                "scale_min": 1,
                                "scale_max": 5,
                                "scale_labels": ["1", "2", "3", "4", "5"],
                                "required": True
                            })
                
                # Detect dropdown questions (education, selection lists)
                if re.search(r'(education|degree|select|choose)', text, re.IGNORECASE) and '-' in text:
                    lines = text.split('\n')
                    question = ''
                    options = []
                    
                    for line in lines:
                        line = line.strip()
                        if '?' in line and not line.startswith('-'):
                            question = line
                        elif line.startswith('-'):
                            option = line[1:].strip()
                            if option:
                                options.append(option)
                    
                    if question and options:
                        return json.dumps({
                            "type": "dropdown",
                            "question": question,
                            "options": options,
                            "required": True
                        })
                
                # Detect yes/no questions
                if re.search(r'\b(yes|no)\b', text, re.IGNORECASE) and '?' in text:
                    question_lines = [line.strip() for line in text.split('\n') if '?' in line]
                    if question_lines:
                        question = question_lines[0]
                        return json.dumps({
                            "type": "yes_no",
                            "question": question,
                            "required": True
                        })
                
                # Detect multiple select questions (select all that apply)
                if re.search(r'select all|all that apply|check all', text, re.IGNORECASE) and re.search(r'[A-Z]\)\s*', text):
                    lines = text.split('\n')
                    question = ''
                    options = []
                    
                    for line in lines:
                        line = line.strip()
                        if '?' in line or 'apply' in line.lower():
                            question = line
                        elif re.match(r'^[A-Z]\)\s*', line):
                            option = re.sub(r'^[A-Z]\)\s*', '', line)
                            options.append(option)
                    
                    if question and options:
                        return json.dumps({
                            "type": "multiple_select",
                            "question": question,
                            "options": options,
                            "required": False
                        })
                
                # Detect open-ended questions
                if '?' in text and ('explain' in text.lower() or 'describe' in text.lower() or 'detail' in text.lower() or 'motivate' in text.lower() or 'change' in text.lower()):
                    question_lines = [line.strip() for line in text.split('\n') if '?' in line]
                    if question_lines:
                        question = question_lines[0]
                        return json.dumps({
                            "type": "open_ended",
                            "question": question,
                            "placeholder": "Please share your thoughts...",
                            "required": False
                        })
                
                # Fallback: if it contains a question mark, make it open-ended
                if '?' in text:
                    question_lines = [line.strip() for line in text.split('\n') if '?' in line]
                    if question_lines:
                        question = question_lines[0]
                        return json.dumps({
                            "type": "open_ended",
                            "question": question,
                            "placeholder": "Please provide your answer...",
                            "required": False
                        })
                
                # Default: return original text
                return text
            
            # Convert to interactive format if it's a survey question
            interactive_response = convert_to_interactive_json(response_content)
            if interactive_response != response_content:
                logger.info("âœ… Converted survey question to interactive JSON format")
                response_content = interactive_response
            else:
                logger.info("â„¹ï¸ Response kept as original text (not a detectable question format)")
            
            # --- Robust JSON Extraction (fallback) ---
            def extract_json_from_response(text):
                """Extract the first complete JSON object from a text response."""
                # Find the first opening brace
                start_idx = text.find('{')
                if start_idx == -1:
                    return None
                
                # Count braces to find the matching closing brace
                brace_count = 0
                for i, char in enumerate(text[start_idx:], start_idx):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            # Found the complete JSON object
                            return text[start_idx:i+1]
                return None
            
            extracted_json = extract_json_from_response(response_content)
            logger.info(f"ðŸ” Extracted JSON: {extracted_json[:200] if extracted_json else 'None'}{'...' if extracted_json and len(extracted_json) > 200 else ''}")
            
            if extracted_json:
                try:
                    # Validate the extracted string is valid JSON
                    json.loads(extracted_json)
                    response_content = extracted_json  # Replace response with clean JSON
                    logger.info("âœ… Extracted and validated JSON from LLM response.")
                except json.JSONDecodeError:
                    logger.warning("âš ï¸ Found a JSON-like object, but it was invalid. Using original response.")
            else:
                logger.info("â„¹ï¸ No JSON object found in response, keeping original text.")
            
            # Prepare source information for survey
            sources = []
            for doc in docs:
                source_info = {
                    "source": doc.metadata.get("original_file", doc.metadata.get("source", "Survey Document")),
                    "page_content": doc.page_content[:200] + ("..." if len(doc.page_content) > 200 else ""),
                    "chunk_index": doc.metadata.get("chunk_index", 0)
                }
                sources.append(source_info)
            
            logger.info(f"ðŸ“Š Survey interaction completed: {len(docs)} sources, response length: {len(response_content)}")
            logger.info(f"ðŸ” Final response content: {response_content[:200]}{'...' if len(response_content) > 200 else ''}")
            logger.info(f"ðŸ” JSON extracted flag: {extracted_json is not None}")
            
            return jsonify({
                "response": response_content,
                "sources": sources,
                "metadata": {
                    "documents_found": len(docs),
                    "context_length": len(context),
                    "response_time": round(llm_time, 2),
                    "survey_mode": True,
                    "json_extracted": extracted_json is not None
                }
            })
            
        except Exception as llm_error:
            llm_time = time.time() - llm_start
            logger.error(f"âŒ Survey LLM generation failed after {llm_time:.2f}s: {str(llm_error)}")
            return jsonify({
                "error": "Failed to generate survey response",
                "message": "An error occurred while processing your survey response."
            }), 500

    except Exception as e:
        logger.error(f"âŒ Unexpected error in survey chat endpoint: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": "An unexpected error occurred while processing your survey request."
        }), 500

@survey_chat_bp.route('/survey-chat/list/<string:config_id>', methods=['GET'])
@jwt_required()
def get_survey_chat_list(config_id):
    """Get list of survey chat sessions for a specific config.
    Survey chats start with AI messages, unlike normal chats that start with human messages.
    """
    try:
        user_id = get_jwt_identity()
        db = current_app.config['MONGO_DB']
        metadata_collection = db["chat_session_metadata"]

        # Pipeline to get survey chat sessions - looks for AI messages first
        # Get both the user's chats and public user chats for this config
        pipeline = [
            {
                '$match': {
                    '$or': [
                        {'user_id': user_id},
                        {'user_id': "public_user"},  # Include public_user chats
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
                        {'$limit': 1},  # Get first message (AI in survey chat)
                        {'$project': {'History': 1, '_id': 0}}
                    ],
                    'as': 'first_message_info'
                }
            },
            {
                '$project': {
                    '_id': 1,
                    'session_id': '$session_id',
                    'user_id': '$user_id',
                    'timestamp': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S.%LZ', 'date': '$_id'}},
                    'first_message_history': {'$arrayElemAt': ['$first_message_info.History', 0]}
                }
            }
        ]

        sessions_from_db = list(metadata_collection.aggregate(pipeline))
        
        sessions_list = []
        for session in sessions_from_db:
            
            # Claim anonymous or public_user chats for current user
            if session.get('user_id') in ['anonymous', 'public_user']:
                metadata_collection.update_one(
                    {"_id": session["_id"]},
                    {"$set": {"user_id": user_id}}
                )
                logger.info(f"âœ… Claimed {session.get('user_id')} survey chat {session['session_id']} for user {user_id}")
                session['user_id'] = user_id  # Update the session in memory for title processing

            # Create title from first AI message (survey question)
            title = "Survey Chat"
            try:
                if session.get('first_message_history'):
                    import json
                    history_data = json.loads(session['first_message_history'])
                    # In survey chat, first message is from AI
                    if history_data.get("data", {}).get("content"):
                        ai_message = history_data["data"]["content"]
                        # Use first 50 chars of AI's first question as title
                        title = ai_message[:50] + ("..." if len(ai_message) > 50 else "")
                        # Clean up title (remove newlines, extra spaces)
                        title = ' '.join(title.split())
            except Exception as e:
                logger.warning(f"Could not parse survey chat title: {e}")

            sessions_list.append({
                "session_id": session["session_id"],
                "title": title,
                "timestamp": session["timestamp"]
            })

        logger.info(f"Retrieved {len(sessions_list)} survey chat sessions for config {config_id}")
        return jsonify({"sessions": sessions_list}), 200

    except Exception as e:
        logger.error(f"âŒ Error fetching survey chat sessions: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch survey chat sessions"}), 500

import json
import time
import requests
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
import logging
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_core.runnables import RunnableLambda
from models.config import Config
from bson import ObjectId

logger = logging.getLogger(__name__)

video_generation_bp = Blueprint('video_generation_routes', __name__)

def filtered_retriever(query, config_id):
    """Perform HNSW vector search with config-based filtering on shared collection."""
    try:
        db = current_app.config['MONGO_DB']
        shared_collection_name = "documents"
        
        vector_store = MongoDBAtlasVectorSearch(
            collection=db[shared_collection_name],
            embedding=current_app.config['EMBEDDINGS'],
            index_name="hnsw_index",
            text_key="text",
            embedding_key="embedding"
        )
        
        logger.info(f"📊 Initialized HNSW vector store: shared collection='{shared_collection_name}', config_id='{config_id}'")
        
        start_time = time.time()
        docs = vector_store.similarity_search(
            query=query,
            k=3,
            pre_filter={"config_id": {"$eq": config_id}}
        )
        
        search_time = time.time() - start_time
        
        if docs:
            logger.info(f"✅ Found {len(docs)} relevant documents in {search_time:.3f}s")
            preview = docs[0].page_content[:100].replace('\n', ' ')
            logger.info(f"📄 Top result: {preview}...")
        else:
            logger.warning(f"⚠️ No documents found for config {config_id} in {search_time:.3f}s")
        
        return docs
        
    except Exception as e:
        logger.error(f"❌ Vector search failed: {str(e)}")
        return []

def format_docs(docs):
    """Format retrieved documents into context for the prompt template."""
    if not docs:
        logger.warning("⚠️ No documents to format - empty context will be sent")
        return ""
    
    context = "\n\n".join(doc.page_content for doc in docs)
    logger.info(f"📝 Formatted context: {len(docs)} docs, {len(context):,} chars")
    
    return context

def inject_template_variables(template, context, query):
    """Inject context and query into the prompt template, creating video-focused scenes."""
    try:
        # If no context found, use query directly with template
        if not context.strip():
            final_prompt = template.replace("{{context}}", query).replace("{{query}}", query)
            logger.warning(f"⚠️ No context found, using query directly: {query}")
            return final_prompt
        
        # Create video-focused prompt by combining context knowledge with user query
        # Extract key visual elements from context for video generation
        video_context = f"Based on this knowledge: {context[:500]}..." if len(context) > 500 else context
        
        # Replace template variables
        final_prompt = template.replace("{{context}}", video_context).replace("{{query}}", query)
        
        logger.info(f"📝 Template injection complete: {len(final_prompt)} chars")
        logger.info(f"🎬 User query: '{query}'")
        logger.info(f"📚 Context length: {len(context)} chars")
        
        return final_prompt
    except Exception as e:
        logger.error(f"❌ Template injection failed: {str(e)}")
        return template

def create_advanced_video_prompt(context, query):
    """Create an advanced video prompt that converts knowledge into visual scenes."""
    try:
        # If no context, create a basic prompt from the query
        if not context.strip():
            logger.warning(f"⚠️ No context found for advanced template, using query-based prompt")
            return f"Create an educational video about {query}. Transform the concept into clear visual scenes with engaging demonstrations and explanations."
        
        # Extract key concepts from context for video scenes
        context_summary = context[:800] if len(context) > 800 else context
        
        # Optimized advanced template for educational content with artistic model
        # Clean up context and make it concise for video generation
        clean_context = context_summary.replace('\n', ' ').replace('\r', ' ').strip()
        clean_context = ' '.join(clean_context.split())  # Remove extra whitespace
        
        # Remove problematic Unicode characters that break JSON parsing
        clean_context = clean_context.replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
        clean_context = clean_context.replace('\u2013', '-').replace('\u2014', '-')
        
        # Keep context shorter for API limits
        if len(clean_context) > 250:
            clean_context = clean_context[:250] + "..."
        
        # Create optimized educational prompt with specific keywords for better content matching
        educational_keywords = "educational diagram, technical illustration, step-by-step tutorial, whiteboard explanation, infographic style"
        
        final_prompt = f"Educational tutorial video: {query}. Create {educational_keywords} showing {clean_context}. Display as clear diagrams, charts, text overlays, and visual explanations. Professional educational content, not abstract art. Focus on information visualization and learning materials."
        
        logger.info(f"🎨 Advanced prompt created using hardcoded template")
        logger.info(f"📝 Final prompt length: {len(final_prompt)} chars")
        logger.info(f"🎬 User query: '{query}'")
        logger.info(f"📚 Context length: {len(context)} chars")
        
        return final_prompt
        
    except Exception as e:
        logger.error(f"❌ Advanced prompt creation failed: {str(e)}")
        # Fallback to simple prompt
        return f"Create an educational video about {query}. Transform the concept into clear visual scenes."

def call_novita_kling_api(prompt, mode, duration, guidance_scale, negative_prompt):
    """Call Novita AI Kling v1.6 Text-to-Video API."""
    try:
        # Get Novita API key from environment
        novita_api_key = current_app.config.get("NOVITA_API_KEY")
        if not novita_api_key:
            raise Exception("NOVITA_API_KEY not found in configuration")
        
        # Validate parameters
        if not prompt or not prompt.strip():
            raise Exception("Prompt cannot be empty")
        
        if duration not in [5, 10]:
            raise Exception(f"Duration must be 5 or 10 seconds, got: {duration}")
        
        if not (0.0 <= guidance_scale <= 1.0):
            raise Exception(f"Guidance scale must be between 0.0 and 1.0, got: {guidance_scale}")
        
        if mode not in ["Standard"]:
            raise Exception(f"Mode must be 'Standard', got: {mode}")
        
        # Prepare API request (using cheaper model until Kling V1.6 credits are available)
        url = "https://api.novita.ai/v3/async/txt2video"
        headers = {
            "Authorization": f"Bearer {novita_api_key}",
            "Content-Type": "application/json"
        }
        
        # Clean up negative prompt (ensure it's a string, not empty if not provided)
        clean_negative_prompt = negative_prompt.strip() if negative_prompt else "low quality, blurry, distorted"
        
        payload = {
            "model_name": "darkSushiMixMix_225D_64380.safetensors",
            "height": 576,
            "width": 1024,
            "steps": 30,
            "seed": -1,
            "prompts": [
                {
                    "frames": 32,
                    "prompt": prompt.strip()
                }
            ],
            "negative_prompt": clean_negative_prompt
        }
        
        logger.info(f"🚀 Calling Novita Kling API with payload: {json.dumps(payload, indent=2)}")
        
        # Make API request
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        # Log response details for debugging
        logger.info(f"📡 API Response Status: {response.status_code}")
        logger.info(f"📡 API Response Headers: {dict(response.headers)}")
        
        if not response.ok:
            try:
                error_details = response.json()
                logger.error(f"❌ API Error Response: {json.dumps(error_details, indent=2)}")
            except:
                logger.error(f"❌ API Error Response (raw): {response.text}")
            
            raise Exception(f"Novita API returned {response.status_code}: {response.text}")
        
        result = response.json()
        logger.info(f"✅ API Success Response: {json.dumps(result, indent=2)}")
        
        task_id = result.get("task_id")
        
        if not task_id:
            raise Exception("No task_id returned from Novita API")
        
        logger.info(f"✅ Video generation task created: {task_id}")
        return task_id
        
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Novita API request failed: {str(e)}")
        raise Exception(f"Failed to call Novita API: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Novita API call failed: {str(e)}")
        raise

def poll_novita_task_result(task_id, max_wait_time=300, poll_interval=10):
    """Poll Novita API for task completion and return video URL."""
    try:
        novita_api_key = current_app.config.get("NOVITA_API_KEY")
        url = f"https://api.novita.ai/v3/async/task-result?task_id={task_id}"
        headers = {
            "Authorization": f"Bearer {novita_api_key}"
        }
        
        start_time = time.time()
        logger.info(f"🔄 Starting to poll task {task_id} (max wait: {max_wait_time}s)")
        
        while time.time() - start_time < max_wait_time:
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                result = response.json()
                
                task_info = result.get("task", {})
                status = task_info.get("status")
                progress = task_info.get("progress_percent", 0)
                
                logger.info(f"📊 Task {task_id} status: {status} ({progress}%)")
                
                if status == "TASK_STATUS_SUCCEED":
                    videos = result.get("videos", [])
                    if videos and len(videos) > 0:
                        video_url = videos[0].get("video_url")
                        video_type = videos[0].get("video_type", "mp4")
                        ttl = videos[0].get("video_url_ttl", "3600")
                        
                        logger.info(f"✅ Video generation completed: {video_url}")
                        return {
                            "status": "success",
                            "video_url": video_url,
                            "video_type": video_type,
                            "ttl": ttl,
                            "task_id": task_id
                        }
                    else:
                        raise Exception("No video URLs returned in successful response")
                
                elif status == "TASK_STATUS_FAILED":
                    reason = task_info.get("reason", "Unknown error")
                    logger.error(f"❌ Video generation failed: {reason}")
                    return {
                        "status": "failed",
                        "reason": reason,
                        "task_id": task_id
                    }
                
                # Task is still processing, wait and retry
                time.sleep(poll_interval)
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"⚠️ Polling request failed, retrying: {str(e)}")
                time.sleep(poll_interval)
                continue
        
        # Timeout reached
        logger.warning(f"⏰ Polling timeout reached for task {task_id}")
        return {
            "status": "timeout",
            "message": f"Video generation is taking longer than expected. Task ID: {task_id}",
            "task_id": task_id
        }
        
    except Exception as e:
        logger.error(f"❌ Polling failed for task {task_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
            "task_id": task_id
        }

@video_generation_bp.route('/generate_video/<string:config_id>', methods=['POST'])
def generate_video(config_id):
    """
    Main endpoint for video generation using RAG + Novita Kling API.
    Retrieves context, injects into prompt template, and generates video.
    """
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({"message": "Missing 'query' field"}), 400
    
    user_query = data['query']
    
    try:
        # Get video generation config
        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id)})
        if not config_document:
            return jsonify({"message": "Configuration not found"}), 404
        
        if config_document.get("config_type") != "video_generation":
            return jsonify({"message": "Invalid configuration type"}), 400
        
        # Check access permissions
        is_public = config_document.get("is_public", False)
        owner_id = str(config_document.get("user_id"))
        
        if not is_public:
            try:
                verify_jwt_in_request()
                jwt_user_id = get_jwt_identity()
                if owner_id != jwt_user_id:
                    return jsonify({"message": "Access denied to this video generator"}), 403
            except Exception as e:
                return jsonify({"message": "Authorization error: " + str(e)}), 401
        
        # Extract video generation parameters
        use_advanced_template = config_document.get("use_advanced_template", False)
        mode = config_document.get("mode", "Standard")
        duration = config_document.get("duration", 5)
        guidance_scale = config_document.get("guidance_scale", 0.5)
        negative_prompt = config_document.get("negative_prompt", "")
        
        logger.info(f"🎬 Starting video generation for config {config_id} with query: '{user_query[:50]}...'")
        
        # Step 1: Retrieve relevant context from knowledge base
        logger.info(f"🔍 Retrieving context from knowledge base...")
        docs = filtered_retriever(user_query, config_id)
        context = format_docs(docs)
        
        # Step 2: Create final prompt based on template type
        if use_advanced_template:
            logger.info(f"🎨 Using hardcoded advanced template")
            final_prompt = create_advanced_video_prompt(context, user_query)
        else:
            instructions = config_document.get("instructions", "")
            logger.info(f"📝 Using custom instructions template")
            final_prompt = inject_template_variables(instructions, context, user_query)
        
        # Step 3: Call Novita Kling API to start video generation
        logger.info(f"🚀 Calling Novita Kling API...")
        task_id = call_novita_kling_api(
            prompt=final_prompt,
            mode=mode,
            duration=duration,
            guidance_scale=guidance_scale,
            negative_prompt=negative_prompt
        )
        
        # Step 4: Poll for completion and get video URL
        logger.info(f"⏳ Polling for video completion...")
        result = poll_novita_task_result(task_id)
        
        # Prepare response with metadata
        response_data = {
            "query": user_query,
            "final_prompt": final_prompt,
            "context_docs_found": len(docs),
            "context_length": len(context),
            "video_params": {
                "mode": mode,
                "duration": duration,
                "guidance_scale": guidance_scale,
                "negative_prompt": negative_prompt
            },
            "result": result
        }
        
        if result["status"] == "success":
            logger.info(f"✅ Video generation completed successfully for config {config_id}")
            return jsonify(response_data), 200
        elif result["status"] == "failed":
            logger.error(f"❌ Video generation failed for config {config_id}: {result.get('reason')}")
            return jsonify(response_data), 500
        elif result["status"] == "timeout":
            logger.warning(f"⏰ Video generation timeout for config {config_id}")
            return jsonify(response_data), 202  # Accepted but still processing
        else:
            logger.error(f"❌ Unknown video generation status for config {config_id}: {result['status']}")
            return jsonify(response_data), 500
        
    except Exception as e:
        logger.error(f"❌ Unexpected error in video generation endpoint: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": "An unexpected error occurred while generating video."
        }), 500

@video_generation_bp.route('/check_task/<string:task_id>', methods=['GET'])
def check_task_status(task_id):
    """Check the status of a video generation task."""
    try:
        result = poll_novita_task_result(task_id, max_wait_time=5, poll_interval=1)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"❌ Error checking task status {task_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "task_id": task_id
        }), 500

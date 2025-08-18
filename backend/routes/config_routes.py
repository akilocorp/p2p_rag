from flask import Flask, Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request, unset_jwt_cookies
import urllib.parse
import logging
import os
from werkzeug.utils import secure_filename
from src.utils.vector_stores.store_vector_stores import process_files_and_create_vector_store
from models.config import Config
from models.user import User

import json
from bson import ObjectId
# --- Setup and Configuration ---
logger = logging.getLogger(__name__)
UPLOAD_FOLDER = "uploads/"
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'md', 'docx'}

config_bp = Blueprint('config_routes', __name__)

def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS



@config_bp.route('/config_list', methods=['GET'])
@jwt_required()
def getconfigs():
    user_id=''
    try:
        # 1. Get the user ID from the JWT token
        user_id= get_jwt_identity()
        current_app.logger.info(f"user {user_id}: ", exc_info=True)
        
        if user_id=='':
            return jsonify({"error": "User not authenticated"}), 401

        # 2. Query the database for all configs matching the user_id.
        # This example assumes your Config model has a method like `find_by_user`.
        # If not, you can use `current_app.config['MONGO_COLLECTION'].find({"userid": user_id})`
        user_configs_cursor = Config.get_collection().find({"user_id": user_id, "config_type": "normal"})

        # 3. Serialize the documents for the JSON response
        configs_list = []
        for config in user_configs_cursor:
            config['config_id'] = str(config.pop('_id'))
            # Ensure 'collection_name' is present, defaulting to an empty string if not
            config['collection_name'] = config.get('collection_name', '')
            configs_list.append(config)
        
        # 4. Return the list of configurations
        return jsonify({"configs": configs_list}), 200

    except Exception as e:
        if user_id:
            current_app.logger.error(f"Error fetching configurations for user {user_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred"}), 500

@config_bp.route('/config/<string:config_id>', methods=['GET'])
def get_single_config(config_id):
    logger.info(f'{config_id}',exc_info=True)
    user_id=''
    """
    Fetches a single configuration.
    If the config is private, a valid JWT for the owner is required.
    If public, it can be accessed without a JWT.
    """
    try:
       
        # 2. Validate the provided config_id to ensure it's a valid MongoDB ObjectId
        if not ObjectId.is_valid(config_id):
            return jsonify({"message": "Invalid configuration ID format"}), 400

        # 3. Query the database for a document that matches BOTH the config_id and the user_id
        # This is a critical security check to prevent users from accessing others' configs.
        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id), "config_type": "normal"})
        logger.info(f"config {config_document}",exc_info=True)
        if config_document is None:
            return jsonify({"message": "Configuration not found"}), 404

        # If the chat is public, return it immediately
        if config_document.get("is_public") is True:
            config_document["config_id"] = str(config_document.pop("_id"))
            config_document['collection_name'] = config_document.get('collection_name', '')
            return jsonify({"config": config_document}), 200

        # If we're here, the chat is private, so a valid JWT is required
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
        except Exception as e:
            logger.warning(f"JWT verification failed for config {config_id}: {e}")
            return jsonify({"message": "Authentication required for this private chat"}), 401

        # Check if the authenticated user is the owner of the config
        if config_document.get("user_id") != user_id:
            return jsonify({"message": "Access denied. You are not the owner of this configuration."}), 403

        # 4. Check if a configuration was found
        

        # 5. Serialize the document for the JSON response
        # Convert the ObjectId to a string so it's JSON serializable
        config_document["config_id"] = str(config_document.pop("_id"))
        config_document['collection_name'] = config_document.get('collection_name', '')
        return jsonify({"config": config_document}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching config {config_id} for user {user_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred"}), 500

@config_bp.route('/config', methods=['POST'])
@jwt_required()
def configure_model():
    """
    API endpoint that now robustly handles 'instructions' or a full 'prompt_template'.
    """
    try:
        # --- 1. Get User ID & Form Data ---
        user_id = get_jwt_identity()
        data = request.form
        uploaded_files = request.files.getlist('files')
        current_app.logger.info(f"Received request for user {user_id} with data: {data}")

        # Parse the config JSON object sent from frontend
        config_json = data.get('config')
        if not config_json:
            return jsonify({"error": "Missing config data"}), 400
        
        try:
            import json
            config_data = json.loads(config_json)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid config data format"}), 400

        bot_name = config_data.get('bot_name')
        llm_type = config_data.get('model_name')  # Frontend sends 'model_name'
        temperature_str = str(config_data.get('temperature', 0.5))
        is_public = config_data.get('is_public', False)
        instructions = config_data.get('instructions')
        use_advanced_template = config_data.get('use_advanced_template', False)
        collection_name = config_data.get('collection_name')

        final_prompt_template = None
        if use_advanced_template:
            # Hard-coded advanced template for normal chat
            final_prompt_template = f"""You are a helpful AI assistant named '{bot_name}'.
Answer questions precisely and professionally. Use the provided reference material when relevant; if it does not contain the needed information, say so clearly.

Follow these specific instructions:
- Be helpful, professional, and polite in all responses
- Prioritize information from the reference material over general knowledge
- If the reference material contains relevant information, use it to provide accurate and detailed answers
- When the material doesn't contain sufficient information, clearly state this limitation
- Provide direct, concise answers while being thorough when the material supports it
- If asked about topics not covered in the material, politely redirect to document-based questions
- Maintain a conversational yet professional tone
- Cite source titles or filenames when appropriate; do not mention 'context' or 'reference material' explicitly in your answers"""
        elif instructions:
            starter_template = """You are a helpful AI assistant named '{bot_name}'.
Answer questions precisely and professionally. Use the provided reference material when relevant; if it does not contain the needed information, say so clearly.

Follow these specific instructions:
{instructions}

Do not mention 'context' or 'reference material' explicitly in your answers. Cite source titles or filenames when appropriate."""
            final_prompt_template = starter_template.format(
                bot_name=bot_name, 
                instructions=instructions
            )
        else:
            return jsonify({"error": "Either instructions or use_advanced_template is required"}), 400

        if not all([llm_type, temperature_str]):
            return jsonify({"error": "Missing required fields: llm_type or temperature"}), 400
        try:
            temperature = float(str(temperature_str))
            if not (0.0 <= temperature <= 2.0):
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"error": "Temperature must be a number between 0.0 and 2.0"}), 400

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        temp_file_paths = []
        uploaded_filenames = []
        for file in uploaded_files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                temp_file_path = os.path.join(UPLOAD_FOLDER, filename)
                file.save(temp_file_path)
                temp_file_paths.append(temp_file_path)
                uploaded_filenames.append(filename)
            elif file and file.filename:
                current_app.logger.warning(f"File type not allowed for {file.filename}, skipping.")

        import time
        final_collection_name = collection_name or f"coll_{user_id}_{int(time.time())}"

        config_document = {
            "user_id": user_id,
            "bot_name": bot_name,
            "collection_name": final_collection_name,
            "model_name": llm_type,
            "prompt_template": final_prompt_template,
            "temperature": temperature,
            "is_public": is_public,
            "documents": uploaded_filenames,
            "config_type": "normal"
        }
        
        result = Config.get_collection().insert_one(config_document)
        config_id = result.inserted_id
        config_document['_id'] = str(config_id)

        # --- 7. Process Files (No change) ---
        if temp_file_paths:
            process_files_and_create_vector_store(
                temp_file_paths=temp_file_paths, 
                user_id=user_id, 
                collection_name=final_collection_name,
                config_id=config_id
            )
        
        return jsonify({
            "message": "Configuration saved successfully!",
            "data": config_document
        }), 201

    except Exception as e:
        current_app.logger.error(f"An error occurred in /config route: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

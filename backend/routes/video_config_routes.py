import json
import time
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
import logging
import os
from werkzeug.utils import secure_filename
from src.utils.vector_stores.store_vector_stores import process_files_and_create_vector_store
from models.config import Config
from bson import ObjectId

logger = logging.getLogger(__name__)
UPLOAD_FOLDER = "uploads/"
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'md', 'docx'}

video_config_bp = Blueprint('video_config_routes', __name__)

def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@video_config_bp.route('/video_config_list', methods=['GET'])
@jwt_required()
def get_video_configs():
    """Fetches all video generation configurations for the authenticated user."""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "User not authenticated"}), 401

        user_configs_cursor = Config.get_collection().find({"user_id": user_id, "config_type": "video_generation"})

        configs_list = []
        for config in user_configs_cursor:
            config['config_id'] = str(config.pop('_id'))
            config['collection_name'] = config.get('collection_name', '')
            configs_list.append(config)
        
        return jsonify({"configs": configs_list}), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching video configurations for user {user_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred"}), 500

@video_config_bp.route('/video_config/<string:config_id>', methods=['GET'])
def get_single_video_config(config_id):
    """
    Fetches a single video generation configuration.
    If the config is private, a valid JWT for the owner is required.
    If public, it can be accessed without a JWT.
    """
    try:
        if not ObjectId.is_valid(config_id):
            return jsonify({"message": "Invalid configuration ID format"}), 400

        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id), "config_type": "video_generation"})

        if config_document is None:
            return jsonify({"message": "Video generation configuration not found"}), 404

        # If the config is public, return it immediately
        if config_document.get("is_public") is True:
            config_document["config_id"] = str(config_document.pop("_id"))
            config_document['collection_name'] = config_document.get('collection_name', '')
            return jsonify({"config": config_document}), 200

        # If we're here, the config is private, so a valid JWT is required
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
        except Exception as e:
            logger.warning(f"JWT verification failed for video config {config_id}: {e}")
            return jsonify({"message": "Authentication required for this private video config"}), 401

        # Check if the authenticated user is the owner of the config
        if config_document.get("user_id") != user_id:
            return jsonify({"message": "Access denied. You are not the owner of this configuration."}), 403

        config_document["config_id"] = str(config_document.pop("_id"))
        config_document['collection_name'] = config_document.get('collection_name', '')
        return jsonify({"config": config_document}), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching video config {config_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred"}), 500

@video_config_bp.route('/video_config', methods=['POST'])
@jwt_required()
def configure_video_model():
    """
    API endpoint to create a new video generation configuration.
    Handles file uploads for knowledge base and stores config with video-specific parameters.
    """
    try:
        user_id = get_jwt_identity()
        data = request.form
        uploaded_files = request.files.getlist('files')
        current_app.logger.info(f"Received video config request for user {user_id} with data: {data}")

        # Parse the config JSON object sent from frontend
        config_json = data.get('config')
        if not config_json:
            return jsonify({"error": "Missing config data"}), 400
        
        try:
            config_data = json.loads(config_json)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid config data format"}), 400

        # Extract video generation specific fields
        bot_name = config_data.get('bot_name')
        collection_name = config_data.get('collection_name')
        is_public = config_data.get('is_public', False)
        use_advanced_template = config_data.get('use_advanced_template', False)
        
        # Video generation parameters
        mode = config_data.get('mode', 'Standard')
        duration = int(config_data.get('duration', 5))
        guidance_scale = float(config_data.get('guidance_scale', 0.5))
        negative_prompt_list = config_data.get('negative_prompt', [])
        
        # Convert negative prompt list to comma-separated string
        negative_prompt_string = ', '.join(negative_prompt_list) if negative_prompt_list else ''

        # Handle instructions vs advanced template
        if use_advanced_template:
            instructions = None  # Will use hardcoded advanced template
        else:
            instructions = config_data.get('instructions')

        # Validation
        if not all([bot_name, collection_name]):
            return jsonify({"error": "Missing required fields: bot_name or collection_name"}), 400
        
        if not use_advanced_template and not instructions:
            return jsonify({"error": "Instructions are required when not using advanced template"}), 400

        if duration not in [5, 10]:
            return jsonify({"error": "Duration must be either 5 or 10 seconds"}), 400

        if not (0.0 <= guidance_scale <= 1.0):
            return jsonify({"error": "Guidance scale must be between 0.0 and 1.0"}), 400

        # Handle file uploads
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

        # Use provided collection name (now required)
        final_collection_name = collection_name

        # Create config document
        config_document = {
            "user_id": user_id,
            "bot_name": bot_name,
            "collection_name": final_collection_name,
            "is_public": is_public,
            "documents": uploaded_filenames,
            "config_type": "video_generation",
            "use_advanced_template": use_advanced_template,
            # Video generation specific fields
            "mode": mode,
            "duration": duration,
            "guidance_scale": guidance_scale,
            "negative_prompt": negative_prompt_string,
            "negative_prompt_list": negative_prompt_list  # Keep original list for editing
        }
        
        # Add template-specific fields
        if not use_advanced_template:
            config_document["instructions"] = instructions
        
        result = Config.get_collection().insert_one(config_document)
        config_id = result.inserted_id
        config_document['_id'] = str(config_id)

        # Process uploaded files and create vector store
        if temp_file_paths:
            process_files_and_create_vector_store(
                temp_file_paths=temp_file_paths, 
                user_id=user_id, 
                collection_name=final_collection_name,
                config_id=config_id
            )
        
        return jsonify({
            "message": "Video generation configuration saved successfully!",
            "data": config_document
        }), 201

    except Exception as e:
        current_app.logger.error(f"An error occurred in /video_config route: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

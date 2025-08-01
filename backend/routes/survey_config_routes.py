import json
import uuid
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

survey_config_bp = Blueprint('survey_config_routes', __name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@survey_config_bp.route('/survey_config_list', methods=['GET'])
@jwt_required()
def get_survey_configs():
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "User not authenticated"}), 401

        user_configs_cursor = Config.get_collection().find({"user_id": user_id, "config_type": "survey"})

        configs_list = []
        for config in user_configs_cursor:
            config['config_id'] = str(config.pop('_id'))
            config['collection_name'] = config.get('collection_name', '')
            configs_list.append(config)
        
        return jsonify({"configs": configs_list}), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching survey configurations for user {user_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred"}), 500

@survey_config_bp.route('/survey_config/<string:config_id>', methods=['GET'])
def get_single_survey_config(config_id):
    try:
        if not ObjectId.is_valid(config_id):
            return jsonify({"message": "Invalid configuration ID format"}), 400

        config_document = Config.get_collection().find_one({"_id": ObjectId(config_id), "config_type": "survey"})

        if config_document is None:
            return jsonify({"message": "Survey configuration not found"}), 404

        if config_document.get("is_public") is True:
            config_document["config_id"] = str(config_document.pop("_id"))
            return jsonify({"config": config_document}), 200

        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
        except Exception:
            return jsonify({"message": "Authentication required for this private survey"}), 401

        if config_document.get("user_id") != user_id:
            return jsonify({"message": "Access forbidden"}), 403

        config_document["config_id"] = str(config_document.pop("_id"))
        return jsonify({"config": config_document}), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching single survey config {config_id}: {e}", exc_info=True)
        return jsonify({"message": "An internal server error occurred"}), 500

@survey_config_bp.route('/survey_config', methods=['POST'])
@jwt_required()
def configure_survey_model():
    try:
        user_id = get_jwt_identity()
        config_json = request.form.get('config')
        if not config_json:
            return jsonify({"error": "Missing config data"}), 400

        try:
            config_data = json.loads(config_json)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON in config data"}), 400

        bot_name = config_data.get('bot_name')
        llm_type = config_data.get('llm_type')
        is_public = config_data.get('is_public', False)
        collection_name = config_data.get('collection_name')
        instructions = config_data.get('instructions')
        use_advanced_template = config_data.get('use_advanced_template', False)
        uploaded_files = request.files.getlist('files')

        if not bot_name:
            return jsonify({"error": "Missing required field: bot_name"}), 400
        if not llm_type:
            return jsonify({"error": "Missing required field: llm_type"}), 400
        if not instructions and not use_advanced_template:
            return jsonify({"error": "Either instructions or use_advanced_template is required"}), 400

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

        if not collection_name:
            collection_name = f"survey_{user_id}_{uuid.uuid4().hex[:8]}"

        config_document = {
            "user_id": user_id,
            "bot_name": bot_name,
            "collection_name": collection_name,
            "model_name": llm_type,
            "instructions": instructions,
            "use_advanced_template": use_advanced_template,
            "temperature": 0.5, # Default or from config_data
            "is_public": is_public,
            "documents": uploaded_filenames,
            "config_type": "survey"
        }
        
        result = Config.get_collection().insert_one(config_document)
        config_id = result.inserted_id
        config_document['_id'] = str(config_id)

        if temp_file_paths:
            process_files_and_create_vector_store(
                temp_file_paths=temp_file_paths, 
                user_id=user_id, 
                collection_name=collection_name,
                config_id=config_id
            )
        
        return jsonify({
            "message": "Survey configuration saved successfully!",
            "data": config_document
        }), 201

    except Exception as e:
        current_app.logger.error(f"An error occurred in /survey_config route: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

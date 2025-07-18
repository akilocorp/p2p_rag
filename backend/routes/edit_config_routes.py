from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from bson import ObjectId
import os

from models.config import Config
from src.utils.vector_stores.store_vector_stores import process_files_and_create_vector_store

edit_config_bp = Blueprint('edit_config_routes', __name__)

UPLOAD_FOLDER = "uploads/"
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'md', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@edit_config_bp.route('/config/<string:config_id>', methods=['PUT'])
@jwt_required()
def update_existing_config(config_id):
    try:
        user_id = get_jwt_identity()
        data = request.form
        files = request.files.getlist('files')

        # Validate required fields
        required_fields = ['bot_name', 'model_name', 'temperature', 'is_public']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing one or more required fields"}), 400

        # Find the config ensuring it belongs to the authenticated user
        config_to_update = Config.get_collection().find_one({
            "_id": ObjectId(config_id),
            "user_id": user_id
        })

        if not config_to_update:
            return jsonify({"message": "Configuration not found or access denied"}), 404

        # Prepare update data
        update_data = {
            "bot_name": data.get('bot_name'),
            "model_name": data.get('model_name'),
            "temperature": float(data.get('temperature', 0.7)),
            "is_public": data.get('is_public').lower() in ['true', '1'],
            "instructions": data.get('instructions'),
            "prompt_template": data.get('prompt_template'),
            "collection_name": data.get('collection_name'),
        }

        # Handle file uploads
        newly_uploaded_filenames = []
        if files:
            temp_file_paths = []
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            for file in files:
                if file and file.filename and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    temp_file_path = os.path.join(UPLOAD_FOLDER, filename)
                    file.save(temp_file_path)
                    temp_file_paths.append(temp_file_path)
                    newly_uploaded_filenames.append(filename)

            if temp_file_paths:
                process_files_and_create_vector_store(
                    temp_file_paths,
                    user_id,
                    config_to_update.get('collection_name'),
                    config_id
                )
        
        # Update documents list
        existing_documents = config_to_update.get('documents', [])
        updated_documents = list(set(existing_documents + newly_uploaded_filenames))
        update_data['documents'] = updated_documents

        # Update the document in the database
        Config.get_collection().update_one(
            {"_id": ObjectId(config_id)},
            {"$set": update_data}
        )

        return jsonify({"message": "Configuration updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating configuration: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

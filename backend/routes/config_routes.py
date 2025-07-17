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

@config_bp.route('/config/<string:config_id>', methods=['PUT'])
@jwt_required()
def update_config(config_id):
    """
    Updates a configuration, such as its public status.
    Only the owner of the config can update it.
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        is_public = data.get('is_public')

        if is_public is None or not isinstance(is_public, bool):
            return jsonify({"error": "Missing or invalid 'is_public' field"}), 400

        # Find the config ensuring it belongs to the authenticated user
        config_to_update = Config.get_collection().find_one({
            "_id": ObjectId(config_id),
            "user_id": user_id
        })

        if not config_to_update:
            return jsonify({"message": "Configuration not found or access denied"}), 404

        # Update the document in the database
        Config.get_collection().update_one(
            {"_id": ObjectId(config_id)},
            {"$set": {"is_public": is_public}}
        )

        return jsonify({"message": "Configuration updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating config {config_id}: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

@config_bp.route('/config/<string:config_id>', methods=['DELETE'])
@jwt_required()
def delete_config(config_id):
    """
    Deletes a configuration and its associated vector store collection.
    Only the owner of the config can delete it.
    """
    try:
        user_id = get_jwt_identity()
        config_to_delete = Config.get_collection().find_one({
            "_id": ObjectId(config_id),
            "user_id": user_id
        })

        if not config_to_delete:
            return jsonify({"message": "Configuration not found or access denied"}), 404

        # Delete the configuration from MongoDB
        Config.get_collection().delete_one({"_id": ObjectId(config_id)})

        # Delete the associated vector store collection from ChromaDB
        collection_name = config_to_delete.get('collection_name')
        if collection_name:
            try:
                from src.utils.vector_stores.get_vector_store import get_vector_store
                vector_store = get_vector_store(collection_name)
                # This assumes the vector store client has a delete_collection method
                vector_store._client.delete_collection(name=collection_name)
                current_app.logger.info(f"Successfully deleted vector store collection: {collection_name}")
            except Exception as e:
                # Log if the collection deletion fails, but don't block the main deletion
                current_app.logger.error(f"Failed to delete vector store collection '{collection_name}': {e}", exc_info=True)

        return jsonify({"message": "Configuration deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"An error occurred in delete_config: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

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
        user_configs_cursor = Config.find_by_user_id(user_id)

        # 3. Serialize the documents for the JSON response
        configs_list = []
        for config in user_configs_cursor:
            # Convert the MongoDB ObjectId to a string and rename it for clarity
            config['config_id'] = str(config.pop('_id'))
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
        config_document = Config.get_collection().find_one({"_id":ObjectId(config_id)})
        logger.info(f"config {config_document}",exc_info=True)
        if config_document is None:
            return jsonify({"message": "Configuration not found or access denied"}), 404
        if config_document["is_public"]==False:
            verify_jwt_in_request() # This will raise an error if no valid JWT is present
            user_id = get_jwt_identity()
            if config_document["user_id"] != user_id:
                return jsonify({"message": "Access denied"}), 403

        # 4. Check if a configuration was found
        

        # 5. Serialize the document for the JSON response
        # Convert the ObjectId to a string so it's JSON serializable
        config_document["_id"] = str(config_document["_id"])
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
        # --- 1. Get User ID & Form Data (No change) ---
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "User not authenticated"}), 401

        config_json_str = request.form.get('config')
        if not config_json_str:
            return jsonify({"message": "Missing 'config' part in form data"}), 400
        
        try:
            config_data = json.loads(config_json_str)
        except json.JSONDecodeError:
            return jsonify({"message": "Invalid JSON in 'config' part"}), 400
        
        uploaded_files = request.files.getlist('files')
        llm_type = config_data.get('model_name')
        is_public = config_data.get('is_public')

        bot_name = config_data.get('bot_name', 'Assistant') # Default bot name
        temperature_str = config_data.get('temperature')
        collection_name = config_data.get('collection_name')

        # --- 2. Get both 'instructions' and 'prompt_template' ---
        instructions = config_data.get('instructions')
        custom_prompt_template = config_data.get('prompt_template')

        # --- 3. Robustly Create the Final Prompt Template ---
        final_prompt_template = ""

        if custom_prompt_template:
            # If a full template is provided, use it directly (highest priority)
            final_prompt_template = custom_prompt_template
        elif instructions:
            # Otherwise, if instructions are provided, build the template
            starter_template = """You are a helpful AI assistant named '{bot_name}'.
Your goal is to answer questions accurately based on the context provided.

Follow these specific instructions:
{instructions}

Based on the context below, please answer the user's question. If the context doesn't contain the answer, say so.
Context: {{context}}
Question: {{question}}
Answer:"""
            final_prompt_template = starter_template.format(
                bot_name=bot_name, 
                instructions=instructions
            )
        else:
            # If neither is provided, it's an error
            return jsonify({"error": "Missing required field: please provide either 'instructions' or a 'prompt_template'"}), 400

        # --- 4. Validate Other Inputs (No change) ---
        if not all([llm_type, temperature_str]):
            return jsonify({"error": "Missing required fields: llm_type or temperature"}), 400
        
        try:
            temperature = float(str(temperature_str))
            if not (0.0 <= temperature <= 2.0):
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"error": "Temperature must be a number between 0.0 and 2.0"}), 400

        # --- 5. Handle File Uploads (No change) ---
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        temp_file_paths = []
        for file in uploaded_files:
            if file and allowed_file(file.filename):
                if file.filename:
                    filename = secure_filename(file.filename)
                    temp_file_path = os.path.join(UPLOAD_FOLDER, filename)
                    file.save(temp_file_path)
                    temp_file_paths.append(temp_file_path)
            elif file and file.filename:
                current_app.logger.warning(f"File type not allowed for {file.filename}, skipping.")

        # --- 6. Save Configuration to MongoDB ---
        mongo_collection = Config

        config_document = {
            "user_id": user_id,
            "bot_name": bot_name,
            "collection": collection_name,
            "model_name": llm_type,
            "prompt_template": final_prompt_template, # Save the dynamically created template
            "temperature": temperature,
            "is_public":is_public
        }
        
        result = mongo_collection.get_collection().insert_one(config_document)
        config_id = result.inserted_id
        config_document['_id'] = str(config_id)

        # --- 7. Process Files (No change) ---
        if temp_file_paths:
            process_files_and_create_vector_store(
                temp_file_paths=temp_file_paths, 
                user_id=user_id, 
                collection_name=collection_name,
                config_id=config_id
            )
        
        return jsonify({
            "message": "Configuration saved successfully!",
            "data": config_document
        }), 201

    except Exception as e:
        current_app.logger.error(f"An error occurred in /config route: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500

@config_bp.route('/logout', methods=['POST'])
def logout():
    """Logs the user out by unsetting the JWT cookie."""
    try:
        response = jsonify({"message": "Logout successful"})
        unset_jwt_cookies(response)
        return response, 200
    except Exception as e:
        current_app.logger.error(f"An error occurred during logout: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during logout"}), 500
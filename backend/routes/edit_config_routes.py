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


@edit_config_bp.route('/config/<string:config_id>', methods=['DELETE'])
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

        # Get the collection name from the config document before deleting it
        collection_name = config_to_delete.get('collection_name')

        # Now, delete the main configuration document
        Config.get_collection().delete_one({"_id": ObjectId(config_id)})

        # --- Cascading Delete --- 
        try:
            db = current_app.config['MONGO_DB']
            
            # 1. Delete documents from shared collection by config_id
            shared_collection_name = "documents"
            vectors_deleted_count = 0
            
            if shared_collection_name in db.list_collection_names():
                # Count documents before deletion
                vectors_deleted_count = db[shared_collection_name].count_documents({"config_id": str(config_id)})
                # Delete documents for this specific config_id
                delete_result = db[shared_collection_name].delete_many({"config_id": str(config_id)})
                current_app.logger.info(f"🗑️ Deleted {delete_result.deleted_count} documents from shared collection '{shared_collection_name}' for config_id: {config_id}")
            else:
                current_app.logger.warning(f"⚠️ Shared collection '{shared_collection_name}' not found, no vector documents to delete for config_id: {config_id}")

            # 2. Find all chat sessions associated with this config_id
            metadata_collection = db['chat_session_metadata']
            sessions_to_delete = list(metadata_collection.find({"config_id": config_id}))
            session_ids_to_delete = [s['session_id'] for s in sessions_to_delete]
            
            chat_messages_deleted = 0
            chat_sessions_deleted = 0

            if session_ids_to_delete:
                current_app.logger.info(f"Found {len(session_ids_to_delete)} chat sessions to delete for config_id: {config_id}")
                
                # 3. Delete all messages for those sessions from message_store
                message_collection = db['message_store']
                message_result = message_collection.delete_many({"SessionId": {"$in": session_ids_to_delete}})
                chat_messages_deleted = message_result.deleted_count
                current_app.logger.info(f"Deleted {vectors_deleted_count} HNSW vector chunks from shared collection for config {config_id}")

                # 4. Delete the chat session metadata itself
                metadata_result = metadata_collection.delete_many({"config_id": config_id})
                chat_sessions_deleted = metadata_result.deleted_count
                current_app.logger.info(f"Deleted {chat_sessions_deleted} chat session metadata entries for config_id: {config_id}")
            
            # 5. Log cleanup summary
            total_deleted = vectors_deleted_count + chat_messages_deleted + chat_sessions_deleted
            current_app.logger.info(f"✅ Cleanup complete for config_id {config_id}: "
                                   f"{vectors_deleted_count} vectors, "
                                   f"{chat_messages_deleted} messages, "
                                   f"{chat_sessions_deleted} sessions (Total: {total_deleted} items deleted)")

        except Exception as e:
            current_app.logger.error(f"❌ Error during cascading delete for config_id '{config_id}': {e}", exc_info=True)
            # Warn the user that cleanup failed but the main config was deleted
            return jsonify({
                "message": "Configuration deleted, but a failure occurred during data cleanup.",
                "warning": str(e)
            }), 200

        return jsonify({
            "message": f"Configuration {config_id} and associated data deleted successfully.",
            "details": {
                "config_id_deleted": config_id,
                "vectors_deleted": vectors_deleted_count,
                "chat_messages_deleted": chat_messages_deleted,
                "chat_sessions_deleted": chat_sessions_deleted
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"An error occurred in delete_config: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred"}), 500
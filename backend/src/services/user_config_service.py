import logging
from pymongo.collection import Collection

logger = logging.getLogger(__name__)

def save_user_config(collection: Collection, user_id: str, config: dict):
    """
    Saves a user's chatbot configuration to MongoDB.
    """
    logger.info(f"Saving config for user_id: {user_id}")
    try:
        # Use update_one with upsert=True to either insert or update
        result = collection.update_one(
            {"user_id": user_id},
            {"$set": {"config": config}},
            upsert=True
        )
        logger.info(f"Config saved. Matched: {result.matched_count}, Modified: {result.modified_count}, Upserted: {result.upserted_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to save config for user_id {user_id}: {e}", exc_info=True)
        return False

def load_user_config(collection: Collection, user_id: str):
    """
    Loads a user's chatbot configuration from MongoDB.
    Returns the config dictionary or None if not found.
    """
    logger.info(f"Loading config for user_id: {user_id}")
    try:
        user_doc = collection.find_one({"user_id": user_id})
        if user_doc and "config" in user_doc:
            logger.info("Config loaded successfully.")
            return user_doc["config"]
        else:
            logger.info("No config found for this user.")
            return None
    except Exception as e:
        logger.error(f"Failed to load config for user_id {user_id}: {e}", exc_info=True)
        return None
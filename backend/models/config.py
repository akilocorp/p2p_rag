from flask import current_app
import pymongo
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId  
class Config:
    """
    User model for interacting with the users collection in MongoDB.
    This class encapsulates all database logic for users.
    """

    @staticmethod
    def get_collection():
        """
        A helper method to get the user collection object from the database.
        It assumes you have a 'MONGO_CLIENT' in your app config.
        """
        mongo_client = pymongo.MongoClient(current_app.config["MONGO_URI"], serverSelectionTimeoutMS=5000)
        # Get the database from the client
        db = mongo_client[current_app.config["MONGO_DB_NAME"]]
        # Get the collection using the name stored in the config
        return db[current_app.config["CONFIG"]]

    @staticmethod
    def create(obj):
        """
        Creates a new user, hashes their password, and inserts them into the database.
        Returns the result of the insert operation.
        """
        config_collection = Config.get_collection()
        
        # Hash the password before storing
        current_app.logger.info(f"{obj}")
        
        
        return config_collection.insert_one(obj)

    @staticmethod
    def find_by_id(id):
        """Finds a user by their email address."""
        
        return Config.get_collection().find_one({"_id":ObjectId(id)})

    @staticmethod
    def find_by_user_id(user_id):
        """Finds a user by their username."""
        return Config.get_collection().find({"user_id": user_id})

   


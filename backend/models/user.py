from flask import current_app
import pymongo
from werkzeug.security import generate_password_hash, check_password_hash

class User:
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
        return db[current_app.config["USER"]]

    @staticmethod
    def create(obj):
        """
        Creates a new user, hashes their password, and inserts them into the database.
        Returns the result of the insert operation.
        """
        users_collection = User.get_collection()
        
        # Hash the password before storing
        current_app.logger.info(f"{obj}")
        
        
        return users_collection.insert_one(obj)

    @staticmethod
    def find_by_email(email):
        """Finds a user by their email address."""
        return User.get_collection().find_one({"email": email.lower()})

    @staticmethod
    def find_by_username(username):
        """Finds a user by their username."""
        return User.get_collection().find_one({"username": username})

    @staticmethod
    def check_password(password_hash, password):
        """Checks a plaintext password against a stored hash."""
        return check_password_hash(password_hash, password)




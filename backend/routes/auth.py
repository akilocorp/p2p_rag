from flask import Blueprint, request, jsonify, current_app
from flask_bcrypt import Bcrypt
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_jwt_extended import create_access_token, create_refresh_token, unset_jwt_cookies
from bson import ObjectId # To handle MongoDB's _id
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from flask_mail import Message

# --- Blueprint Setup ---
auth_bp = Blueprint('auth_bp', __name__)
bcrypt = Bcrypt()
from models.user import User
# --- API Routes for Authentication
# 
from app import mail

# --- Helper Function to Send Email ---
def send_verification_email(user_email, token):
    """Sends the verification email."""
    # IMPORTANT: The URL should point to your FRONTEND application
    verify_url = f"{current_app.config.get('FRONTEND_URL')}/verify-email?token={token}" # Change for production
    msg = Message(
        subject="Confirm Your Email Address",
        recipients=[user_email],
        html=f"<p>Welcome! Thanks for signing up. Please follow this link to activate your account:</p>"
             f"<p><a href='{verify_url}'>Click here to verify</a></p>"
             f"<br>"
             f"<p>Thanks!</p>"
    )
    mail.send(msg)

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    User registration endpoint. Expects a JSON payload with
    'username' and 'password'.
    """
    try:
        users_collection = User
        data = request.get_json()
       

        email = data.get('email')
        password = data.get('password')
        username = data.get('username')


        if not email or not password:
            return jsonify({"error": "Username and password are required"}), 400

        # Check if user already exists
        if users_collection.find_by_email(email):
            return jsonify({"error": "That email already exists. Please choose a different one."}), 409
        elif users_collection.find_by_username(username):
            return jsonify({"error": "That username already exists. Please choose a different one."}), 409

        # Hash the password
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        
        serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        # Include all necessary user info in the token payload
        token_data = {
            "email": email,
            "username": username,
            "password_hash": password_hash
        }
        token = serializer.dumps(token_data, salt='email-confirm-salt')

        # Call the helper function to send the verification email
        send_verification_email(email, token)

        return jsonify({"message": f"User '{username}' registered successfully!"}), 201

    except Exception as e:
        current_app.logger.error(f"Error in /register route: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logs the user out by unsetting the JWT cookie."""
    try:
        response = jsonify({"message": "Logout successful"})
        unset_jwt_cookies(response)
        return response, 200
    except Exception as e:
        current_app.logger.error(f"An error occurred during logout: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during logout"}), 500

# ---> 2. Add the new /refresh endpoint
@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True) # This decorator ensures only a refresh token can be used
def refresh():
    """
    Refreshes an expired access token using a valid refresh token.
    """
    try:
        # Get the identity of the user from the refresh token
        current_user_id = get_jwt_identity()
        # Create a new access token
        new_access_token = create_access_token(identity=current_user_id)
        return jsonify(access_token=new_access_token), 200
    except Exception as e:
        current_app.logger.error(f"Error in /refresh route: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """
    Verify the user's email with the provided token.
    This is called by the frontend after the user clicks the email link.
    """
    try:
        data = request.get_json()
        token = data.get('token')
        if not token:
            return jsonify({"message": "Token is missing."}), 400
            
        serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

        # Deserialize the token
        # max_age is set to 1 hour (3600 seconds)
        token_data = serializer.loads(token, salt='email-confirm-salt', max_age=3600)

        # Extract user info
        email = token_data['email']
        username = token_data['username']
        password_hash = token_data['password_hash']

        # Check if user has already been verified and created
        if User.find_by_email(email):
            return jsonify({"message": "Account already verified. Please login."}), 409

        # Create and save the new user
        new_user = {
            "email": email,
            "username": username,
            "password": password_hash,
            "verified": True # Optionally add a 'verified' field
        }
        User.create(new_user)

        return jsonify({"message": "Email verified successfully! You can now log in."}), 200

    except SignatureExpired:
        return jsonify({"message": "The verification link has expired. Please register again."}), 400
    except BadTimeSignature:
        return jsonify({"message": "The verification link is invalid. Please register again."}), 400
    except Exception as e:
        current_app.logger.error(f"Error in /verify-email: {e}")
        return jsonify({"message": "An internal server error occurred"}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user_info():
    """
    Get the current user's information.
    Requires a valid JWT token.
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.find_by_id(current_user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Return user info without sensitive data
        return jsonify({
            "username": user['username'],
            "email": user['email']
        })
    except Exception as e:
        current_app.logger.error(f"Error in /me route: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    User login endpoint. Expects 'username' and 'password'.
    Returns a JWT access token upon success.
    """
    try:
        users_collection = User
        data = request.get_json()
        
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400

        user = users_collection.find_by_username(username)

        # Verify user and password
        if user and bcrypt.check_password_hash(user['password'], password):
            # The identity can be the user's ID from the database
            user_id = str(user['_id'])
            access_token = create_access_token(identity=user_id)
            refresh_token = create_refresh_token(identity=user_id)

            return jsonify(access_token=access_token, refresh_token=refresh_token)

        return jsonify({"error": "Invalid username or password"}), 401

    except Exception as e:
        current_app.logger.error(f"Error in /login route: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500
    

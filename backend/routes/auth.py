from functools import wraps
from flask import Blueprint, request, jsonify

from database.db import (
    hash_password,
    verify_password,
    create_jwt_token,
    decode_jwt_token,
    find_user_by_email,
    find_user_by_id,
    insert_user,
    get_current_user_from_request,
    supabase,
    TABLE_NAME
)

auth_bp = Blueprint("auth", __name__)


def admin_required(f):
    """Decorator ensuring request has a valid JWT for an admin user (isAdmin == True)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user_from_request(request)
        if not user:
            return jsonify({"error": "Authentication required. Please sign in."}), 401

        is_admin = bool(user.get("isAdmin", False))
        if not is_admin:
            uid = user.get("sub") or user.get("id")
            if uid:
                db_user = find_user_by_id(uid)
                if db_user and bool(db_user.get("isAdmin", False)):
                    is_admin = True

        if not is_admin:
            return jsonify({"error": "Admin access required. You do not have permission to perform this action."}), 403

        return f(*args, **kwargs)
    return decorated_function


@auth_bp.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "online",
        "supabase_connected": supabase is not None,
        "table": TABLE_NAME,
        "auth": "JWT with SHA-256"
    })


@auth_bp.route("/api/signup", methods=["POST"])
def signup():
    """
    Registers a new user:
    Body: { name, email, password, phone_number }
    Hashes password with SHA-256 and stores in database.
    """
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    phone_number = data.get("phone_number") or data.get("phoneNumber") or ""
    phone_number = str(phone_number).strip()

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    # Check if user already exists
    existing_user = find_user_by_email(email)
    if existing_user:
        return jsonify({"error": "An account with this email already exists."}), 400

    # Hash password with SHA-256
    hashed_pwd = hash_password(password)

    try:
        created_user = insert_user(name, email, hashed_pwd, phone_number, is_admin=False)
        uid = created_user.get("id") or created_user.get("user_id")
        is_admin = bool(created_user.get("isAdmin", False))
        token = create_jwt_token(uid, email, name, is_admin=is_admin)

        return jsonify({
            "message": "Signed up successfully with SHA-256 security!",
            "token": token,
            "user": {
                "id": uid,
                "name": created_user.get("name", name),
                "email": email,
                "phone_number": created_user.get("phone_number", phone_number),
                "isAdmin": is_admin
            }
        }), 201
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@auth_bp.route("/api/login", methods=["POST"])
def login():
    """
    Signs in a user with email and password:
    Verifies SHA-256 hash and issues signed JWT token.
    """
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user_row = find_user_by_email(email)
    if not user_row:
        return jsonify({"error": "Invalid email or password."}), 401

    stored_password = str(user_row.get("password", ""))
    if not verify_password(password, stored_password):
        return jsonify({"error": "Invalid email or password."}), 401

    uid = user_row.get("id") or user_row.get("user_id")
    name = user_row.get("name")
    is_admin = bool(user_row.get("isAdmin", False))
    token = create_jwt_token(uid, email, name, is_admin=is_admin)

    return jsonify({
        "message": "Sign in successful!",
        "token": token,
        "user": {
            "id": uid,
            "name": name,
            "email": email,
            "phone_number": user_row.get("phone_number", ""),
            "isAdmin": is_admin
        }
    }), 200


@auth_bp.route("/api/me", methods=["GET"])
def get_current_user():
    """
    Protected endpoint: Verifies JWT token from Authorization header.
    Format: Authorization: Bearer <token>
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Bearer token."}), 401

    token = auth_header.split(" ")[1]
    payload, error = decode_jwt_token(token)
    if error:
        return jsonify({"error": error}), 401

    uid = payload.get("sub")
    is_admin = bool(payload.get("isAdmin", False))
    if not is_admin and uid:
        db_user = find_user_by_id(uid)
        if db_user:
            is_admin = bool(db_user.get("isAdmin", False))

    return jsonify({
        "user": {
            "id": uid,
            "email": payload.get("email"),
            "name": payload.get("name"),
            "isAdmin": is_admin
        }
    }), 200

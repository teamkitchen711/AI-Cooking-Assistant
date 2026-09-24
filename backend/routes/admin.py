from flask import Blueprint, jsonify, request
from database.db import (
    get_all_users_admin,
    find_user_by_email,
    find_user_by_id,
    insert_user,
    admin_update_user,
    admin_delete_user,
    hash_password,
    get_all_recipes,
    get_current_user_from_request
)
from routes.auth import admin_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/api/admin/stats", methods=["GET"])
@admin_required
def get_admin_stats():
    """Returns overview metrics for the Admin Dashboard."""
    users = get_all_users_admin()
    recipes = get_all_recipes()

    total_users = len(users)
    total_admins = sum(1 for u in users if u.get("isAdmin") is True)
    total_recipes = len(recipes)

    return jsonify({
        "stats": {
            "total_users": total_users,
            "total_admins": total_admins,
            "total_regular_users": total_users - total_admins,
            "total_recipes": total_recipes
        }
    }), 200


@admin_bp.route("/api/admin/users", methods=["GET"])
@admin_required
def list_users():
    """Returns all users in the system."""
    users = get_all_users_admin()
    return jsonify({"users": users}), 200


@admin_bp.route("/api/admin/users", methods=["POST"])
@admin_required
def create_user():
    """Allows an admin to add a new user (with specified isAdmin status)."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    phone_number = data.get("phone_number") or data.get("phoneNumber") or ""
    phone_number = str(phone_number).strip()
    is_admin = bool(data.get("isAdmin", False))

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    existing = find_user_by_email(email)
    if existing:
        return jsonify({"error": "A user with this email already exists."}), 400

    hashed_pwd = hash_password(password)
    try:
        new_user = insert_user(name, email, hashed_pwd, phone_number, is_admin=is_admin)
        return jsonify({
            "message": "User created successfully!",
            "user": {
                "id": new_user.get("id"),
                "name": new_user.get("name"),
                "email": new_user.get("email"),
                "phone_number": new_user.get("phone_number"),
                "isAdmin": bool(new_user.get("isAdmin", is_admin))
            }
        }), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500


@admin_bp.route("/api/admin/users/<user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    """Allows an admin to modify user details or toggle admin role."""
    data = request.get_json() or {}
    name = data.get("name")
    email = data.get("email")
    phone_number = data.get("phone_number") or data.get("phoneNumber")
    is_admin = data.get("isAdmin")
    new_password = data.get("password")

    password_hash = hash_password(new_password.strip()) if new_password and len(new_password.strip()) >= 6 else None

    # Check if target email is being changed and is already taken
    if email:
        existing = find_user_by_email(email.strip().lower())
        if existing and str(existing.get("id")) != str(user_id):
            return jsonify({"error": "Email is already taken by another account."}), 400

    updated = admin_update_user(
        user_id=user_id,
        name=name,
        email=email,
        phone_number=phone_number,
        is_admin=is_admin,
        password_hash=password_hash
    )

    if not updated:
        return jsonify({"error": "User not found or update failed."}), 400

    return jsonify({
        "message": "User updated successfully!",
        "user": {
            "id": updated.get("id", user_id),
            "name": updated.get("name", name),
            "email": updated.get("email", email),
            "phone_number": updated.get("phone_number", phone_number),
            "isAdmin": bool(updated.get("isAdmin", is_admin))
        }
    }), 200


@admin_bp.route("/api/admin/users/<user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    """Allows an admin to delete a user account."""
    current_admin = get_current_user_from_request(request)
    current_admin_id = current_admin.get("sub") or current_admin.get("id")

    if str(current_admin_id) == str(user_id):
        return jsonify({"error": "You cannot delete your own admin account while logged in."}), 400

    success = admin_delete_user(user_id)
    if not success:
        return jsonify({"error": "User not found or deletion failed."}), 400

    return jsonify({"message": "User deleted successfully!", "id": user_id}), 200

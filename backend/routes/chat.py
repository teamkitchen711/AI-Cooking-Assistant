from flask import Blueprint, jsonify, request
from database.db import (
    get_current_user_from_request,
    get_conversation,
    save_conversation,
    delete_conversation,
    get_conversation_chat_id,
    get_recipe_by_id,
    record_recipe_cooked
)
from services.gemini_service import chat_with_chef_bon

chat_bp = Blueprint("chat", __name__)


def get_request_user_id(req):
    user = get_current_user_from_request(req)
    if not user:
        return "guest"
    return user.get("sub") or user.get("id") or user.get("email") or "guest"


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    """
    Main conversational endpoint for Chef Bon AI Sous Chef.
    Accepts: message, history, active_recipe, health_goal, saved_cups
    Returns: reply, actions
    """
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Message is required"}), 400

    # Extract authenticated user if available
    current_user = get_current_user_from_request(request)
    user_id = get_request_user_id(request)
    user_name = current_user.get("name", "Chef") if current_user else "Chef"

    history = data.get("history", [])
    active_recipe = data.get("active_recipe")
    health_goal = data.get("health_goal")
    saved_cups = data.get("saved_cups")

    try:
        result = chat_with_chef_bon(
            user_id=user_id,
            user_name=user_name,
            message=message,
            history=history,
            active_recipe=active_recipe,
            health_goal=health_goal,
            saved_cups=saved_cups
        )
        return jsonify(result), 200
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({
            "reply": f"Chef Bon says: Oops! The kitchen timer went off early. Let me check the stove! ({str(e)})",
            "actions": []
        }), 200


@chat_bp.route("/api/conversations", methods=["GET"])
def list_conversation():
    """
    Retrieves stored conversation messages for a recipe or general chat.
    Query param: recipe_id (e.g. 'sri-lankan-chinese-chili-paste' or 'general')
    """
    current_user = get_current_user_from_request(request)
    user_id = get_request_user_id(request)
    user_email = current_user.get("email") if current_user else None
    recipe_id = request.args.get("recipe_id") or "general"
    chat_id = get_conversation_chat_id(user_id, recipe_id)

    messages = get_conversation(user_id=user_id, recipe_id=recipe_id, chat_id=chat_id, user_email=user_email)
    return jsonify({
        "chat_id": chat_id,
        "user_recipes_id": chat_id,
        "recipe_id": recipe_id,
        "messages": messages
    }), 200


@chat_bp.route("/api/conversations", methods=["POST"])
def store_conversation():
    """
    Saves conversation messages to the conversations table.
    CRITICAL: Only stores if user has actually started saying or typing something.
    """
    current_user = get_current_user_from_request(request)
    user_id = get_request_user_id(request)
    user_email = current_user.get("email") if current_user else None
    data = request.get_json() or {}
    recipe_id = data.get("recipe_id") or "general"
    messages = data.get("messages", [])

    saved = save_conversation(user_id=user_id, recipe_id=recipe_id, messages=messages)

    # When user converses about a recipe, ensure a session record is saved/updated in user_recipes
    if saved and recipe_id and recipe_id != "general":
        try:
            recipe = get_recipe_by_id(recipe_id)
            title = recipe.get("title", recipe_id) if recipe else recipe_id
            image = recipe.get("image_url") or recipe.get("image", "") if recipe else ""
            target_user = user_email or user_id
            record_recipe_cooked(target_user, recipe_id, title, image)
        except Exception as e:
            print(f"Error syncing session to user_recipes: {e}")

    return jsonify({
        "success": True,
        "saved_count": len(saved)
    }), 200


@chat_bp.route("/api/conversations", methods=["DELETE"])
def clear_conversation():
    """Clears conversation messages for a recipe."""
    user_id = get_request_user_id(request)
    recipe_id = request.args.get("recipe_id") or (request.get_json() or {}).get("recipe_id") or "general"

    success = delete_conversation(user_id=user_id, recipe_id=recipe_id)
    return jsonify({"success": success}), 200


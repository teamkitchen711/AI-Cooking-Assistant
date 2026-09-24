from flask import Blueprint, jsonify, request
from database.db import (
    get_shopping_items,
    insert_shopping_item,
    toggle_shopping_item,
    delete_shopping_item,
    clear_completed_shopping_items,
    get_current_user_from_request
)

shopping_bp = Blueprint("shopping", __name__)


@shopping_bp.route("/api/shopping", methods=["GET"])
def list_shopping():
    """Returns all shopping list items for user."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "all"
    items = get_shopping_items(user_id)
    return jsonify({"items": items}), 200


@shopping_bp.route("/api/shopping", methods=["POST"])
def add_item():
    """Adds a new ingredient to shopping list."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "all"

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Item name is required"}), 400

    amount = data.get("amount", "1 unit").strip()
    category = data.get("category", "Produce").strip()
    source = data.get("source", "Manual").strip()

    new_item = insert_shopping_item(
        user_id=user_id,
        name=name,
        amount=amount,
        category=category,
        source=source
    )
    return jsonify({"message": "Item added to shopping list", "item": new_item}), 201


@shopping_bp.route("/api/shopping/<item_id>/toggle", methods=["PATCH", "PUT"])
def toggle_item(item_id):
    """Toggles or updates the purchased status of a shopping item."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "all"

    data = request.get_json() or {}
    completed = data.get("completed")  # Can be True, False, or None (to invert)

    updated = toggle_shopping_item(user_id, item_id, completed)
    if not updated:
        return jsonify({"error": "Item not found"}), 404

    return jsonify({"message": "Item status updated", "item": updated}), 200


@shopping_bp.route("/api/shopping/<item_id>", methods=["DELETE"])
def delete_item(item_id):
    """Removes an item from the shopping list."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "all"

    success = delete_shopping_item(user_id, item_id)
    return jsonify({"message": "Item removed", "success": success}), 200


@shopping_bp.route("/api/shopping/clear-completed", methods=["POST", "DELETE"])
def clear_completed():
    """Removes all checked/purchased items."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "all"

    clear_completed_shopping_items(user_id)
    return jsonify({"message": "Completed items cleared"}), 200

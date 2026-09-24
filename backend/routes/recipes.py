from flask import Blueprint, jsonify, request
from database.db import (
    get_all_recipes,
    get_recipe_by_id,
    insert_recipe,
    update_recipe,
    delete_recipe,
    get_user_recipes,
    record_recipe_cooked,
    get_recipes_with_conversations,
    get_current_user_from_request
)
from routes.auth import admin_required

recipes_bp = Blueprint("recipes", __name__)


@recipes_bp.route("/api/recipes", methods=["GET"])
def list_recipes():
    """Returns all available recipes from database."""
    recipes = get_all_recipes()
    return jsonify({"recipes": recipes}), 200


@recipes_bp.route("/api/recipes/<recipe_id>", methods=["GET"])
def recipe_detail(recipe_id):
    """Returns details for a specific recipe."""
    recipe = get_recipe_by_id(recipe_id)
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404
    return jsonify({"recipe": recipe}), 200


@recipes_bp.route("/api/recipes", methods=["POST"])
@admin_required
def create_recipe():
    """Adds a new recipe to the library (Admin only)."""
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Recipe title is required"}), 400

    recipe_id = data.get("id") or title.lower().replace(" ", "-")[:40]
    new_recipe = {
        "id": recipe_id,
        "title": title,
        "description": data.get("description", ""),
        "time": data.get("time", "20 min"),
        "servings": data.get("servings", "2 servings"),
        "kcal": data.get("kcal", "500 kcal"),
        "image_url": data.get("image_url", "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80"),
        "ingredients": data.get("ingredients", []),
        "steps": data.get("steps", [])
    }

    saved = insert_recipe(new_recipe)
    return jsonify({"message": "Recipe created", "recipe": saved}), 201


@recipes_bp.route("/api/recipes/<recipe_id>", methods=["PUT"])
@admin_required
def modify_recipe(recipe_id):
    """Updates an existing recipe (Admin only)."""
    data = request.get_json() or {}
    updated = update_recipe(recipe_id, data)
    if not updated:
        return jsonify({"error": "Failed to update recipe or recipe not found"}), 400
    return jsonify({"message": "Recipe updated successfully", "recipe": updated}), 200


@recipes_bp.route("/api/recipes/<recipe_id>", methods=["DELETE"])
@admin_required
def remove_recipe(recipe_id):
    """Deletes a recipe (Admin only)."""
    success = delete_recipe(recipe_id)
    if not success:
        return jsonify({"error": "Failed to delete recipe or recipe not found"}), 400
    return jsonify({"message": "Recipe deleted successfully", "id": recipe_id}), 200


@recipes_bp.route("/api/recipes/completed", methods=["GET"])
def get_completed():
    """Returns past cooked recipes for user."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "student@university.edu"
    completed = get_user_recipes(user_id, status="completed")
    return jsonify({"completed": completed}), 200


@recipes_bp.route("/api/recipes/<recipe_id>/cook", methods=["POST"])
def cook_recipe(recipe_id):
    """Marks a recipe as completed by the user."""
    user = get_current_user_from_request(request)
    user_id = user["email"] if user else "student@university.edu"

    data = request.get_json() or {}
    title = data.get("title", "Delicious Meal")
    image_url = data.get("image_url", "")

    record = record_recipe_cooked(user_id, recipe_id, title, image_url)
    return jsonify({"message": "Recipe marked as cooked", "record": record}), 201


@recipes_bp.route("/api/recipes/selected", methods=["GET"])
def get_selected():
    """Returns recipes for which the user has actually made a conversation."""
    user = get_current_user_from_request(request)
    user_id = user.get("sub") or user.get("id") or user.get("email") if user else "guest"
    user_email = user.get("email") if user else None
    selected = get_recipes_with_conversations(user_id=user_id, user_email=user_email)
    return jsonify({"selected": selected}), 200
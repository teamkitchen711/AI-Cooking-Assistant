import os
from flask import Blueprint, jsonify, request
from google import genai
from dotenv import load_dotenv

from database.db import (
    get_custom_cups,
    insert_custom_cup,
    delete_custom_cup,
    get_current_user_from_request
)

load_dotenv()

measuring_bp = Blueprint("measuring", __name__)
MODELS_TO_TRY = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"]


def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def get_user_identifiers(req):
    user = get_current_user_from_request(req)
    if not user:
        return "all", None
    user_id = user.get("sub") or user.get("id") or user.get("email") or "all"
    email = user.get("email")
    return user_id, email


@measuring_bp.route("/api/cups", methods=["GET"])
def list_cups():
    """Returns all custom measuring cups saved for user."""
    user_id, email = get_user_identifiers(request)
    cups = get_custom_cups(user_id, email=email)
    return jsonify({"cups": cups}), 200


@measuring_bp.route("/api/cups", methods=["POST"])
def add_cup():
    """Saves a new custom measuring cup tool with a unique name."""
    user_id, email = get_user_identifiers(request)

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    volume_ml = data.get("volume_ml")

    if not name:
        return jsonify({"error": "Cup name is required"}), 400
    if volume_ml is None:
        return jsonify({"error": "Cup volume in ml is required"}), 400

    try:
        volume_ml = float(volume_ml)
    except ValueError:
        return jsonify({"error": "Volume must be a valid number"}), 400

    # Verify unique name for this user (case-insensitive)
    existing_cups = get_custom_cups(user_id, email=email)
    if any(c.get("name", "").strip().lower() == name.lower() for c in existing_cups):
        return jsonify({"error": f"A cup named '{name}' already exists. Please choose a unique name."}), 400

    height_cm = data.get("height_cm")
    diameter_cm = data.get("diameter_cm")

    new_cup = insert_custom_cup(
        user_id=user_id,
        name=name,
        volume_ml=volume_ml,
        height_cm=float(height_cm) if height_cm is not None else None,
        diameter_cm=float(diameter_cm) if diameter_cm is not None else None
    )

    return jsonify({"message": "Cup saved successfully", "cup": new_cup}), 201


@measuring_bp.route("/api/cups/<cup_id>", methods=["DELETE"])
def remove_cup(cup_id):
    """Deletes a saved custom cup tool."""
    user_id, email = get_user_identifiers(request)
    success = delete_custom_cup(user_id, cup_id)
    return jsonify({"message": "Cup deleted", "success": success}), 200


@measuring_bp.route("/api/convert", methods=["POST"])
def convert_measurements():
    """
    Converts ingredient measurements using Gemini AI.
    - 'scaler_to_cups': Converts grams/metric scale list into specified standard or custom cup measurements.
    - 'cups_to_scaler': Converts standard cup recipe list into exact grams (metric scale).
    """
    data = request.get_json() or {}
    mode = data.get("mode", "scaler_to_cups")  # 'scaler_to_cups' | 'cups_to_scaler'
    text = data.get("text", "").strip()
    cup = data.get("cup", {})  # {"name": "Blue mug", "volume_ml": 350}

    if not text:
        return jsonify({"error": "Ingredients text is required"}), 400

    cup_name = cup.get("name", "Standard Cup")
    cup_vol = cup.get("volume_ml", 240)

    # Construct Gemini Prompt
    if mode == "scaler_to_cups":
        prompt = f"""You are Chef Bon, an expert culinary measurement converter.
The user has weighed ingredients on a kitchen scale (metric/grams) and wants them converted to cup measurements using their selected cup:
Target Cup: "{cup_name}" (Volume capacity: {cup_vol} ml).

Ingredients:
{text}

Instructions:
1. Calculate the exact conversion considering culinary ingredient densities (e.g. flour ~120g per 240ml, granulated sugar ~200g per 240ml, butter ~227g per 240ml).
2. Proportionately adjust to the target cup volume ({cup_vol} ml).
3. Return a clean, easy-to-read list formatted line-by-line:
   • [Converted amount in {cup_name}] of [Ingredient]
4. Add a friendly 1-sentence tip from Chef Bon at the end.
Keep it direct, accurate, and culinary-focused."""
    else:
        # cups_to_scaler
        prompt = f"""You are Chef Bon, an expert culinary measurement converter.
The user has a recipe written in standard cup measurements (1 US Cup = 240ml) and wants to weigh them on a kitchen scale in grams (g) or milliliters (ml):

Ingredients:
{text}

Instructions:
1. Convert each ingredient to precise kitchen scale measurements in grams (g) (or ml for liquids), factoring in standard culinary ingredient densities (e.g. 1 cup all-purpose flour = 120-125g, 1 cup sugar = 200g, 1 cup butter = 227g, 1 cup milk = 245g).
2. Return a clean, easy-to-read list formatted line-by-line:
   • [Exact grams/metric amount] of [Ingredient]
3. Add a friendly 1-sentence tip from Chef Bon at the end.
Keep it direct, accurate, and culinary-focused."""

    client = get_gemini_client()
    converted_text = ""

    if client:
        for model in MODELS_TO_TRY:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt
                )
                if response.text:
                    converted_text = response.text
                    break
            except Exception as e:
                print(f"Convert error on {model}: {e}")
                continue

    # Resilient fallback if AI is unreachable
    if not converted_text:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if mode == "scaler_to_cups":
            converted_text = f"Chef Bon's Conversion to {cup_name} ({cup_vol}ml):\n"
            ratio = round(240 / float(cup_vol), 2)
            for line in lines:
                converted_text += f"• {line} ➔ approx. {ratio} × {cup_name}\n"
        else:
            converted_text = "Chef Bon's Conversion to Kitchen Scale (Grams):\n"
            for line in lines:
                converted_text += f"• {line} ➔ approx. measured in grams on scale\n"

    return jsonify({"converted": converted_text}), 200

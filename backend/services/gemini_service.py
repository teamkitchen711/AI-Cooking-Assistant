import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

from database.db import insert_shopping_item, insert_custom_cup, get_all_recipes

load_dotenv()

# Gemini Models in priority order (with automatic failover)
MODELS_TO_TRY = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"]


def get_gemini_client():
    """Returns an authenticated Gemini API client."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in backend/.env")
    return genai.Client(api_key=api_key)


def build_system_instruction(user_name="Chef", active_recipe=None, health_goal=None, saved_cups=None):
    """Builds the comprehensive Chef Bon persona and context grounding."""
    recipes = get_all_recipes()
    catalog_summary = ", ".join([r.get("title", "") for r in recipes[:6]])

    prompt = f"""You are Chef Bon ("Bon" like bon appétit!), a warm, witty, enthusiastic, and practical AI sous chef.
    You are helping {user_name} cook amazing food in their kitchen!

    Tone & Style:
    - Energetic, encouraging, kitchen-smart, and friendly.
    - Keep explanations concise, practical, and easy to follow while cooking.
    - Use fun cooking expressions and metaphors (e.g. aprons, simmering, seasoning, plating).
    - If giving steps, keep them clear and sequential.

    Context Grounding:
    - Available library recipes: {catalog_summary}
    - User nutrition / health target: {health_goal or 'Balanced, healthy cooking'}
    - User saved custom cups & measuring tools: {saved_cups or 'Standard cup (240ml), Grams scale'}
    """

    if active_recipe:
        prompt += f"""
    Current Recipe Loaded in Recipe Box:
    - Title: {active_recipe.get('title')}
    - Time: {active_recipe.get('time')} | Servings: {active_recipe.get('servings')} | Calories: {active_recipe.get('kcal')}
    - Ingredients: {', '.join(active_recipe.get('ingredients', []))}
    - Steps: {'; '.join([s.get('text', '') if isinstance(s, dict) else str(s) for s in active_recipe.get('steps', [])])}
    Guide the user through this recipe step-by-step when asked!
    """

    prompt += """
    Tool Usage Rules:
    1. When the user says they are missing an ingredient, need an item, or explicitly asks to add something to their shopping list, call `add_to_shopping_list`.
    2. When the user says to add a cup (e.g. "add a cup into...", "add a cup into measuring", "add a cup", "save my mug", "save cup", or in Sinhala/Tamil/any language), you MUST IMMEDIATELY call `save_custom_cup` right in the middle of conversation!
       - If the user specifies a name (e.g. 'Blue Mug', 'Tea Cup', 'Steel Cup'), use that name. If no specific name is given, use 'My Measuring Cup'.
       - If the user specifies volume (e.g. 200ml, 350ml), pass that volume. If not specified, default to 250.0 ml.
       - Acknowledge warmly in the user's language that you have saved their cup into their kitchen tools in real time.
    """
    return prompt.strip()


def chat_with_chef_bon(
    user_id: str,
    user_name: str,
    message: str,
    history=None,
    active_recipe=None,
    health_goal=None,
    saved_cups=None
):
    """
    Sends a user message to Chef Bon (Gemini) with full context grounding and tool execution.
    Returns:
        dict: {"reply": str, "actions": list}
    """
    client = get_gemini_client()
    captured_actions = []

    # -------------------------------------------------------------
    # 1. Define Tools / Function Calling Callables
    # -------------------------------------------------------------
    def add_to_shopping_list(name: str, amount: str = "1 unit", category: str = "Produce") -> str:
        """Adds an ingredient to the user shopping list.
        Args:
            name: Name of the ingredient (e.g. 'Olive oil', 'Garlic')
            amount: Quantity and unit (e.g. '2 tbsp', '200g')
            category: Grocery category like 'Produce', 'Dairy', 'Pantry', 'Meat & Seafood', 'Spices & Herbs', 'Other'
        """
        saved = insert_shopping_item(
            user_id=user_id,
            name=name,
            amount=amount,
            category=category,
            source="AI Voice/Chat"
        )
        captured_actions.append({
            "type": "shopping_added",
            "item": saved
        })
        return f"Successfully added {amount} of {name} ({category}) to your shopping list."

    def save_custom_cup(name: str = "My Measuring Cup", volume_ml: float = 250.0, height_cm: float = None, diameter_cm: float = None) -> str:
        """Saves a custom measuring cup or container for future recipe conversions.
        Args:
            name: Friendly name for the cup (e.g. 'Blue Coffee Mug', 'Steel Mug'). Defaults to 'My Measuring Cup'.
            volume_ml: Total volume capacity in milliliters (e.g. 250, 350, 180). Defaults to 250.0.
            height_cm: Optional inside height in centimeters
            diameter_cm: Optional inside diameter in centimeters
        """
        clean_name = str(name or "My Measuring Cup").strip()
        lower_name = clean_name.lower()
        prefixes_to_strip = [
            "add a cup into measuring called ",
            "add a cup into measuring ",
            "add a cup into tools called ",
            "add a cup into tools ",
            "add a cup into ",
            "add a cup called ",
            "add a cup ",
            "save a cup called ",
            "save a cup ",
        ]
        for p in prefixes_to_strip:
            if lower_name.startswith(p):
                clean_name = clean_name[len(p):].strip()
                break

        if not clean_name or clean_name.lower() in ["measuring", "tools", "into", "into measuring", "kitchen"]:
            clean_name = "My Measuring Cup"

        vol = 250.0
        if volume_ml is not None:
            try:
                vol = float(volume_ml)
            except (ValueError, TypeError):
                import re
                match = re.search(r"(\d+(\.\d+)?)", str(volume_ml))
                vol = float(match.group(1)) if match else 250.0

        saved = insert_custom_cup(
            user_id=user_id,
            name=clean_name,
            volume_ml=vol,
            height_cm=height_cm,
            diameter_cm=diameter_cm
        )
        captured_actions.append({
            "type": "cup_saved",
            "cup": saved
        })
        return f"Saved your custom cup '{clean_name}' with volume {vol} ml into your tools."

    # -------------------------------------------------------------
    # 2. Build Tool Config & System Instruction
    # -------------------------------------------------------------
    system_prompt = build_system_instruction(
        user_name=user_name,
        active_recipe=active_recipe,
        health_goal=health_goal,
        saved_cups=saved_cups
    )

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[add_to_shopping_list, save_custom_cup],
        temperature=0.7
    )

    # -------------------------------------------------------------
    # 3. Format Conversation History for Gemini
    # -------------------------------------------------------------
    contents = []
    if history:
        for msg in history:
            sender = msg.get("sender") or msg.get("role")
            text = msg.get("text") or msg.get("content") or ""
            if not text.strip():
                continue

            # Map to Gemini roles ('user' or 'model')
            role = "user" if sender == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=text)]
            ))

    # Add current user prompt
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=message)]
    ))

    # -------------------------------------------------------------
    # 4. Generate Content with Automatic Model Fallback
    # -------------------------------------------------------------
    reply_text = ""
    last_error = None

    for model_name in MODELS_TO_TRY:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
            reply_text = response.text or "Bon appétit! Let's get cooking."
            break
        except Exception as e:
            print(f"Gemini model [{model_name}] error: {e}")
            last_error = e
            continue

    if not reply_text and last_error:
        # Graceful fallback if network is completely unavailable
        reply_text = f"Chef Bon says: That apron looks great on you! I'm prepping my kitchen tools right now. (Note: {last_error})"

    return {
        "reply": reply_text,
        "actions": captured_actions
    }

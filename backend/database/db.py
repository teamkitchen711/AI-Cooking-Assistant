import os
import datetime
import hashlib
import uuid
import jwt
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables (explicitly resolve backend/.env)
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)
load_dotenv()

# JWT Secret Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "bonappetit_university_secret_key_2026")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Table name for users in Supabase (default: user or users)
USER_TABLE_NAME = os.getenv("TABLE_NAME", "user")
TABLE_NAME = USER_TABLE_NAME

# Initialize Supabase Client
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f" Connected to Supabase Database ({USER_TABLE_NAME}) successfully!")
    except Exception as e:
        print(f" Supabase connection warning: {e}")

# =========================================================================
# In-Memory Fallback Storage (Resilient if Supabase is offline or migrating)
# =========================================================================
FALLBACK_USERS = {
    "student@university.edu": {
        "id": "1",
        "name": "Student",
        "email": "student@university.edu",
        "password": hashlib.sha256("password123".encode("utf-8")).hexdigest(),
        "phone_number": "0771234567"
    }
}

FALLBACK_RECIPES = [
    {
        "id": "sri-lankan-chinese-chili-paste",
        "title": "Sri Lankan Chinese-Style Chili Paste",
        "time": "25 min",
        "servings": "10 servings",
        "kcal": "95 kcal",
        "image_url": "https://live.staticflickr.com/4133/4967780329_1a19648cf2_b.jpg",
        "description": "A fiery, aromatic chili oil condiment packed with crispy garlic, chili flakes, and umami richness.",
        "ingredients": [
            "1 cup red chili flakes (crushed dried red chilies)",
            "6 cloves garlic, finely minced",
            "1 tbsp fresh ginger, finely minced",
            "2 tbsp Maldive fish flakes (umbalakada) or dried prawns, ground",
            "3 tbsp dark soy sauce",
            "1 tbsp sugar",
            "1/2 cup vegetable oil (or sesame oil blend)",
            "Salt, to taste"
        ],
        "steps": [
            {"id": 1, "text": "Fry garlic and ginger — Heat oil in a pan over medium-low heat and fry until lightly golden and fragrant"},
            {"id": 2, "text": "Crisp the umami base — Add ground Maldive fish or dried shrimp and fry for 1-2 minutes until crisp"},
            {"id": 3, "text": "Toss chili flakes — Reduce heat to low, stir in chili flakes, and fry gently without burning"},
            {"id": 4, "text": "Season and finish — Stir in soy sauce, sugar, and salt; simmer for 1 minute until well combined and glossy"}
        ]
    }
]

FALLBACK_USER_RECIPES = []

FALLBACK_CUSTOM_CUPS = [
    {"id": "cup-1", "user_id": "all", "name": "Blue mug", "volume_ml": 350, "height_cm": 11.0, "diameter_cm": 8.0},
    {"id": "cup-2", "user_id": "all", "name": "Glass tumbler", "volume_ml": 250, "height_cm": 10.0, "diameter_cm": 7.0}
]

FALLBACK_SHOPPING_ITEMS = [
    {"id": "shop-1", "user_id": "all", "name": "Extra Virgin Olive Oil", "amount": "250 ml", "category": "Pantry", "source": "Manual", "completed": False, "added_at": "Today, 10:15 AM"},
    {"id": "shop-2", "user_id": "all", "name": "Fresh Garlic", "amount": "2 bulbs", "category": "Produce", "source": "AI Voice", "completed": False, "added_at": "Today, 10:20 AM"},
    {"id": "shop-3", "user_id": "all", "name": "Parmesan Cheese", "amount": "100g", "category": "Dairy", "source": "Recipe: Garlic Butter Shrimp", "completed": True, "added_at": "Yesterday"},
    {"id": "shop-4", "user_id": "all", "name": "Linguine Pasta", "amount": "500g", "category": "Pantry", "source": "Recipe: Garlic Butter Shrimp", "completed": True, "added_at": "Yesterday"},
    {"id": "shop-5", "user_id": "all", "name": "Fresh Parsley", "amount": "1 bunch", "category": "Produce", "source": "Manual", "completed": False, "added_at": "Today, 11:05 AM"}
]


# =========================================================================
# Password Hashing Functions (SHA-256)
# =========================================================================
def hash_password(password: str) -> str:
    """Hashes a plain-text password using SHA-256."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, stored_password: str) -> bool:
    """Compares plain password's SHA-256 hash against stored password."""
    return stored_password == hash_password(plain_password)


# =========================================================================
# JWT Helper Functions
# =========================================================================
def create_jwt_token(user_id, email, name="", is_admin=False):
    """Generates a signed JWT token valid for 24 hours."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name or email.split("@")[0],
        "isAdmin": bool(is_admin),
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_jwt_token(token):
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired. Please sign in again."
    except jwt.InvalidTokenError:
        return None, "Invalid token."


def get_current_user_from_request(req):
    """Extracts decoded JWT user from Authorization header, or None."""
    auth_header = req.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload, _ = decode_jwt_token(token)
        if payload:
            return payload
    return None


# =========================================================================
# User Database Helpers
# =========================================================================
def find_user_by_email(email: str):
    """Finds a user by email in Supabase table or fallback store."""
    if supabase:
        for table in [USER_TABLE_NAME, "user", "users"]:
            try:
                res = supabase.table(table).select("*").eq("email", email).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                continue

    return FALLBACK_USERS.get(email)


def find_user_by_id(user_id: str):
    """Finds a user by ID in Supabase table or fallback store."""
    if supabase:
        for table in [USER_TABLE_NAME, "user", "users"]:
            try:
                res = supabase.table(table).select("*").eq("id", user_id).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                continue

    return next((u for u in FALLBACK_USERS.values() if u.get("id") == user_id), None)


def insert_user(name: str, email: str, password_hash: str, phone_number: str, is_admin: bool = False):
    """Inserts a new user into Supabase table or fallback store."""
    clean_email = email.strip().lower()
    if supabase:
        for table in [USER_TABLE_NAME, "user", "users"]:
            try:
                new_row = {
                    "name": name,
                    "email": clean_email,
                    "password": password_hash,
                    "phone_number": phone_number,
                    "isAdmin": bool(is_admin)
                }
                res = supabase.table(table).insert(new_row).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                print(f"Supabase insert_user error on {table}: {e}")
                continue

    # Fallback in-memory storage
    user_record = {
        "id": str(len(FALLBACK_USERS) + 1),
        "name": name,
        "email": clean_email,
        "password": password_hash,
        "phone_number": phone_number,
        "isAdmin": bool(is_admin)
    }
    FALLBACK_USERS[clean_email] = user_record
    return user_record


def get_all_users_admin():
    """Retrieves all users for admin management, omitting sensitive passwords."""
    if supabase:
        for table in [USER_TABLE_NAME, "user", "users"]:
            try:
                res = supabase.table(table).select("id, name, email, phone_number, isAdmin, created_at").order("created_at", desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"Supabase get_all_users_admin error on {table}: {e}")
                continue

    users = []
    for em, u in FALLBACK_USERS.items():
        users.append({
            "id": u.get("id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "phone_number": u.get("phone_number"),
            "isAdmin": u.get("isAdmin", False),
            "created_at": "Just now"
        })
    return users


def admin_update_user(user_id: str, name: str = None, email: str = None, phone_number: str = None, is_admin: bool = None, password_hash: str = None):
    """Updates user fields in Supabase user table."""
    updates = {}
    if name is not None:
        updates["name"] = name.strip()
    if email is not None:
        updates["email"] = email.strip().lower()
    if phone_number is not None:
        updates["phone_number"] = phone_number.strip()
    if is_admin is not None:
        updates["isAdmin"] = bool(is_admin)
    if password_hash:
        updates["password"] = password_hash

    if not updates:
        return None

    if supabase:
        for table in [USER_TABLE_NAME, "user", "users"]:
            try:
                res = supabase.table(table).update(updates).eq("id", user_id).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                print(f"Supabase admin_update_user error on {table}: {e}")
                continue

    for em, u in FALLBACK_USERS.items():
        if u.get("id") == user_id:
            u.update(updates)
            return u
    return None


def admin_delete_user(user_id: str):
    """Deletes a user from Supabase user table."""
    if supabase:
        for table in [USER_TABLE_NAME, "user", "users"]:
            try:
                supabase.table(table).delete().eq("id", user_id).execute()
                return True
            except Exception as e:
                print(f"Supabase admin_delete_user error on {table}: {e}")
                continue

    target_email = next((em for em, u in FALLBACK_USERS.items() if u.get("id") == user_id), None)
    if target_email:
        FALLBACK_USERS.pop(target_email, None)
        return True
    return False


# =========================================================================
# Recipes Database Helpers
# =========================================================================
def get_all_recipes():
    """Retrieves all recipes from Supabase or fallback seed list."""
    if supabase:
        try:
            res = supabase.table("recipes").select("*").order("created_at", desc=True).execute()
            if res.data and len(res.data) > 0:
                return res.data
        except Exception as e:
            print(f"Supabase recipes select error: {e}")

    return FALLBACK_RECIPES


def get_recipe_by_id(recipe_id: str):
    """Retrieves a single recipe by its ID."""
    if supabase:
        try:
            res = supabase.table("recipes").select("*").eq("id", recipe_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase recipe select error: {e}")

    return next((r for r in FALLBACK_RECIPES if r["id"] == recipe_id), None)


def insert_recipe(recipe_dict: dict):
    """Inserts a new recipe into Supabase or fallback list."""
    if supabase:
        try:
            res = supabase.table("recipes").insert(recipe_dict).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase recipe insert error: {e}")

    FALLBACK_RECIPES.insert(0, recipe_dict)
    return recipe_dict


def update_recipe(recipe_id: str, recipe_dict: dict):
    """Updates a recipe in Supabase or fallback list."""
    if supabase:
        try:
            res = supabase.table("recipes").update(recipe_dict).eq("id", recipe_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase recipe update error: {e}")

    for idx, r in enumerate(FALLBACK_RECIPES):
        if r["id"] == recipe_id:
            r.update(recipe_dict)
            return r
    return None


def delete_recipe(recipe_id: str):
    """Deletes a recipe from Supabase or fallback list."""
    if supabase:
        try:
            supabase.table("recipes").delete().eq("id", recipe_id).execute()
            return True
        except Exception as e:
            print(f"Supabase recipe delete error: {e}")

    global FALLBACK_RECIPES
    FALLBACK_RECIPES = [r for r in FALLBACK_RECIPES if r["id"] != recipe_id]
    return True


def get_user_recipes(user_id: str, status="completed"):
    """Retrieves recipes cooked or saved by the user."""
    if supabase:
        try:
            res = supabase.table("user_recipes").select("*").eq("user_id", user_id).eq("status", status).order("cooked_at", desc=True).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"Supabase user_recipes select error: {e}")

    return [r for r in FALLBACK_USER_RECIPES if r.get("user_id") in [user_id, "student@university.edu"]]


def record_recipe_cooked(user_id: str, recipe_id: str, title: str, image_url: str):
    """Records or updates a recipe session for the user in user_recipes."""
    clean_user = str(user_id or "default_user").strip().lower()
    new_entry = {
        "user_id": clean_user,
        "recipe_id": recipe_id,
        "recipe_title": title,
        "recipe_image": image_url,
        "status": "completed"
    }
    if supabase:
        try:
            # Check if record already exists for this user and recipe; if so, update cooked_at
            existing = supabase.table("user_recipes").select("id").eq("user_id", clean_user).eq("recipe_id", recipe_id).execute()
            if existing.data and len(existing.data) > 0:
                now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                upd = supabase.table("user_recipes").update({
                    "cooked_at": now_str,
                    "recipe_title": title,
                    "recipe_image": image_url
                }).eq("id", existing.data[0]["id"]).execute()
                return upd.data[0] if upd.data else existing.data[0]
            res = supabase.table("user_recipes").insert(new_entry).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase record_recipe_cooked error: {e}")

    new_entry["id"] = f"cooked-{len(FALLBACK_USER_RECIPES) + 1}"
    new_entry["cooked_at"] = "Just now"
    FALLBACK_USER_RECIPES.insert(0, new_entry)
    return new_entry


# =========================================================================
# Custom Measuring Cups Database Helpers
# =========================================================================
def get_custom_cups(user_id: str, email: str = None):
    """Retrieves saved custom cups for the user, deduplicating by lowercase name."""
    raw_cups = []
    if supabase:
        try:
            filters = [f"user_id.eq.{user_id}", "user_id.eq.all"]
            if email and email != user_id:
                filters.append(f"user_id.eq.{email}")
            res = supabase.table("custom_cups").select("*").or_(",".join(filters)).execute()
            if res.data is not None:
                raw_cups = res.data
        except Exception as e:
            print(f"Supabase custom_cups select error: {e}")
    else:
        raw_cups = [c for c in FALLBACK_CUSTOM_CUPS if c.get("user_id") in [user_id, email, "all"]]

    seen_names = set()
    unique_cups = []
    for c in raw_cups:
        c_name = str(c.get("name", "")).strip().lower()
        if c_name and c_name not in seen_names:
            seen_names.add(c_name)
            unique_cups.append(c)

    return unique_cups


def insert_custom_cup(user_id: str, name: str, volume_ml: float, height_cm=None, diameter_cm=None):
    """Saves a new custom measuring cup."""
    new_cup = {
        "user_id": user_id,
        "name": name,
        "volume_ml": volume_ml,
    }
    if height_cm is not None:
        new_cup["height_cm"] = height_cm
    if diameter_cm is not None:
        new_cup["diameter_cm"] = diameter_cm

    if supabase:
        try:
            res = supabase.table("custom_cups").insert(new_cup).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase custom_cup insert error: {e}")
            # If extra columns don't exist in Supabase table, retry with core fields only
            try:
                core_cup = {
                    "user_id": user_id,
                    "name": name,
                    "volume_ml": volume_ml,
                }
                res = supabase.table("custom_cups").insert(core_cup).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as retry_e:
                print(f"Supabase custom_cup retry insert error: {retry_e}")

    new_cup["id"] = f"cup-{len(FALLBACK_CUSTOM_CUPS) + 1}"
    FALLBACK_CUSTOM_CUPS.append(new_cup)
    return new_cup


def delete_custom_cup(user_id: str, cup_id: str):
    """Deletes a custom measuring cup by ID."""
    if supabase:
        try:
            supabase.table("custom_cups").delete().eq("id", cup_id).execute()
            return True
        except Exception as e:
            print(f"Supabase custom_cup delete error: {e}")

    global FALLBACK_CUSTOM_CUPS
    FALLBACK_CUSTOM_CUPS = [c for c in FALLBACK_CUSTOM_CUPS if str(c.get("id")) != str(cup_id)]
    return True


# =========================================================================
# Shopping List Database Helpers
# =========================================================================
def get_shopping_items(user_id: str):
    """Retrieves all shopping list items for user."""
    if supabase:
        try:
            res = supabase.table("shopping_items").select("*").or_(f"user_id.eq.{user_id},user_id.eq.all").order("created_at", desc=True).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"Supabase shopping_items select error: {e}")

    return []


def insert_shopping_item(user_id: str, name: str, amount="1 unit", category="Produce", source="Manual"):
    """Inserts a new shopping list item."""
    new_item = {
        "user_id": user_id,
        "name": name,
        "amount": amount,
        "category": category,
        "source": source,
        "completed": False
    }
    if supabase:
        try:
            res = supabase.table("shopping_items").insert(new_item).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase shopping_item insert error: {e}")

    new_item["id"] = f"shop-{len(FALLBACK_SHOPPING_ITEMS) + 1}"
    new_item["added_at"] = "Just now"
    FALLBACK_SHOPPING_ITEMS.insert(0, new_item)
    return new_item


def toggle_shopping_item(user_id: str, item_id: str, completed=None):
    """Toggles or updates the completed status of an item."""
    if supabase:
        try:
            # If completed is None, fetch current and invert
            if completed is None:
                current = supabase.table("shopping_items").select("completed").eq("id", item_id).execute()
                if current.data:
                    completed = not current.data[0].get("completed", False)
                else:
                    completed = True

            res = supabase.table("shopping_items").update({"completed": completed}).eq("id", item_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase shopping_item toggle error: {e}")

    # Fallback
    for item in FALLBACK_SHOPPING_ITEMS:
        if str(item.get("id")) == str(item_id):
            item["completed"] = not item.get("completed", False) if completed is None else completed
            return item
    return None


def delete_shopping_item(user_id: str, item_id: str):
    """Deletes a shopping item by ID."""
    if supabase:
        try:
            supabase.table("shopping_items").delete().eq("id", item_id).execute()
            return True
        except Exception as e:
            print(f"Supabase shopping_item delete error: {e}")

    global FALLBACK_SHOPPING_ITEMS
    FALLBACK_SHOPPING_ITEMS = [item for item in FALLBACK_SHOPPING_ITEMS if str(item.get("id")) != str(item_id)]
    return True


def clear_completed_shopping_items(user_id: str):
    """Removes all completed shopping items for user."""
    if supabase:
        try:
            supabase.table("shopping_items").delete().eq("completed", True).or_(f"user_id.eq.{user_id},user_id.eq.all").execute()
            return True
        except Exception as e:
            print(f"Supabase clear_completed error: {e}")

    global FALLBACK_SHOPPING_ITEMS
    FALLBACK_SHOPPING_ITEMS = [item for item in FALLBACK_SHOPPING_ITEMS if not item.get("completed", False)]
    return True


# =========================================================================
# Conversations Database Helpers (conversations table)
# =========================================================================
FALLBACK_CONVERSATIONS = {}


def get_conversation_chat_id(user_id: str, recipe_id: str = None) -> str:
    """Generates a deterministic RFC-4122 UUID for a conversation based on user_id and recipe_id."""
    clean_user = str(user_id or "default_user").strip().lower()
    clean_recipe = str(recipe_id or "general").strip().lower()
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"cookingbuddy:{clean_user}:{clean_recipe}"))


def get_conversation(user_id: str, recipe_id: str = None, chat_id: str = None, user_email: str = None) -> list:
    """Retrieves saved conversation messages for a recipe or general chat."""
    clean_uid = str(user_id or "default_user").strip().lower()
    clean_email = str(user_email or "").strip().lower() if user_email else None

    candidate_cids = []
    if chat_id:
        candidate_cids.append(chat_id)
    candidate_cids.append(get_conversation_chat_id(clean_uid, recipe_id))
    if clean_email and clean_email != clean_uid:
        candidate_cids.append(get_conversation_chat_id(clean_email, recipe_id))

    # Also check if user_recipes has any session id for this user and recipe
    if supabase and recipe_id and recipe_id != "general":
        try:
            filters = [f"user_id.eq.{clean_uid}"]
            if clean_email and clean_email != clean_uid:
                filters.append(f"user_id.eq.{clean_email}")
            res_ur = (
                supabase.table("user_recipes")
                .select("id")
                .or_(",".join(set(filters)))
                .eq("recipe_id", recipe_id)
                .execute()
            )
            if res_ur.data:
                for row in res_ur.data:
                    ur_id = row.get("id")
                    if ur_id and ur_id not in candidate_cids:
                        candidate_cids.append(ur_id)
        except Exception as e:
            print(f"Error querying user_recipes session id in get_conversation: {e}")

    # Fallback to guest only if the request itself was made by guest
    if clean_uid in ["guest", "default_user"]:
        cid_guest = get_conversation_chat_id("guest", recipe_id)
        cid_default = get_conversation_chat_id("default_user", recipe_id)
        if cid_guest not in candidate_cids:
            candidate_cids.append(cid_guest)
        if cid_default not in candidate_cids:
            candidate_cids.append(cid_default)

    if supabase:
        for cid in candidate_cids:
            try:
                res = supabase.table("conversations").select("*").eq("user_recipes_id", cid).order("id", desc=False).execute()
                if res.data and len(res.data) > 0:
                    return res.data
            except Exception as e:
                print(f"Supabase conversations select error: {e}")

    for cid in candidate_cids:
        if cid in FALLBACK_CONVERSATIONS and len(FALLBACK_CONVERSATIONS[cid]) > 0:
            return FALLBACK_CONVERSATIONS[cid]

    return []


def save_conversation(user_id: str, recipe_id: str = None, messages: list = None, chat_id: str = None) -> list:
    """
    Saves conversation messages to the conversations table in Supabase.
    CRITICAL RULE:
    Only stores if the user has actually started saying/typing something.
    If the user has not said anything (e.g. only initial greeting exists), DO NOT store.
    """
    if not messages or not isinstance(messages, list):
        return []

    # Verify if user has actually said or typed anything in this conversation
    has_user_spoken = False
    for m in messages:
        role = str(m.get("role") or m.get("sender") or "").strip().lower()
        text = str(m.get("message") or m.get("text") or "").strip()
        if role == "user" and text:
            has_user_spoken = True
            break

    # If user hasn't said anything, do not store!
    if not has_user_spoken:
        return []

    cid = chat_id or get_conversation_chat_id(user_id, recipe_id)

    rows_to_insert = []
    for m in messages:
        sender = str(m.get("role") or m.get("sender") or "").strip().lower()
        text = str(m.get("message") or m.get("text") or "").strip()
        if not text:
            continue
        role = "user" if sender == "user" else "chef"
        rows_to_insert.append({
            "user_recipes_id": cid,
            "role": role,
            "message": text
        })

    if not rows_to_insert:
        return []

    if supabase:
        try:
            # Clear previous entries for this conversation and insert new messages
            supabase.table("conversations").delete().eq("user_recipes_id", cid).execute()
            res = supabase.table("conversations").insert(rows_to_insert).execute()
            if res.data:
                return res.data
        except Exception as e:
            print(f"Supabase conversations insert error: {e}")

    FALLBACK_CONVERSATIONS[cid] = rows_to_insert
    return rows_to_insert


def delete_conversation(user_id: str, recipe_id: str = None, chat_id: str = None) -> bool:
    """Deletes conversation messages for a recipe or general chat."""
    cid = chat_id or get_conversation_chat_id(user_id, recipe_id)
    if supabase:
        try:
            supabase.table("conversations").delete().eq("user_recipes_id", cid).execute()
            return True
        except Exception as e:
            print(f"Supabase conversations delete error: {e}")

    FALLBACK_CONVERSATIONS.pop(cid, None)
    return True


def get_recipes_with_conversations(user_id: str, user_email: str = None) -> list:
    """
    Returns full recipe objects for all user sessions stored in user_recipes,
    as well as recipes with active conversations for this specific user.
    Status in user_recipes is NOT considered (all sessions are included).
    """
    all_recipes = get_all_recipes()
    recipes_by_id = {r.get("id"): r for r in all_recipes if r.get("id")}

    clean_uid = str(user_id or "guest").strip().lower()
    clean_email = str(user_email or "").strip().lower() if user_email else None

    selected_recipes = []
    seen_recipe_ids = set()

    # 1. Fetch user sessions from user_recipes table (WITHOUT filtering by status)
    if supabase:
        try:
            filters = [f"user_id.eq.{clean_uid}"]
            if clean_email and clean_email != clean_uid:
                filters.append(f"user_id.eq.{clean_email}")

            res_ur = (
                supabase.table("user_recipes")
                .select("*")
                .or_(",".join(set(filters)))
                .order("cooked_at", desc=True)
                .execute()
            )

            if res_ur.data:
                for ur in res_ur.data:
                    rid = ur.get("recipe_id")
                    if rid and rid not in seen_recipe_ids:
                        seen_recipe_ids.add(rid)
                        full_rec = recipes_by_id.get(rid)
                        if full_rec:
                            recipe_obj = dict(full_rec)
                            if ur.get("recipe_image"):
                                recipe_obj["image_url"] = ur.get("recipe_image")
                            if ur.get("recipe_title"):
                                recipe_obj["title"] = ur.get("recipe_title")
                            recipe_obj["session_id"] = ur.get("id")
                            recipe_obj["cooked_at"] = ur.get("cooked_at")
                            selected_recipes.append(recipe_obj)
                        else:
                            selected_recipes.append({
                                "id": rid,
                                "title": ur.get("recipe_title") or rid.replace("-", " ").title(),
                                "image_url": ur.get("recipe_image") or "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80",
                                "time": "20 min",
                                "kcal": "450 kcal",
                                "description": ur.get("recipe_title") or "",
                                "ingredients": [],
                                "steps": [],
                                "session_id": ur.get("id"),
                                "cooked_at": ur.get("cooked_at")
                            })
        except Exception as e:
            print(f"Supabase error fetching user_recipes sessions: {e}")

    # Fallback memory check for user_recipes
    for ur in FALLBACK_USER_RECIPES:
        u_id = str(ur.get("user_id", "")).strip().lower()
        if u_id in [clean_uid, clean_email]:
            rid = ur.get("recipe_id")
            if rid and rid not in seen_recipe_ids:
                seen_recipe_ids.add(rid)
                full_rec = recipes_by_id.get(rid)
                if full_rec:
                    selected_recipes.append(full_rec)
                else:
                    selected_recipes.append({
                        "id": rid,
                        "title": ur.get("recipe_title", rid),
                        "image_url": ur.get("recipe_image", ""),
                        "time": "20 min",
                        "kcal": "450 kcal"
                    })

    # 2. Also check conversations table ONLY for this user's own conversations
    if supabase:
        try:
            for recipe in all_recipes:
                rec_id = recipe.get("id")
                if rec_id in seen_recipe_ids:
                    continue

                user_cids = [get_conversation_chat_id(clean_uid, rec_id)]
                if clean_email and clean_email != clean_uid:
                    user_cids.append(get_conversation_chat_id(clean_email, rec_id))

                res_c = (
                    supabase.table("conversations")
                    .select("id")
                    .in_("user_recipes_id", user_cids)
                    .limit(1)
                    .execute()
                )
                if res_c.data and len(res_c.data) > 0:
                    seen_recipe_ids.add(rec_id)
                    selected_recipes.append(recipe)
        except Exception as e:
            print(f"Supabase error checking conversations for user: {e}")

    return selected_recipes
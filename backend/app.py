import os
import sys

# Configure UTF-8 for console output on Windows to prevent charmap encoding errors
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from flask import Flask
from dotenv import load_dotenv

# Import route blueprints
from routes.auth import auth_bp
from routes.recipes import recipes_bp
from routes.measuring import measuring_bp
from routes.shopping import shopping_bp
from routes.chat import chat_bp
from routes.admin import admin_bp

# Import Live Voice WebSocket runner
from services.live_voice_service import start_live_voice_server_thread

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

# ==========================================================
# CORS Configuration (Enables React Frontend Communication)
# ==========================================================
@app.after_request
def handle_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    return response


@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def preflight_cors(path):
    return ("", 204)


# ==========================================================
# Register Blueprints
# ==========================================================
app.register_blueprint(auth_bp)
app.register_blueprint(recipes_bp)
app.register_blueprint(measuring_bp)
app.register_blueprint(shopping_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(admin_bp)


# ==========================================================
# Start Flask Server & Live Voice Server
# ==========================================================
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    voice_port = int(os.getenv("VOICE_PORT", 5001))

    # Start Gemini Live WebSocket Voice bridge in background daemon thread
    try:
        start_live_voice_server_thread(host="0.0.0.0", port=voice_port)
        print(f"[Voice Server] Voice WebSocket bridge enabled on ws://127.0.0.1:{voice_port}")
    except Exception as e:
        print(f"[Voice Server] Failed to start voice server thread: {e}")

    print(f"[Server] Server running on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)


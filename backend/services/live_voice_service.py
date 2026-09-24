import os
import sys
import json
import base64
import asyncio
import threading
from dotenv import load_dotenv
from google import genai
from google.genai import types
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from database.db import insert_shopping_item, insert_custom_cup, get_all_recipes

load_dotenv()

# Configure UTF-8 for console output on Windows to prevent charmap encoding errors
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def safe_log(msg: str):
    """Safely prints messages to console without crashing on charmap encoding errors."""
    try:
        print(msg)
    except Exception:
        try:
            print(str(msg).encode("ascii", errors="backslashreplace").decode("ascii"))
        except Exception:
            pass

# Live Gemini model verified for bidirectional streaming
LIVE_MODEL = "gemini-3.1-flash-live-preview"


def get_gemini_client():
    """Initializes and returns an authenticated GenAI client."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in backend/.env")
    return genai.Client(api_key=api_key)


def build_voice_system_prompt(user_name="Chef", active_recipe=None, health_goal=None, saved_cups=None, history=None):
    """Builds a spoken-optimized system prompt for Chef Bon voice interaction."""
    recipes = get_all_recipes()
    catalog_summary = ", ".join([r.get("title", "") for r in recipes[:6]])

    prompt = f"""You are Chef Bon, a warm, energetic, and witty AI sous chef speaking out loud with {user_name} in their kitchen!

    Spoken Voice Persona & Rules:
    - Your words will be converted directly to speech and heard aloud through the kitchen speakers.
    - Speak naturally, warmly, friendly and concisely (1 to 3 conversational sentences per response).
    - Never use markdown syntax like asterisks, bullet points, hashes, or emojis in your speech.
    - Use friendly culinary phrases and encouragement (seasoning, aromas, aprons, simmering).
    - If the user asks for steps, give them one or two practical steps at a time so they can follow along while cooking.
    - Always reply exact language user is talking to you.(eg. if user is talking in sinhala reply in sinhala, if user is talking in english reply in english,   if user talking tamil reply in tamil)
    - if user ask about non-cooking related things then ignore it and say that you are a cooking assistant and you can only help with cooking related things and refuse to answer 
    -dont output any code or JSON or markdown or bullet points or hashtags or any other formatting.
    
    Kitchen Context:
    - Available library recipes: {catalog_summary}
    - User nutrition & health target: {health_goal or 'Balanced cooking'}
    - User saved custom cups: {saved_cups or 'Standard cup (240ml), Grams scale'}
    """

    if active_recipe:
        prompt += f"""
            Currently Cooking Recipe:
            - Title: {active_recipe.get('title')}
            - Time: {active_recipe.get('time')} | Servings: {active_recipe.get('servings')} | Calories: {active_recipe.get('kcal')}
            - Ingredients: {', '.join(active_recipe.get('ingredients', []))}
            Guide {user_name} step-by-step through this dish.
            """

    if history and isinstance(history, list):
        recent_turns = []
        for m in history[-10:]:
            sender = m.get("sender") or m.get("role") or "chef"
            text = m.get("text") or m.get("content") or ""
            if text:
                label = "User" if sender == "user" else "Chef Bon"
                recent_turns.append(f"{label}: {text}")
        if recent_turns:
            turns_str = "\n".join(recent_turns)
            prompt += f"""
            Previous Conversation in this Ongoing Cooking Session:
            {turns_str}
            The user is continuing this conversation. Keep track of what has already been discussed, answered, or measured.
            """

    prompt += """
    Tool Usage Rules:
    1. When the user asks to add an ingredient or item to their shopping list, call `add_to_shopping_list`.
    2. When the user says to add a cup (e.g. "add a cup into...", "add a cup into measuring", "add a cup", "save my mug", "save cup", or in Sinhala/Tamil/any language), you MUST IMMEDIATELY call `save_custom_cup` right in the middle of conversation!
       - If the user specifies a name (e.g. 'Blue Mug', 'Tea Cup', 'Steel Cup'), use that name. If no specific name is given, use 'My Measuring Cup'.
       - If the user specifies volume (e.g. 200ml, 350ml), pass that volume. If not specified, default to 250.0 ml.
       - Acknowledge warmly in the user's spoken language that you have saved their cup into their kitchen tools in real time.
    """
    return prompt.strip()


# =========================================================================
# Voice Tool Declarations for Gemini Live
# =========================================================================
def add_to_shopping_list(name: str, amount: str = "1 unit", category: str = "Produce") -> str:
    """Adds an ingredient or grocery item to the user shopping list.
    Args:
        name: Name of the ingredient (e.g. 'Olive oil', 'Garlic', 'Avocados')
        amount: Quantity and unit (e.g. '2 tbsp', '500g', '2 units')
        category: Grocery category like 'Produce', 'Dairy', 'Pantry', 'Meat & Seafood', 'Spices & Herbs', 'Other'
    """
    return "ok"


def save_custom_cup(name: str = "My Measuring Cup", volume_ml: float = 250.0) -> str:
    """Saves a custom measuring cup or container into user kitchen tools in real time.
    Call this tool whenever the user asks to add or save a cup, mug, or measuring container at any point in conversation (e.g. 'add a cup into...', 'add a cup into measuring', 'add a cup 200ml', 'save my blue mug 350ml', 'add a cup').
    Args:
        name: Friendly name for the cup (e.g. 'Blue Coffee Mug', 'Glass Tumbler', 'Tea Cup'). Defaults to 'My Measuring Cup'.
        volume_ml: Total volume capacity in milliliters (e.g. 250, 350, 180). Defaults to 250.0 if not specified.
    """
    return "ok"



# =========================================================================
# Client Connection Handler
# =========================================================================
async def handle_voice_client(websocket):
    """Handles an incoming browser WebSocket connection and bridges it to Gemini Live with transparent auto-reconnection."""
    safe_log("[Voice Server] Browser client connected to Live Voice bridge.")

    client = get_gemini_client()

    user_id = "default_user"
    user_name = "Chef"
    active_recipe = None
    health_goal = "Balanced & High Protein (~1,900 kcal)"
    saved_cups = None
    queued_first_message = None
    accumulated_history = []

    # 1. Wait briefly for optional initial setup payload from frontend
    try:
        raw_first = await asyncio.wait_for(websocket.recv(), timeout=1.0)
        if isinstance(raw_first, str):
            try:
                data = json.loads(raw_first)
                if data.get("type") == "setup":
                    user_id = data.get("userId") or user_id
                    user_name = data.get("userName") or user_name
                    active_recipe = data.get("activeRecipe") or active_recipe
                    health_goal = data.get("healthGoal") or health_goal
                    saved_cups = data.get("savedCups") or saved_cups
                    accumulated_history = list(data.get("history") or [])
                else:
                    queued_first_message = raw_first
            except Exception:
                queued_first_message = raw_first
        else:
            queued_first_message = raw_first
    except asyncio.TimeoutError:
        pass
    except ConnectionClosed:
        safe_log("[Voice Server] Client disconnected before setup.")
        return

    is_first_connect = True

    # 2. Resilient session loop: transparently reconnects Gemini Live if Google aborts (e.g. 1008/150s preview limit)
    while getattr(websocket, "open", True):
        system_prompt = build_voice_system_prompt(
            user_name=user_name,
            active_recipe=active_recipe,
            health_goal=health_goal,
            saved_cups=saved_cups,
            history=accumulated_history
        )

        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                )
            ),
            tools=[add_to_shopping_list, save_custom_cup],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            system_instruction=types.Content(parts=[types.Part.from_text(text=system_prompt)])
        )

        try:
            async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
                safe_log(f"[Voice Server] Connected to Gemini Live session (session turn #{len(accumulated_history) + 1}).")

                # Notify frontend that Live session is ready
                try:
                    await websocket.send(json.dumps({
                        "type": "ready",
                        "model": LIVE_MODEL,
                        "reconnected": not is_first_connect
                    }))
                except Exception:
                    break

                is_first_connect = False
                user_turn_snippets = []
                model_turn_snippets = []

                async def process_client_message(msg, live_session):
                    if isinstance(msg, bytes):
                        # Raw 16kHz PCM audio bytes
                        await live_session.send_realtime_input(
                            audio=types.Blob(data=msg, mime_type="audio/pcm;rate=16000")
                        )
                    elif isinstance(msg, str):
                        try:
                            payload = json.loads(msg)
                            msg_type = payload.get("type")

                            if msg_type == "audio":
                                audio_b64 = payload.get("data", "")
                                if audio_b64:
                                    pcm_data = base64.b64decode(audio_b64)
                                    await live_session.send_realtime_input(
                                        audio=types.Blob(data=pcm_data, mime_type="audio/pcm;rate=16000")
                                    )
                            elif msg_type == "text":
                                text_val = payload.get("text", "")
                                if text_val:
                                    await live_session.send_client_content(
                                        turns=[types.Content(role="user", parts=[types.Part.from_text(text=text_val)])],
                                        turn_complete=True
                                    )
                            elif msg_type == "end_of_turn":
                                await live_session.send_realtime_input(audio_stream_end=True)
                        except Exception as parse_err:
                            safe_log(f"[Voice Server] Error parsing client JSON message: {parse_err}")

                async def browser_to_gemini():
                    nonlocal queued_first_message
                    try:
                        if queued_first_message:
                            msg_to_send = queued_first_message
                            queued_first_message = None
                            await process_client_message(msg_to_send, session)

                        async for message in websocket:
                            await process_client_message(message, session)
                    except ConnectionClosed:
                        pass
                    except asyncio.CancelledError:
                        pass
                    except Exception as err:
                        safe_log(f"[Voice Server] browser_to_gemini notice: {err}")

                async def gemini_to_browser():
                    nonlocal user_turn_snippets, model_turn_snippets
                    try:
                        while True:
                            try:
                                async for response in session.receive():
                                    # Handle Tool Calls
                                    if response.tool_call:
                                        function_responses = []
                                        for fc in response.tool_call.function_calls:
                                            tool_name = fc.name
                                            tool_args = fc.args or {}
                                            safe_log(f"[Voice Server] Tool called: {tool_name}")

                                            result_text = "Action succeeded."
                                            if tool_name == "add_to_shopping_list":
                                                name = tool_args.get("name") or tool_args.get("item") or "Ingredient"
                                                amount = tool_args.get("amount") or tool_args.get("quantity") or "1 unit"
                                                category = tool_args.get("category") or "Produce"
                                                saved = insert_shopping_item(
                                                    user_id=user_id,
                                                    name=name,
                                                    amount=amount,
                                                    category=category,
                                                    source="AI Voice Live"
                                                )
                                                result_text = f"Added {amount} of {name} ({category}) to your shopping list."
                                                await websocket.send(json.dumps({
                                                    "type": "tool_executed",
                                                    "tool": "add_to_shopping_list",
                                                    "item": saved
                                                }))
                                            elif tool_name == "save_custom_cup":
                                                name = (
                                                    tool_args.get("name")
                                                    or tool_args.get("cup_name")
                                                    or tool_args.get("title")
                                                    or "My Measuring Cup"
                                                )
                                                name = str(name).strip()
                                                lower_name = name.lower()
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
                                                        name = name[len(p):].strip()
                                                        break

                                                if not name or name.lower() in ["measuring", "tools", "into", "into measuring", "kitchen"]:
                                                    name = "My Measuring Cup"

                                                vol_raw = tool_args.get("volume_ml") or tool_args.get("volume")
                                                volume = 250.0
                                                if vol_raw is not None:
                                                    try:
                                                        volume = float(vol_raw)
                                                    except (ValueError, TypeError):
                                                        import re
                                                        match = re.search(r"(\d+(\.\d+)?)", str(vol_raw))
                                                        volume = float(match.group(1)) if match else 250.0

                                                saved = insert_custom_cup(
                                                    user_id=user_id,
                                                    name=name,
                                                    volume_ml=volume
                                                )
                                                result_text = f"Saved custom cup '{name}' with volume {volume} ml."
                                                await websocket.send(json.dumps({
                                                    "type": "tool_executed",
                                                    "tool": "save_custom_cup",
                                                    "cup": saved
                                                }))

                                            function_responses.append(types.FunctionResponse(
                                                name=tool_name,
                                                id=fc.id,
                                                response={"result": result_text}
                                            ))

                                        if function_responses:
                                            await session.send_tool_response(function_responses=function_responses)

                                    # Handle Server Content (Audio & Live Transcriptions)
                                    if response.server_content:
                                        content = response.server_content

                                        # Barge-in / Interruption signal
                                        if getattr(content, "interrupted", False):
                                            await websocket.send(json.dumps({"type": "interrupted"}))

                                        # Real-time User Transcription
                                        if getattr(content, "input_transcription", None):
                                            text = content.input_transcription.text or ""
                                            if text:
                                                user_turn_snippets.append(text)
                                                await websocket.send(json.dumps({
                                                    "type": "transcription",
                                                    "role": "user",
                                                    "text": text
                                                }))

                                        # Real-time Model Transcription
                                        if getattr(content, "output_transcription", None):
                                            text = content.output_transcription.text or ""
                                            if text:
                                                model_turn_snippets.append(text)
                                                await websocket.send(json.dumps({
                                                    "type": "transcription",
                                                    "role": "model",
                                                    "text": text
                                                }))

                                        # Audio Stream Chunks (PCM 24kHz)
                                        if getattr(content, "model_turn", None) and content.model_turn.parts:
                                            for part in content.model_turn.parts:
                                                if getattr(part, "inline_data", None) and part.inline_data.data:
                                                    audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                                                    await websocket.send(json.dumps({
                                                        "type": "audio",
                                                        "data": audio_b64
                                                    }))

                                        # Turn Complete
                                        if getattr(content, "turn_complete", False):
                                            if user_turn_snippets:
                                                accumulated_history.append({"role": "user", "text": " ".join(user_turn_snippets)})
                                                user_turn_snippets = []
                                            if model_turn_snippets:
                                                accumulated_history.append({"role": "model", "text": " ".join(model_turn_snippets)})
                                                model_turn_snippets = []
                                            await websocket.send(json.dumps({"type": "turn_complete"}))

                            except ConnectionClosed:
                                break
                            except asyncio.CancelledError:
                                break
                            except Exception as turn_err:
                                safe_log(f"[Voice Server] Turn receive notice: {turn_err}")
                                break
                    except ConnectionClosed:
                        pass
                    except asyncio.CancelledError:
                        pass
                    except Exception as err:
                        safe_log(f"[Voice Server] gemini_to_browser error: {err}")

                # Run both streaming tasks concurrently
                t1 = asyncio.create_task(browser_to_gemini())
                t2 = asyncio.create_task(gemini_to_browser())

                done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass

        except ConnectionClosed:
            safe_log("[Voice Server] Browser client disconnected.")
            break
        except Exception as live_err:
            safe_log(f"[Voice Server] Gemini Live session dropped: {live_err}")
            if not getattr(websocket, "open", True):
                break
            # Save any in-flight speech before transparent reconnect
            if user_turn_snippets:
                accumulated_history.append({"role": "user", "text": " ".join(user_turn_snippets)})
            if model_turn_snippets:
                accumulated_history.append({"role": "model", "text": " ".join(model_turn_snippets)})
            safe_log("[Voice Server] Auto-reconnecting to Gemini Live seamlessly...")
            await asyncio.sleep(0.3)

    safe_log("[Voice Server] Client voice session ended.")


# =========================================================================
# Server Lifecycle Runner
# =========================================================================
async def start_voice_server(host="0.0.0.0", port=5001):
    """Starts the WebSocket server and runs continuously."""
    async with serve(handle_voice_client, host, port):
        print(f"[Voice Server] Live Voice WebSocket server running on ws://{host}:{port}")
        await asyncio.Future()  # run forever


def start_live_voice_server_thread(host="0.0.0.0", port=5001):
    """Launches the WebSocket server in a background daemon thread."""
    def run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(start_voice_server(host=host, port=port))
        except Exception as e:
            print(f"[Voice Server] Thread exception: {e}")

    thread = threading.Thread(target=run, daemon=True, name="LiveVoiceServerThread")
    thread.start()
    return thread


if __name__ == "__main__":
    asyncio.run(start_voice_server())

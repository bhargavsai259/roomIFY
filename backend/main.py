import os
import uuid
import json
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import replicate
from ultralytics import YOLO
from transformers import CLIPProcessor, CLIPModel

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    print("WARNING: groq package not installed. Run: pip install groq")


app = FastAPI(title="Roomify Backend API", description="API for processing room images into 3D scene data")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory session store ──────────────────────────────────────────────────
# Structure: { session_id: { "messages": [...], "created_at": timestamp } }
chat_sessions: dict = {}

# ─── Available furniture catalog (mirrors assets.json) ───────────────────────
AVAILABLE_FURNITURE = [
    "coffee_table", "sofa", "couch", "tablelamp", "teapoy", "woodendesk",
    "chair", "bed", "bathingtub", "car", "piano", "smart_fridge",
    "simple_dining_table", "airconditioner", "bed_side_table_with_lamp",
    "bicycle", "carcae", "ceiling_fan", "closet_wooden", "maple_tree",
    "mirror", "mirror_table", "modern_furniture_shelf", "motorcycle",
    "pottedplant", "pottedplant2", "shelf", "stove_sink_dish_drainer_kitchen_hood",
    "switchboard", "table_furniture", "treadmill", "tvdish", "tv_bench",
    "washing_machine", "window"
]

ROOM_TYPES = ["living_room", "bedroom", "kitchen", "bathroom", "office", "dining_room"]

# ─── System prompt template ───────────────────────────────────────────────────
def build_system_prompt(rooms_count: int, furniture_list: list) -> str:
    furniture_summary = ", ".join(
        f"{i}: {f['type']} (room {f['roomIndex']}, scale {f.get('scale', 1.0):.2f})"
        for i, f in enumerate(furniture_list)
    ) if furniture_list else "none"

    return f"""You are Roomify AI — an expert, friendly interior design assistant embedded in a 3D room visualization tool.

CURRENT SCENE STATE:
- Number of rooms: {rooms_count}
- Furniture currently in scene: {furniture_summary}

AVAILABLE FURNITURE MODELS (use exact names):
{', '.join(AVAILABLE_FURNITURE)}

AVAILABLE ROOM TYPES: {', '.join(ROOM_TYPES)}

YOUR CAPABILITIES:
1. Add furniture to a room
2. Remove furniture from the scene
3. Resize/scale furniture (0.1 = tiny, 1.0 = default, 2.0 = double size, 3.0 = very large)
4. Clear all furniture from a room
5. Add a new room to the scene
6. Answer design questions and give recommendations

RESPONSE FORMAT — You MUST always respond with valid JSON (no markdown, no code fences):
{{
  "message": "Your warm, helpful, conversational response here",
  "actions": [
    // Zero or more of the following action objects:
    {{"type": "add_furniture", "model_name": "<exact_name>", "room_index": <0-based int>}},
    {{"type": "remove_furniture", "furniture_type": "<type_name>"}},
    {{"type": "scale_furniture", "furniture_type": "<type_name>", "scale": <float 0.1-3.0>}},
    {{"type": "clear_room", "room_index": <0-based int>}},
    {{"type": "add_room", "room_type": "<room_type>", "breadth": <float>, "length": <float>}}
  ]
}}

RULES:
- Only use model_name values from the AVAILABLE FURNITURE MODELS list
- room_index is 0-based (first room = 0, second = 1, etc.)
- scale: 1.0 = normal, 0.5 = half size, 2.0 = double size (max 3.0)
- For add_room: default breadth=200, length=150 unless user specifies
- Always include a warm "message" explaining what you're doing
- If user asks for unavailable furniture, suggest the closest alternative
- You can execute multiple actions at once (e.g., add a sofa AND a coffee table)
- Be specific about which room you're placing items in
- NEVER output anything other than the JSON object — no prose before or after
"""


# ─── Groq chat endpoint ───────────────────────────────────────────────────────
@app.post("/chat")
async def chat(request: Request):
    """
    AI chat endpoint powered by Groq LLaMA.
    Maintains per-session conversation history in memory.
    Body: {
        session_id: string (optional, auto-generated if absent),
        message: string,
        rooms_count: int,
        furniture_list: [...],
    }
    Returns: {
        session_id: string,
        message: string,
        actions: [...]
    }
    """
    if not GROQ_AVAILABLE:
        return JSONResponse(
            content={"error": "groq package not installed. Run: pip install groq"},
            status_code=500
        )

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        return JSONResponse(
            content={"error": "GROQ_API_KEY environment variable not set."},
            status_code=500
        )

    try:
        body = await request.json()
    except Exception:
        return JSONResponse(content={"error": "Invalid JSON body"}, status_code=400)

    session_id = body.get("session_id") or str(uuid.uuid4())
    user_message = body.get("message", "").strip()
    rooms_count = int(body.get("rooms_count", 0))
    furniture_list = body.get("furniture_list", [])

    if not user_message:
        return JSONResponse(content={"error": "message cannot be empty"}, status_code=400)

    # Get or create session
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {"messages": []}

    session = chat_sessions[session_id]

    # Build fresh system prompt with current scene state
    system_prompt = build_system_prompt(rooms_count, furniture_list)

    # Append user message to history
    session["messages"].append({
        "role": "user",
        "content": user_message
    })

    # Build messages for Groq (system + full history)
    groq_messages = [
        {"role": "system", "content": system_prompt},
        *session["messages"]
    ]

    try:
        client = Groq(api_key=groq_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            temperature=0.7,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        raw_content = completion.choices[0].message.content
    except Exception as groq_err:
        # Remove last user message on failure
        session["messages"].pop()
        return JSONResponse(
            content={"error": f"Groq API error: {str(groq_err)}"},
            status_code=500
        )

    # Parse AI response
    try:
        ai_response = json.loads(raw_content)
        ai_message = ai_response.get("message", "Done!")
        actions = ai_response.get("actions", [])
    except json.JSONDecodeError:
        # Fallback: treat entire response as message
        ai_message = raw_content
        actions = []

    # Validate and sanitize actions
    sanitized_actions = []
    for action in actions:
        action_type = action.get("type")
        if action_type == "add_furniture":
            model_name = action.get("model_name", "")
            if model_name in AVAILABLE_FURNITURE:
                sanitized_actions.append({
                    "type": "add_furniture",
                    "model_name": model_name,
                    "room_index": max(0, int(action.get("room_index", 0)))
                })
        elif action_type == "remove_furniture":
            sanitized_actions.append({
                "type": "remove_furniture",
                "furniture_type": str(action.get("furniture_type", ""))
            })
        elif action_type == "scale_furniture":
            scale = float(action.get("scale", 1.0))
            scale = max(0.1, min(3.0, scale))
            sanitized_actions.append({
                "type": "scale_furniture",
                "furniture_type": str(action.get("furniture_type", "")),
                "scale": scale
            })
        elif action_type == "clear_room":
            sanitized_actions.append({
                "type": "clear_room",
                "room_index": max(0, int(action.get("room_index", 0)))
            })
        elif action_type == "add_room":
            sanitized_actions.append({
                "type": "add_room",
                "room_type": str(action.get("room_type", "living_room")),
                "breadth": float(action.get("breadth", 200)),
                "length": float(action.get("length", 150))
            })

    # Append assistant response to history
    session["messages"].append({
        "role": "assistant",
        "content": json.dumps({"message": ai_message, "actions": sanitized_actions})
    })

    # Trim history to last 20 exchanges to prevent token overflow
    if len(session["messages"]) > 40:
        session["messages"] = session["messages"][-40:]

    return JSONResponse(content={
        "session_id": session_id,
        "message": ai_message,
        "actions": sanitized_actions
    }, status_code=200)


@app.delete("/chat/{session_id}")
async def clear_session(session_id: str):
    """Clear a chat session."""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return JSONResponse(content={"cleared": True})


# ─── Replicate endpoint ───────────────────────────────────────────────────────
@app.post("/replicate")
async def replicate_api(request: Request):
    try:
        req = await request.json()
        image = req.get("image")
        theme = req.get("theme")
        room = req.get("room")

        replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_token:
            return JSONResponse(content={"error": "REPLICATE_API_TOKEN is missing."}, status_code=500)

        client = replicate.Client(api_token=replicate_token)
        model = "jagilley/controlnet-hough:854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b"
        input_data = {
            "image": image,
            "prompt": f"A {theme} {room} Editorial Style Photo, Symmetry, Straight On, Modern Living Room, Large Window, Leather, Glass, Metal, Wood Paneling, Neutral Palette, Ikea, Natural Light, Apartment, Afternoon, Serene, Contemporary, 4k",
            "a_prompt": "best quality, extremely detailed, photo from Pinterest, interior, cinematic photo, ultra-detailed, ultra-realistic, award-winning"
        }

        try:
            output = client.run(model, input=input_data)
        except Exception as replicate_error:
            return JSONResponse(content={"error": "Replicate API error", "details": str(replicate_error)}, status_code=500)

        if not output:
            return JSONResponse(content={"error": "Replicate output is null"}, status_code=500)

        output_urls = [str(item) for item in output] if isinstance(output, list) else []
        return JSONResponse(content={"output": output_urls}, status_code=201)
    except Exception as error:
        return JSONResponse(content={"error": str(error)}, status_code=500)


# ─── CV models ────────────────────────────────────────────────────────────────
yolo_model = YOLO('yolov8n.pt')
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")


def classify_room_type(image_bytes):
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        labels = ["living room", "kitchen", "bedroom", "bathroom", "outdoor", "desert", "park", "street"]
        inputs = clip_processor(text=labels, images=img, return_tensors="pt", padding=True)
        outputs = clip_model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)
        best_label = labels[probs.argmax().item()]
        if best_label in ["outdoor", "desert", "park", "street"]:
            return "outdoor"
        return best_label.replace(" ", "_")
    except Exception as e:
        print(f"Error classifying room type: {e}")
        return "living_room"


def detect_furniture_objects(image_bytes, breadth, length):
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        results = yolo_model(img)
        furniture = []
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls)
                class_name = yolo_model.names[class_id]
                confidence = float(box.conf)
                if confidence > 0.3:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    center_x = (x1 + x2) / 2 / img.width * breadth
                    center_y = (y1 + y2) / 2 / img.height * length
                    furniture.append({
                        "type": class_name,
                        "position": [float(round(center_x, 1)), float(round(center_y, 1))]
                    })
        return furniture if furniture else [{"type": "chair", "position": [100.0, 75.0]}]
    except Exception as e:
        print(f"Error detecting furniture: {e}")
        return [{"type": "chair", "position": [100.0, 75.0]}]


def get_default_dimensions():
    return {"breadth": 200.0, "length": 150.0}


def calculate_room_positions(rooms_data):
    if not rooms_data:
        return rooms_data
    SPACING = 50.0
    current_x_offset = 0.0
    for room in rooms_data:
        breadth = room["dimensions"]["breadth"]
        room["position"] = [float(round(current_x_offset, 1)), 0.0]
        current_x_offset += breadth + SPACING
    return rooms_data


async def process_image(file: UploadFile, room_no: int):
    image_bytes = await file.read()
    dimensions = get_default_dimensions()
    room_type = classify_room_type(image_bytes)
    furniture = [] if room_type == "outdoor" else detect_furniture_objects(image_bytes, dimensions["breadth"], dimensions["length"])
    return {
        "roomno": room_no + 1,
        "roomtype": room_type,
        "position": [0.0, 0.0],
        "dimensions": dimensions,
        "furniture": furniture,
        "furniture_count": len(furniture)
    }


@app.post("/upload")
async def upload_images(files: list[UploadFile] = File(...)):
    rooms = []
    for i, file in enumerate(files):
        if file.content_type.startswith("image/"):
            room_data = await process_image(file, i)
            rooms.append(room_data)
    if rooms:
        rooms = calculate_room_positions(rooms)
    return JSONResponse(content=rooms)


@app.get("/")
async def root():
    return {"message": "Roomify Backend API is running", "groq_available": GROQ_AVAILABLE}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
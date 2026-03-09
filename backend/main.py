import os
import uuid
import json
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import replicate
from ultralytics import YOLO
from transformers import CLIPProcessor, CLIPModel

# Load environment variables from .env file
load_dotenv()

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

app = FastAPI(title="Roomify Backend API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

chat_sessions: dict = {}

WALL_MOUNTED_FURNITURE   = {'airconditioner','mirror','switchboard','tvdish','tv_bench','window','mirror_table'}
CEILING_MOUNTED_FURNITURE = {'ceiling_fan'}

AVAILABLE_FURNITURE = [
    "coffee_table","sofa","couch","tablelamp","teapoy","woodendesk",
    "chair","bed","bathingtub","car","piano","smart_fridge",
    "simple_dining_table","airconditioner","bed_side_table_with_lamp",
    "bicycle","carcae","ceiling_fan","closet_wooden","maple_tree",
    "mirror","mirror_table","modern_furniture_shelf","motorcycle",
    "pottedplant","pottedplant2","shelf","stove_sink_dish_drainer_kitchen_hood",
    "switchboard","table_furniture","treadmill","tvdish","tv_bench",
    "washing_machine","window"
]
ROOM_TYPES = ["living_room","bedroom","kitchen","bathroom","office","dining_room"]

ROOM_DEFAULT_BREADTH = 200.0
ROOM_DEFAULT_LENGTH  = 150.0

def fix_room_dim(val, default):
    """LLM often gives metres (12,15) instead of world units (200,150). Fix it."""
    try:
        v = float(val)
    except (TypeError, ValueError):
        return default
    if v <= 0:
        return default
    if v < 50:          # metres → world units
        v = v * 14.0
    return max(100.0, min(600.0, v))


def build_system_prompt(rooms_count, furniture_list, rooms_list):
    furn_summary = ", ".join(
        f"{i}: {f['type']} (room {f['roomIndex']}, ×{f.get('scale',1.0):.1f})"
        for i, f in enumerate(furniture_list)
    ) if furniture_list else "none"

    rooms_summary = ", ".join(
        f"[{i}] {r.get('roomtype','?')} {r.get('dimensions',{}).get('breadth',200):.0f}×{r.get('dimensions',{}).get('length',150):.0f}"
        for i, r in enumerate(rooms_list)
    ) if rooms_list else f"{rooms_count} room(s)"

    return f"""You are Roomify AI, expert interior design assistant in a 3D room tool.

SCENE: rooms={rooms_summary} | furniture={furn_summary}

FURNITURE (exact names): {', '.join(AVAILABLE_FURNITURE)}
WALL-MOUNTED: airconditioner,mirror,switchboard,tvdish,tv_bench,window,mirror_table
CEILING: ceiling_fan
ROOM TYPES: {', '.join(ROOM_TYPES)}

ACTIONS:
add_furniture | remove_furniture | scale_furniture | clear_room
add_room | remove_room | resize_room

⚠️ DIMENSION RULE — values are 3D world-units, NOT metres:
  default = breadth:200, length:150
  small   = breadth:150, length:120
  large   = breadth:300, length:220
  NEVER use values below 100. NEVER output 12,15,20,30.

JSON only, no markdown:
{{
  "message": "...",
  "actions": [
    {{"type":"add_furniture",   "model_name":"<n>",  "room_index":<int>}},
    {{"type":"remove_furniture","furniture_type":"<n>"}},
    {{"type":"scale_furniture", "furniture_type":"<n>","scale":<0.1-3.0>}},
    {{"type":"clear_room",      "room_index":<int>}},
    {{"type":"add_room",        "room_type":"<t>",   "breadth":<100-600>,"length":<100-600>}},
    {{"type":"remove_room",     "room_index":<int>}},
    {{"type":"resize_room",     "room_index":<int>,  "breadth":<100-600>,"length":<100-600>}}
  ]
}}"""


@app.post("/chat")
async def chat(request: Request):
    if not GROQ_AVAILABLE:
        return JSONResponse(content={"error":"groq not installed"}, status_code=500)
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        return JSONResponse(content={"error":"GROQ_API_KEY not set"}, status_code=500)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse(content={"error":"Invalid JSON"}, status_code=400)

    session_id     = body.get("session_id") or str(uuid.uuid4())
    user_message   = body.get("message","").strip()
    rooms_count    = int(body.get("rooms_count", 0))
    furniture_list = body.get("furniture_list", [])
    rooms_list     = body.get("rooms_list", [])

    if not user_message:
        return JSONResponse(content={"error":"empty message"}, status_code=400)

    if session_id not in chat_sessions:
        chat_sessions[session_id] = {"messages":[]}
    session = chat_sessions[session_id]

    session["messages"].append({"role":"user","content":user_message})
    try:
        client = Groq(api_key=groq_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role":"system","content":build_system_prompt(rooms_count,furniture_list,rooms_list)},
                      *session["messages"]],
            temperature=0.5, max_tokens=1024,
            response_format={"type":"json_object"},
        )
        raw = completion.choices[0].message.content
    except Exception as e:
        session["messages"].pop()
        return JSONResponse(content={"error":f"Groq: {e}"}, status_code=500)

    try:
        parsed = json.loads(raw)
        ai_msg = parsed.get("message","Done!")
        actions = parsed.get("actions",[])
    except json.JSONDecodeError:
        ai_msg = raw; actions = []

    sanitized = []
    for a in actions:
        t = a.get("type")
        if t == "add_furniture":
            mn = a.get("model_name","")
            if mn in AVAILABLE_FURNITURE:
                sanitized.append({"type":"add_furniture","model_name":mn,
                    "room_index":max(0,int(a.get("room_index",0))),
                    "placement_hint":"wall" if mn in WALL_MOUNTED_FURNITURE else
                                     "ceiling" if mn in CEILING_MOUNTED_FURNITURE else "floor"})
        elif t == "remove_furniture":
            sanitized.append({"type":"remove_furniture","furniture_type":str(a.get("furniture_type",""))})
        elif t == "scale_furniture":
            sanitized.append({"type":"scale_furniture","furniture_type":str(a.get("furniture_type","")),
                               "scale":max(0.1,min(3.0,float(a.get("scale",1.0))))})
        elif t == "clear_room":
            sanitized.append({"type":"clear_room","room_index":max(0,int(a.get("room_index",0)))})
        elif t == "add_room":
            sanitized.append({"type":"add_room","room_type":str(a.get("room_type","living_room")),
                               "breadth":fix_room_dim(a.get("breadth",ROOM_DEFAULT_BREADTH),ROOM_DEFAULT_BREADTH),
                               "length": fix_room_dim(a.get("length", ROOM_DEFAULT_LENGTH), ROOM_DEFAULT_LENGTH)})
        elif t == "remove_room":
            ri = int(a.get("room_index",-1))
            if ri >= 0:
                sanitized.append({"type":"remove_room","room_index":ri})
        elif t == "resize_room":
            sanitized.append({"type":"resize_room","room_index":max(0,int(a.get("room_index",0))),
                               "breadth":fix_room_dim(a.get("breadth",ROOM_DEFAULT_BREADTH),ROOM_DEFAULT_BREADTH),
                               "length": fix_room_dim(a.get("length", ROOM_DEFAULT_LENGTH), ROOM_DEFAULT_LENGTH)})

    session["messages"].append({"role":"assistant","content":json.dumps({"message":ai_msg,"actions":sanitized})})
    if len(session["messages"]) > 40:
        session["messages"] = session["messages"][-40:]

    return JSONResponse(content={"session_id":session_id,"message":ai_msg,"actions":sanitized})


@app.delete("/chat/{session_id}")
async def clear_session(session_id: str):
    chat_sessions.pop(session_id, None)
    return JSONResponse(content={"cleared":True})


@app.post("/replicate")
async def replicate_api(request: Request):
    try:
        req = await request.json()
        token = os.getenv("REPLICATE_API_TOKEN", "")
        if not token:
            return JSONResponse(content={"error":"REPLICATE_API_TOKEN missing"}, status_code=500)
        
        image_data = req.get("image")
        theme = req.get("theme", "modern")
        room_type = req.get("room", "living room")
        
        # Check if room is empty
        is_empty = req.get("is_empty", False)
        
        # Define furniture prompts for different room types
        room_furniture_map = {
            "living room": "sofa, coffee table, TV unit, decorative plants, lamps, side tables",
            "bedroom": "bed, nightstands, wardrobe, dresser, lamps, decorative items",
            "kitchen": "cabinets, countertops, appliances, dining table, chairs",
            "bathroom": "bathtub, sink, mirror, toilet, storage cabinets",
            "office": "desk, office chair, bookshelf, computer, storage units",
            "dining room": "dining table, chairs, sideboard, chandelier, decorative pieces"
        }
        
        # Normalize room type for lookup
        room_key = room_type.lower().replace("_", " ")
        furniture_suggestions = room_furniture_map.get(room_key, "appropriate furniture and decor")
        
        # Enhanced prompt for empty rooms
        if is_empty:
            main_prompt = f"A fully furnished {theme} style {room_type} with {furniture_suggestions}, Editorial Style Photo, 4k, well-decorated interior"
            additional_prompt = "best quality, extremely detailed, interior, cinematic photo, complete room setup, fully furnished, cozy atmosphere, professional interior design"
        else:
            main_prompt = f"A {theme} style {room_type} Editorial Style Photo, 4k"
            additional_prompt = "best quality, extremely detailed, interior, cinematic photo"
        
        client = replicate.Client(api_token=token)
        output = client.run(
            "jagilley/controlnet-hough:854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b",
            input={
                "image": image_data,
                "prompt": main_prompt,
                "a_prompt": additional_prompt,
                "num_samples": "1",
                "image_resolution": "512",
                "strength": 1.0,
                "guidance_scale": 9.0
            },
        )
        
        return JSONResponse(
            content={
                "output": [str(i) for i in output] if isinstance(output, list) else [],
                "was_enhanced": is_empty,
                "applied_theme": theme,
                "room_type": room_type,
                "furniture_added": is_empty
            }, 
            status_code=201
        )
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


yolo_model     = YOLO('yolov8n.pt')
clip_model     = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

YOLO_TO_MODEL = {
    "chair":"chair","couch":"sofa","sofa":"sofa","bed":"bed",
    "dining table":"simple_dining_table","toilet":"bathingtub",
    "tv":"tv_bench","laptop":"woodendesk","refrigerator":"smart_fridge",
    "clock":"tablelamp","vase":"pottedplant","potted plant":"pottedplant",
    "book":"shelf","sink":"stove_sink_dish_drainer_kitchen_hood",
    "oven":"stove_sink_dish_drainer_kitchen_hood","microwave":"smart_fridge",
    "bicycle":"bicycle","motorcycle":"motorcycle","car":"car",
}
SKIP_YOLO = {"person","bottle","cup","fork","knife","spoon","bowl"}


def classify_room_type(image_bytes):
    try:
        img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        labels = ["living room","kitchen","bedroom","bathroom","outdoor","desert","park","street"]
        inputs = clip_processor(text=labels, images=img, return_tensors="pt", padding=True)
        best   = labels[clip_model(**inputs).logits_per_image.softmax(dim=1).argmax().item()]
        return "outdoor" if best in {"outdoor","desert","park","street"} else best.replace(" ","_")
    except Exception:
        return "living_room"


def detect_furniture_objects(image_bytes, breadth, length):
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        furniture, seen = [], set()
        for result in yolo_model(img):
            for box in result.boxes:
                cn = yolo_model.names[int(box.cls)].lower()
                if cn in SKIP_YOLO or float(box.conf) < 0.3: continue
                mn = YOLO_TO_MODEL.get(cn)
                if not mn or mn in seen: continue
                seen.add(mn)
                x1,y1,x2,y2 = box.xyxy[0].cpu().numpy()
                cx = max(15, min(breadth-15, (x1+x2)/2/img.width *breadth))
                cy = max(15, min(length -15, (y1+y2)/2/img.height*length))
                furniture.append({"type":mn,"position":[round(float(cx),1),round(float(cy),1)],
                    "placement":"wall" if mn in WALL_MOUNTED_FURNITURE else
                                "ceiling" if mn in CEILING_MOUNTED_FURNITURE else "floor"})
        return furniture or [{"type":"chair","position":[100.0,75.0],"placement":"floor"}]
    except Exception:
        return [{"type":"chair","position":[100.0,75.0],"placement":"floor"}]


def get_room_features(room_type):
    f = {"wall_color":"#cdd3db","floor_color":"#e4e8f0",
         "doors":[{"wall":"front","position_ratio":0.5,"width":30,"height":60}],"windows":[]}
    if room_type in ("living_room","bedroom","office"):
        f["windows"].append({"wall":"back","position_ratio":0.35,"width":40,"height":35,"height_from_floor":35})
        if room_type == "living_room":
            f["windows"].append({"wall":"back","position_ratio":0.65,"width":40,"height":35,"height_from_floor":35})
    elif room_type == "kitchen":
        f["windows"].append({"wall":"back","position_ratio":0.5,"width":30,"height":25,"height_from_floor":45})
    return f


async def process_image(file: UploadFile, room_no: int):
    image_bytes = await file.read()
    room_type   = classify_room_type(image_bytes)
    dims = {"breadth":ROOM_DEFAULT_BREADTH,"length":ROOM_DEFAULT_LENGTH}
    furniture = [] if room_type=="outdoor" else detect_furniture_objects(image_bytes, dims["breadth"], dims["length"])
    return {"roomno":room_no+1,"roomtype":room_type,"position":[0.0,0.0],"dimensions":dims,
            "furniture":furniture,"furniture_count":len(furniture),**get_room_features(room_type)}


def calculate_room_positions(rooms_data, cols=3):
    if not rooms_data: return rooms_data
    GAP = 20.0
    num_rows = (len(rooms_data)+cols-1)//cols
    row_max_len = []
    for row in range(num_rows):
        ml = max(rooms_data[row*cols+c]["dimensions"]["length"]
                 for c in range(cols) if row*cols+c < len(rooms_data))
        row_max_len.append(ml)
    for i, room in enumerate(rooms_data):
        col, row = i%cols, i//cols
        ox = sum(rooms_data[row*cols+c]["dimensions"]["breadth"]+GAP
                 for c in range(col) if row*cols+c < len(rooms_data))
        oz = sum(row_max_len[r]+GAP for r in range(row))
        room["position"] = [round(float(ox),1), round(float(oz),1)]
        room["grid_col"] = col; room["grid_row"] = row
    return rooms_data


@app.post("/upload")
async def upload_images(files: list[UploadFile] = File(...)):
    rooms = []
    for i, file in enumerate(files):
        if file.content_type.startswith("image/"):
            rooms.append(await process_image(file, i))
    if rooms:
        rooms = calculate_room_positions(rooms)
    return JSONResponse(content=rooms)


@app.get("/")
async def root():
    return {"message":"Roomify API running","groq_available":GROQ_AVAILABLE}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
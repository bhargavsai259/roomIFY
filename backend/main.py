from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import replicate
from ultralytics import YOLO
from transformers import CLIPProcessor, CLIPModel


app = FastAPI(title="Roomify Backend API", description="API for processing room images into 3D scene data")

@app.post("/replicate")
async def replicate_api(request: Request):
    """
    Run Replicate model for image transformation.
    Expects JSON body: {"image": <image_url>, "theme": <theme>, "room": <room>}
    """
    try:
        req = await request.json()
        image = req.get("image")
        theme = req.get("theme")
        room = req.get("room")


        # Replicate API token (should be stored securely)
        replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_token:
            return JSONResponse(content={"error": "REPLICATE_API_TOKEN is missing."}, status_code=500)

        # Initialize Replicate client
        client = replicate.Client(api_token=replicate_token)

        model = "jagilley/controlnet-hough:854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b"
        input = {
            "image": image,
            "prompt": f"A {theme} {room} Editorial Style Photo, Symmetry, Straight On, Modern Living Room, Large Window, Leather, Glass, Metal, Wood Paneling, Neutral Palette, Ikea, Natural Light, Apartment, Afternoon, Serene, Contemporary, 4k",
            "a_prompt": "best quality, extremely detailed, photo from Pinterest, interior, cinematic photo, ultra-detailed, ultra-realistic, award-winning"
        }

        try:
            output = client.run(model, input=input)
        except Exception as replicate_error:
            return JSONResponse(content={
                "error": "Replicate API error",
                "details": str(replicate_error)
            }, status_code=500)

        if not output:
            return JSONResponse(content={"error": "Replicate output is null"}, status_code=500)

        # Convert output to URL strings
        output_urls = [str(item) for item in output] if isinstance(output, list) else []

        return JSONResponse(content={"output": output_urls}, status_code=201)
    except Exception as error:
        return JSONResponse(content={
            "error": str(error)
        }, status_code=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["http://localhost:5173"] for stricter security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLOv8 model for object detection
model = YOLO('yolov8n.pt')  # Nano model, lightweight

# Load CLIP model for scene classification
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def classify_room_type(image_bytes):
    """Classify the room type using CLIP."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        labels = ["living room", "kitchen", "bedroom", "bathroom", "outdoor", "desert", "park", "street"]
        inputs = clip_processor(text=labels, images=img, return_tensors="pt", padding=True)
        outputs = clip_model(**inputs)
        logits_per_image = outputs.logits_per_image
        probs = logits_per_image.softmax(dim=1)
        best_idx = probs.argmax().item()
        best_label = labels[best_idx]
        if best_label in ["outdoor", "desert", "park", "street"]:
            return "outdoor"
        else:
            return best_label.replace(" ", "_")
    except Exception as e:
        print(f"Error classifying room type: {e}")
        return "living_room"  # Default

def detect_furniture_objects(image_bytes, breadth, length):
    """Detect furniture objects in image using YOLOv8."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        results = model(img)
        furniture = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                class_id = int(box.cls)
                class_name = model.names[class_id]
                confidence = float(box.conf)
                if confidence > 0.3:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    center_x = (x1 + x2) / 2 / img.width * breadth
                    center_y = (y1 + y2) / 2 / img.height * length
                    print(f"Detected: {class_name} with score {confidence:.2f}")
                    furniture.append({
                        "type": class_name,
                        "position": [float(round(center_x, 1)), float(round(center_y, 1))]
                    })
        
        return furniture if furniture else [{"type": "chair", "position": [100.0, 75.0]}]  # Fallback
    except Exception as e:
        print(f"Error detecting furniture: {e}")
        return [{"type": "chair", "position": [100.0, 75.0]}]

def get_default_dimensions():
    """Return fixed default dimensions for all rooms."""
    return {"breadth": 200.0, "length": 150.0}

def calculate_room_positions(rooms_data):
    """
    Calculate non-overlapping positions for all rooms.
    Arranges rooms side-by-side in a horizontal line with proper spacing.
    """
    if not rooms_data:
        return rooms_data
    
    # Gap between rooms
    SPACING = 50.0
    
    # Place all rooms in a horizontal line (side by side)
    current_x_offset = 0.0
    
    for i, room in enumerate(rooms_data):
        breadth = room["dimensions"]["breadth"]
        length = room["dimensions"]["length"]
        
        # Position room with its left edge at current_x_offset
        # Center it on the Y-axis (all rooms aligned at Y=0)
        room["position"] = [
            float(round(current_x_offset, 1)), 
            0.0
        ]
        
        # Move x_offset for next room (current room width + spacing)
        current_x_offset += breadth + SPACING
    
    return rooms_data

async def process_image(file: UploadFile, room_no: int):
    """Process a single image to extract room data."""
    image_bytes = await file.read()
    
    # Use fixed default dimensions for all rooms
    dimensions = get_default_dimensions()
    
    # Determine room type using CLIP
    room_type = classify_room_type(image_bytes)
    
    # Detect furniture (only for indoor rooms)
    if room_type == "outdoor":
        furniture = []  # No furniture for outdoor
    else:
        furniture = detect_furniture_objects(image_bytes, dimensions["breadth"], dimensions["length"])
    
    # Position will be calculated later in calculate_room_positions
    return {
        "roomno": room_no + 1,
        "roomtype": room_type,
        "position": [0.0, 0.0],  # Temporary, will be updated
        "dimensions": dimensions,
        "furniture": furniture,
        "furniture_count": len(furniture)
    }

@app.post("/upload")
async def upload_images(files: list[UploadFile] = File(...)):
    """
    Upload multiple room images and get 3D scene data.
    Processes each image to extract room type and furniture positions.
    Automatically arranges rooms in a non-overlapping grid layout.
    """
    rooms = []
    for i, file in enumerate(files):
        if file.content_type.startswith("image/"):
            room_data = await process_image(file, i)
            rooms.append(room_data)
        else:
            # Skip non-image files
            continue
    
    # Calculate non-overlapping positions for all rooms
    if rooms:
        rooms = calculate_room_positions(rooms)
    
    return JSONResponse(content=rooms)

@app.get("/")
async def root():
    return {"message": "Roomify Backend API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
# Roomify — User Walkthrough

## Overview
User uploads one or more photographs of rooms and Roomify produces an interactive 3D view of the connected space. The 3D view uses a single dominant color for the entire room, places detected furniture as 3D objects, and allows full rotation/inspection across multiple rooms (ceiling, floor, walls, corners, furniture).

## User Flow
1. Open Roomify and click **Upload Images**.
2. Select one or more clear photos of indoor rooms (standing height, showing walls, floor, and furniture). Optionally label each image with a room name (e.g., "Living Room").
3. The app uploads the images to the backend; a progress indicator shows model processing for each room.
4. Backend runs segmentation, depth estimation (MiDaS), and object detection on each image, detects connections between rooms (e.g., via doorways), then returns a combined 3D scene description and assets.
5. Frontend renders the generated multi-room scene and automatically opens the interactive 3D viewer.

## 3D Viewer interactions
- Rotate: click-drag or use two-finger drag to orbit camera around the current room.
- Pan: middle-click (or right-drag) to translate the view.
- Zoom: scroll wheel or pinch to zoom in/out.
- Inspect ceiling/floor: orbit camera above or below the room to view ceiling and floor surfaces.
- Navigate rooms: use UI buttons or click on detected doorways to teleport between connected rooms.
- Toggle layers: UI toggles to show/hide walls, floor, furniture, or bounding boxes per room or globally.
- Color sync: the entire room uses the extracted dominant color; a small color swatch shows the sampled color and allows manual override.

### Moving furniture (interactive)
- Drag & drop: click and drag a furniture object to move it across the floor plane; on touch, drag with a single finger.
- Rotate: select an item and drag a rotation handle (or use a rotation gesture) to rotate the object around its vertical axis.
- Scale: use corner handles or pinch to uniformly scale a selected object (minor scale adjustments only).
- Snap & gravity: moved items snap to the floor and align to nearby walls or grid if enabled.
- Collision hints: show simple collision outlines to avoid overlapping furniture; optionally prevent moves that collide.
- Precise placement: allow numeric input for X/Y position and rotation for exact adjustments.
- Undo/Redo & save: provide undo/redo for placement edits and a save/export button to persist the new layout (local or backend).

### Deleting furniture
- Select & delete: select a furniture item and press the `Delete` key or click a trash/remove icon to remove it from the scene.
- Confirm removal: show a small confirmation tooltip/modal to avoid accidental deletes (configurable in settings).
- Soft-delete & restore: support a temporary "removed items" list (trash) where deleted items can be restored or permanently deleted.
- Update layout: after deletion, update scene JSON and allow user to save/export the updated layout.
- Undo/Redo: deletion should be part of the undo/redo stack so users can revert mistakes.
- Backend sync: when saved, send updated scene layout to backend to persist changes; optionally remove or archive asset references.


## What the view preserves

## What the view preserves
- Room color: a single dominant color sampled from the image and applied uniformly to walls, floor, and ceiling.
- Windows & doors: detected as part of segmentation and rendered as openings or textured regions when possible.
- Furniture: detected furniture items are matched to nearest 3D assets (placeholders if exact match missing) and positioned using detection bounding boxes and depth map.

## Backend processing (brief)
- Receive images, run preprocessing (resize / normalize) on each.
- For each image: Extract one dominant color from the image.
- Run object detection (YOLO) → furniture categories + bounding boxes.
- Estimate room dimensions from image size.
- Classify room type using CLIP.
- Package JSON scene description with room data and send to frontend.

## Frontend rendering (brief)
- Use Three.js to build a multi-room scene from the JSON description.
- Construct room shells from basic geometry and apply the uniform room color.
- Place furniture assets at estimated positions and apply basic lighting and shadows.
- Expose UI for camera controls, room navigation, toggles, and color overrides.

## Notes & limitations
- Dimensions are estimated from image size; absolute scale may be approximate. Consider a calibration step or allow user scale adjustments.
- Furniture placement is approximate for single-view input; occlusions and heavy clutter reduce accuracy.
- Room color is a single dominant color from the entire image, not separated by surfaces.
- Multi-room support is basic: rooms are positioned side by side; users can manually arrange them.

## Quick test checklist
- Try images with clear floor and at least two visible walls per room.
- Test with rooms containing a single dominant furniture piece, then with multiple items.
- Verify color extraction by comparing the swatch to the original photo.
- Test multi-room setups: Upload multiple images; rooms will be positioned side by side for manual arrangement.

## Next steps
- Add segmentation to separate floor, walls, ceiling for more accurate color extraction.
- Add depth estimation for better dimension accuracy.
- Add a manual calibration UI to set room scale (e.g., user draws 1m on a wall).
- Add ability to replace furniture with selectable 3D models from a catalog.
- Improve multi-room alignment: Detect connections or allow users to manually adjust room positions.



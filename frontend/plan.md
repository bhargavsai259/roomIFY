# Frontend Conversion Plan

## Goal
Convert the current project to use a blueprint-like JSON format for room layouts, similar to chair.blueprint3d, enabling 3D visualization and editing.

## Steps

1. **Blueprint JSON Integration**
   - Define a schema for room blueprints (corners, walls, items/furniture).
   - Store/export/import blueprint files from frontend.

2. **3D Visualization**
   - Use Three.js (or similar) to render rooms and furniture from blueprint JSON.
   - Map corners/walls/items to 3D objects.

3. **UI for Editing**
   - Add UI to place/move furniture, edit walls, and change textures/colors.
   - Allow users to save/export their room as a blueprint JSON file.

4. **Backend API Integration**
   - Connect frontend to backend for image upload and AI processing.
   - Convert backend results to blueprint JSON for frontend rendering.

5. **File Management**
   - Enable upload/download of blueprint files.
   - Support loading existing blueprints for editing.

6. **Testing & Iteration**
   - Test with sample blueprint files (like chair.blueprint3d).
   - Refine UI/UX and 3D rendering.

## Key Modules
- Blueprint JSON handler (parse, validate, generate)
- 3D renderer (Three.js integration)
- UI editor (React components for room/furniture editing)
- API connector (fetch/process backend results)

---

This plan will be updated as features are implemented and requirements evolve.

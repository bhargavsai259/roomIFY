
## Blueprint JSON Integration Notes
To convert the project to a blueprint-based system:
- Use a JSON format for room layouts (corners, walls, items/furniture).
- Render rooms and furniture in 3D using Three.js.
- Allow users to edit, save, and load blueprint files.
- Integrate backend API to generate blueprint JSON from image uploads.



<!-- copilot-ignore-start -->
First-person walkthrough (impressive demo)
Color changer for furniture
Shareable link
<!-- copilot-ignore-end -->

## Simplified API Response Structure
For uploading images, the backend returns a JSON array of rooms (rectangular only, side-by-side positioning):

```json
[
  {
    "roomno": 1,
    "roomtype": "living_room",
    "position": [0, 0, 0],
    "dimensions": {
      "width": 5.0,
      "height": 3.0,
      "depth": 4.0
    },
    "room_color": "#FFFFFF",
    "furniture": [
      {
        "type": "chair",
        "position": [2.0, 0, 1.0]
      }
    ]
  }
]
```

- Rooms are processed separately.
- Positions start side by side (offset by width + gap).
- Users drag rooms in 3D space for manual arrangement.
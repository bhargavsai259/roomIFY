import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import assets from './assets/assets.json';

export default function ThreeDView({ rooms }) {
  const isRotatingRef = useRef(false);
  const lastMouseYRef = useRef(0);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const furnitureObjectsRef = useRef([]);
  const wallsRef = useRef([]);
  const isDraggingRef = useRef(false);
  const dragSelectedRef = useRef(null);
  const dragOffsetRef = useRef(new THREE.Vector3());
  const cameraRef = useRef(null);

  const [selectedFurniture, setSelectedFurniture] = useState(null);
  const [hoveredFurniture, setHoveredFurniture] = useState(null);

  useEffect(() => {
    if (!rooms || rooms.length === 0) return;
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    cameraRef.current = camera;

    let totalWidth = 0;
    let maxDepth = 0;
    const roomPositions = [];
    let currentX = 0;

    rooms.forEach((room) => {
      const roomWidth = room.dimensions.breadth;
      const roomDepth = room.dimensions.length;
      roomPositions.push({ x: currentX + roomWidth / 2, z: roomDepth / 2 });
      currentX += roomWidth;
      totalWidth += roomWidth;
      maxDepth = Math.max(maxDepth, roomDepth);
    });

    const centerX = totalWidth / 2;
    const centerZ = maxDepth / 2;
    const maxDimension = Math.max(totalWidth, maxDepth);
    const cameraDistance = maxDimension * 1.2;
    camera.position.set(centerX - cameraDistance * 0.7, cameraDistance * 0.6, centerZ + cameraDistance * 0.7);
    camera.lookAt(centerX, 30, centerZ);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0xf5f5f5, 1);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 50;
    controls.maxDistance = maxDimension * 3;
    controls.target.set(centerX, 30, centerZ);
    controls.maxPolarAngle = Math.PI / 2.1;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(centerX + 500, 500, centerZ + 500);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -totalWidth;
    dirLight.shadow.camera.right = totalWidth;
    dirLight.shadow.camera.top = maxDepth;
    dirLight.shadow.camera.bottom = -maxDepth;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(centerX - 300, 300, centerZ - 300);
    scene.add(fillLight);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 0.5));

    const furnitureObjects = [];
    const walls = [];
    const placedBBoxes = [];
    const FLOOR_TOP = 2;

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      transparent: false,
      opacity: 1.0,
    });

    rooms.forEach((room, roomIndex) => {
      const roomGroup = new THREE.Group();
      roomGroup.name = `room-${roomIndex}`;
      const roomWidth = room.dimensions.breadth;
      const roomDepth = room.dimensions.length;
      const wallHeight = 80;
      const wallThickness = 5;
      const cx = roomPositions[roomIndex].x;
      const cz = roomPositions[roomIndex].z;

      const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 2, roomDepth), wallMaterial);
      roomFloor.position.set(cx, 1, cz);
      roomFloor.receiveShadow = true;
      roomGroup.add(roomFloor);

      const addWall = (geom, pos, normal) => {
        const wall = new THREE.Mesh(geom, wallMaterial.clone());
        wall.position.set(...pos);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.userData.normal = normal;
        wall.userData.wallType = 'vertical';
        walls.push(wall);
        roomGroup.add(wall);
      };

      addWall(new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness), [cx, wallHeight / 2, cz - roomDepth / 2], new THREE.Vector3(0, 0, -1));
      addWall(new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness), [cx, wallHeight / 2, cz + roomDepth / 2], new THREE.Vector3(0, 0, 1));
      addWall(new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth), [cx + roomWidth / 2, wallHeight / 2, cz], new THREE.Vector3(1, 0, 0));
      if (roomIndex === 0) {
        addWall(new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth), [cx - roomWidth / 2, wallHeight / 2, cz], new THREE.Vector3(-1, 0, 0));
      }

      scene.add(roomGroup);

      const loader = new GLTFLoader();
      room.furniture.forEach((item, itemIndex) => {
        const modelData = assets.models.find((m) => m?.name?.toLowerCase() === item?.type?.toLowerCase());
        let modelPath;
        if (modelData) {
          modelPath = modelData.path.replace('@assets', '/src/assets');
        } else {
          const itemType = item?.type?.toLowerCase() || '';
          let bestMatch = null;
          let bestScore = 0;
          for (const model of assets.models) {
            const modelName = model?.name?.toLowerCase() || '';
            let score = 0;
            for (let i = 0; i < itemType.length; i++) {
              for (let j = i + 1; j <= itemType.length; j++) {
                const substr = itemType.substring(i, j);
                if (substr.length > 2 && modelName.includes(substr)) score = Math.max(score, substr.length);
              }
            }
            if (score > bestScore) { bestScore = score; bestMatch = model; }
          }
          modelPath = (bestMatch || assets.models[0]).path.replace('@assets', '/src/assets');
        }

        loader.load(modelPath, (gltf) => {
          const model = gltf.scene;
          model.scale.multiplyScalar(25);
          const bbox = new THREE.Box3().setFromObject(model);
          const size = bbox.getSize(new THREE.Vector3());
          const halfRoomW = roomWidth / 2;
          const halfRoomD = roomDepth / 2;
          const margin = 2;
          const maxX = halfRoomW - wallThickness - size.x / 2 - margin;
          const minX = -halfRoomW + wallThickness + size.x / 2 + margin;
          const maxZ = halfRoomD - wallThickness - size.z / 2 - margin;
          const minZ = -halfRoomD + wallThickness + size.z / 2 + margin;

          let placedX = item.position[0];
          let placedZ = item.position[1];
          if (minX <= maxX) placedX = Math.min(Math.max(placedX, minX), maxX); else placedX = 0;
          if (minZ <= maxZ) placedZ = Math.min(Math.max(placedZ, minZ), maxZ); else placedZ = 0;

          const yPos = FLOOR_TOP - bbox.min.y;

          const testBBoxAt = (xRel, zRel) => {
            model.position.set(xRel + cx, yPos, zRel + cz);
            const b = new THREE.Box3().setFromObject(model);
            return placedBBoxes.some((other) => b.intersectsBox(other.bbox));
          };

          if (testBBoxAt(placedX, placedZ)) {
            const step = Math.max(size.x, size.z, 5);
            let found = false;
            for (let r = step; r <= Math.max(roomWidth, roomDepth) && !found; r += step) {
              for (let ang = 0; ang < 360; ang += 30) {
                const rad = (ang * Math.PI) / 180;
                const nx = placedX + Math.cos(rad) * r;
                const nz = placedZ + Math.sin(rad) * r;
                if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
                if (!testBBoxAt(nx, nz)) { placedX = nx; placedZ = nz; found = true; break; }
              }
            }
            if (!found) { placedX = 0; placedZ = 0; }
          }

          model.position.set(placedX + cx, yPos, placedZ + cz);
          placedBBoxes.push({ model, bbox: new THREE.Box3().setFromObject(model) });

          model.traverse((child) => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
          });

          model.userData = { type: item.type, roomIndex, itemIndex, roomType: room.roomtype, originalPosition: model.position.clone(), isInteractive: true };
          furnitureObjects.push(model);
          scene.add(model);
        }, undefined, (err) => console.error('Error loading model:', err));
      });
    });

    furnitureObjectsRef.current = furnitureObjects;
    wallsRef.current = walls;

    function updateWallVisibility() {
      walls.forEach((wall) => {
        if (wall.userData.wallType !== 'vertical') return;
        const wallWorldPos = new THREE.Vector3();
        wall.getWorldPosition(wallWorldPos);
        const toWall = new THREE.Vector3().subVectors(wallWorldPos, camera.position).normalize();
        const dot = toWall.dot(wall.userData.normal.clone());
        wall.visible = dot >= -0.1;
        wall.material.opacity = wall.visible ? 1.0 : 0;
      });
    }

    const onMouseMove = (event) => {
      if (isRotatingRef.current && dragSelectedRef.current) {
        const deltaX = event.clientX - lastMouseYRef.current;
        lastMouseYRef.current = event.clientX;
        dragSelectedRef.current.rotation.y += deltaX * 0.01;
        renderer.domElement.style.cursor = 'crosshair';
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDraggingRef.current && dragSelectedRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
        const intersectPoint = new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(plane, intersectPoint)) {
          const model = dragSelectedRef.current;
          const desiredWorld = intersectPoint.clone().sub(dragOffsetRef.current);
          const roomIdx = model.userData.roomIndex;
          const cx = roomPositions[roomIdx].x;
          const cz = roomPositions[roomIdx].z;
          const roomWidth = rooms[roomIdx].dimensions.breadth;
          const roomDepth = rooms[roomIdx].dimensions.length;
          const bbox = new THREE.Box3().setFromObject(model);
          const size = bbox.getSize(new THREE.Vector3());
          const margin = 2;
          const wallThickness = 5;
          const maxX = roomWidth / 2 - wallThickness - size.x / 2 - margin;
          const minX = -roomWidth / 2 + wallThickness + size.x / 2 + margin;
          const maxZ = roomDepth / 2 - wallThickness - size.z / 2 - margin;
          const minZ = -roomDepth / 2 + wallThickness + size.z / 2 + margin;
          let relX = Math.min(Math.max(desiredWorld.x - cx, minX <= maxX ? minX : 0), minX <= maxX ? maxX : 0);
          let relZ = Math.min(Math.max(desiredWorld.z - cz, minZ <= maxZ ? minZ : 0), minZ <= maxZ ? maxZ : 0);
          const origPos = model.position.clone();
          model.position.set(relX + cx, FLOOR_TOP - bbox.min.y, relZ + cz);
          const newBB = new THREE.Box3().setFromObject(model);
          const collided = placedBBoxes.some((other) => other.model !== model && newBB.intersectsBox(other.bbox));
          if (!collided) {
            const entry = placedBBoxes.find((e) => e.model === model);
            if (entry) entry.bbox.copy(newBB);
          } else {
            model.position.copy(origPos);
          }
          renderer.domElement.style.cursor = 'grabbing';
          return;
        }
      }

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.isInteractive) object = object.parent;
        if (object.userData.isInteractive) {
          setHoveredFurniture(object.userData);
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredFurniture(null);
      renderer.domElement.style.cursor = 'default';
    };

    const onPointerDown = (event) => {
      if (isRotatingRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.isInteractive) object = object.parent;
        if (object.userData.isInteractive) {
          dragSelectedRef.current = object;
          setSelectedFurniture(object.userData);
          isDraggingRef.current = true;
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
          const intersectPoint = new THREE.Vector3();
          if (raycasterRef.current.ray.intersectPlane(plane, intersectPoint)) {
            dragOffsetRef.current.copy(intersectPoint).sub(object.position);
          } else {
            dragOffsetRef.current.set(0, 0, 0);
          }
          const idx = placedBBoxes.findIndex((e) => e.model === object);
          if (idx >= 0) placedBBoxes.splice(idx, 1);
          controls.enabled = false;
        }
      }
    };

    const onPointerUp = () => {
      if (isRotatingRef.current) {
        isRotatingRef.current = false;
        dragSelectedRef.current = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = 'default';
        return;
      }
      if (isDraggingRef.current && dragSelectedRef.current) {
        placedBBoxes.push({ model: dragSelectedRef.current, bbox: new THREE.Box3().setFromObject(dragSelectedRef.current) });
      }
      isDraggingRef.current = false;
      dragSelectedRef.current = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = 'default';
    };

    const onDoubleClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.isInteractive) object = object.parent;
        if (object.userData.isInteractive) {
          dragSelectedRef.current = object;
          isRotatingRef.current = true;
          lastMouseYRef.current = event.clientX;
          controls.enabled = false;
        }
      }
    };

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.isInteractive) object = object.parent;
        if (object.userData.isInteractive) { setSelectedFurniture(object.userData); return; }
      }
      setSelectedFurniture(null);
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);

    // Handle resize
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      updateWallVisibility();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [rooms]);

  return (
    /* FIX: was height:'100vh' which overflowed — now height:'100%' to fill parent */
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', background: '#f5f5f5' }}
      />

      {/* Hover tooltip */}
      {hoveredFurniture && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(17,24,39,0.9)', color: 'white',
          padding: '8px 14px', borderRadius: 10, fontSize: 13,
          pointerEvents: 'none', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <strong>{hoveredFurniture.type}</strong>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{hoveredFurniture.roomType}</div>
        </div>
      )}

      {/* Selection panel */}
      {selectedFurniture && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'white', padding: '14px 16px', borderRadius: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)', minWidth: 200,
          border: '1px solid #f0f0f0',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            {selectedFurniture.type}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            📍 {selectedFurniture.roomType}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10, lineHeight: 1.5 }}>
            Drag to move • Double-click to rotate
          </div>
          <button
            onClick={() => setSelectedFurniture(null)}
            style={{
              width: '100%', padding: '6px 10px', fontSize: 12,
              borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#f9fafb', color: '#374151',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Deselect
          </button>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(17,24,39,0.75)', color: 'white',
        padding: '6px 16px', borderRadius: 20, fontSize: 11,
        pointerEvents: 'none', backdropFilter: 'blur(8px)',
        display: 'flex', gap: 16,
      }}>
        <span>🖱 Drag to orbit</span>
        <span>⚙ Drag furniture to move</span>
        <span>↔ Double-click to rotate</span>
        <span>🔍 Scroll to zoom</span>
      </div>
    </div>
  );
}
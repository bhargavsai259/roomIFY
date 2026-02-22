import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import assets from './assets/assets.json';

const FLOOR_TOP = 2;
const DEFAULT_SCALE = 25;

// ─── Resolve model path from model name ──────────────────────────────────────
function resolveModelPath(typeName) {
  const exact = assets.models.find((m) => m?.name?.toLowerCase() === typeName?.toLowerCase());
  if (exact) return exact.path.replace('@assets', '/src/assets');

  // Fuzzy match by longest common substring
  let bestMatch = null, bestScore = 0;
  const target = typeName?.toLowerCase() || '';
  for (const m of assets.models) {
    const mn = m?.name?.toLowerCase() || '';
    let score = 0;
    for (let i = 0; i < target.length; i++)
      for (let j = i + 1; j <= target.length; j++) {
        const s = target.substring(i, j);
        if (s.length > 2 && mn.includes(s)) score = Math.max(score, s.length);
      }
    if (score > bestScore) { bestScore = score; bestMatch = m; }
  }
  return (bestMatch || assets.models[0]).path.replace('@assets', '/src/assets');
}

// ─── Load a GLTF model and place it at world position ─────────────────────────
function placeModel({ scene, modelPath, worldX, worldZ, placedBBoxes, metadata, onDone }) {
  const loader = new GLTFLoader();
  loader.load(modelPath, (gltf) => {
    const model = gltf.scene;
    model.scale.multiplyScalar(DEFAULT_SCALE);
    model.position.set(worldX, 0, worldZ);
    scene.add(model);

    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const yPos = FLOOR_TOP - bbox.min.y;
    model.position.set(worldX, yPos, worldZ);

    // Collision avoidance spiral
    const testAt = (tx, tz) => {
      model.position.set(tx, yPos, tz);
      const b = new THREE.Box3().setFromObject(model);
      return placedBBoxes.some((o) => b.intersectsBox(o.bbox));
    };

    let px = worldX, pz = worldZ;
    if (testAt(px, pz)) {
      const step = Math.max(size.x, size.z, 10);
      let found = false;
      for (let r = step; r <= 500 && !found; r += step)
        for (let ang = 0; ang < 360; ang += 30) {
          const rad = ang * Math.PI / 180;
          const nx = px + Math.cos(rad) * r, nz = pz + Math.sin(rad) * r;
          if (!testAt(nx, nz)) { px = nx; pz = nz; found = true; break; }
        }
    }
    model.position.set(px, yPos, pz);

    const finalBBox = new THREE.Box3().setFromObject(model);
    placedBBoxes.push({ model, bbox: finalBBox });
    model.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    model.userData = { ...metadata, isInteractive: true, baseScale: DEFAULT_SCALE };

    onDone?.(model);
  }, undefined, (err) => console.error('Model load error:', err));
}

// ─── Main component ───────────────────────────────────────────────────────────
const ThreeDView = forwardRef(function ThreeDView({ rooms, onRoomsChange }, ref) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const furnitureObjectsRef = useRef([]);
  const placedBBoxesRef = useRef([]);
  const roomPositionsRef = useRef([]);
  const wallsRef = useRef([]);

  const isDraggingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const dragSelectedRef = useRef(null);
  const dragOffsetRef = useRef(new THREE.Vector3());
  const lastMouseXRef = useRef(0);

  const [selectedFurniture, setSelectedFurniture] = useState(null);   // { userData, model }
  const [hoveredFurniture, setHoveredFurniture] = useState(null);
  const [dropHighlight, setDropHighlight] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [selectedScale, setSelectedScale] = useState(1.0);

  // ── Scale slider handler ─────────────────────────────────────────────────
  const handleScaleChange = useCallback((newScale) => {
    setSelectedScale(newScale);
    if (!selectedFurniture?.model) return;
    const model = selectedFurniture.model;
    const base = model.userData.baseScale || DEFAULT_SCALE;
    model.scale.set(base * newScale, base * newScale, base * newScale);
    model.userData.currentScale = newScale;
    // Update placedBBoxes
    const entry = placedBBoxesRef.current.find((e) => e.model === model);
    if (entry) entry.bbox.setFromObject(model);
  }, [selectedFurniture]);

  // ── Exposed imperative API ────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({

    // Add furniture to a specific room by room index (AI-triggered)
    addFurnitureToRoom(modelName, roomIndex = 0) {
      const scene = sceneRef.current;
      const rp = roomPositionsRef.current[roomIndex];
      if (!scene || !rp) { console.warn('Scene or room not ready'); return; }
      const modelPath = resolveModelPath(modelName);
      const ri = Math.min(roomIndex, (rooms?.length || 1) - 1);

      setBusyLabel(`Adding ${modelName.replace(/_/g, ' ')}…`);
      placeModel({
        scene, modelPath,
        worldX: rp.x, worldZ: rp.z,
        placedBBoxes: placedBBoxesRef.current,
        metadata: {
          type: modelName,
          roomIndex: ri,
          itemIndex: furnitureObjectsRef.current.length,
          roomType: rooms?.[ri]?.roomtype || 'custom',
          originalPosition: new THREE.Vector3(rp.x, FLOOR_TOP, rp.z),
        },
        onDone: (model) => {
          furnitureObjectsRef.current.push(model);
          setBusyLabel('');
        },
      });
    },

    // Drop furniture at specific screen coordinates (palette drag-and-drop)
    addFurnitureAtDrop(clientX, clientY, modelName) {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const mount = mountRef.current;
      const rps = roomPositionsRef.current;
      if (!scene || !camera || !mount) return;

      const modelPath = resolveModelPath(modelName);
      const rect = mount.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        ),
        camera
      );
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(floorPlane, hitPoint);
      if (!hitPoint.length()) hitPoint.set(rps[0]?.x || 0, FLOOR_TOP, rps[0]?.z || 0);

      // Determine which room
      let roomIndex = 0;
      for (let i = 0; i < rps.length; i++) {
        const r = rooms?.[i]; if (!r) continue;
        const hw = r.dimensions.breadth / 2, hd = r.dimensions.length / 2;
        if (hitPoint.x >= rps[i].x - hw && hitPoint.x <= rps[i].x + hw &&
          hitPoint.z >= rps[i].z - hd && hitPoint.z <= rps[i].z + hd) { roomIndex = i; break; }
      }

      setBusyLabel(`Placing ${modelName.replace(/_/g, ' ')}…`);
      placeModel({
        scene, modelPath,
        worldX: hitPoint.x, worldZ: hitPoint.z,
        placedBBoxes: placedBBoxesRef.current,
        metadata: {
          type: modelName, roomIndex,
          itemIndex: furnitureObjectsRef.current.length,
          roomType: rooms?.[roomIndex]?.roomtype || 'custom',
        },
        onDone: (model) => { furnitureObjectsRef.current.push(model); setBusyLabel(''); },
      });
    },

    // Remove all furniture matching a type name (case-insensitive)
    removeFurnitureByType(typeName) {
      const scene = sceneRef.current;
      if (!scene) return;
      const toRemove = furnitureObjectsRef.current.filter(
        (m) => m.userData.type?.toLowerCase() === typeName?.toLowerCase()
      );
      toRemove.forEach((model) => {
        scene.remove(model);
        const idx = furnitureObjectsRef.current.indexOf(model);
        if (idx >= 0) furnitureObjectsRef.current.splice(idx, 1);
        const bIdx = placedBBoxesRef.current.findIndex((e) => e.model === model);
        if (bIdx >= 0) placedBBoxesRef.current.splice(bIdx, 1);
      });
      if (selectedFurniture && toRemove.includes(selectedFurniture.model)) {
        setSelectedFurniture(null);
      }
    },

    // Scale all furniture matching a type
    scaleFurnitureByType(typeName, scale) {
      const clamped = Math.max(0.1, Math.min(3.0, scale));
      furnitureObjectsRef.current
        .filter((m) => m.userData.type?.toLowerCase() === typeName?.toLowerCase())
        .forEach((model) => {
          const base = model.userData.baseScale || DEFAULT_SCALE;
          model.scale.set(base * clamped, base * clamped, base * clamped);
          model.userData.currentScale = clamped;
          const entry = placedBBoxesRef.current.find((e) => e.model === model);
          if (entry) entry.bbox.setFromObject(model);
        });
      // Sync slider if this type is selected
      if (selectedFurniture?.userData?.type?.toLowerCase() === typeName?.toLowerCase()) {
        setSelectedScale(clamped);
      }
    },

    // Clear all furniture from a specific room
    clearRoom(roomIndex) {
      const scene = sceneRef.current;
      if (!scene) return;
      const toRemove = furnitureObjectsRef.current.filter(
        (m) => m.userData.roomIndex === roomIndex
      );
      toRemove.forEach((model) => {
        scene.remove(model);
        const idx = furnitureObjectsRef.current.indexOf(model);
        if (idx >= 0) furnitureObjectsRef.current.splice(idx, 1);
        const bIdx = placedBBoxesRef.current.findIndex((e) => e.model === model);
        if (bIdx >= 0) placedBBoxesRef.current.splice(bIdx, 1);
      });
      if (selectedFurniture && toRemove.includes(selectedFurniture.model)) setSelectedFurniture(null);
    },

    // Return current furniture list for AI context
    getFurnitureList() {
      return furnitureObjectsRef.current.map((m, i) => ({
        index: i,
        type: m.userData.type || 'unknown',
        roomIndex: m.userData.roomIndex ?? 0,
        roomType: m.userData.roomType || '',
        scale: m.userData.currentScale || 1.0,
      }));
    },
  }));

  // ── Three.js scene setup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!rooms || rooms.length === 0) return;
    const mount = mountRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeff1f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 5000);
    cameraRef.current = camera;

    let totalWidth = 0, maxDepth = 0;
    const roomPositions = [];
    let curX = 0;
    rooms.forEach((room) => {
      const rw = room.dimensions.breadth, rd = room.dimensions.length;
      roomPositions.push({ x: curX + rw / 2, z: rd / 2 });
      curX += rw; totalWidth += rw;
      maxDepth = Math.max(maxDepth, rd);
    });
    roomPositionsRef.current = roomPositions;

    const cx0 = totalWidth / 2, cz0 = maxDepth / 2;
    const maxDim = Math.max(totalWidth, maxDepth);
    const cd = maxDim * 1.2;
    camera.position.set(cx0 - cd * 0.7, cd * 0.6, cz0 + cd * 0.7);
    camera.lookAt(cx0, 30, cz0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 50; controls.maxDistance = maxDim * 3;
    controls.target.set(cx0, 30, cz0);
    controls.maxPolarAngle = Math.PI / 2.1;
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(cx0 + 500, 600, cz0 + 500);
    dir.castShadow = true;
    dir.shadow.camera.left = -totalWidth; dir.shadow.camera.right = totalWidth;
    dir.shadow.camera.top = maxDepth; dir.shadow.camera.bottom = -maxDepth;
    dir.shadow.mapSize.width = dir.shadow.mapSize.height = 2048;
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xfff5e0, 0.3);
    fill.position.set(cx0 - 300, 400, cz0 - 300);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9999aa, 0.4));

    const furnitureObjects = [];
    const placedBBoxes = [];
    const walls = [];
    furnitureObjectsRef.current = furnitureObjects;
    placedBBoxesRef.current = placedBBoxes;
    wallsRef.current = walls;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xcdd3db, roughness: 0.85, metalness: 0,
      side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });

    rooms.forEach((room, ri) => {
      const rw = room.dimensions.breadth, rd = room.dimensions.length;
      const wallH = 80, wallT = 5;
      const cx = roomPositions[ri].x, cz = roomPositions[ri].z;

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(rw, 2, rd),
        new THREE.MeshStandardMaterial({ color: ri % 2 === 0 ? 0xe4e8f0 : 0xeaedf5, roughness: 0.9 })
      );
      floor.position.set(cx, 1, cz);
      floor.receiveShadow = true;
      scene.add(floor);

      const grid = new THREE.GridHelper(Math.max(rw, rd), Math.floor(Math.max(rw, rd) / 10), 0xc0c8d4, 0xc0c8d4);
      grid.position.set(cx, 2.1, cz);
      grid.material.transparent = true; grid.material.opacity = 0.18;
      scene.add(grid);

      const addWall = (geo, pos, normal) => {
        const w = new THREE.Mesh(geo, wallMat.clone());
        w.position.set(...pos); w.castShadow = true; w.receiveShadow = true;
        w.userData.normal = normal; w.userData.wallType = 'vertical';
        walls.push(w); scene.add(w);
      };
      addWall(new THREE.BoxGeometry(rw, wallH, wallT), [cx, wallH / 2, cz - rd / 2], new THREE.Vector3(0, 0, -1));
      addWall(new THREE.BoxGeometry(rw, wallH, wallT), [cx, wallH / 2, cz + rd / 2], new THREE.Vector3(0, 0, 1));
      addWall(new THREE.BoxGeometry(wallT, wallH, rd), [cx + rw / 2, wallH / 2, cz], new THREE.Vector3(1, 0, 0));
      if (ri === 0) addWall(new THREE.BoxGeometry(wallT, wallH, rd), [cx - rw / 2, wallH / 2, cz], new THREE.Vector3(-1, 0, 0));

      // Initial furniture from AI/upload
      room.furniture?.forEach((item, ii) => {
        const mp = resolveModelPath(item.type);
        const hw = rw / 2, hd = rd / 2, m2 = 2, wt = 5;

        placeModel({
          scene, modelPath: mp,
          worldX: item.position[0] + cx - rw / 2,
          worldZ: item.position[1] + cz - rd / 2,
          placedBBoxes,
          metadata: {
            type: item.type, roomIndex: ri, itemIndex: ii,
            roomType: room.roomtype,
          },
          onDone: (model) => furnitureObjects.push(model),
        });
      });
    });

    // Wall visibility update
    const updateWalls = () => {
      walls.forEach((w) => {
        if (w.userData.wallType !== 'vertical') return;
        const wp = new THREE.Vector3(); w.getWorldPosition(wp);
        const toW = new THREE.Vector3().subVectors(wp, camera.position).normalize();
        w.visible = toW.dot(w.userData.normal.clone()) >= -0.1;
      });
    };

    // ── Input handlers ──────────────────────────────────────────────────────
    const ndcOf = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };
    const findRoot = (obj) => { while (obj && !obj.userData.isInteractive) obj = obj.parent; return obj; };

    const onMouseMove = (e) => {
      if (isRotatingRef.current && dragSelectedRef.current) {
        dragSelectedRef.current.rotation.y += (e.clientX - lastMouseXRef.current) * 0.01;
        lastMouseXRef.current = e.clientX;
        renderer.domElement.style.cursor = 'crosshair';
        return;
      }
      const { x, y } = ndcOf(e);
      mouseRef.current.set(x, y);

      if (isDraggingRef.current && dragSelectedRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
        const hit = new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(plane, hit)) {
          const model = dragSelectedRef.current;
          const desired = hit.clone().sub(dragOffsetRef.current);
          const ri = model.userData.roomIndex;
          const rp = roomPositions[ri], rv = rooms[ri];
          if (!rp || !rv) return;
          const rw = rv.dimensions.breadth, rd = rv.dimensions.length;
          const bb = new THREE.Box3().setFromObject(model);
          const sz = bb.getSize(new THREE.Vector3());
          const wt = 5, m2 = 2;
          const maxX = rw / 2 - wt - sz.x / 2 - m2, minX = -rw / 2 + wt + sz.x / 2 + m2;
          const maxZ = rd / 2 - wt - sz.z / 2 - m2, minZ = -rd / 2 + wt + sz.z / 2 + m2;
          let rx = desired.x - rp.x, rz = desired.z - rp.z;
          if (minX <= maxX) rx = Math.min(Math.max(rx, minX), maxX); else rx = 0;
          if (minZ <= maxZ) rz = Math.min(Math.max(rz, minZ), maxZ); else rz = 0;
          const orig = model.position.clone();
          model.position.set(rx + rp.x, FLOOR_TOP - bb.min.y, rz + rp.z);
          const newBB = new THREE.Box3().setFromObject(model);
          if (placedBBoxes.some((o) => o.model !== model && newBB.intersectsBox(o.bbox))) model.position.copy(orig);
          else { const ent = placedBBoxes.find((e2) => e2.model === model); if (ent) ent.bbox.copy(newBB); }
          renderer.domElement.style.cursor = 'grabbing';
        }
        return;
      }

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) {
        const obj = findRoot(hits[0].object);
        if (obj?.userData.isInteractive) { setHoveredFurniture(obj.userData); renderer.domElement.style.cursor = 'grab'; return; }
      }
      setHoveredFurniture(null); renderer.domElement.style.cursor = 'default';
    };

    const onPointerDown = (e) => {
      if (isRotatingRef.current) return;
      const { x, y } = ndcOf(e); mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) {
        const obj = findRoot(hits[0].object);
        if (obj?.userData.isInteractive) {
          dragSelectedRef.current = obj;
          setSelectedFurniture({ userData: obj.userData, model: obj });
          setSelectedScale(obj.userData.currentScale || 1.0);
          isDraggingRef.current = true;
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
          const hit = new THREE.Vector3();
          if (raycasterRef.current.ray.intersectPlane(plane, hit)) dragOffsetRef.current.copy(hit).sub(obj.position);
          else dragOffsetRef.current.set(0, 0, 0);
          const idx = placedBBoxes.findIndex((e2) => e2.model === obj);
          if (idx >= 0) placedBBoxes.splice(idx, 1);
          controls.enabled = false;
        }
      }
    };

    const onPointerUp = () => {
      if (isRotatingRef.current) { isRotatingRef.current = false; dragSelectedRef.current = null; controls.enabled = true; renderer.domElement.style.cursor = 'default'; return; }
      if (isDraggingRef.current && dragSelectedRef.current) placedBBoxes.push({ model: dragSelectedRef.current, bbox: new THREE.Box3().setFromObject(dragSelectedRef.current) });
      isDraggingRef.current = false; dragSelectedRef.current = null; controls.enabled = true; renderer.domElement.style.cursor = 'default';
    };

    const onDblClick = (e) => {
      const { x, y } = ndcOf(e); mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) {
        const obj = findRoot(hits[0].object);
        if (obj?.userData.isInteractive) { dragSelectedRef.current = obj; isRotatingRef.current = true; lastMouseXRef.current = e.clientX; controls.enabled = false; }
      }
    };

    const onClick = (e) => {
      const { x, y } = ndcOf(e); mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) {
        const obj = findRoot(hits[0].object);
        if (obj?.userData.isInteractive) {
          setSelectedFurniture({ userData: obj.userData, model: obj });
          setSelectedScale(obj.userData.currentScale || 1.0);
          return;
        }
      }
      setSelectedFurniture(null);
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('dblclick', onDblClick);
    renderer.domElement.addEventListener('click', onClick);

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); controls.update(); updateWalls(); renderer.render(scene, camera); };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      ['mousemove', 'pointerdown', 'pointerup', 'dblclick', 'click'].forEach((ev) =>
        renderer.domElement.removeEventListener(ev, { mousemove: onMouseMove, pointerdown: onPointerDown, pointerup: onPointerUp, dblclick: onDblClick, click: onClick }[ev])
      );
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [rooms]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHighlight(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropHighlight(false); }}
      onDrop={(e) => {
        e.preventDefault(); setDropHighlight(false);
        const modelName = e.dataTransfer.getData('text/plain');
        if (modelName && ref?.current) ref.current.addFurnitureAtDrop(e.clientX, e.clientY, modelName);
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Drop overlay */}
      {dropHighlight && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20, border: '3px dashed #6366f1', borderRadius: 8, background: 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(99,102,241,0.95)', color: '#fff', padding: '12px 30px', borderRadius: 14, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
            📦 Release to place furniture
          </div>
        </div>
      )}

      {/* Busy overlay */}
      {busyLabel && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.88)', color: '#fff', padding: '8px 20px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, zIndex: 30, backdropFilter: 'blur(10px)' }}>
          <svg style={{ animation: 'th3spin 0.7s linear infinite', width: 14, height: 14, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path fill="currentColor" opacity="0.8" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {busyLabel}
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredFurniture && !busyLabel && (
        <div style={{ position: 'absolute', top: 14, left: 14, pointerEvents: 'none', zIndex: 20, background: 'rgba(17,24,39,0.88)', color: '#fff', padding: '7px 13px', borderRadius: 9, fontSize: 12, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <strong style={{ display: 'block', fontSize: 12 }}>{hoveredFurniture.type?.replace(/_/g, ' ')}</strong>
          <span style={{ fontSize: 10, opacity: 0.65 }}>{hoveredFurniture.roomType}</span>
        </div>
      )}

      {/* ── Selection panel with scale slider ── */}
      {selectedFurniture && (
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20, background: '#fff', padding: '14px 16px', borderRadius: 14, boxShadow: '0 4px 28px rgba(0,0,0,0.13)', minWidth: 220, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Selected Item</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 2 }}>{selectedFurniture.userData.type?.replace(/_/g, ' ')}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>📍 {selectedFurniture.userData.roomType}</div>

          {/* Scale slider */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Size</label>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '2px 7px', borderRadius: 6 }}>
                {selectedScale.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min="0.1" max="3.0" step="0.05"
              value={selectedScale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer', height: 4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#9ca3af', marginTop: 3 }}>
              <span>Tiny (0.1×)</span><span>Normal (1×)</span><span>Large (3×)</span>
            </div>
            {/* Quick size buttons */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {[['XS', 0.25], ['S', 0.5], ['M', 1.0], ['L', 1.5], ['XL', 2.5]].map(([lbl, val]) => (
                <button key={lbl} onClick={() => handleScaleChange(val)} style={{
                  flex: 1, padding: '4px 2px', fontSize: 10, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: '1px solid',
                  borderColor: Math.abs(selectedScale - val) < 0.05 ? '#6366f1' : '#e5e7eb',
                  background: Math.abs(selectedScale - val) < 0.05 ? '#eef2ff' : '#f9fafb',
                  color: Math.abs(selectedScale - val) < 0.05 ? '#6366f1' : '#6b7280',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10.5, color: '#9ca3af', lineHeight: 1.7, marginBottom: 12, padding: '7px 9px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
            🖱 <b>Drag</b> to move &nbsp;|&nbsp; ↔ <b>Dbl-click</b> to rotate
          </div>
          <button
            onClick={() => setSelectedFurniture(null)}
            style={{ width: '100%', padding: '7px', fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontWeight: 700 }}
          >✕ Deselect</button>
        </div>
      )}

      {/* Bottom hint */}
      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.70)', color: 'rgba(255,255,255,0.82)', padding: '5px 18px', borderRadius: 20, fontSize: 10.5, pointerEvents: 'none', backdropFilter: 'blur(8px)', display: 'flex', gap: 18, whiteSpace: 'nowrap', zIndex: 15 }}>
        <span>🌀 Orbit</span>
        <span>🖱 Move</span>
        <span>↔ Dbl rotate</span>
        <span>🔍 Zoom</span>
        <span>📦 Drag from palette</span>
        <span>⬜ Click to resize</span>
      </div>

      <style>{`@keyframes th3spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

export default ThreeDView;
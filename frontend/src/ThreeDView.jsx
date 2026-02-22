import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import assets from './assets/assets.json';

const FLOOR_TOP = 2;

const ThreeDView = forwardRef(function ThreeDView({ rooms }, ref) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Furniture interaction
  const furnitureObjectsRef = useRef([]);
  const placedBBoxesRef = useRef([]);
  const roomPositionsRef = useRef([]);
  const wallsRef = useRef([]);
  const isDraggingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const dragSelectedRef = useRef(null);
  const dragOffsetRef = useRef(new THREE.Vector3());
  const lastMouseXRef = useRef(0);

  const [selectedFurniture, setSelectedFurniture] = useState(null);
  const [hoveredFurniture, setHoveredFurniture] = useState(null);
  const [dropHighlight, setDropHighlight] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addingName, setAddingName] = useState('');

  // ── Exposed API for parent (drop-to-add) ──────────────────────────────────
  useImperativeHandle(ref, () => ({
    addFurnitureAtDrop(clientX, clientY, modelName) {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const mount = mountRef.current;
      const rooms_ = roomPositionsRef.current; // snapshot
      if (!scene || !camera || !mount) return;

      const modelData = assets.models.find((m) => m.name === modelName);
      if (!modelData) { console.warn('Model not found:', modelName); return; }
      const modelPath = modelData.path.replace('@assets', '/src/assets');

      // Screen → NDC → ray → floor plane
      const rect = mount.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
      const hitPoint = new THREE.Vector3();
      ray.ray.intersectPlane(floorPlane, hitPoint);

      // Fallback to first room centre
      if (!hitPoint.length()) {
        const rp = roomPositionsRef.current;
        hitPoint.set(rp.length ? rp[0].x : 0, FLOOR_TOP, rp.length ? rp[0].z : 0);
      }

      // Which room?
      let roomIndex = 0;
      for (let i = 0; i < roomPositionsRef.current.length; i++) {
        const rp = roomPositionsRef.current[i];
        const r = rooms[i];
        if (!r) continue;
        const hw = r.dimensions.breadth / 2, hd = r.dimensions.length / 2;
        if (hitPoint.x >= rp.x - hw && hitPoint.x <= rp.x + hw &&
            hitPoint.z >= rp.z - hd && hitPoint.z <= rp.z + hd) { roomIndex = i; break; }
      }

      setIsAdding(true);
      setAddingName(modelName.replace(/_/g, ' '));

      const loader = new GLTFLoader();
      loader.load(modelPath, (gltf) => {
        const model = gltf.scene;
        model.scale.multiplyScalar(25);
        model.position.set(hitPoint.x, 0, hitPoint.z);
        scene.add(model);

        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const yPos = FLOOR_TOP - bbox.min.y;
        model.position.set(hitPoint.x, yPos, hitPoint.z);

        // Collision avoidance
        const testAt = (tx, tz) => {
          model.position.set(tx, yPos, tz);
          const b = new THREE.Box3().setFromObject(model);
          return placedBBoxesRef.current.some((o) => b.intersectsBox(o.bbox));
        };

        let px = hitPoint.x, pz = hitPoint.z;
        if (testAt(px, pz)) {
          const step = Math.max(size.x, size.z, 10);
          let found = false;
          for (let r = step; r <= 400 && !found; r += step)
            for (let ang = 0; ang < 360; ang += 30) {
              const rad = (ang * Math.PI) / 180;
              const nx = px + Math.cos(rad) * r, nz = pz + Math.sin(rad) * r;
              if (!testAt(nx, nz)) { px = nx; pz = nz; found = true; break; }
            }
        }
        model.position.set(px, yPos, pz);

        placedBBoxesRef.current.push({ model, bbox: new THREE.Box3().setFromObject(model) });
        model.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        model.userData = {
          type: modelName, roomIndex,
          itemIndex: furnitureObjectsRef.current.length,
          roomType: rooms[roomIndex]?.roomtype || 'custom',
          originalPosition: model.position.clone(),
          isInteractive: true,
        };
        furnitureObjectsRef.current.push(model);
        setIsAdding(false);
        setAddingName('');
      }, undefined, (err) => { console.error(err); setIsAdding(false); setAddingName(''); });
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
    const floorPalette = [0xe4e8f0, 0xeaedf5];

    rooms.forEach((room, ri) => {
      const rw = room.dimensions.breadth, rd = room.dimensions.length;
      const wallH = 80, wallT = 5;
      const cx = roomPositions[ri].x, cz = roomPositions[ri].z;

      // Floor
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(rw, 2, rd),
        new THREE.MeshStandardMaterial({ color: floorPalette[ri % 2], roughness: 0.9 })
      );
      floor.position.set(cx, 1, cz);
      floor.receiveShadow = true;
      scene.add(floor);

      // Subtle grid
      const grid = new THREE.GridHelper(Math.max(rw, rd), Math.floor(Math.max(rw, rd) / 10), 0xc0c8d4, 0xc0c8d4);
      grid.position.set(cx, 2.1, cz);
      grid.material.transparent = true; grid.material.opacity = 0.2;
      scene.add(grid);

      const addWall = (geo, pos, normal) => {
        const w = new THREE.Mesh(geo, wallMat.clone());
        w.position.set(...pos); w.castShadow = true; w.receiveShadow = true;
        w.userData.normal = normal; w.userData.wallType = 'vertical';
        walls.push(w); scene.add(w);
      };
      addWall(new THREE.BoxGeometry(rw, wallH, wallT), [cx, wallH/2, cz - rd/2], new THREE.Vector3(0,0,-1));
      addWall(new THREE.BoxGeometry(rw, wallH, wallT), [cx, wallH/2, cz + rd/2], new THREE.Vector3(0,0,1));
      addWall(new THREE.BoxGeometry(wallT, wallH, rd), [cx + rw/2, wallH/2, cz], new THREE.Vector3(1,0,0));
      if (ri === 0) addWall(new THREE.BoxGeometry(wallT, wallH, rd), [cx - rw/2, wallH/2, cz], new THREE.Vector3(-1,0,0));

      // Initial furniture
      const loader = new GLTFLoader();
      room.furniture.forEach((item, ii) => {
        const md = assets.models.find((m) => m?.name?.toLowerCase() === item?.type?.toLowerCase());
        let mp = md ? md.path : null;
        if (!mp) {
          const it = item?.type?.toLowerCase() || '';
          let best = null, bs = 0;
          for (const m of assets.models) {
            const mn = m?.name?.toLowerCase() || ''; let sc = 0;
            for (let i = 0; i < it.length; i++) for (let j = i+1; j <= it.length; j++) {
              const s = it.substring(i, j);
              if (s.length > 2 && mn.includes(s)) sc = Math.max(sc, s.length);
            }
            if (sc > bs) { bs = sc; best = m; }
          }
          mp = (best || assets.models[0]).path;
        }
        mp = mp.replace('@assets', '/src/assets');

        loader.load(mp, (gltf) => {
          const model = gltf.scene;
          model.scale.multiplyScalar(25);
          const bbox = new THREE.Box3().setFromObject(model);
          const size = bbox.getSize(new THREE.Vector3());
          const hw = rw/2, hd = rd/2, m2 = 2;
          const maxX = hw - wallT - size.x/2 - m2, minX = -hw + wallT + size.x/2 + m2;
          const maxZ = hd - wallT - size.z/2 - m2, minZ = -hd + wallT + size.z/2 + m2;
          let px = item.position[0], pz = item.position[1];
          if (minX <= maxX) px = Math.min(Math.max(px, minX), maxX); else px = 0;
          if (minZ <= maxZ) pz = Math.min(Math.max(pz, minZ), maxZ); else pz = 0;
          const yPos = FLOOR_TOP - bbox.min.y;

          const testAt = (tx, tz) => { model.position.set(tx+cx, yPos, tz+cz); const b = new THREE.Box3().setFromObject(model); return placedBBoxes.some((o) => b.intersectsBox(o.bbox)); };
          if (testAt(px, pz)) {
            const step = Math.max(size.x, size.z, 5); let found = false;
            for (let r = step; r <= Math.max(rw, rd) && !found; r += step)
              for (let ang = 0; ang < 360; ang += 30) {
                const rad = ang * Math.PI / 180;
                const nx = px + Math.cos(rad) * r, nz = pz + Math.sin(rad) * r;
                if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
                if (!testAt(nx, nz)) { px = nx; pz = nz; found = true; break; }
              }
            if (!found) { px = 0; pz = 0; }
          }
          model.position.set(px+cx, yPos, pz+cz);
          placedBBoxes.push({ model, bbox: new THREE.Box3().setFromObject(model) });
          model.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          model.userData = { type: item.type, roomIndex: ri, itemIndex: ii, roomType: room.roomtype, originalPosition: model.position.clone(), isInteractive: true };
          furnitureObjects.push(model);
          scene.add(model);
        }, undefined, (e) => console.error(e));
      });
    });

    // Wall visibility
    const updateWalls = () => {
      walls.forEach((w) => {
        if (w.userData.wallType !== 'vertical') return;
        const wp = new THREE.Vector3(); w.getWorldPosition(wp);
        const toW = new THREE.Vector3().subVectors(wp, camera.position).normalize();
        w.visible = toW.dot(w.userData.normal.clone()) >= -0.1;
      });
    };

    // ── Interaction handlers ────────────────────────────────────────────────
    const getCanvasNDC = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const findInteractiveParent = (obj) => {
      while (obj && !obj.userData.isInteractive) obj = obj.parent;
      return obj;
    };

    const onMouseMove = (e) => {
      if (isRotatingRef.current && dragSelectedRef.current) {
        dragSelectedRef.current.rotation.y += (e.clientX - lastMouseXRef.current) * 0.01;
        lastMouseXRef.current = e.clientX;
        renderer.domElement.style.cursor = 'crosshair';
        return;
      }
      const { x, y } = getCanvasNDC(e);
      mouseRef.current.set(x, y);

      if (isDraggingRef.current && dragSelectedRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -FLOOR_TOP);
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
          const m2 = 2, wt = 5;
          const maxX = rw/2 - wt - sz.x/2 - m2, minX = -rw/2 + wt + sz.x/2 + m2;
          const maxZ = rd/2 - wt - sz.z/2 - m2, minZ = -rd/2 + wt + sz.z/2 + m2;
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
        const obj = findInteractiveParent(hits[0].object);
        if (obj?.userData.isInteractive) { setHoveredFurniture(obj.userData); renderer.domElement.style.cursor = 'grab'; return; }
      }
      setHoveredFurniture(null); renderer.domElement.style.cursor = 'default';
    };

    const onPointerDown = (e) => {
      if (isRotatingRef.current) return;
      const { x, y } = getCanvasNDC(e);
      mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) {
        const obj = findInteractiveParent(hits[0].object);
        if (obj?.userData.isInteractive) {
          dragSelectedRef.current = obj; setSelectedFurniture(obj.userData);
          isDraggingRef.current = true;
          const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -FLOOR_TOP);
          const hit = new THREE.Vector3();
          if (raycasterRef.current.ray.intersectPlane(plane, hit)) dragOffsetRef.current.copy(hit).sub(obj.position);
          else dragOffsetRef.current.set(0,0,0);
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
      const { x, y } = getCanvasNDC(e); mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) {
        const obj = findInteractiveParent(hits[0].object);
        if (obj?.userData.isInteractive) { dragSelectedRef.current = obj; isRotatingRef.current = true; lastMouseXRef.current = e.clientX; controls.enabled = false; }
      }
    };

    const onClick = (e) => {
      const { x, y } = getCanvasNDC(e); mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(furnitureObjects, true);
      if (hits.length) { const obj = findInteractiveParent(hits[0].object); if (obj?.userData.isInteractive) { setSelectedFurniture(obj.userData); return; } }
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
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      renderer.domElement.removeEventListener('click', onClick);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [rooms]);

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHighlight(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropHighlight(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDropHighlight(false);
        const modelName = e.dataTransfer.getData('text/plain');
        if (modelName && ref?.current) ref.current.addFurnitureAtDrop(e.clientX, e.clientY, modelName);
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Drop highlight overlay */}
      {dropHighlight && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20,
          border: '3px dashed #6366f1', borderRadius: 8,
          background: 'rgba(99,102,241,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(99,102,241,0.95)', color: 'white',
            padding: '12px 32px', borderRadius: 16, fontSize: 15, fontWeight: 700,
            boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
          }}>
            📦 Release to place furniture
          </div>
        </div>
      )}

      {/* Adding indicator */}
      {isAdding && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(17,24,39,0.88)', color: 'white',
          padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 30,
          backdropFilter: 'blur(10px)',
        }}>
          <svg style={{ animation: 'spin 0.8s linear infinite', width: 15, height: 15, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path fill="currentColor" opacity="0.8" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Placing {addingName}…
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredFurniture && !isAdding && (
        <div style={{
          position: 'absolute', top: 16, left: 16, pointerEvents: 'none', zIndex: 20,
          background: 'rgba(17,24,39,0.88)', color: 'white',
          padding: '8px 14px', borderRadius: 10, fontSize: 13,
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <strong style={{ display: 'block', fontSize: 13 }}>{hoveredFurniture.type?.replace(/_/g, ' ')}</strong>
          <span style={{ fontSize: 11, opacity: 0.65 }}>{hoveredFurniture.roomType}</span>
        </div>
      )}

      {/* Selection panel */}
      {selectedFurniture && (
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 20,
          background: 'white', padding: '14px 16px', borderRadius: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,0.11)', minWidth: 210,
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Selected Item</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 3 }}>
            {selectedFurniture.type?.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>📍 {selectedFurniture.roomType}</div>
          <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, marginBottom: 12, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
            🖱 <b>Drag</b> to reposition<br />
            ↔ <b>Double-click</b> to rotate
          </div>
          <button
            onClick={() => setSelectedFurniture(null)}
            style={{ width: '100%', padding: '7px', fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontWeight: 600 }}
          >✕ Deselect</button>
        </div>
      )}

      {/* Bottom hint bar */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(17,24,39,0.72)', color: 'rgba(255,255,255,0.82)',
        padding: '5px 20px', borderRadius: 20, fontSize: 11, pointerEvents: 'none',
        backdropFilter: 'blur(8px)', display: 'flex', gap: 20, whiteSpace: 'nowrap', zIndex: 15,
      }}>
        <span>🌀 Orbit</span>
        <span>🖱 Move furniture</span>
        <span>↔ Dbl-click rotate</span>
        <span>🔍 Scroll zoom</span>
        <span>📦 Drag from palette</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

export default ThreeDView;
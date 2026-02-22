import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import assets from './assets/assets.json';

const FLOOR_TOP    = 2;
const DEFAULT_SCALE = 25;
const WALL_H       = 80;
const WALL_T       = 5;
const ROOM_GAP     = 20;

const WALL_MOUNTED_ITEMS    = new Set(['airconditioner','mirror','switchboard','tvdish','tv_bench','window','mirror_table']);
const CEILING_MOUNTED_ITEMS = new Set(['ceiling_fan']);

const MODEL_SCALE_OVERRIDES = {
  switchboard:0.3,tablelamp:0.5,bed_side_table_with_lamp:0.6,teapoy:0.7,
  pottedplant:0.6,pottedplant2:0.6,mirror:0.8,window:1.0,ceiling_fan:1.2,
  car:2.5,motorcycle:1.2,carcae:2.8,maple_tree:1.5,piano:1.1,smart_fridge:0.9,
  stove_sink_dish_drainer_kitchen_hood:1.3,treadmill:1.0,bicycle:0.9,washing_machine:0.8,
};

function resolveModelPath(typeName) {
  const t  = typeName?.toLowerCase() || '';
  const exact = assets.models.find((m) => m?.name?.toLowerCase() === t);
  if (exact) return exact.path.replace('@assets','/src/assets');
  let best = null, bestScore = 0;
  for (const m of assets.models) {
    const mn = m?.name?.toLowerCase() || '';
    let score = 0;
    for (let i=0;i<t.length;i++) for (let j=i+2;j<=t.length;j++) {
      const s=t.substring(i,j); if (mn.includes(s)) score=Math.max(score,s.length);
    }
    if (score>bestScore) { bestScore=score; best=m; }
  }
  return (best||assets.models[0]).path.replace('@assets','/src/assets');
}

function computeModelScale(typeName, rw, rl) {
  const ratio = Math.sqrt((rw*rl)/(200*150));
  return DEFAULT_SCALE * ratio * (MODEL_SCALE_OVERRIDES[typeName?.toLowerCase()] ?? 1.0);
}

// ─── Grid layout: compute {x,z} world-centre for each room ──────────────────
function calcGridPositions(rooms, cols=3) {
  const positions = [];
  const numRows   = Math.ceil(rooms.length / cols);

  // row max lengths (for Z stacking)
  const rowMaxLen = Array.from({length:numRows}, (_,row) =>
    Math.max(...Array.from({length:cols},(_,col)=>{
      const ri=row*cols+col; return ri<rooms.length ? rooms[ri].dimensions.length : 0;
    }))
  );

  let zBase = 0;
  for (let row=0; row<numRows; row++) {
    let xBase = 0;
    for (let col=0; col<cols; col++) {
      const ri = row*cols+col;
      if (ri >= rooms.length) break;
      const rw = rooms[ri].dimensions.breadth;
      const rl = rooms[ri].dimensions.length;
      positions[ri] = { x: xBase + rw/2, z: zBase + rl/2 };
      xBase += rw + ROOM_GAP;
    }
    zBase += rowMaxLen[row] + ROOM_GAP;
  }
  return positions;
}

// ─── Build one room's geometry ───────────────────────────────────────────────
function buildRoomMeshes(scene, room, ri, rp, wallColor) {
  const rw=room.dimensions.breadth, rl=room.dimensions.length;
  const {x:cx, z:cz} = rp;
  const created = [];   // all objects tagged roomIndex=ri

  // Floor
  const floorMat  = new THREE.MeshStandardMaterial({color: ri%2===0 ? 0xe4e8f0 : 0xeaedf5, roughness:0.9});
  const floor     = new THREE.Mesh(new THREE.BoxGeometry(rw,2,rl), floorMat);
  floor.position.set(cx,1,cz); floor.receiveShadow=true;
  floor.userData = {roomIndex:ri, isFloor:true};
  scene.add(floor); created.push({mesh:floor, mat:floorMat, isFloor:true});

  // Grid
  const grid = new THREE.GridHelper(Math.max(rw,rl), Math.floor(Math.max(rw,rl)/10), 0xc0c8d4, 0xc0c8d4);
  grid.position.set(cx,2.1,cz);
  grid.material.transparent=true; grid.material.opacity=0.15;
  grid.userData = {roomIndex:ri, isAux:true};
  scene.add(grid); created.push({mesh:grid, isAux:true});

  // Label canvas
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,512,128);
  ctx.font='bold 46px system-ui'; ctx.fillStyle='#5a6680'; ctx.textAlign='center';
  ctx.fillText(room.roomtype?.replace(/_/g,' ')||`Room ${ri+1}`,256,55);
  ctx.font='26px system-ui'; ctx.fillStyle='#8a9ab0';
  ctx.fillText(`${rw.toFixed(0)} × ${rl.toFixed(0)}`,256,92);
  const label=new THREE.Mesh(
    new THREE.PlaneGeometry(rw*0.55, rw*0.16),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false})
  );
  label.rotation.x=-Math.PI/2; label.position.set(cx,2.6,cz);
  label.userData={roomIndex:ri,isAux:true};
  scene.add(label); created.push({mesh:label,isAux:true});

  // Walls
  const wallMats = [];
  const addWall = (geo,pos,normal)=>{
    const mat=new THREE.MeshStandardMaterial({color:wallColor,roughness:0.85,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    wallMats.push(mat);
    const w=new THREE.Mesh(geo,mat);
    w.position.set(...pos); w.castShadow=true; w.receiveShadow=true;
    w.userData={roomIndex:ri, wallType:'vertical', normal};
    scene.add(w); created.push({mesh:w, mat, isWall:true, normal});
  };

  addWall(new THREE.BoxGeometry(rw,WALL_H,WALL_T),[cx,WALL_H/2,cz-rl/2],new THREE.Vector3(0,0,-1));
  addWall(new THREE.BoxGeometry(rw,WALL_H,WALL_T),[cx,WALL_H/2,cz+rl/2],new THREE.Vector3(0,0, 1));
  addWall(new THREE.BoxGeometry(WALL_T,WALL_H,rl),[cx+rw/2,WALL_H/2,cz],new THREE.Vector3( 1,0,0));
  addWall(new THREE.BoxGeometry(WALL_T,WALL_H,rl),[cx-rw/2,WALL_H/2,cz],new THREE.Vector3(-1,0,0));

  return {created, wallMats, floorMat};
}

// ─── Placement helpers ───────────────────────────────────────────────────────
function placeOnFloor({scene,modelPath,worldX,worldZ,placedBBoxes,metadata,onDone,scale}) {
  new GLTFLoader().load(modelPath,(gltf)=>{
    const model=gltf.scene; const s=scale??DEFAULT_SCALE;
    model.scale.setScalar(s); model.position.set(worldX,0,worldZ); scene.add(model);
    const bbox=new THREE.Box3().setFromObject(model);
    const size=bbox.getSize(new THREE.Vector3());
    const yPos=FLOOR_TOP-bbox.min.y;
    model.position.set(worldX,yPos,worldZ);
    const testAt=(tx,tz)=>{model.position.set(tx,yPos,tz);const b=new THREE.Box3().setFromObject(model);return placedBBoxes.some(o=>b.intersectsBox(o.bbox));};
    let px=worldX,pz=worldZ;
    if (testAt(px,pz)) {
      const step=Math.max(size.x,size.z,10);
      outer:for(let r=step;r<=500;r+=step)
        for(let a=0;a<360;a+=30){const rad=a*Math.PI/180;const nx=px+Math.cos(rad)*r,nz=pz+Math.sin(rad)*r;if(!testAt(nx,nz)){px=nx;pz=nz;break outer;}}
    }
    model.position.set(px,yPos,pz);
    const finalBBox=new THREE.Box3().setFromObject(model);
    placedBBoxes.push({model,bbox:finalBBox});
    model.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});
    model.userData={...metadata,isInteractive:true,baseScale:s,placement:'floor'};
    onDone?.(model);
  },undefined,e=>console.error('Model load error:',e));
}

function placeOnWall({scene,modelPath,roomPos,roomDim,placedBBoxes,metadata,onDone,scale,wallSide='back'}) {
  new GLTFLoader().load(modelPath,(gltf)=>{
    const model=gltf.scene; const s=scale??DEFAULT_SCALE;
    model.scale.setScalar(s); scene.add(model);
    const bbox=new THREE.Box3().setFromObject(model);
    const size=bbox.getSize(new THREE.Vector3());
    const mh=WALL_H*0.55;
    const {x:cx,z:cz}=roomPos; const hw=roomDim.breadth/2, hd=roomDim.length/2;
    let px=cx,pz=cz,ry=0;
    switch(wallSide){
      case 'back':  pz=cz-hd+WALL_T+size.z/2; ry=0;           break;
      case 'front': pz=cz+hd-WALL_T-size.z/2; ry=Math.PI;     break;
      case 'right': px=cx+hw-WALL_T-size.z/2; ry=-Math.PI/2;  break;
      case 'left':  px=cx-hw+WALL_T+size.z/2; ry= Math.PI/2;  break;
    }
    model.position.set(px,mh-size.y/2,pz); model.rotation.y=ry;
    const fb=new THREE.Box3().setFromObject(model); placedBBoxes.push({model,bbox:fb});
    model.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});
    model.userData={...metadata,isInteractive:true,baseScale:s,placement:'wall',wallSide};
    onDone?.(model);
  },undefined,e=>console.error('Wall load error:',e));
}

function placeOnCeiling({scene,modelPath,worldX,worldZ,placedBBoxes,metadata,onDone,scale}) {
  new GLTFLoader().load(modelPath,(gltf)=>{
    const model=gltf.scene; const s=scale??DEFAULT_SCALE;
    model.scale.setScalar(s); model.position.set(worldX,WALL_H,worldZ); scene.add(model);
    const fb=new THREE.Box3().setFromObject(model); placedBBoxes.push({model,bbox:fb});
    model.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});
    model.userData={...metadata,isInteractive:true,baseScale:s,placement:'ceiling'};
    onDone?.(model);
  },undefined,e=>console.error('Ceiling load error:',e));
}

function smartPlace({scene,typeName,modelPath,worldX,worldZ,roomPos,roomDim,placedBBoxes,metadata,onDone,scale}) {
  const n=typeName?.toLowerCase()||'';
  if (CEILING_MOUNTED_ITEMS.has(n))
    placeOnCeiling({scene,modelPath,worldX:roomPos.x,worldZ:roomPos.z,placedBBoxes,metadata,onDone,scale});
  else if (WALL_MOUNTED_ITEMS.has(n))
    placeOnWall({scene,modelPath,roomPos,roomDim,placedBBoxes,metadata,onDone,scale,wallSide:'back'});
  else
    placeOnFloor({scene,modelPath,worldX,worldZ,placedBBoxes,metadata,onDone,scale});
}

// ─── Component ───────────────────────────────────────────────────────────────
const ThreeDView = forwardRef(function ThreeDView({rooms, gridCols=3}, ref) {
  const mountRef    = useRef(null);
  const sceneRef    = useRef(null);
  const cameraRef   = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef    = useRef(new THREE.Vector2());

  // Per-room tracking
  const roomPositionsRef = useRef([]);
  const roomDimsRef      = useRef([]);
  // Room scene objects: Map<roomIndex, [{mesh, mat?, isWall?, isFloor?, isAux?}]>
  const roomMeshMapRef   = useRef(new Map());
  const wallMatsRef      = useRef([]);   // flat list for global colour changes
  const floorMeshesRef   = useRef([]);

  const furnitureObjectsRef = useRef([]);
  const placedBBoxesRef     = useRef([]);

  const isDraggingRef  = useRef(false);
  const isRotatingRef  = useRef(false);
  const dragSelectedRef = useRef(null);
  const dragOffsetRef  = useRef(new THREE.Vector3());
  const lastMouseXRef  = useRef(0);

  const [wallColor,      setWallColor]      = useState('#cdd3db');
  const [floorColor,     setFloorColor]     = useState(null);
  const [showCustomPanel,setShowCustomPanel] = useState(false);
  const [selectedFurniture, setSelectedFurniture] = useState(null);
  const [hoveredFurniture,  setHoveredFurniture]  = useState(null);
  const [dropHighlight,  setDropHighlight]  = useState(false);
  const [busyLabel,      setBusyLabel]      = useState('');
  const [selectedScale,  setSelectedScale]  = useState(1.0);

  const applyWallColor = useCallback((c) => {
    setWallColor(c); wallMatsRef.current.forEach(m=>m.color.set(c));
  },[]);
  const applyFloorColor = useCallback((c) => {
    setFloorColor(c); floorMeshesRef.current.forEach(m=>m.material.color.set(c));
  },[]);

  const handleScaleChange = useCallback((v) => {
    setSelectedScale(v);
    if (!selectedFurniture?.model) return;
    const m=selectedFurniture.model;
    m.scale.setScalar((m.userData.baseScale||DEFAULT_SCALE)*v);
    m.userData.currentScale=v;
    const e=placedBBoxesRef.current.find(e=>e.model===m); if(e) e.bbox.setFromObject(m);
  },[selectedFurniture]);

  const deleteSelected = useCallback(()=>{
    if (!selectedFurniture?.model) return;
    const m=selectedFurniture.model;
    sceneRef.current?.remove(m);
    const fi=furnitureObjectsRef.current.indexOf(m); if(fi>=0) furnitureObjectsRef.current.splice(fi,1);
    const bi=placedBBoxesRef.current.findIndex(e=>e.model===m); if(bi>=0) placedBBoxesRef.current.splice(bi,1);
    setSelectedFurniture(null);
  },[selectedFurniture]);

  // ── Remove all scene objects for a room ──────────────────────────────────
  const purgeRoomFromScene = useCallback((scene, roomIndex) => {
    // Remove furniture
    const toRemove = furnitureObjectsRef.current.filter(m=>m.userData.roomIndex===roomIndex);
    toRemove.forEach(m=>{
      scene.remove(m);
      const fi=furnitureObjectsRef.current.indexOf(m); if(fi>=0) furnitureObjectsRef.current.splice(fi,1);
      const bi=placedBBoxesRef.current.findIndex(e=>e.model===m); if(bi>=0) placedBBoxesRef.current.splice(bi,1);
    });
    if (selectedFurniture && toRemove.includes(selectedFurniture.model)) setSelectedFurniture(null);

    // Remove geometry
    const meshes = roomMeshMapRef.current.get(roomIndex) || [];
    meshes.forEach(({mesh})=>scene.remove(mesh));
    roomMeshMapRef.current.delete(roomIndex);

    // Rebuild flat refs (wall mats + floor meshes)
    const allWM=[], allFM=[];
    roomMeshMapRef.current.forEach((items)=>{
      items.forEach(({mat,isWall,isFloor,mesh})=>{
        if (isWall && mat) allWM.push(mat);
        if (isFloor && mesh) allFM.push(mesh);
      });
    });
    wallMatsRef.current   = allWM;
    floorMeshesRef.current = allFM;
  },[selectedFurniture]);

  // ── Imperative API ────────────────────────────────────────────────────────
  useImperativeHandle(ref,()=>({
    addFurnitureToRoom(modelName, roomIndex=0) {
      const scene=sceneRef.current;
      const rp=roomPositionsRef.current[roomIndex];
      const rd=roomDimsRef.current[roomIndex];
      if (!scene||!rp) return;
      const scale=computeModelScale(modelName, rd?.breadth||200, rd?.length||150);
      setBusyLabel(`Adding ${modelName.replace(/_/g,' ')}…`);
      smartPlace({scene,typeName:modelName,modelPath:resolveModelPath(modelName),
        worldX:rp.x,worldZ:rp.z,roomPos:rp,roomDim:rd,
        placedBBoxes:placedBBoxesRef.current,scale,
        metadata:{type:modelName,roomIndex,itemIndex:furnitureObjectsRef.current.length,roomType:rooms?.[roomIndex]?.roomtype||'custom'},
        onDone:m=>{furnitureObjectsRef.current.push(m);setBusyLabel('');}});
    },

    addFurnitureAtDrop(clientX,clientY,modelName) {
      const scene=sceneRef.current,camera=cameraRef.current,mount=mountRef.current;
      if (!scene||!camera||!mount) return;
      const rect=mount.getBoundingClientRect();
      const ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1),camera);
      const hit=new THREE.Vector3();
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-FLOOR_TOP),hit);

      const rps=roomPositionsRef.current, rds=roomDimsRef.current;
      let roomIndex=0;
      for (let i=0;i<rps.length;i++) {
        const r=rooms?.[i]; if(!r) continue;
        if (hit.x>=rps[i].x-r.dimensions.breadth/2 && hit.x<=rps[i].x+r.dimensions.breadth/2 &&
            hit.z>=rps[i].z-r.dimensions.length/2  && hit.z<=rps[i].z+r.dimensions.length/2) {roomIndex=i;break;}
      }
      const rp=rps[roomIndex]||rps[0];
      const rd=rds[roomIndex]||rds[0]||{breadth:200,length:150};
      const cx=Math.max(rp.x-rd.breadth/2+8,Math.min(rp.x+rd.breadth/2-8,hit.x||rp.x));
      const cz=Math.max(rp.z-rd.length/2+8, Math.min(rp.z+rd.length/2-8, hit.z||rp.z));
      const scale=computeModelScale(modelName,rd.breadth,rd.length);
      setBusyLabel(`Placing ${modelName.replace(/_/g,' ')}…`);
      smartPlace({scene,typeName:modelName,modelPath:resolveModelPath(modelName),
        worldX:cx,worldZ:cz,roomPos:rp,roomDim:rd,
        placedBBoxes:placedBBoxesRef.current,scale,
        metadata:{type:modelName,roomIndex,itemIndex:furnitureObjectsRef.current.length,roomType:rooms?.[roomIndex]?.roomtype||'custom'},
        onDone:m=>{furnitureObjectsRef.current.push(m);setBusyLabel('');}});
    },

    removeFurnitureByType(typeName) {
      const scene=sceneRef.current; if(!scene) return;
      const toRm=furnitureObjectsRef.current.filter(m=>m.userData.type?.toLowerCase()===typeName?.toLowerCase());
      toRm.forEach(m=>{
        scene.remove(m);
        const fi=furnitureObjectsRef.current.indexOf(m); if(fi>=0) furnitureObjectsRef.current.splice(fi,1);
        const bi=placedBBoxesRef.current.findIndex(e=>e.model===m); if(bi>=0) placedBBoxesRef.current.splice(bi,1);
      });
      if (selectedFurniture&&toRm.includes(selectedFurniture.model)) setSelectedFurniture(null);
    },

    scaleFurnitureByType(typeName,scale) {
      const v=Math.max(0.1,Math.min(3.0,scale));
      furnitureObjectsRef.current.filter(m=>m.userData.type?.toLowerCase()===typeName?.toLowerCase()).forEach(m=>{
        m.scale.setScalar((m.userData.baseScale||DEFAULT_SCALE)*v); m.userData.currentScale=v;
        const e=placedBBoxesRef.current.find(e=>e.model===m); if(e) e.bbox.setFromObject(m);
      });
      if (selectedFurniture?.userData?.type?.toLowerCase()===typeName?.toLowerCase()) setSelectedScale(v);
    },

    clearRoom(roomIndex) {
      const scene=sceneRef.current; if(!scene) return;
      const toRm=furnitureObjectsRef.current.filter(m=>m.userData.roomIndex===roomIndex);
      toRm.forEach(m=>{
        scene.remove(m);
        const fi=furnitureObjectsRef.current.indexOf(m); if(fi>=0) furnitureObjectsRef.current.splice(fi,1);
        const bi=placedBBoxesRef.current.findIndex(e=>e.model===m); if(bi>=0) placedBBoxesRef.current.splice(bi,1);
      });
      if (selectedFurniture&&toRm.includes(selectedFurniture.model)) setSelectedFurniture(null);
    },

    getFurnitureList() {
      return furnitureObjectsRef.current.map((m,i)=>({
        index:i,type:m.userData.type||'unknown',roomIndex:m.userData.roomIndex??0,
        roomType:m.userData.roomType||'',scale:m.userData.currentScale||1.0,placement:m.userData.placement||'floor',
      }));
    },
  }));

  // ── Scene setup (rebuilds when rooms or gridCols change) ─────────────────
  useEffect(()=>{
    if (!rooms||rooms.length===0) return;
    const mount=mountRef.current;
    const W=mount.clientWidth, H=mount.clientHeight;

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0xeff1f5);
    sceneRef.current=scene;

    const camera=new THREE.PerspectiveCamera(60,W/H,0.1,10000);
    cameraRef.current=camera;

    const roomPositions = calcGridPositions(rooms, gridCols);
    const roomDims      = rooms.map(r=>({breadth:r.dimensions.breadth,length:r.dimensions.length}));
    roomPositionsRef.current = roomPositions;
    roomDimsRef.current      = roomDims;

    // Scene bounds for camera
    let maxX=0,maxZ=0;
    roomPositions.forEach((rp,i)=>{
      maxX=Math.max(maxX,rp.x+roomDims[i].breadth/2);
      maxZ=Math.max(maxZ,rp.z+roomDims[i].length/2);
    });
    const cx0=maxX/2, cz0=maxZ/2, md=Math.max(maxX,maxZ);
    camera.position.set(cx0-md*0.55, md*0.65, cz0+md*0.85);
    camera.lookAt(cx0,30,cz0);

    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(W,H);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current=renderer;

    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=0.05;
    controls.minDistance=50; controls.maxDistance=md*6;
    controls.target.set(cx0,30,cz0); controls.maxPolarAngle=Math.PI/2.05;
    controlsRef.current=controls;

    scene.add(new THREE.AmbientLight(0xffffff,0.8));
    const dir=new THREE.DirectionalLight(0xffffff,1.0);
    dir.position.set(cx0+500,700,cz0+500); dir.castShadow=true;
    dir.shadow.camera.left=-maxX*1.5; dir.shadow.camera.right=maxX*1.5;
    dir.shadow.camera.top=maxZ*1.5; dir.shadow.camera.bottom=-maxZ*1.5;
    dir.shadow.mapSize.width=dir.shadow.mapSize.height=2048;
    scene.add(dir); scene.add(new THREE.HemisphereLight(0xffffff,0x9999aa,0.5));

    const furnitureObjects=[],placedBBoxes=[],allWallMats=[],allFloorMeshes=[];
    const roomMeshMap=new Map();
    furnitureObjectsRef.current=furnitureObjects;
    placedBBoxesRef.current=placedBBoxes;
    roomMeshMapRef.current=roomMeshMap;
    wallMatsRef.current=allWallMats;
    floorMeshesRef.current=allFloorMeshes;

    // Build each room
    rooms.forEach((room,ri)=>{
      const {created,wallMats,floorMat}=buildRoomMeshes(scene,room,ri,roomPositions[ri],wallColor);
      roomMeshMap.set(ri,created);
      wallMats.forEach(m=>allWallMats.push(m));
      // find the floor mesh
      const floorEntry=created.find(c=>c.isFloor);
      if (floorEntry) allFloorMeshes.push(floorEntry.mesh);

      // Initial furniture from backend detection
      const rw=room.dimensions.breadth, rl=room.dimensions.length;
      room.furniture?.forEach((item,ii)=>{
        const scale=computeModelScale(item.type,rw,rl);
        smartPlace({scene,typeName:item.type,modelPath:resolveModelPath(item.type),
          worldX:(item.position[0]||0)+roomPositions[ri].x-rw/2,
          worldZ:(item.position[1]||0)+roomPositions[ri].z-rl/2,
          roomPos:roomPositions[ri],roomDim:roomDims[ri],
          placedBBoxes,scale,
          metadata:{type:item.type,roomIndex:ri,itemIndex:ii,roomType:room.roomtype},
          onDone:m=>furnitureObjects.push(m)});
      });
    });

    // Wall visibility (hide walls facing camera)
    const walls=[];
    roomMeshMap.forEach(items=>items.forEach(({mesh,isWall,normal})=>{if(isWall) walls.push({mesh,normal});}));
    const updateWallVis=()=>{
      walls.forEach(({mesh,normal})=>{
        const wp=new THREE.Vector3(); mesh.getWorldPosition(wp);
        const toW=new THREE.Vector3().subVectors(wp,camera.position).normalize();
        mesh.visible=toW.dot(normal.clone())>=-0.15;
      });
    };

    // Input
    const ndcOf=e=>{const r=renderer.domElement.getBoundingClientRect();return{x:((e.clientX-r.left)/r.width)*2-1,y:-((e.clientY-r.top)/r.height)*2+1};};
    const findRoot=obj=>{while(obj&&!obj.userData.isInteractive)obj=obj.parent;return obj;};

    const onMouseMove=e=>{
      if (isRotatingRef.current&&dragSelectedRef.current){
        dragSelectedRef.current.rotation.y+=(e.clientX-lastMouseXRef.current)*0.01;
        lastMouseXRef.current=e.clientX; renderer.domElement.style.cursor='crosshair'; return;
      }
      const {x,y}=ndcOf(e); mouseRef.current.set(x,y);
      if (isDraggingRef.current&&dragSelectedRef.current){
        raycasterRef.current.setFromCamera(mouseRef.current,camera);
        const m=dragSelectedRef.current;
        if (m.userData.placement==='wall'||m.userData.placement==='ceiling') return;
        const hit=new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-FLOOR_TOP),hit)){
          const des=hit.clone().sub(dragOffsetRef.current);
          const ri=m.userData.roomIndex;
          const rp=roomPositions[ri], rv=rooms[ri]; if(!rp||!rv) return;
          const bb=new THREE.Box3().setFromObject(m), sz=bb.getSize(new THREE.Vector3()), mg=6;
          const nx=Math.min(Math.max(des.x,rp.x-rv.dimensions.breadth/2+sz.x/2+mg),rp.x+rv.dimensions.breadth/2-sz.x/2-mg);
          const nz=Math.min(Math.max(des.z,rp.z-rv.dimensions.length/2+sz.z/2+mg), rp.z+rv.dimensions.length/2-sz.z/2-mg);
          const orig=m.position.clone();
          m.position.set(nx,m.position.y,nz);
          const nb=new THREE.Box3().setFromObject(m);
          if (placedBBoxes.some(o=>o.model!==m&&nb.intersectsBox(o.bbox))) m.position.copy(orig);
          else {const ent=placedBBoxes.find(e2=>e2.model===m); if(ent) ent.bbox.copy(nb);}
          renderer.domElement.style.cursor='grabbing';
        }
        return;
      }
      raycasterRef.current.setFromCamera(mouseRef.current,camera);
      const hits=raycasterRef.current.intersectObjects(furnitureObjects,true);
      if (hits.length){const obj=findRoot(hits[0].object);if(obj?.userData.isInteractive){setHoveredFurniture(obj.userData);renderer.domElement.style.cursor='grab';return;}}
      setHoveredFurniture(null); renderer.domElement.style.cursor='default';
    };

    const onPointerDown=e=>{
      if (isRotatingRef.current) return;
      const {x,y}=ndcOf(e); mouseRef.current.set(x,y);
      raycasterRef.current.setFromCamera(mouseRef.current,camera);
      const hits=raycasterRef.current.intersectObjects(furnitureObjects,true);
      if (hits.length){
        const obj=findRoot(hits[0].object);
        if (obj?.userData.isInteractive&&obj.userData.placement!=='ceiling'){
          dragSelectedRef.current=obj;
          setSelectedFurniture({userData:obj.userData,model:obj});
          setSelectedScale(obj.userData.currentScale||1.0);
          isDraggingRef.current=true;
          const hit=new THREE.Vector3();
          if(raycasterRef.current.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-FLOOR_TOP),hit))
            dragOffsetRef.current.copy(hit).sub(obj.position);
          else dragOffsetRef.current.set(0,0,0);
          const idx=placedBBoxes.findIndex(e2=>e2.model===obj); if(idx>=0)placedBBoxes.splice(idx,1);
          controls.enabled=false;
        }
      }
    };

    const onPointerUp=()=>{
      if (isRotatingRef.current){isRotatingRef.current=false;dragSelectedRef.current=null;controls.enabled=true;renderer.domElement.style.cursor='default';return;}
      if (isDraggingRef.current&&dragSelectedRef.current) placedBBoxes.push({model:dragSelectedRef.current,bbox:new THREE.Box3().setFromObject(dragSelectedRef.current)});
      isDraggingRef.current=false;dragSelectedRef.current=null;controls.enabled=true;renderer.domElement.style.cursor='default';
    };

    const onDblClick=e=>{
      const {x,y}=ndcOf(e); mouseRef.current.set(x,y);
      raycasterRef.current.setFromCamera(mouseRef.current,camera);
      const hits=raycasterRef.current.intersectObjects(furnitureObjects,true);
      if(hits.length){const obj=findRoot(hits[0].object);if(obj?.userData.isInteractive){dragSelectedRef.current=obj;isRotatingRef.current=true;lastMouseXRef.current=e.clientX;controls.enabled=false;}}
    };

    const onClick=e=>{
      const {x,y}=ndcOf(e); mouseRef.current.set(x,y);
      raycasterRef.current.setFromCamera(mouseRef.current,camera);
      const hits=raycasterRef.current.intersectObjects(furnitureObjects,true);
      if(hits.length){const obj=findRoot(hits[0].object);if(obj?.userData.isInteractive){setSelectedFurniture({userData:obj.userData,model:obj});setSelectedScale(obj.userData.currentScale||1.0);return;}}
      setSelectedFurniture(null);
    };

    const onResize=()=>{const w=mount.clientWidth,h=mount.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);};

    renderer.domElement.addEventListener('mousemove',onMouseMove);
    renderer.domElement.addEventListener('pointerdown',onPointerDown);
    renderer.domElement.addEventListener('pointerup',onPointerUp);
    renderer.domElement.addEventListener('dblclick',onDblClick);
    renderer.domElement.addEventListener('click',onClick);
    window.addEventListener('resize',onResize);

    let animId;
    const animate=()=>{animId=requestAnimationFrame(animate);controls.update();updateWallVis();renderer.render(scene,camera);};
    animate();

    return ()=>{
      cancelAnimationFrame(animId);
      window.removeEventListener('resize',onResize);
      renderer.domElement.removeEventListener('mousemove',onMouseMove);
      renderer.domElement.removeEventListener('pointerdown',onPointerDown);
      renderer.domElement.removeEventListener('pointerup',onPointerUp);
      renderer.domElement.removeEventListener('dblclick',onDblClick);
      renderer.domElement.removeEventListener('click',onClick);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rooms, gridCols]);

  return (
    <div style={{position:'relative',width:'100%',height:'100%'}}
      onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';setDropHighlight(true);}}
      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropHighlight(false);}}
      onDrop={e=>{e.preventDefault();setDropHighlight(false);const mn=e.dataTransfer.getData('text/plain');if(mn&&ref?.current)ref.current.addFurnitureAtDrop(e.clientX,e.clientY,mn);}}
    >
      <div ref={mountRef} style={{width:'100%',height:'100%'}}/>

      {dropHighlight&&<div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:20,border:'3px dashed #6366f1',borderRadius:8,background:'rgba(99,102,241,0.05)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'rgba(99,102,241,0.95)',color:'#fff',padding:'12px 30px',borderRadius:14,fontSize:14,fontWeight:700}}>📦 Release to place furniture</div>
      </div>}

      {busyLabel&&<div style={{position:'absolute',top:14,left:'50%',transform:'translateX(-50%)',background:'rgba(17,24,39,0.88)',color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:8,zIndex:30,backdropFilter:'blur(10px)'}}>
        <svg style={{animation:'th3spin 0.7s linear infinite',width:14,height:14}} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2"/><path fill="currentColor" opacity="0.8" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>{busyLabel}
      </div>}

      {hoveredFurniture&&!busyLabel&&<div style={{position:'absolute',top:14,left:14,pointerEvents:'none',zIndex:20,background:'rgba(17,24,39,0.88)',color:'#fff',padding:'7px 13px',borderRadius:9,fontSize:12,backdropFilter:'blur(8px)'}}>
        <strong style={{display:'block'}}>{hoveredFurniture.type?.replace(/_/g,' ')}</strong>
        <span style={{fontSize:10,opacity:0.65}}>{hoveredFurniture.roomType} · {hoveredFurniture.placement||'floor'}</span>
      </div>}

      {/* Customize button */}
      <button onClick={()=>setShowCustomPanel(v=>!v)}
        style={{position:'absolute',top:14,right:selectedFurniture?256:14,zIndex:25,background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',gap:5,color:'#374151'}}>
        🎨 Customize
      </button>

      {showCustomPanel&&<div style={{position:'absolute',top:50,right:selectedFurniture?256:14,zIndex:24,background:'#fff',padding:'14px 16px',borderRadius:14,boxShadow:'0 4px 28px rgba(0,0,0,0.13)',minWidth:224,border:'1px solid #e5e7eb'}}>
        <div style={{fontSize:11,fontWeight:800,color:'#374151',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.07em'}}>Customize</div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:700,color:'#6b7280',display:'block',marginBottom:5}}>🧱 Wall Color</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {['#cdd3db','#f5f0e8','#e8f0e8','#e8eaf5','#f5e8e8','#1a2433','#2d4a3e','#f9f5f0'].map(c=>(
              <button key={c} onClick={()=>applyWallColor(c)} style={{width:26,height:26,borderRadius:6,background:c,border:wallColor===c?'2.5px solid #6366f1':'1.5px solid #e5e7eb',cursor:'pointer'}}/>
            ))}
            <input type="color" value={wallColor} onChange={e=>applyWallColor(e.target.value)} style={{width:26,height:26,padding:1,border:'1.5px solid #e5e7eb',borderRadius:6,cursor:'pointer'}}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:700,color:'#6b7280',display:'block',marginBottom:5}}>🪵 Floor Color</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {['#e4e8f0','#d4c4a8','#8b6f47','#c8b090','#2c2c2c','#f5f5f0','#e8d5b7'].map(c=>(
              <button key={c} onClick={()=>applyFloorColor(c)} style={{width:26,height:26,borderRadius:6,background:c,border:(floorColor||'#e4e8f0')===c?'2.5px solid #6366f1':'1.5px solid #e5e7eb',cursor:'pointer'}}/>
            ))}
            <input type="color" value={floorColor||'#e4e8f0'} onChange={e=>applyFloorColor(e.target.value)} style={{width:26,height:26,padding:1,border:'1.5px solid #e5e7eb',borderRadius:6,cursor:'pointer'}}/>
          </div>
        </div>
        <button onClick={()=>setShowCustomPanel(false)} style={{width:'100%',padding:'6px',fontSize:11,borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#374151',cursor:'pointer',fontWeight:700}}>✕ Close</button>
      </div>}

      {/* Selection panel */}
      {selectedFurniture&&<div style={{position:'absolute',top:14,right:14,zIndex:20,background:'#fff',padding:'14px 16px',borderRadius:14,boxShadow:'0 4px 28px rgba(0,0,0,0.13)',minWidth:234,border:'1px solid #e5e7eb'}}>
        <div style={{fontSize:10,color:'#9ca3af',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Selected</div>
        <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:2}}>{selectedFurniture.userData.type?.replace(/_/g,' ')}</div>
        <div style={{fontSize:11,color:'#6b7280',marginBottom:10}}>
          📍 {selectedFurniture.userData.roomType}
          {selectedFurniture.userData.placement!=='floor'&&<span style={{marginLeft:6,fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 6px',borderRadius:6,fontWeight:700}}>
            {selectedFurniture.userData.placement==='wall'?'🧱 Wall':'⬆️ Ceiling'}
          </span>}
        </div>
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
            <label style={{fontSize:11,fontWeight:700,color:'#374151'}}>Size</label>
            <span style={{fontSize:11,fontWeight:700,color:'#6366f1',background:'#eef2ff',padding:'2px 7px',borderRadius:6}}>{selectedScale.toFixed(2)}×</span>
          </div>
          <input type="range" min="0.1" max="3.0" step="0.05" value={selectedScale} onChange={e=>handleScaleChange(parseFloat(e.target.value))}
            style={{width:'100%',accentColor:'#6366f1',cursor:'pointer',height:4}}/>
          <div style={{display:'flex',gap:4,marginTop:7}}>
            {[['XS',0.25],['S',0.5],['M',1.0],['L',1.5],['XL',2.5]].map(([lbl,val])=>(
              <button key={lbl} onClick={()=>handleScaleChange(val)}
                style={{flex:1,padding:'4px 2px',fontSize:10,fontWeight:700,borderRadius:6,cursor:'pointer',border:'1px solid',
                  borderColor:Math.abs(selectedScale-val)<0.05?'#6366f1':'#e5e7eb',
                  background:Math.abs(selectedScale-val)<0.05?'#eef2ff':'#f9fafb',
                  color:Math.abs(selectedScale-val)<0.05?'#6366f1':'#6b7280'}}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Rotate</label>
          <div style={{display:'flex',gap:4}}>
            {[['↺ 90°',-Math.PI/2],['↻ 90°',Math.PI/2],['180°',Math.PI]].map(([lbl,angle])=>(
              <button key={lbl} onClick={()=>{if(selectedFurniture?.model){selectedFurniture.model.rotation.y+=angle;const e=placedBBoxesRef.current.find(e=>e.model===selectedFurniture.model);if(e)e.bbox.setFromObject(selectedFurniture.model);}}}
                style={{flex:1,padding:'5px 2px',fontSize:10,fontWeight:700,borderRadius:6,cursor:'pointer',border:'1px solid #e5e7eb',background:'#f9fafb',color:'#374151'}}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{fontSize:10,color:'#9ca3af',marginBottom:10,padding:'6px 9px',background:'#f8fafc',borderRadius:8,border:'1px solid #f1f5f9'}}>
          🖱 <b>Drag</b> to move · <b>Dbl-click</b> to rotate
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={deleteSelected} style={{flex:1,padding:'7px',fontSize:12,borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontWeight:700}}>🗑 Delete</button>
          <button onClick={()=>setSelectedFurniture(null)} style={{flex:1,padding:'7px',fontSize:12,borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#374151',cursor:'pointer',fontWeight:700}}>✕ Close</button>
        </div>
      </div>}

      <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(17,24,39,0.70)',color:'rgba(255,255,255,0.82)',padding:'5px 18px',borderRadius:20,fontSize:10.5,pointerEvents:'none',backdropFilter:'blur(8px)',display:'flex',gap:14,whiteSpace:'nowrap',zIndex:15}}>
        <span>🌀 Orbit</span><span>🖱 Drag</span><span>↻ Dbl-rotate</span><span>🔍 Zoom</span><span>📦 Drop palette</span><span>🗑 Delete</span>
      </div>
      <style>{`@keyframes th3spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
});

export default ThreeDView;
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ThreeDView from '../ThreeDView';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ─── Furniture catalog ────────────────────────────────────────────────────────
const CATALOG = {
  'Living Room': { color:'#3b82f6',bg:'#eff6ff',border:'#bfdbfe',emoji:'🛋',items:[
    {name:'sofa',label:'Sofa',icon:'🛋'},{name:'couch',label:'Couch',icon:'🪑'},
    {name:'coffee_table',label:'Coffee Table',icon:'🟫'},{name:'tablelamp',label:'Table Lamp',icon:'💡'},
    {name:'teapoy',label:'Teapoy',icon:'🪵'},{name:'piano',label:'Piano',icon:'🎹'},
    {name:'airconditioner',label:'AC Unit',icon:'❄️'},{name:'mirror',label:'Mirror',icon:'🪞'},
    {name:'mirror_table',label:'Mirror Table',icon:'🪞'},{name:'pottedplant',label:'Plant',icon:'🪴'},
    {name:'pottedplant2',label:'Plant 2',icon:'🌿'},{name:'maple_tree',label:'Maple Tree',icon:'🌳'},
    {name:'shelf',label:'Shelf',icon:'📚'},{name:'modern_furniture_shelf',label:'Modern Shelf',icon:'🗂'},
    {name:'closet_wooden',label:'Closet',icon:'🚪'},{name:'ceiling_fan',label:'Ceiling Fan',icon:'💨'},
    {name:'tvdish',label:'TV Dish',icon:'📡'},{name:'tv_bench',label:'TV Bench',icon:'📺'},
    {name:'table_furniture',label:'Table',icon:'🟤'},{name:'switchboard',label:'Switchboard',icon:'🔌'},
    {name:'bed_side_table_with_lamp',label:'Bedside Lamp',icon:'🕯'},
  ]},
  'Bedroom': {color:'#8b5cf6',bg:'#f5f3ff',border:'#ddd6fe',emoji:'🛏',items:[{name:'bed',label:'Bed',icon:'🛏'},{name:'closet_wooden',label:'Closet',icon:'🚪'}]},
  'Office':  {color:'#6366f1',bg:'#eef2ff',border:'#c7d2fe',emoji:'🖥',items:[{name:'woodendesk',label:'Wooden Desk',icon:'🖥'},{name:'chair',label:'Chair',icon:'🪑'}]},
  'Kitchen': {color:'#f59e0b',bg:'#fffbeb',border:'#fde68a',emoji:'🍳',items:[
    {name:'smart_fridge',label:'Smart Fridge',icon:'🧊'},{name:'stove_sink_dish_drainer_kitchen_hood',label:'Kitchen Set',icon:'🍳'},
  ]},
  'Dining':  {color:'#10b981',bg:'#ecfdf5',border:'#a7f3d0',emoji:'🍽',items:[
    {name:'chair',label:'Chair',icon:'🪑'},{name:'simple_dining_table',label:'Dining Table',icon:'🍽'},
  ]},
  'Bathroom':{color:'#0ea5e9',bg:'#f0f9ff',border:'#bae6fd',emoji:'🛁',items:[
    {name:'bathingtub',label:'Bathtub',icon:'🛁'},{name:'washing_machine',label:'Washer',icon:'🫧'},
  ]},
  'Fitness': {color:'#22c55e',bg:'#f0fdf4',border:'#bbf7d0',emoji:'💪',items:[
    {name:'treadmill',label:'Treadmill',icon:'🏃'},{name:'bicycle',label:'Bicycle',icon:'🚲'},
  ]},
  'Garage':  {color:'#64748b',bg:'#f8fafc',border:'#cbd5e1',emoji:'🚗',items:[
    {name:'car',label:'Car',icon:'🚗'},{name:'motorcycle',label:'Motorcycle',icon:'🏍'},{name:'carcae',label:'Car Cage',icon:'🏎'},
  ]},
  'Decor':   {color:'#ec4899',bg:'#fdf2f8',border:'#fbcfe8',emoji:'🪟',items:[
    {name:'window',label:'Window',icon:'🪟'},
    {name:'picture_window',label:'Picture Window',icon:'🖼️'},
    {name:'door',label:'Door',icon:'🚪'}
  ]},
};
const ALL_ITEMS = Object.values(CATALOG).flatMap(c=>c.items);

const ROOM_TYPE_OPTIONS = ['living_room','bedroom','kitchen','bathroom','office','dining_room'];

function FurnitureCard({item,cat,onDragStart}) {
  const [hov,setHov]=useState(false),[drag,setDrag]=useState(false);
  return (
    <div draggable
      onDragStart={e=>{e.dataTransfer.setData('text/plain',item.name);e.dataTransfer.effectAllowed='copy';setDrag(true);onDragStart?.(item.name);}}
      onDragEnd={()=>{setDrag(false);onDragStart?.(null);}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      title={`Drag "${item.label}" into the 3D view`}
      style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,padding:'8px 4px',borderRadius:10,
        cursor:drag?'grabbing':'grab',background:drag?cat.color:hov?cat.bg:'#fff',
        border:`1.5px solid ${drag||hov?cat.border:'#e5e7eb'}`,transition:'all 0.14s',opacity:drag?0.55:1,userSelect:'none',
        boxShadow:hov&&!drag?`0 2px 10px ${cat.color}22`:'0 1px 3px rgba(0,0,0,0.04)',
        transform:hov&&!drag?'translateY(-1px) scale(1.03)':'none'}}>
      <span style={{fontSize:18,lineHeight:1}}>{item.icon}</span>
      <span style={{fontSize:9.5,fontWeight:700,textAlign:'center',color:drag?'#fff':hov?cat.color:'#6b7280',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%',paddingInline:2}}>
        {item.label}
      </span>
    </div>
  );
}

function ChatBubble({msg}) {
  const isUser=msg.role==='user';
  const ACTION_STYLES = {
    add_furniture:   {bg:'#ecfdf5',color:'#059669',border:'#a7f3d0'},
    remove_furniture:{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
    scale_furniture: {bg:'#eff6ff',color:'#3b82f6',border:'#bfdbfe'},
    clear_room:      {bg:'#fef3c7',color:'#d97706',border:'#fde68a'},
    add_room:        {bg:'#f5f3ff',color:'#7c3aed',border:'#ddd6fe'},
    remove_room:     {bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
    resize_room:     {bg:'#ecfdf5',color:'#059669',border:'#a7f3d0'},
  };
  const actionLabel = a => {
    if (a.type==='add_furniture')   return `➕ ${a.model_name?.replace(/_/g,' ')}`;
    if (a.type==='remove_furniture') return `🗑 ${a.furniture_type?.replace(/_/g,' ')}`;
    if (a.type==='scale_furniture')  return `⚖️ ${a.furniture_type?.replace(/_/g,' ')} → ${a.scale}×`;
    if (a.type==='clear_room')       return `🧹 Clear room ${a.room_index}`;
    if (a.type==='add_room')         return `🏠 New ${a.room_type?.replace(/_/g,' ')}`;
    if (a.type==='remove_room')      return `🗑 Remove room ${a.room_index}`;
    if (a.type==='resize_room')      return `📐 Room ${a.room_index}: ${a.breadth?.toFixed(0)}×${a.length?.toFixed(0)}`;
    return a.type;
  };
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:isUser?'flex-end':'flex-start',marginBottom:12}}>
      <div style={{fontSize:9.5,color:'#9ca3af',marginBottom:3,paddingInline:4}}>{isUser?'You':'🤖 Roomify AI'}</div>
      <div style={{maxWidth:'88%',padding:'9px 13px',borderRadius:isUser?'14px 14px 4px 14px':'14px 14px 14px 4px',
        background:isUser?'linear-gradient(135deg,#6366f1,#8b5cf6)':'#f0f2f7',
        color:isUser?'#fff':'#1f2937',fontSize:12.5,lineHeight:1.55,fontWeight:500,
        boxShadow:isUser?'0 2px 10px rgba(99,102,241,0.25)':'0 1px 4px rgba(0,0,0,0.07)'}}>
        {msg.content}
      </div>
      {msg.actions?.length>0&&(
        <div style={{marginTop:5,display:'flex',flexWrap:'wrap',gap:4,paddingInline:2,maxWidth:'88%'}}>
          {msg.actions.map((a,i)=>{const s=ACTION_STYLES[a.type]||{bg:'#f5f3ff',color:'#7c3aed',border:'#ddd6fe'};return(
            <span key={i} style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>
              {actionLabel(a)}
            </span>
          );})}
        </div>
      )}
      {msg.isError&&<div style={{fontSize:10.5,color:'#ef4444',marginTop:3,paddingInline:4}}>⚠️ {msg.errorDetail}</div>}
    </div>
  );
}

const SUGGESTIONS = [
  'Add a sofa and coffee table','Add a bedroom with a bed and closet',
  'Make the sofa 2x bigger','Remove all chairs','Clear the living room',
  'Add a new kitchen room','Remove room 1','Make room 0 larger (300×220)',
];

export default function ThreeDViewRoute() {
  const [rooms,setRooms]         = useState([]);
  const [selectedFiles,setSelectedFiles] = useState([]);
  const [loading,setLoading]     = useState(false);
  const [uploadError,setUploadError] = useState('');
  const [tab,setTab]             = useState('upload');
  const [search,setSearch]       = useState('');
  const [draggedModel,setDraggedModel] = useState(null);
  const [openCats,setOpenCats]   = useState({'Living Room':true});

  // Grid layout controls
  const [gridCols,setGridCols]   = useState(3);

  // Room management panel
  const [showRoomPanel,setShowRoomPanel] = useState(false);
  const [newRoomType,setNewRoomType]     = useState('bedroom');
  const [newRoomW,setNewRoomW]           = useState(200);
  const [newRoomL,setNewRoomL]           = useState(150);

  // Chat
  const [chatMessages,setChatMessages] = useState([
    {role:'assistant',content:"Hi! I'm Roomify AI 🏠 I can add/remove/resize rooms and furniture. Try: 'add a bedroom', 'remove room 1', 'make room 0 larger'."}
  ]);
  const [chatInput,setChatInput] = useState('');
  const [chatLoading,setChatLoading] = useState(false);
  const [sessionId]  = useState(()=>crypto.randomUUID?.()||Date.now().toString());

  const threeDRef    = useRef(null);
  const chatEndRef   = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chatMessages]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async e => {
    const files=e.target.files; if (!files?.length) return;
    setSelectedFiles(Array.from(files)); setUploadError(''); setLoading(true);
    const fd=new FormData();
    for (let i=0;i<files.length;i++) fd.append('files',files[i]);
    try {
      const res=await fetch(`${API_URL}/upload`,{method:'POST',body:fd});
      if (!res.ok){setUploadError('Upload failed (HTTP '+res.status+')');setRooms([]);return;}
      const data=await res.json();
      const loaded=Array.isArray(data)?data:[];
      setRooms(loaded);
      if (loaded.length>0){
        setTab('ai');
        setChatMessages(prev=>[...prev,{role:'assistant',content:`✅ ${loaded.length} room${loaded.length>1?'s':''} loaded! What would you like to do?`}]);
      }
    } catch(err){setUploadError('Network error: '+err.message);setRooms([]);}
    finally{setLoading(false);}
  };

  // ── Manual add room ─────────────────────────────────────────────────────────
  const handleAddRoom = () => {
    const newRoom={roomno:rooms.length+1,roomtype:newRoomType,position:[0,0],
      dimensions:{breadth:Math.max(100,newRoomW),length:Math.max(100,newRoomL)},
      furniture:[],furniture_count:0,wall_color:'#cdd3db',floor_color:'#e4e8f0',doors:[],windows:[]};
    setRooms(prev=>[...prev,newRoom]);
  };

  // ── Manual remove room ──────────────────────────────────────────────────────
  const handleRemoveRoom = (roomIndex) => {
    if (rooms.length<=1) return; // keep at least 1
    setRooms(prev=>prev.filter((_,i)=>i!==roomIndex));
  };

  // ── Manual resize room ──────────────────────────────────────────────────────
  const handleResizeRoom = (roomIndex, breadth, length) => {
    setRooms(prev=>prev.map((r,i)=>i===roomIndex?{...r,dimensions:{breadth:Math.max(100,breadth),length:Math.max(100,length)}}:r));
  };

  // ── Execute AI actions ──────────────────────────────────────────────────────
  const executeActions = useCallback((actions) => {
    if (!threeDRef.current) return;
    actions.forEach(action=>{
      switch(action.type){
        case 'add_furniture':
          threeDRef.current.addFurnitureToRoom(action.model_name, action.room_index||0); break;
        case 'remove_furniture':
          threeDRef.current.removeFurnitureByType(action.furniture_type); break;
        case 'scale_furniture':
          threeDRef.current.scaleFurnitureByType(action.furniture_type, action.scale); break;
        case 'clear_room':
          threeDRef.current.clearRoom(action.room_index||0); break;
        case 'add_room':
          setRooms(prev=>[...prev,{
            roomno:prev.length+1, roomtype:action.room_type||'living_room',
            position:[0,0],
            dimensions:{
              breadth: Math.max(100, action.breadth||200),
              length:  Math.max(100, action.length ||150),
            },
            furniture:[],furniture_count:0,wall_color:'#cdd3db',floor_color:'#e4e8f0',doors:[],windows:[],
          }]); break;
        case 'remove_room': {
          const ri=action.room_index;
          setRooms(prev=>{
            if (prev.length<=1) return prev;
            return prev.filter((_,i)=>i!==ri);
          }); break;
        }
        case 'resize_room':
          setRooms(prev=>prev.map((r,i)=>i===action.room_index
            ?{...r,dimensions:{breadth:Math.max(100,action.breadth||200),length:Math.max(100,action.length||150)}}
            :r)); break;
        default: break;
      }
    });
  },[]);

  // ── Send chat ───────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async(message)=>{
    const msg=message||chatInput.trim();
    if (!msg||chatLoading) return;
    setChatInput(''); setChatLoading(true);
    setChatMessages(prev=>[...prev,{role:'user',content:msg}]);
    const furnitureList = threeDRef.current?.getFurnitureList?.() || [];
    const roomsList = rooms.map((r,i)=>({
      index:i, roomtype:r.roomtype, dimensions:r.dimensions,
    }));
    try {
      const res=await fetch(`${API_URL}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({session_id:sessionId,message:msg,rooms_count:rooms.length,
          furniture_list:furnitureList, rooms_list:roomsList})});
      const data=await res.json();
      if (!res.ok){
        setChatMessages(prev=>[...prev,{role:'assistant',content:"Sorry, I hit an error.",isError:true,errorDetail:data.error||'Unknown'}]);
        return;
      }
      const {message:aiMsg,actions=[]}=data;
      setChatMessages(prev=>[...prev,{role:'assistant',content:aiMsg,actions}]);
      if (actions.length>0) setTimeout(()=>executeActions(actions),150);
    } catch(err){
      setChatMessages(prev=>[...prev,{role:'assistant',content:"Can't connect to backend.",isError:true,errorDetail:err.message}]);
    } finally{setChatLoading(false);chatInputRef.current?.focus();}
  },[chatInput,chatLoading,rooms,sessionId,executeActions]);

  const handleKeyDown = e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}};

  const filteredCatalog = search.trim()
    ?{'Results':{color:'#6366f1',bg:'#eef2ff',border:'#c7d2fe',emoji:'🔍',items:ALL_ITEMS.filter(i=>i.label.toLowerCase().includes(search.toLowerCase())||i.name.includes(search.toLowerCase()))}}
    :CATALOG;

  const TABS=[{id:'upload',icon:'📂',label:'Upload'},{id:'furniture',icon:'🛋',label:'Palette'},{id:'rooms',icon:'🏠',label:'Rooms'},{id:'ai',icon:'🤖',label:'AI Chat'}];

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden',fontFamily:'system-ui,sans-serif'}}>

      {/* ── LEFT PANEL ── */}
      <div style={{width:290,flexShrink:0,background:'#fff',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid #e5e7eb',background:'#fafafa',flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'10px 2px',fontSize:10,fontWeight:700,border:'none',cursor:'pointer',
              borderBottom:tab===t.id?'2.5px solid #6366f1':'2.5px solid transparent',
              background:tab===t.id?'#fff':'transparent',color:tab===t.id?'#6366f1':'#9ca3af',transition:'all 0.14s',
              display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>
              <span style={{fontSize:12}}>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── UPLOAD TAB ── */}
        {tab==='upload'&&(
          <div style={{flex:1,overflowY:'auto',padding:14,display:'flex',flexDirection:'column',gap:10}}>
            <div>
              <p style={{fontSize:13,fontWeight:800,color:'#111',margin:'0 0 3px'}}>Upload Room Photos</p>
              <p style={{fontSize:11,color:'#9ca3af',margin:0,lineHeight:1.5}}>AI analyzes and generates a 3D layout.</p>
            </div>
            <label style={{cursor:'pointer',display:'block'}}>
              <div style={{border:'2px dashed #d1d5db',borderRadius:12,padding:'18px 10px',textAlign:'center',background:'#f9fafb'}}>
                <div style={{fontSize:28,marginBottom:6}}>📂</div>
                <p style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 2px'}}>Click to choose files</p>
                <p style={{fontSize:10,color:'#9ca3af',margin:0}}>JPEG, PNG — multiple allowed</p>
              </div>
              <input type="file" multiple accept="image/*" onChange={handleUpload} style={{display:'none'}}/>
            </label>
            {loading&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:'#eff6ff',borderRadius:9,border:'1px solid #bfdbfe'}}>
              <span style={{fontSize:12,color:'#2563eb',fontWeight:600}}>⏳ Generating 3D layout…</span>
            </div>}
            {uploadError&&<div style={{padding:'9px 12px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9}}>
              <p style={{fontSize:12,color:'#dc2626',fontWeight:600,margin:0}}>⚠️ {uploadError}</p>
            </div>}
            {rooms.length>0&&<div style={{padding:'9px 12px',background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:9}}>
              <p style={{fontSize:12,color:'#059669',fontWeight:700,margin:'0 0 3px'}}>✅ {rooms.length} room{rooms.length!==1?'s':''} loaded!</p>
              <button onClick={()=>setTab('rooms')} style={{fontSize:11,color:'#047857',background:'none',border:'none',padding:0,cursor:'pointer',fontWeight:700,textDecoration:'underline'}}>→ Manage rooms</button>
            </div>}
            {selectedFiles.length>0&&<div>
              <p style={{fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 6px'}}>Uploads ({selectedFiles.length})</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                {selectedFiles.map((f,i)=>(
                  <div key={i} style={{borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb',aspectRatio:'1',background:'#f3f4f6'}}>
                    <img src={URL.createObjectURL(f)} alt={f.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>
                ))}
              </div>
            </div>}
            <div style={{padding:'10px 12px',background:'#fefce8',border:'1px solid #fde68a',borderRadius:10,marginTop:'auto'}}>
              <p style={{fontSize:11,fontWeight:700,color:'#92400e',margin:'0 0 5px'}}>💡 Tips</p>
              {['Chat AI: "add a bedroom" or "remove room 1"','Drag items from Palette tab to 3D view','Use Rooms tab to manually add/remove/resize','Click placed items to resize or rotate'].map((t,i)=>(
                <p key={i} style={{fontSize:10.5,color:'#78350f',margin:'0 0 2px',paddingLeft:8,borderLeft:'2px solid #fbbf24'}}>• {t}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── PALETTE TAB ── */}
        {tab==='furniture'&&(
          <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'10px 10px 0',flexShrink:0}}>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9ca3af',pointerEvents:'none'}}>🔍</span>
                <input type="text" placeholder="Search furniture…" value={search} onChange={e=>setSearch(e.target.value)}
                  style={{width:'100%',padding:'7px 28px 7px 26px',fontSize:11,border:'1.5px solid #e5e7eb',borderRadius:8,background:'#f9fafb',color:'#374151',outline:'none',boxSizing:'border-box'}}/>
                {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:13}}>✕</button>}
              </div>
            </div>
            {rooms.length===0&&<div style={{margin:'10px',padding:'10px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:9}}>
              <p style={{fontSize:11,fontWeight:700,color:'#92400e',margin:'0 0 2px'}}>⚠️ Upload a room first</p>
              <button onClick={()=>setTab('upload')} style={{padding:'4px 10px',fontSize:10.5,fontWeight:700,background:'#f59e0b',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',marginTop:4}}>→ Upload</button>
            </div>}
            <div style={{margin:'8px 10px 0',padding:'7px 10px',background:'#eef2ff',border:'1px solid #c7d2fe',borderRadius:8,flexShrink:0}}>
              <p style={{fontSize:11,color:'#4338ca',fontWeight:600,margin:0}}>🖱 <b>Drag</b> item → <b>drop</b> onto 3D view</p>
            </div>
            <div style={{padding:'8px 10px 16px',display:'flex',flexDirection:'column',gap:6}}>
              {Object.entries(filteredCatalog).map(([catName,cat])=>{
                const isOpen=search?true:!!openCats[catName];
                return (
                  <div key={catName} style={{border:`1.5px solid ${cat.border}`,borderRadius:10,overflow:'hidden'}}>
                    <button onClick={()=>!search&&setOpenCats(p=>({...p,[catName]:!p[catName]}))}
                      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px',background:cat.bg,border:'none',cursor:'pointer'}}>
                      <span style={{fontSize:11,fontWeight:700,color:cat.color,display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:13}}>{cat.emoji}</span>{catName}
                        <span style={{fontSize:9.5,color:`${cat.color}aa`,fontWeight:700,background:`${cat.color}18`,padding:'1px 5px',borderRadius:8}}>{cat.items.length}</span>
                      </span>
                      {!search&&<span style={{fontSize:10,color:cat.color,transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}>▼</span>}
                    </button>
                    {isOpen&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,padding:'7px',background:'#fff'}}>
                      {cat.items.map(item=><FurnitureCard key={item.name} item={item} cat={cat} onDragStart={setDraggedModel}/>)}
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ROOMS TAB ── */}
        {tab==='rooms'&&(
          <div style={{flex:1,overflowY:'auto',padding:'12px 12px 20px',display:'flex',flexDirection:'column',gap:12}}>

            {/* Grid layout control */}
            <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px'}}>
              <p style={{fontSize:11,fontWeight:800,color:'#374151',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.06em'}}>🔲 Grid Layout</p>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <label style={{fontSize:11,color:'#6b7280',fontWeight:600}}>Columns:</label>
                <div style={{display:'flex',gap:4}}>
                  {[1,2,3,4].map(n=>(
                    <button key={n} onClick={()=>setGridCols(n)}
                      style={{width:28,height:28,borderRadius:6,border:'1.5px solid',cursor:'pointer',fontSize:12,fontWeight:700,
                        borderColor:gridCols===n?'#6366f1':'#e5e7eb',
                        background:gridCols===n?'#6366f1':'#fff',
                        color:gridCols===n?'#fff':'#6b7280'}}>{n}</button>
                  ))}
                </div>
              </div>
              <p style={{fontSize:10,color:'#9ca3af',margin:'6px 0 0'}}>Arrange rooms in {gridCols} column{gridCols!==1?'s':''} · scene rebuilds automatically</p>
            </div>

            {/* Add new room manually */}
            <div style={{background:'#f0fdf4',border:'1px solid #a7f3d0',borderRadius:10,padding:'10px 12px'}}>
              <p style={{fontSize:11,fontWeight:800,color:'#065f46',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.06em'}}>➕ Add Room</p>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:3}}>Room Type</label>
                  <select value={newRoomType} onChange={e=>setNewRoomType(e.target.value)}
                    style={{width:'100%',padding:'5px 8px',fontSize:11,border:'1.5px solid #a7f3d0',borderRadius:7,background:'#fff',color:'#374151',outline:'none'}}>
                    {ROOM_TYPE_OPTIONS.map(rt=><option key={rt} value={rt}>{rt.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:3}}>Width (breadth)</label>
                    <input type="number" min="100" max="600" step="10" value={newRoomW} onChange={e=>setNewRoomW(parseInt(e.target.value)||200)}
                      style={{width:'100%',padding:'5px 8px',fontSize:11,border:'1.5px solid #a7f3d0',borderRadius:7,background:'#fff',color:'#374151',outline:'none',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:3}}>Depth (length)</label>
                    <input type="number" min="100" max="600" step="10" value={newRoomL} onChange={e=>setNewRoomL(parseInt(e.target.value)||150)}
                      style={{width:'100%',padding:'5px 8px',fontSize:11,border:'1.5px solid #a7f3d0',borderRadius:7,background:'#fff',color:'#374151',outline:'none',boxSizing:'border-box'}}/>
                  </div>
                </div>
                <button onClick={handleAddRoom}
                  style={{padding:'7px',background:'#10b981',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(16,185,129,0.3)'}}>
                  ➕ Add {newRoomType.replace(/_/g,' ')} ({newRoomW}×{newRoomL})
                </button>
              </div>
            </div>

            {/* Room list */}
            {rooms.length===0
              ? <div style={{textAlign:'center',padding:'20px 0',color:'#9ca3af',fontSize:12}}>No rooms loaded yet</div>
              : rooms.map((room,ri)=>(
                <RoomCard key={ri} room={room} roomIndex={ri} total={rooms.length}
                  onRemove={()=>handleRemoveRoom(ri)}
                  onResize={(b,l)=>handleResizeRoom(ri,b,l)}/>
              ))
            }
          </div>
        )}

        {/* ── AI CHAT TAB ── */}
        {tab==='ai'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'8px 12px',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',flexShrink:0}}>
              <p style={{fontSize:10.5,color:'rgba(255,255,255,0.9)',margin:0,fontWeight:600}}>🤖 Powered by Groq LLaMA · rooms_list sent for context</p>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 12px 4px'}}>
              {chatMessages.map((msg,i)=><ChatBubble key={i} msg={msg}/>)}
              {chatLoading&&(
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{fontSize:9.5,color:'#9ca3af'}}>🤖 Roomify AI</div>
                  <div style={{display:'flex',gap:3,padding:'8px 12px',background:'#f0f2f7',borderRadius:'14px 14px 14px 4px'}}>
                    {[0,1,2].map(n=><div key={n} style={{width:6,height:6,borderRadius:'50%',background:'#9ca3af',animation:`chatdot 1.2s ${n*0.2}s ease-in-out infinite`}}/>)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
            {chatMessages.length<=2&&(
              <div style={{padding:'4px 12px 8px',flexShrink:0}}>
                <p style={{fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 5px'}}>Try asking…</p>
                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  {SUGGESTIONS.slice(0,6).map(s=>(
                    <button key={s} onClick={()=>sendMessage(s)}
                      style={{textAlign:'left',padding:'5px 10px',fontSize:11,fontWeight:500,color:'#4338ca',background:'#eef2ff',border:'1px solid #c7d2fe',borderRadius:8,cursor:'pointer'}}
                      onMouseEnter={e=>e.target.style.background='#e0e7ff'} onMouseLeave={e=>e.target.style.background='#eef2ff'}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{padding:'8px 12px 12px',borderTop:'1px solid #f1f5f9',flexShrink:0,background:'#fafafa'}}>
              <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
                <textarea ref={chatInputRef} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Ask AI to design your room…" rows={2}
                  style={{flex:1,padding:'8px 10px',fontSize:12,fontWeight:500,border:'1.5px solid #e5e7eb',borderRadius:10,background:'#fff',color:'#1f2937',outline:'none',resize:'none',lineHeight:1.4,fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor='#a5b4fc'} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                <button onClick={()=>sendMessage()} disabled={chatLoading||!chatInput.trim()}
                  style={{width:38,height:38,borderRadius:10,border:'none',cursor:chatLoading||!chatInput.trim()?'not-allowed':'pointer',
                    background:chatLoading||!chatInput.trim()?'#e5e7eb':'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color:chatLoading||!chatInput.trim()?'#9ca3af':'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}>
                  {chatLoading?<svg style={{animation:'rspin 0.8s linear infinite',width:15,height:15}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>:'↑'}
                </button>
              </div>
              <p style={{fontSize:9.5,color:'#9ca3af',margin:'5px 0 0',textAlign:'center'}}>Enter to send · AI controls rooms + furniture</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 3D VIEWER ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden',background:'#eff1f5'}}>
        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'10px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <h2 style={{fontSize:15,fontWeight:800,color:'#111',margin:0}}>3D Room View</h2>
            <p style={{fontSize:11,color:'#9ca3af',margin:'2px 0 0'}}>
              {rooms.length>0?`${rooms.length} room${rooms.length!==1?'s':''} · ${gridCols}-col grid · drag from palette or ask AI`:'Upload room images to get started'}
            </p>
          </div>
          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            {rooms.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:'#059669',background:'#ecfdf5',border:'1px solid #a7f3d0',padding:'4px 9px',borderRadius:20}}>
              <span style={{width:6,height:6,background:'#10b981',borderRadius:'50%',display:'inline-block',animation:'livepulse 2s infinite'}}></span>
              Live · {rooms.length} room{rooms.length!==1?'s':''}
            </span>}
            {draggedModel&&<span style={{fontSize:11,fontWeight:700,color:'#4338ca',background:'#eef2ff',border:'1px solid #c7d2fe',padding:'4px 9px',borderRadius:20}}>
              📦 {draggedModel.replace(/_/g,' ')}
            </span>}
            {chatLoading&&<span style={{fontSize:11,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',border:'1px solid #ddd6fe',padding:'4px 9px',borderRadius:20,display:'flex',alignItems:'center',gap:5}}>
              <svg style={{animation:'rspin 0.8s linear infinite',width:11,height:11}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              AI thinking…
            </span>}
          </div>
        </div>

        <div style={{flex:1,position:'relative',overflow:'hidden'}}>
          {rooms.length===0
            ?<div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,textAlign:'center'}}>
              <div style={{fontSize:64,marginBottom:16,opacity:0.15}}>🧊</div>
              <h3 style={{fontSize:18,fontWeight:800,color:'#9ca3af',margin:'0 0 8px'}}>No rooms loaded yet</h3>
              <p style={{fontSize:13,color:'#d1d5db',maxWidth:280,lineHeight:1.6,margin:'0 0 20px'}}>Upload room photos or use the Rooms tab to manually create rooms.</p>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setTab('upload')} style={{padding:'10px 20px',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>📂 Upload Photos</button>
                <button onClick={()=>setTab('rooms')} style={{padding:'10px 20px',background:'#fff',color:'#374151',border:'1.5px solid #e5e7eb',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>🏠 Add Room</button>
              </div>
            </div>
            :<ThreeDView ref={threeDRef} rooms={rooms} gridCols={gridCols}/>
          }
        </div>
      </div>

      <style>{`
        @keyframes rspin{to{transform:rotate(360deg);}}
        @keyframes livepulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
        @keyframes chatdot{0%,80%,100%{transform:scale(0.7);opacity:0.5;}40%{transform:scale(1.1);opacity:1;}}
      `}</style>
    </div>
  );
}

// ─── Room card in Rooms tab ──────────────────────────────────────────────────
function RoomCard({room,roomIndex,total,onRemove,onResize}) {
  const [editing,setEditing] = useState(false);
  const [tw,setTw]           = useState(room.dimensions.breadth);
  const [tl,setTl]           = useState(room.dimensions.length);

  const ROOM_COLORS = {
    living_room:'#3b82f6',bedroom:'#8b5cf6',kitchen:'#f59e0b',
    bathroom:'#0ea5e9',office:'#6366f1',dining_room:'#10b981',
  };
  const color = ROOM_COLORS[room.roomtype] || '#6366f1';

  return (
    <div style={{border:`1.5px solid`,borderColor:color+'44',borderRadius:11,overflow:'hidden',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:color+'10'}}>
        <div>
          <span style={{fontSize:12,fontWeight:800,color:color}}>
            Room {roomIndex+1} — {room.roomtype?.replace(/_/g,' ')}
          </span>
          <span style={{fontSize:10,color:'#9ca3af',marginLeft:8}}>
            {room.dimensions.breadth.toFixed(0)} × {room.dimensions.length.toFixed(0)}
          </span>
        </div>
        <div style={{display:'flex',gap:4}}>
          <button onClick={()=>setEditing(v=>!v)}
            style={{padding:'3px 8px',fontSize:10,fontWeight:700,borderRadius:6,border:`1px solid ${color}44`,background:'#fff',color:color,cursor:'pointer'}}>
            {editing?'Done':'📐 Resize'}
          </button>
          {total>1&&<button onClick={onRemove}
            style={{padding:'3px 8px',fontSize:10,fontWeight:700,borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',cursor:'pointer'}}>
            🗑
          </button>}
        </div>
      </div>

      {/* Resize controls */}
      {editing&&(
        <div style={{padding:'8px 10px',background:'#fafafa',borderTop:'1px solid #f1f5f9'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:'#6b7280',display:'block',marginBottom:2}}>Width</label>
              <input type="number" min="100" max="600" step="10" value={tw} onChange={e=>setTw(parseInt(e.target.value)||200)}
                style={{width:'100%',padding:'4px 7px',fontSize:11,border:'1.5px solid #e5e7eb',borderRadius:6,background:'#fff',color:'#374151',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:'#6b7280',display:'block',marginBottom:2}}>Depth</label>
              <input type="number" min="100" max="600" step="10" value={tl} onChange={e=>setTl(parseInt(e.target.value)||150)}
                style={{width:'100%',padding:'4px 7px',fontSize:11,border:'1.5px solid #e5e7eb',borderRadius:6,background:'#fff',color:'#374151',outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
          {/* Visual size preset buttons */}
          <div style={{display:'flex',gap:4,marginBottom:8}}>
            {[['Small',150,120],['Medium',200,150],['Large',280,220],['XL',350,280]].map(([lbl,b,l])=>(
              <button key={lbl} onClick={()=>{setTw(b);setTl(l);}}
                style={{flex:1,padding:'4px 2px',fontSize:9.5,fontWeight:700,borderRadius:6,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',cursor:'pointer'}}>
                {lbl}<br/><span style={{fontSize:8,opacity:0.7}}>{b}×{l}</span>
              </button>
            ))}
          </div>
          <button onClick={()=>{onResize(tw,tl);setEditing(false);}}
            style={{width:'100%',padding:'6px',background:color,color:'#fff',border:'none',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            Apply Resize
          </button>
        </div>
      )}
    </div>
  );
}
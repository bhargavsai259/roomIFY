import React, { useState, useRef, useEffect, useCallback } from 'react';
import ThreeDView from '../ThreeDView';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ─── Furniture catalog ────────────────────────────────────────────────────────
const CATALOG = {
  'Living Room': { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', emoji: '🛋', items: [
    { name: 'sofa', label: 'Sofa', icon: '🛋' }, { name: 'couch', label: 'Couch', icon: '🪑' },
    { name: 'coffee_table', label: 'Coffee Table', icon: '🟫' }, { name: 'tablelamp', label: 'Table Lamp', icon: '💡' },
    { name: 'teapoy', label: 'Teapoy', icon: '🪵' }, { name: 'piano', label: 'Piano', icon: '🎹' },
    { name: 'airconditioner', label: 'AC Unit', icon: '❄️' }, { name: 'mirror', label: 'Mirror', icon: '🪞' },
    { name: 'mirror_table', label: 'Mirror Table', icon: '🪞' }, { name: 'pottedplant', label: 'Plant', icon: '🪴' },
    { name: 'pottedplant2', label: 'Plant 2', icon: '🌿' }, { name: 'maple_tree', label: 'Maple Tree', icon: '🌳' },
    { name: 'shelf', label: 'Shelf', icon: '📚' }, { name: 'modern_furniture_shelf', label: 'Modern Shelf', icon: '🗂' },
    { name: 'closet_wooden', label: 'Closet', icon: '🚪' }, { name: 'ceiling_fan', label: 'Ceiling Fan', icon: '💨' },
    { name: 'tvdish', label: 'TV Dish', icon: '📡' }, { name: 'tv_bench', label: 'TV Bench', icon: '📺' },
    { name: 'table_furniture', label: 'Table', icon: '🟤' }, { name: 'switchboard', label: 'Switchboard', icon: '🔌' },
    { name: 'bed_side_table_with_lamp', label: 'Bedside Lamp', icon: '🕯' },
  ]},
  'Bedroom': { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', emoji: '🛏', items: [{ name: 'bed', label: 'Bed', icon: '🛏' }] },
  'Office':   { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', emoji: '🖥', items: [{ name: 'woodendesk', label: 'Wooden Desk', icon: '🖥' }] },
  'Kitchen':  { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', emoji: '🍳', items: [
    { name: 'smart_fridge', label: 'Smart Fridge', icon: '🧊' },
    { name: 'stove_sink_dish_drainer_kitchen_hood', label: 'Kitchen Set', icon: '🍳' },
  ]},
  'Dining':   { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', emoji: '🍽', items: [
    { name: 'chair', label: 'Chair', icon: '🪑' }, { name: 'simple_dining_table', label: 'Dining Table', icon: '🍽' },
  ]},
  'Bathroom': { color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', emoji: '🛁', items: [
    { name: 'bathingtub', label: 'Bathtub', icon: '🛁' }, { name: 'washing_machine', label: 'Washer', icon: '🫧' },
  ]},
  'Fitness':  { color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', emoji: '💪', items: [
    { name: 'treadmill', label: 'Treadmill', icon: '🏃' }, { name: 'bicycle', label: 'Bicycle', icon: '🚲' },
  ]},
  'Garage':   { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', emoji: '🚗', items: [
    { name: 'car', label: 'Car', icon: '🚗' }, { name: 'motorcycle', label: 'Motorcycle', icon: '🏍' }, { name: 'carcae', label: 'Car Cage', icon: '🏎' },
  ]},
  'Decor':    { color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', emoji: '🪟', items: [{ name: 'window', label: 'Window', icon: '🪟' }] },
};
const ALL_ITEMS = Object.values(CATALOG).flatMap((c) => c.items);

// ─── Draggable furniture card ─────────────────────────────────────────────────
function FurnitureCard({ item, cat, onDragStart }) {
  const [hov, setHov] = useState(false);
  const [drag, setDrag] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.name); e.dataTransfer.effectAllowed = 'copy'; setDrag(true); onDragStart?.(item.name); }}
      onDragEnd={() => { setDrag(false); onDragStart?.(null); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={`Drag "${item.label}" into the 3D view`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: '8px 4px', borderRadius: 10, cursor: drag ? 'grabbing' : 'grab',
        background: drag ? cat.color : hov ? cat.bg : '#fff',
        border: `1.5px solid ${drag || hov ? cat.border : '#e5e7eb'}`,
        transition: 'all 0.14s', opacity: drag ? 0.55 : 1, userSelect: 'none',
        boxShadow: hov && !drag ? `0 2px 10px ${cat.color}22` : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hov && !drag ? 'translateY(-1px) scale(1.03)' : 'none',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
      <span style={{ fontSize: 9.5, fontWeight: 700, textAlign: 'center', color: drag ? '#fff' : hov ? cat.color : '#6b7280', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', paddingInline: 2 }}>
        {item.label}
      </span>
    </div>
  );
}

// ─── Chat message bubble ───────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  const hasActions = msg.actions?.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{ fontSize: 9.5, color: '#9ca3af', marginBottom: 3, paddingInline: 4 }}>
        {isUser ? 'You' : '🤖 Roomify AI'}
      </div>
      <div style={{
        maxWidth: '88%', padding: '9px 13px', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f0f2f7',
        color: isUser ? '#fff' : '#1f2937',
        fontSize: 12.5, lineHeight: 1.55, fontWeight: 500,
        boxShadow: isUser ? '0 2px 10px rgba(99,102,241,0.25)' : '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {msg.content}
      </div>
      {hasActions && (
        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4, paddingInline: 2, maxWidth: '88%' }}>
          {msg.actions.map((a, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
              background: a.type === 'add_furniture' ? '#ecfdf5' : a.type === 'remove_furniture' ? '#fef2f2' : a.type === 'scale_furniture' ? '#eff6ff' : a.type === 'clear_room' ? '#fef3c7' : '#f5f3ff',
              color: a.type === 'add_furniture' ? '#059669' : a.type === 'remove_furniture' ? '#dc2626' : a.type === 'scale_furniture' ? '#3b82f6' : a.type === 'clear_room' ? '#d97706' : '#7c3aed',
              border: '1px solid',
              borderColor: a.type === 'add_furniture' ? '#a7f3d0' : a.type === 'remove_furniture' ? '#fecaca' : a.type === 'scale_furniture' ? '#bfdbfe' : a.type === 'clear_room' ? '#fde68a' : '#ddd6fe',
            }}>
              {a.type === 'add_furniture' && `➕ ${a.model_name?.replace(/_/g, ' ')}`}
              {a.type === 'remove_furniture' && `🗑 ${a.furniture_type?.replace(/_/g, ' ')}`}
              {a.type === 'scale_furniture' && `⚖️ ${a.furniture_type?.replace(/_/g, ' ')} → ${a.scale}×`}
              {a.type === 'clear_room' && `🧹 Clear room ${a.room_index}`}
              {a.type === 'add_room' && `🏠 New ${a.room_type?.replace(/_/g, ' ')}`}
            </span>
          ))}
        </div>
      )}
      {msg.isError && <div style={{ fontSize: 10.5, color: '#ef4444', marginTop: 3, paddingInline: 4 }}>⚠️ {msg.errorDetail}</div>}
    </div>
  );
}

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Add a sofa and coffee table to room 1',
  'Place a bed and wardrobe in the bedroom',
  'Make the sofa bigger (2x size)',
  'Add some plants to decorate',
  'Remove all chairs',
  'Clear the living room',
  'Create a cozy reading corner',
  'Add kitchen appliances',
];

// ─── Main Route ───────────────────────────────────────────────────────────────
export default function ThreeDViewRoute() {
  const [rooms, setRooms] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [tab, setTab] = useState('upload');
  const [search, setSearch] = useState('');
  const [draggedModel, setDraggedModel] = useState(null);
  const [openCats, setOpenCats] = useState({ 'Living Room': true });

  // AI Chat state
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Roomify AI 🏠 I can help you design your room. Try asking me to add furniture, resize items, clear rooms, or describe a style you want!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID?.() || Date.now().toString());

  const threeDRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Upload ──────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setSelectedFiles(Array.from(files));
    setUploadError(''); setLoading(true);
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: fd });
      if (!res.ok) { setUploadError('Upload failed (HTTP ' + res.status + ')'); setRooms([]); return; }
      const data = await res.json();
      const loaded = Array.isArray(data) ? data : [];
      setRooms(loaded);
      if (loaded.length > 0) {
        setTab('ai');
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Great! I can see ${loaded.length} room${loaded.length > 1 ? 's' : ''} loaded. What would you like me to do? I can add furniture, change sizes, or help decorate! 🎨` }
        ]);
      }
    } catch (err) {
      setUploadError('Network error: ' + err.message); setRooms([]);
    } finally { setLoading(false); }
  };

  // ── Process AI actions from chat ────────────────────────────────────────
  const executeActions = useCallback((actions) => {
    if (!threeDRef.current) return;
    actions.forEach((action) => {
      switch (action.type) {
        case 'add_furniture':
          threeDRef.current.addFurnitureToRoom(action.model_name, action.room_index || 0);
          break;
        case 'remove_furniture':
          threeDRef.current.removeFurnitureByType(action.furniture_type);
          break;
        case 'scale_furniture':
          threeDRef.current.scaleFurnitureByType(action.furniture_type, action.scale);
          break;
        case 'clear_room':
          threeDRef.current.clearRoom(action.room_index || 0);
          break;
        case 'add_room': {
          // Append a new synthetic room to the rooms array
          const newRoom = {
            roomno: rooms.length + 1,
            roomtype: action.room_type || 'living_room',
            position: [0, 0],
            dimensions: { breadth: action.breadth || 200, length: action.length || 150 },
            furniture: [],
            furniture_count: 0,
          };
          setRooms((prev) => [...prev, newRoom]);
          break;
        }
        default: break;
      }
    });
  }, [rooms]);

  // ── Send chat message ───────────────────────────────────────────────────
  const sendMessage = useCallback(async (message) => {
    const msg = message || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatLoading(true);

    // Append user message
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);

    // Get current furniture state for context
    const furnitureList = threeDRef.current?.getFurnitureList?.() || [];

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: msg,
          rooms_count: rooms.length,
          furniture_list: furnitureList,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChatMessages((prev) => [...prev, {
          role: 'assistant', content: "Sorry, I ran into an error. Please check your GROQ_API_KEY environment variable on the backend.",
          isError: true, errorDetail: data.error || 'Unknown error',
        }]);
        return;
      }

      const { message: aiMsg, actions = [] } = data;

      // Show AI response with action tags
      setChatMessages((prev) => [...prev, { role: 'assistant', content: aiMsg, actions }]);

      // Execute actions in 3D scene
      if (actions.length > 0) {
        setTimeout(() => executeActions(actions), 150);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, {
        role: 'assistant',
        content: "I couldn't connect to the backend. Make sure the server is running and GROQ_API_KEY is set.",
        isError: true, errorDetail: err.message,
      }]);
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  }, [chatInput, chatLoading, rooms, sessionId, executeActions]);

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const filteredCatalog = search.trim()
    ? { 'Results': { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', emoji: '🔍', items: ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()) || i.name.includes(search.toLowerCase())) } }
    : CATALOG;

  // ── Tabs config ──────────────────────────────────────────────────────────
  const TABS = [
    { id: 'upload',    icon: '📂', label: 'Upload' },
    { id: 'furniture', icon: '🛋', label: 'Palette' },
    { id: 'ai',        icon: '🤖', label: 'AI Chat' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div style={{ width: 286, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '11px 4px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
              borderBottom: tab === t.id ? '2.5px solid #6366f1' : '2.5px solid transparent',
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#6366f1' : '#9ca3af', transition: 'all 0.14s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.id === 'ai' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0, animation: tab === 'ai' ? 'none' : 'aipulse 2s infinite' }}></span>
              )}
            </button>
          ))}
        </div>

        {/* ── UPLOAD TAB ─── */}
        {tab === 'upload' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#111', margin: '0 0 3px' }}>Upload Room Photos</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>AI will analyze and generate a 3D layout automatically.</p>
            </div>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <div style={{ border: '2px dashed #d1d5db', borderRadius: 12, padding: '18px 10px', textAlign: 'center', background: '#f9fafb', transition: 'border-color 0.15s' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>Click to choose files</p>
                <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>JPEG, PNG — multiple allowed</p>
              </div>
              <input type="file" multiple accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </label>

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#eff6ff', borderRadius: 9, border: '1px solid #bfdbfe' }}>
                <svg style={{ animation: 'aipulse 0.8s linear infinite', width: 13, height: 13, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="3" opacity="0.25" />
                  <path fill="#3b82f6" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>Generating 3D layout…</span>
              </div>
            )}
            {uploadError && (
              <div style={{ padding: '9px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9 }}>
                <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, margin: 0 }}>⚠️ {uploadError}</p>
              </div>
            )}
            {rooms.length > 0 && (
              <div style={{ padding: '9px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 9 }}>
                <p style={{ fontSize: 12, color: '#059669', fontWeight: 700, margin: '0 0 3px' }}>✅ {rooms.length} room{rooms.length !== 1 ? 's' : ''} loaded!</p>
                <button onClick={() => setTab('ai')} style={{ fontSize: 11, color: '#047857', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                  → Chat with AI to design your room
                </button>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Uploads ({selectedFiles.length})</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {selectedFiles.map((f, i) => (
                    <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', aspectRatio: '1', background: '#f3f4f6' }}>
                      <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding: '10px 12px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, marginTop: 'auto' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 5px' }}>💡 Tips</p>
              {['Use AI Chat tab to place furniture by talking', 'Drag items from Palette to position them', 'Click a placed item to resize it with a slider', 'Double-click to rotate, drag to move'].map((t, i) => (
                <p key={i} style={{ fontSize: 10.5, color: '#78350f', margin: '0 0 2px', paddingLeft: 8, borderLeft: '2px solid #fbbf24' }}>• {t}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── PALETTE TAB ─── */}
        {tab === 'furniture' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af', pointerEvents: 'none' }}>🔍</span>
                <input type="text" placeholder="Search furniture…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '7px 28px 7px 26px', fontSize: 11, border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#374151', outline: 'none', boxSizing: 'border-box' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13 }}>✕</button>}
              </div>
            </div>
            {rooms.length === 0 && (
              <div style={{ margin: '10px', padding: '10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 9 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>⚠️ Upload a room first</p>
                <button onClick={() => setTab('upload')} style={{ padding: '4px 10px', fontSize: 10.5, fontWeight: 700, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 4 }}>→ Upload</button>
              </div>
            )}
            <div style={{ margin: '8px 10px 0', padding: '7px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: '#4338ca', fontWeight: 600, margin: 0 }}>🖱 <b>Drag</b> item → <b>drop</b> onto 3D view</p>
            </div>
            <div style={{ padding: '8px 10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(filteredCatalog).map(([catName, cat]) => {
                const isOpen = search ? true : !!openCats[catName];
                return (
                  <div key={catName} style={{ border: `1.5px solid ${cat.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <button onClick={() => !search && setOpenCats((p) => ({ ...p, [catName]: !p[catName] }))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: cat.bg, border: 'none', cursor: 'pointer' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 13 }}>{cat.emoji}</span> {catName}
                        <span style={{ fontSize: 9.5, color: `${cat.color}aa`, fontWeight: 700, background: `${cat.color}18`, padding: '1px 5px', borderRadius: 8 }}>{cat.items.length}</span>
                      </span>
                      {!search && <span style={{ fontSize: 10, color: cat.color, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>}
                    </button>
                    {isOpen && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, padding: '7px', background: '#fff' }}>
                        {cat.items.map((item) => <FurnitureCard key={item.name} item={item} cat={cat} onDragStart={setDraggedModel} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── AI CHAT TAB ─── */}
        {tab === 'ai' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Setup notice if no API key setup */}
            <div style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }}>
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 600 }}>
                🤖 Powered by Groq LLaMA · Set <code style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: 4 }}>GROQ_API_KEY</code> env var
              </p>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px' }}>
              {chatMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 9.5, color: '#9ca3af' }}>🤖 Roomify AI</div>
                  <div style={{ display: 'flex', gap: 3, padding: '8px 12px', background: '#f0f2f7', borderRadius: '14px 14px 14px 4px' }}>
                    {[0, 1, 2].map((n) => (
                      <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', animation: `chatdot 1.2s ${n * 0.2}s ease-in-out infinite` }}></div>
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions */}
            {chatMessages.length <= 2 && (
              <div style={{ padding: '4px 12px 8px', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>Try asking…</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {SUGGESTIONS.slice(0, 5).map((s) => (
                    <button key={s} onClick={() => sendMessage(s)} style={{ textAlign: 'left', padding: '5px 10px', fontSize: 11, fontWeight: 500, color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.target.style.background = '#e0e7ff'}
                      onMouseLeave={e => e.target.style.background = '#eef2ff'}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input area */}
            <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #f1f5f9', flexShrink: 0, background: '#fafafa' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AI to design your room…"
                  rows={2}
                  style={{
                    flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 500,
                    border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff',
                    color: '#1f2937', outline: 'none', resize: 'none', lineHeight: 1.4,
                    fontFamily: 'inherit', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#a5b4fc'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: 'none', cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                    background: chatLoading || !chatInput.trim() ? '#e5e7eb' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: chatLoading || !chatInput.trim() ? '#9ca3af' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: 16, transition: 'all 0.15s', boxShadow: !chatLoading && chatInput.trim() ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                  }}
                >
                  {chatLoading ? (
                    <svg style={{ animation: 'rspin 0.8s linear infinite', width: 15, height: 15 }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : '↑'}
                </button>
              </div>
              <p style={{ fontSize: 9.5, color: '#9ca3af', margin: '5px 0 0', textAlign: 'center' }}>
                Enter to send · AI controls the 3D scene
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 3D VIEWER ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: '#eff1f5' }}>
        {/* Viewer header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: 0 }}>3D Room View</h2>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
              {rooms.length > 0 ? `${rooms.length} room${rooms.length !== 1 ? 's' : ''} — chat with AI or drag from palette` : 'Upload room images to get started'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {rooms.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 9px', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', display: 'inline-block', animation: 'livepulse 2s infinite' }}></span>
                Live · {rooms.length} room{rooms.length !== 1 ? 's' : ''}
              </span>
            )}
            {draggedModel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '4px 9px', borderRadius: 20 }}>
                📦 {draggedModel.replace(/_/g, ' ')}
              </span>
            )}
            {chatLoading && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '4px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg style={{ animation: 'rspin 0.8s linear infinite', width: 11, height: 11 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                AI thinking…
              </span>
            )}
          </div>
        </div>

        {/* 3D scene */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {rooms.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.15 }}>🧊</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#9ca3af', margin: '0 0 8px' }}>No rooms loaded yet</h3>
              <p style={{ fontSize: 13, color: '#d1d5db', maxWidth: 280, lineHeight: 1.6, margin: '0 0 20px' }}>
                Upload room photos and AI will generate a 3D layout you can interact with and chat to design.
              </p>
              <button onClick={() => setTab('upload')} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                📂 Upload Room Images
              </button>
            </div>
          ) : (
            <ThreeDView ref={threeDRef} rooms={rooms} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes rspin { to { transform: rotate(360deg); } }
        @keyframes aipulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes livepulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes chatdot { 0%,80%,100% { transform:scale(0.7); opacity:0.5; } 40% { transform:scale(1.1); opacity:1; } }
      `}</style>
    </div>
  );
}
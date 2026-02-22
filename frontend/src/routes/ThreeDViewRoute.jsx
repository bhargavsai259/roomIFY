import React, { useState, useRef } from 'react';
import ThreeDView from '../ThreeDView';

// ─── Furniture catalog ────────────────────────────────────────────────────────
const CATALOG = {
  'Living Room': {
    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', emoji: '🛋',
    items: [
      { name: 'sofa', label: 'Sofa', icon: '🛋' },
      { name: 'couch', label: 'Couch', icon: '🪑' },
      { name: 'coffee_table', label: 'Coffee Table', icon: '🟫' },
      { name: 'tablelamp', label: 'Table Lamp', icon: '💡' },
      { name: 'teapoy', label: 'Teapoy', icon: '🪵' },
      { name: 'piano', label: 'Piano', icon: '🎹' },
      { name: 'airconditioner', label: 'AC Unit', icon: '❄️' },
      { name: 'mirror', label: 'Mirror', icon: '🪞' },
      { name: 'mirror_table', label: 'Mirror Table', icon: '🪞' },
      { name: 'pottedplant', label: 'Plant', icon: '🪴' },
      { name: 'pottedplant2', label: 'Plant 2', icon: '🌿' },
      { name: 'maple_tree', label: 'Maple Tree', icon: '🌳' },
      { name: 'shelf', label: 'Shelf', icon: '📚' },
      { name: 'modern_furniture_shelf', label: 'Modern Shelf', icon: '🗂' },
      { name: 'closet_wooden', label: 'Closet', icon: '🚪' },
      { name: 'ceiling_fan', label: 'Ceiling Fan', icon: '💨' },
      { name: 'tvdish', label: 'TV Dish', icon: '📡' },
      { name: 'tv_bench', label: 'TV Bench', icon: '📺' },
      { name: 'table_furniture', label: 'Table', icon: '🟤' },
      { name: 'switchboard', label: 'Switchboard', icon: '🔌' },
      { name: 'bed_side_table_with_lamp', label: 'Bedside Lamp', icon: '🕯' },
    ],
  },
  'Bedroom': {
    color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', emoji: '🛏',
    items: [{ name: 'bed', label: 'Bed', icon: '🛏' }],
  },
  'Office': {
    color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', emoji: '🖥',
    items: [{ name: 'woodendesk', label: 'Wooden Desk', icon: '🖥' }],
  },
  'Kitchen': {
    color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', emoji: '🍳',
    items: [
      { name: 'smart_fridge', label: 'Smart Fridge', icon: '🧊' },
      { name: 'stove_sink_dish_drainer_kitchen_hood', label: 'Kitchen Set', icon: '🍳' },
    ],
  },
  'Dining': {
    color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', emoji: '🍽',
    items: [
      { name: 'chair', label: 'Chair', icon: '🪑' },
      { name: 'simple_dining_table', label: 'Dining Table', icon: '🍽' },
    ],
  },
  'Bathroom': {
    color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', emoji: '🛁',
    items: [
      { name: 'bathingtub', label: 'Bathtub', icon: '🛁' },
      { name: 'washing_machine', label: 'Washer', icon: '🫧' },
    ],
  },
  'Fitness': {
    color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', emoji: '💪',
    items: [
      { name: 'treadmill', label: 'Treadmill', icon: '🏃' },
      { name: 'bicycle', label: 'Bicycle', icon: '🚲' },
    ],
  },
  'Garage': {
    color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', emoji: '🚗',
    items: [
      { name: 'car', label: 'Car', icon: '🚗' },
      { name: 'motorcycle', label: 'Motorcycle', icon: '🏍' },
      { name: 'carcae', label: 'Car Cage', icon: '🏎' },
    ],
  },
  'Decor': {
    color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', emoji: '🪟',
    items: [{ name: 'window', label: 'Window', icon: '🪟' }],
  },
};

const ALL_ITEMS = Object.values(CATALOG).flatMap((c) => c.items);

// ─── Draggable furniture card ─────────────────────────────────────────────────
function FurnitureCard({ item, cat, onDragStart }) {
  const [hov, setHov] = useState(false);
  const [drag, setDrag] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.name);
        e.dataTransfer.effectAllowed = 'copy';
        setDrag(true);
        onDragStart?.(item.name);
      }}
      onDragEnd={() => { setDrag(false); onDragStart?.(null); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`Drag "${item.label}" into the 3D view`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, padding: '8px 4px', borderRadius: 10,
        cursor: drag ? 'grabbing' : 'grab',
        background: drag ? cat.color : hov ? cat.bg : '#fff',
        border: `1.5px solid ${drag || hov ? cat.border : '#e5e7eb'}`,
        transition: 'all 0.15s', opacity: drag ? 0.6 : 1,
        boxShadow: hov && !drag ? `0 2px 10px ${cat.color}25` : '0 1px 3px rgba(0,0,0,0.04)',
        userSelect: 'none',
        transform: hov && !drag ? 'translateY(-1px) scale(1.02)' : 'none',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
      <span style={{
        fontSize: 9.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
        color: drag ? '#fff' : hov ? cat.color : '#6b7280',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', width: '100%', paddingInline: 2,
      }}>
        {item.label}
      </span>
    </div>
  );
}

// ─── Route component ──────────────────────────────────────────────────────────
export default function ThreeDViewRoute() {
  const [rooms, setRooms] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upload');
  const [search, setSearch] = useState('');
  const [draggedModel, setDraggedModel] = useState(null);
  const [openCats, setOpenCats] = useState(
    Object.fromEntries(Object.keys(CATALOG).map((k) => [k, k === 'Living Room']))
  );
  const threeDRef = useRef(null);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setSelectedFiles(Array.from(files));
    setError(''); setLoading(true);
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
    try {
      const api = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${api}/upload`, { method: 'POST', body: fd });
      if (!res.ok) { setError('Upload failed (HTTP ' + res.status + ')'); setRooms([]); return; }
      const data = await res.json();
      const loaded = Array.isArray(data) ? data : [];
      setRooms(loaded);
      if (loaded.length > 0) setTab('furniture');
    } catch (err) {
      setError('Network error: ' + err.message); setRooms([]);
    } finally { setLoading(false); }
  };

  const filteredCatalog = search.trim()
    ? { 'Results': { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', emoji: '🔍', items: ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()) || i.name.includes(search.toLowerCase())) } }
    : CATALOG;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div style={{ width: 276, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0, background: '#fafafa' }}>
          {[{ id: 'upload', icon: '📂', label: 'Upload' }, { id: 'furniture', icon: '🛋', label: 'Palette' }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '11px 6px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              borderBottom: tab === t.id ? '2.5px solid #6366f1' : '2.5px solid transparent',
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#6366f1' : '#9ca3af', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* UPLOAD TAB */}
        {tab === 'upload' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: '0 0 3px' }}>Upload Room Photos</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>AI will analyze and generate a 3D layout automatically.</p>
            </div>

            <label style={{ cursor: 'pointer', display: 'block' }}>
              <div style={{ border: '2px dashed #d1d5db', borderRadius: 12, padding: '18px 10px', textAlign: 'center', background: '#f9fafb' }}>
                <div style={{ fontSize: 26, marginBottom: 5 }}>📂</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>Click to choose files</p>
                <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>JPEG, PNG — multiple allowed</p>
              </div>
              <input type="file" multiple accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </label>

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#eff6ff', borderRadius: 9, border: '1px solid #bfdbfe' }}>
                <svg style={{ animation: 'rspin 0.8s linear infinite', width: 13, height: 13, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="3" opacity="0.25" />
                  <path fill="#3b82f6" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>Generating 3D layout…</span>
              </div>
            )}

            {error && (
              <div style={{ padding: '9px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9 }}>
                <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, margin: 0 }}>⚠️ {error}</p>
              </div>
            )}

            {rooms.length > 0 && (
              <div style={{ padding: '9px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 9 }}>
                <p style={{ fontSize: 12, color: '#059669', fontWeight: 700, margin: '0 0 2px' }}>✅ {rooms.length} room{rooms.length !== 1 ? 's' : ''} loaded!</p>
                <button onClick={() => setTab('furniture')} style={{ fontSize: 11, color: '#047857', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                  → Switch to Palette to add furniture
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
              {['Drag furniture from Palette tab to add items', 'Click & drag in 3D to move furniture', 'Double-click to rotate furniture', 'Scroll to zoom in/out'].map((t, i) => (
                <p key={i} style={{ fontSize: 10.5, color: '#78350f', margin: '0 0 2px', paddingLeft: 8, borderLeft: '2px solid #fbbf24' }}>• {t}</p>
              ))}
            </div>
          </div>
        )}

        {/* FURNITURE PALETTE TAB */}
        {tab === 'furniture' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Search */}
            <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af', pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text" placeholder="Search furniture…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 28px 7px 26px', fontSize: 11, border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13 }}>✕</button>}
              </div>
            </div>

            {/* No rooms warning */}
            {rooms.length === 0 && (
              <div style={{ margin: '10px', padding: '10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 9 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>⚠️ Upload a room first</p>
                <p style={{ fontSize: 10.5, color: '#78350f', margin: '0 0 6px', lineHeight: 1.4 }}>You need a loaded room before dropping furniture.</p>
                <button onClick={() => setTab('upload')} style={{ padding: '4px 10px', fontSize: 10.5, fontWeight: 700, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>→ Upload</button>
              </div>
            )}

            {/* Drop hint */}
            <div style={{ margin: '8px 10px 0', padding: '7px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: '#4338ca', fontWeight: 600, margin: 0 }}>
                🖱 <b>Drag</b> any item → <b>drop</b> onto the 3D view
              </p>
            </div>

            {/* Catalog */}
            <div style={{ padding: '8px 10px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {Object.entries(filteredCatalog).map(([catName, cat]) => {
                const isOpen = search ? true : openCats[catName];
                return (
                  <div key={catName} style={{ border: `1.5px solid ${cat.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Category header */}
                    <button
                      onClick={() => !search && setOpenCats((p) => ({ ...p, [catName]: !p[catName] }))}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: cat.bg, border: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 13 }}>{cat.emoji}</span>
                        {catName}
                        <span style={{ fontSize: 9.5, color: `${cat.color}aa`, fontWeight: 700, background: `${cat.color}18`, padding: '1px 5px', borderRadius: 8 }}>{cat.items.length}</span>
                      </span>
                      {!search && <span style={{ fontSize: 10, color: cat.color, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>}
                    </button>

                    {isOpen && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, padding: '7px', background: '#fff' }}>
                        {cat.items.map((item) => (
                          <FurnitureCard key={item.name} item={item} cat={cat} onDragStart={setDraggedModel} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 3D VIEWER ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: '#eff1f5' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: 0 }}>3D Room View</h2>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
              {rooms.length > 0 ? `${rooms.length} room${rooms.length !== 1 ? 's' : ''} — drag from palette to add furniture` : 'Upload room images to generate 3D view'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {rooms.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 9px', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                Live
              </span>
            )}
            {draggedModel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '4px 9px', borderRadius: 20 }}>
                📦 {draggedModel.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Viewer */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {rooms.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 14, opacity: 0.18 }}>🧊</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#9ca3af', margin: '0 0 8px' }}>No rooms loaded yet</h3>
              <p style={{ fontSize: 13, color: '#d1d5db', maxWidth: 280, lineHeight: 1.6, margin: '0 0 18px' }}>
                Upload one or more room photos and AI will generate an interactive 3D layout.
              </p>
              <button onClick={() => setTab('upload')} style={{ padding: '10px 22px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
      `}</style>
    </div>
  );
}